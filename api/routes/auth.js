/**
 * routes/auth.js — Authentication routes (wallet-based login).
 */
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { verifyWalletSignature, authenticateToken } = require('../middleware/security');
const { JWT_SECRET, JWT_ACCESS_TTL } = require('../config/secrets');
const { issueNonce, NONCE_TTL_SECONDS } = require('../utils/walletNonce');
const walletService = require('../services/walletService');
const { generateBezhasId } = require('../lib/bezhasId');

const apiPQC = require('../lib/apiPQC');

const router = Router();
const DUMMY_HASH = bcrypt.hashSync('bezhas-dummy-password', 12);

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
        const bezhasId = generateBezhasId();
        const { rows } = await query(
            `INSERT INTO users (wallet_address, primary_wallet_address, bezhas_id, last_login) VALUES ($1, $1, $2, NOW())
             RETURNING id, wallet_address, username, role, avatar_url, bezhas_id, created_at`,
            [address, bezhasId]
        );
        user = rows[0];
    } else {
        user = findUser.rows[0];
        if (!user.bezhas_id) {
            const bezhasId = generateBezhasId();
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
        { expiresIn: JWT_ACCESS_TTL }
    );
    const pqcSig = apiPQC.signToken(token);

    res.json({ success: true, token, pqc: { ...pqcSig, alg: 'ML-DSA-65' }, user });
});

// ── FIAT-first registration: creates a managed wallet inside the profile ──
// Se registra también como /register-email: es el nombre que usa el chat y el frontend del Hub.
const registerChecks = [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 chars'),
    body('username').optional().isLength({ min: 3, max: 40 }),
];
router.post(['/fiat/register', '/register-email'], registerChecks, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const email = String(req.body.email).trim().toLowerCase();
        const passwordHash = await bcrypt.hash(req.body.password, 12);
        const bezhasId = generateBezhasId();

        // Temporary wallet_address is replaced by ensureFiatSafeWalletForUser after the user row exists.
        const provisionalAddress = `0x${require('crypto').createHash('sha256').update(`fiat:${email}:${Date.now()}`).digest('hex').slice(0, 40)}`;
        const { rows } = await query(
            `INSERT INTO users (wallet_address, primary_wallet_address, username, email, password_hash,
                                auth_type, custody_mode, bezhas_id, last_login)
             VALUES ($1, $1, $2, $3, $4, 'fiat', 'managed', $5, NOW())
             RETURNING id, wallet_address, username, role, avatar_url, email, auth_type, custody_mode, bezhas_id, created_at`,
            [provisionalAddress.toLowerCase(), req.body.username || null, email, passwordHash, bezhasId]
        );

        // La wallet gestionada es de mejor esfuerzo: si la cadena o la bóveda de claves no responden, la cuenta
        // se crea igualmente (si no, quedaba una fila huérfana que impedía volver a registrarse) y la wallet
        // se completa después con /auth/safe-wallet/ensure o en el siguiente login.
        const safeWallet = await walletService.ensureFiatSafeWalletForUser(rows[0].id, {
            dailyLimit: req.body.dailyLimit,
            guardian: req.body.guardian,
        }).catch((e) => {
            require('../utils/logger').warn({ userId: rows[0].id, error: e.message }, 'Safe wallet pendiente tras el registro');
            return null;
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
            { expiresIn: JWT_ACCESS_TTL }
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
// Se registra también como /login-email (mismo contrato que el Hub).
const loginChecks = [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 1 }).withMessage('Password required'),
];
router.post(['/fiat/login', '/login-email'], loginChecks, async (req, res) => {
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
            // Misma duración que un login real: sin esto, el tiempo de respuesta delata qué emails existen.
            await bcrypt.compare(req.body.password, DUMMY_HASH);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const ok = await bcrypt.compare(req.body.password, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        let user = { ...rows[0] };
        delete user.password_hash;

        if (!user.bezhas_id) {
            const bezhasId = generateBezhasId();
            await query('UPDATE users SET bezhas_id = $1, last_login = NOW() WHERE id = $2', [bezhasId, user.id]);
            user.bezhas_id = bezhasId;
        } else {
            await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        }

        // Mejor esfuerzo: un login no puede depender de que la cadena esté arriba.
        const safeWallet = await walletService.ensureFiatSafeWalletForUser(user.id).catch((e) => {
            require('../utils/logger').warn({ userId: user.id, error: e.message }, 'Safe wallet no disponible en el login');
            return null;
        });
        const token  = jwt.sign(
            { address: safeWallet?.ownerAddress || user.primary_wallet_address || user.wallet_address, userId: user.id, role: user.role, auth_type: user.auth_type, bezhas_id: user.bezhas_id },
            JWT_SECRET,
            { expiresIn: JWT_ACCESS_TTL }
        );
        const pqcSig = apiPQC.signToken(token);

        res.json({ success: true, token, pqc: { ...pqcSig, alg: 'ML-DSA-65' }, user: { ...user, primary_wallet_address: safeWallet?.ownerAddress || user.primary_wallet_address }, safeWallet });
    } catch (error) {
        res.status(500).json({ error: 'FIAT login failed', details: error.message });
    }
});

// ── Recuperación de contraseña ──
// Código de un solo uso enviado por email: 10 caracteres sin ambiguos (≈ 50 bits), caduca a los
// 30 min y se invalida tras 5 intentos fallidos. Sólo se guarda su hash. Las respuestas de
// «olvidé» son SIEMPRE iguales exista o no la cuenta, para no enumerar usuarios.
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { sendMail } = require('../services/mailer');
const RESET_TTL_MIN = 30;
const RESET_MAX_ATTEMPTS = 5;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const hashCode = (code) => crypto.createHash('sha256').update(String(code).toUpperCase()).digest('hex');
const newCode = () => Array.from(crypto.randomBytes(10), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
const resetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.PASSWORD_RESET_RATE_MAX, 10) || 10,
    message: { error: 'Demasiados intentos. Espera unos minutos.', code: 'RESET_RATE_LIMIT' },
    standardHeaders: true,
    legacyHeaders: false,
});
const FORGOT_REPLY = { success: true, message: 'Si el email tiene una cuenta con contraseña, te hemos enviado un código para restablecerla.' };

