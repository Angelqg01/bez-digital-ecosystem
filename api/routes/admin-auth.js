/**
 * routes/admin-auth.js — Secure Admin Authentication
 * 
 * Security features:
 * - Server-side bcrypt password verification (never client-side)
 * - Wallet signature verification (SIWE pattern)
 * - Strict rate limiting (5 attempts / 15 min per IP)
 * - Nonce-based replay protection
 * - JWT in HttpOnly cookie
 * - Full audit trail of every login attempt
 * - Admin wallet & credentials from env vars (never hardcoded in frontend)
 */
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { checkRateLimit } = require('../cache/redis');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-secret' : null);
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET is required in production');
}

// ── Admin config from env (NEVER hardcode in frontend) ──
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'YoelAdmin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
    || '$2a$12$SGO2W1xmmM9j77i6rB.AWOMAfDhBLuXk/S2PZEZBO9Pyt9OhYqn26'; // dev fallback
const ADMIN_WALLET = (process.env.ADMIN_WALLET || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3').toLowerCase();

// ── Nonce store (in-memory for dev, use Redis in prod) ──
const nonceStore = new Map();

// Cleanup expired nonces every 10 min
const nonceCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of nonceStore) {
        if (now - val.created > 10 * 60 * 1000) nonceStore.delete(key);
    }
}, 10 * 60 * 1000);
nonceCleanupTimer.unref?.();

// ── Strict rate limiter for admin ──
async function adminRateLimit(req, res, next) {
    const key = `admin-auth:${req.ip}`;
    const result = await checkRateLimit(key, 5, 15 * 60); // 5 attempts per 15 min
    if (!result.allowed) {
        await logAttempt(req, 'RATE_LIMITED', false);
        return res.status(429).json({
            error: 'Demasiados intentos. Intente de nuevo en 15 minutos.',
            retryAfter: 15 * 60,
        });
    }
    next();
}

// ── Audit logger ──
async function logAttempt(req, method, success, details = {}) {
    try {
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, output_data, processing_ms)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'admin-auth',
                `ADMIN_LOGIN_${method}`,
                success ? 'info' : 'warning',
                JSON.stringify({
                    ip: req.ip,
                    userAgent: req.headers['user-agent']?.substring(0, 200),
                    timestamp: new Date().toISOString(),
                    ...details,
                }),
                JSON.stringify({ success }),
                0,
            ]
        );
    } catch (_) {
        // Non-blocking audit
    }
}

// ── GET /nonce — Generate nonce for SIWE ──
router.get('/nonce', (req, res) => {
    const nonce = crypto.randomBytes(32).toString('hex');
    const id = crypto.randomBytes(16).toString('hex');
    nonceStore.set(id, { nonce, created: Date.now(), used: false });

    // Auto-expire in 5 min
    setTimeout(() => nonceStore.delete(id), 5 * 60 * 1000);

    res.json({ nonceId: id, nonce });
});

// ── POST /login — Credential-based admin login ──
router.post('/login', adminRateLimit, [
    body('username').trim().isLength({ min: 1, max: 50 }).escape(),
    body('password').isLength({ min: 1, max: 128 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    const { username, password } = req.body;

    // Constant-time comparison for username
    const usernameMatch = crypto.timingSafeEqual(
        Buffer.from(username.padEnd(50, '\0')),
        Buffer.from(ADMIN_USERNAME.padEnd(50, '\0'))
    );

    // Always verify password (even if username wrong) to prevent timing attacks
    const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (!usernameMatch || !passwordMatch) {
        await logAttempt(req, 'CREDENTIALS', false, { username });
        return res.status(401).json({ error: 'Credenciales de administrador inválidas' });
    }

    // Generate JWT
    const token = jwt.sign(
        {
            role: 'SUPER_ADMIN',
            wallet: ADMIN_WALLET,
            method: 'credentials',
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: '2h', issuer: 'bezhas-admin-auth' }
    );

    await logAttempt(req, 'CREDENTIALS', true, { username });

    // Set HttpOnly secure cookie
    res.cookie('bezhas_admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 2 * 60 * 60 * 1000, // 2h
    });

    res.json({
        success: true,
        role: 'SUPER_ADMIN',
        expiresIn: 7200,
    });
});

// ── POST /wallet-login — Wallet signature admin login ──
router.post('/wallet-login', adminRateLimit, [
    body('address').isEthereumAddress(),
    body('signature').isLength({ min: 1 }),
    body('message').isLength({ min: 1, max: 1000 }),
    body('nonceId').isLength({ min: 1, max: 64 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Datos inválidos' });
    }

    const { address, signature, message, nonceId } = req.body;

    // Verify nonce hasn't been used (replay protection)
    const storedNonce = nonceStore.get(nonceId);
    if (!storedNonce || storedNonce.used) {
        await logAttempt(req, 'WALLET', false, { reason: 'invalid_nonce', address });
        return res.status(401).json({ error: 'Nonce inválido o expirado' });
    }

    // Verify nonce is in the signed message
    if (!message.includes(storedNonce.nonce)) {
        await logAttempt(req, 'WALLET', false, { reason: 'nonce_mismatch', address });
        return res.status(401).json({ error: 'Nonce no coincide con el mensaje firmado' });
    }

    // Mark nonce as used (one-time use)
    storedNonce.used = true;

    // Verify the cryptographic signature
    let recoveredAddress;
    try {
        recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (err) {
        await logAttempt(req, 'WALLET', false, { reason: 'invalid_signature', address });
        return res.status(401).json({ error: 'Firma inválida' });
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        await logAttempt(req, 'WALLET', false, { reason: 'address_mismatch', address });
        return res.status(401).json({ error: 'La firma no corresponde a la dirección' });
    }

    // Verify this is the admin wallet
    if (address.toLowerCase() !== ADMIN_WALLET) {
        await logAttempt(req, 'WALLET', false, { reason: 'not_admin_wallet', address });
        return res.status(403).json({ error: 'Wallet no autorizada para acceso administrativo' });
    }

    // Generate JWT
    const token = jwt.sign(
        {
            role: 'SUPER_ADMIN',
            wallet: ADMIN_WALLET,
            method: 'wallet',
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: '2h', issuer: 'bezhas-admin-auth' }
    );

    await logAttempt(req, 'WALLET', true, { address });

    // Set HttpOnly secure cookie
    res.cookie('bezhas_admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 2 * 60 * 60 * 1000,
    });

    res.json({
        success: true,
        role: 'SUPER_ADMIN',
        expiresIn: 7200,
    });
});

// ── POST /verify — Check if current admin session is valid ──
router.post('/verify', (req, res) => {
    const token = req.cookies?.bezhas_admin_token
        || req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ valid: false });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET, { issuer: 'bezhas-admin-auth' });
        if (decoded.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ valid: false });
        }
        res.json({ valid: true, role: decoded.role, method: decoded.method });
    } catch (err) {
        return res.status(401).json({ valid: false });
    }
});

// ── POST /logout — Clear admin session ──
router.post('/logout', (req, res) => {
    res.clearCookie('bezhas_admin_token', { path: '/' });
    res.json({ success: true });
});

module.exports = router;
