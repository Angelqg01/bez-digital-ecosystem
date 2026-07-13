/**
 * routes/auth.js — Authentication routes (wallet-based login).
 */
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { verifyWalletSignature, authenticateToken } = require('../middleware/security');
const { JWT_SECRET } = require('../config/secrets');
const { issueNonce, NONCE_TTL_SECONDS } = require('../utils/walletNonce');
const walletService = require('../services/walletService');

const apiPQC = require('../lib/apiPQC');

const router = Router();

// ── Nonce challenge (anti-replay) ──
// Client flow: GET /auth/nonce?address=0x.. → sign returned `message` → POST /auth/login.
router.get('/nonce', [
    require('express-validator').query('address').isEthereumAddress().withMessage('Invalid Ethereum address'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const { nonce, message } = await issueNonce(req.query.address);
        res.json({ success: true, nonce, message, expiresInSeconds: NONCE_TTL_SECONDS });
    } catch (error) {
        res.status(500).json({ error: 'Failed to issue nonce' });
    }
});

// ── Login (wallet signature) ──
router.post('/login', [
    body('address').isEthereumAddress().withMessage('Invalid Ethereum address'),
    body('signature').isLength({ min: 1 }).withMessage('Signature required'),
    body('message').isLength({ min: 1 }).withMessage('Message required'),
], verifyWalletSignature, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Check if user exists to ensure BeZhas_ID generation
    const address = req.walletAddress.toLowerCase();
    const findUser = await query('SELECT * FROM users WHERE LOWER(wallet_address) = $1 LIMIT 1', [address]);
    let user;

    if (findUser.rows.length === 0) {
        const bezhasId = 'BEZ-' + require('crypto').randomBytes(4).toString('hex').toUpperCase() + '-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();
        const { rows } = await query(
            `INSERT INTO users (wallet_address, primary_wallet_address, bezhas_id, last_login) VALUES ($1, $1, $2, NOW())
             RETURNING id, wallet_address, username, role, avatar_url, bezhas_id, created_at`,
            [address, bezhasId]
        );
        user = rows[0];
    } else {
        user = findUser.rows[0];
        if (!user.bezhas_id) {
            const bezhasId = 'BEZ-' + require('crypto').randomBytes(4).toString('hex').toUpperCase() + '-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();
            const { rows } = await query(
                `UPDATE users SET bezhas_id = $1, last_login = NOW(),
                                  primary_wallet_address = COALESCE(primary_wallet_address, wallet_address)
                 WHERE id = $2
                 RETURNING id, wallet_address, username, role, avatar_url, bezhas_id, created_at`,
                [bezhasId, user.id]
            );
            user = rows[0];
        } else {
            const { rows } = await query(
                `UPDATE users SET last_login = NOW(),
                                  primary_wallet_address = COALESCE(primary_wallet_address, wallet_address)
                 WHERE id = $1
                 RETURNING id, wallet_address, username, role, avatar_url, bezhas_id, created_at`,
                [user.id]
            );
            user = rows[0];
        }
    }

    const token  = jwt.sign(
        { address: user.wallet_address, userId: user.id, role: user.role, bezhas_id: user.bezhas_id },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    const pqcSig = apiPQC.signToken(token);

    res.json({ success: true, token, pqc: { ...pqcSig, alg: 'ML-DSA-65' }, user });
});