router.post('/forgot-password', resetLimiter, [
    body('email').isEmail().withMessage('Valid email required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const email = String(req.body.email).trim().toLowerCase();
        const { rows } = await query('SELECT id FROM users WHERE LOWER(email) = $1 AND password_hash IS NOT NULL LIMIT 1', [email]);
        if (rows.length > 0) {
            const userId = rows[0].id;
            // Un solo código vivo por usuario: el anterior deja de valer.
            await query('UPDATE password_reset_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
            const code = newCode();
            await query(
                `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
                 VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
                [userId, hashCode(code), String(RESET_TTL_MIN)]
            );
            await sendMail({
                to: email,
                subject: 'Tu código para restablecer la contraseña de BeZhas',
                text: `Tu código es: ${code}\n\nCaduca en ${RESET_TTL_MIN} minutos y sólo sirve una vez. `
                    + 'Si no lo has pedido tú, ignora este mensaje: tu contraseña no ha cambiado.',
            }).catch(() => { /* el fallo de envío no debe revelar si la cuenta existe */ });
        }
    } catch (error) {
        // También aquí la respuesta es la misma: un error interno no puede delatar la cuenta.
        require('../utils/logger').error({ error: error.message }, 'forgot-password falló');
    }
    res.json(FORGOT_REPLY);
});

router.post('/reset-password', resetLimiter, [
    body('email').isEmail().withMessage('Valid email required'),
    body('code').isString().isLength({ min: 6, max: 20 }).withMessage('Code required'),
    body('password').isLength({ min: 8, max: 200 }).withMessage('Password must be at least 8 chars'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const INVALID = { error: 'Código inválido o caducado', code: 'RESET_INVALID' };
    try {
        const email = String(req.body.email).trim().toLowerCase();
        const { rows } = await query(
            `SELECT c.id, c.code_hash, c.attempts, u.id AS user_id
               FROM password_reset_codes c JOIN users u ON u.id = c.user_id
              WHERE LOWER(u.email) = $1 AND c.used_at IS NULL AND c.expires_at > NOW()
              ORDER BY c.created_at DESC LIMIT 1`,
            [email]
        );
        if (rows.length === 0) return res.status(400).json(INVALID);
        const row = rows[0];
        if (row.attempts >= RESET_MAX_ATTEMPTS) return res.status(400).json(INVALID);

        const a = Buffer.from(hashCode(req.body.code), 'hex');
        const b = Buffer.from(row.code_hash, 'hex');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            await query('UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
            return res.status(400).json(INVALID);
        }
        const passwordHash = await bcrypt.hash(req.body.password, 12);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
        await query('UPDATE password_reset_codes SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
        res.json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo restablecer la contraseña' });
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
// El payload se reconstruye desde la BD, no se copia del token entrante: así el
// renovado incluye `bezhas_id` y `auth_type` (antes se perdían, y una sesión
// larga acababa con un token sin identidad canónica, invisible para las
// SubApps) y además recoge cambios de rol o de identidad hechos entretanto, en
// vez de arrastrar los del momento del login.
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT id, wallet_address, primary_wallet_address, role, auth_type, bezhas_id
             FROM users WHERE id = $1 LIMIT 1`,
            [req.user.userId]
        );
        if (rows.length === 0) return res.status(401).json({ error: 'User no longer exists' });

        const user = rows[0];

        // Una fila antigua puede no tener BeZhas_ID todavía; emitirlo aquí evita
        // que el usuario se quede sin identidad canónica hasta su próximo login.
        if (!user.bezhas_id) {
            user.bezhas_id = generateBezhasId();
            await query('UPDATE users SET bezhas_id = $1 WHERE id = $2', [user.bezhas_id, user.id]);
        }

        const token = jwt.sign(
            {
                address: user.primary_wallet_address || user.wallet_address,
                userId: user.id,
                role: user.role,
                auth_type: user.auth_type,
                bezhas_id: user.bezhas_id,
            },
            JWT_SECRET,
            { expiresIn: JWT_ACCESS_TTL }
        );
        const pqcSig = apiPQC.signToken(token);
        res.json({ success: true, token, pqc: { ...pqcSig, alg: 'ML-DSA-65' } });
    } catch (error) {
        res.status(500).json({ error: 'Token refresh failed', details: error.message });
    }
});

// ── PQC public key (sin autenticación — es información pública) ──
router.get('/pqc-pubkey', (_req, res) => {
    res.json({ success: true, ...apiPQC.getInfo() });
});

module.exports = router;