// ── FIAT-first registration: creates a managed wallet inside the profile ──
router.post('/fiat/register', [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
    body('username').optional().isLength({ min: 3, max: 40 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const email = String(req.body.email).trim().toLowerCase();
        const passwordHash = await bcrypt.hash(req.body.password, 12);
        const bezhasId = 'BEZ-' + require('crypto').randomBytes(4).toString('hex').toUpperCase() + '-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();

        // Temporary wallet_address is replaced by ensureFiatSafeWalletForUser after the user row exists.
        const provisionalAddress = `0x${require('crypto').createHash('sha256').update(`fiat:${email}:${Date.now()}`).digest('hex').slice(0, 40)}`;
        const { rows } = await query(
            `INSERT INTO users (wallet_address, primary_wallet_address, username, email, password_hash,
                                auth_type, custody_mode, bezhas_id, last_login)
             VALUES ($1, $1, $2, $3, $4, 'fiat', 'managed', $5, NOW())
             RETURNING id, wallet_address, username, role, avatar_url, email, auth_type, custody_mode, bezhas_id, created_at`,
            [provisionalAddress.toLowerCase(), req.body.username || null, email, passwordHash, bezhasId]
        );

        const safeWallet = await walletService.ensureFiatSafeWalletForUser(rows[0].id, {
            dailyLimit: req.body.dailyLimit,
            guardian: req.body.guardian,
        });

        const refreshed = await query(
            `SELECT id, wallet_address, primary_wallet_address, primary_smart_wallet_address,
                    username, role, avatar_url, email, auth_type, custody_mode, bezhas_id, created_at
             FROM users WHERE id = $1`,
            [rows[0].id]
        );
        const user = refreshed.rows[0];
        const token  = jwt.sign(
            { address: user.primary_wallet_address || user.wallet_address, userId: user.id, role: user.role, auth_type: user.auth_type, bezhas_id: user.bezhas_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        const pqcSig = apiPQC.signToken(token);

        res.status(201).json({ success: true, token, pqc: { ...pqcSig, alg: 'ML-DSA-65' }, user, safeWallet });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Email or wallet already registered' });
        }
        res.status(500).json({ error: 'FIAT registration failed', details: error.message });
    }
});

// ── FIAT-first login: email/password, returns the same wallet identity to all SubApps ──
router.post('/fiat/login', [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 1 }).withMessage('Password required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const email = String(req.body.email).trim().toLowerCase();
        const { rows } = await query(
            `SELECT id, wallet_address, primary_wallet_address, primary_smart_wallet_address,
                    username, role, avatar_url, email, auth_type, custody_mode, password_hash, bezhas_id, created_at
             FROM users WHERE LOWER(email) = $1 LIMIT 1`,
            [email]
        );
        if (rows.length === 0 || !rows[0].password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const ok = await bcrypt.compare(req.body.password, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        let user = { ...rows[0] };
        delete user.password_hash;

        if (!user.bezhas_id) {
            const bezhasId = 'BEZ-' + require('crypto').randomBytes(4).toString('hex').toUpperCase() + '-' + require('crypto').randomBytes(4).toString('hex').toUpperCase();
            await query('UPDATE users SET bezhas_id = $1, last_login = NOW() WHERE id = $2', [bezhasId, user.id]);
            user.bezhas_id = bezhasId;
        } else {
            await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        }

        const safeWallet = await walletService.ensureFiatSafeWalletForUser(user.id);
        const token  = jwt.sign(
            { address: safeWallet.ownerAddress || user.primary_wallet_address || user.wallet_address, userId: user.id, role: user.role, auth_type: user.auth_type, bezhas_id: user.bezhas_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        const pqcSig = apiPQC.signToken(token);

        res.json({ success: true, token, pqc: { ...pqcSig, alg: 'ML-DSA-65' }, user: { ...user, primary_wallet_address: safeWallet.ownerAddress }, safeWallet });
    } catch (error) {
        res.status(500).json({ error: 'FIAT login failed', details: error.message });
    }
});

// ── Current profile wallet bootstrap for apps that only have a JWT ──
router.post('/safe-wallet/ensure', authenticateToken, async (req, res) => {
    try {
        const safeWallet = await walletService.ensureFiatSafeWalletForUser(req.user.userId, req.body || {});
        res.json({ success: true, safeWallet });
    } catch (error) {
        res.status(500).json({ error: 'Failed to ensure safe wallet', details: error.message });
    }
});

// ── Refresh token ──
router.post('/refresh', authenticateToken, (req, res) => {
    const token  = jwt.sign(
        { address: req.user.address, userId: req.user.userId, role: req.user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
    const pqcSig = apiPQC.signToken(token);
    res.json({ success: true, token, pqc: { ...pqcSig, alg: 'ML-DSA-65' } });
});

// ── PQC public key (sin autenticación — es información pública) ──
router.get('/pqc-pubkey', (_req, res) => {
    res.json({ success: true, ...apiPQC.getInfo() });
});

module.exports = router;
