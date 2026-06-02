/**
 * Security middleware — RBAC, audit logging, per-enterprise rate limiting.
 */
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { checkRateLimit } = require('../cache/redis');
const { JWT_SECRET, AUTH_BYPASS } = require('../config/secrets');
const { consumeNonce, extractNonce } = require('../utils/walletNonce');

// ── JWT authentication ──
function authenticateToken(req, res, next) {
    // Auth bypass: ONLY when explicitly opted in (AUTH_BYPASS=true, non-prod).
    // Impossible in production — see config/secrets.js.
    if (AUTH_BYPASS) {
        req.user = { address: '0xDev0000000000000000000000000000000000001', userId: 1, role: 'admin' };
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// ── Wallet signature verification ──
async function verifyWalletSignature(req, res, next) {
    try {
        const { address, signature, message } = req.body;
        if (!address || !signature || !message) {
            return res.status(400).json({ error: 'Address, signature, and message required' });
        }

        // 1) Cryptographic check: signature was produced by `address`.
        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // 2) Anti-replay: the signed message must carry a server-issued, single-use
        //    nonce that we now atomically consume. Without this, any captured
        //    signature could be replayed forever. Skipped only under explicit dev bypass.
        if (!AUTH_BYPASS) {
            const presentedNonce = extractNonce(message);
            if (!presentedNonce) {
                return res.status(401).json({ error: 'Login message missing nonce. Request one at GET /auth/nonce.' });
            }
            const storedNonce = await consumeNonce(address);
            if (!storedNonce || storedNonce !== presentedNonce) {
                return res.status(401).json({ error: 'Invalid, expired, or already-used nonce. Request a new one at GET /auth/nonce.' });
            }
        }

        req.walletAddress = address;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Signature verification failed' });
    }
}

// ── Role-based access control ──
function requireRole(...roles) {
    return async (req, res, next) => {
        if (!req.user || !req.user.address) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { rows } = await query(
            'SELECT role FROM users WHERE wallet_address = $1',
            [req.user.address]
        );

        if (rows.length === 0) {
            return res.status(403).json({ error: 'User not found' });
        }

        const userRole = rows[0].role;
        if (!roles.includes(userRole)) {
            return res.status(403).json({ error: `Role '${userRole}' not authorized. Required: ${roles.join(', ')}` });
        }

        req.user.role = userRole;
        next();
    };
}

// ── Per-enterprise Redis rate limiting ──
function enterpriseRateLimit(limit = 100, windowSec = 60) {
    return async (req, res, next) => {
        const key = req.user?.address || req.ip;
        const result = await checkRateLimit(`rl:${key}`, limit, windowSec);
        if (!result.allowed) {
            return res.status(429).json({ error: 'Rate limit exceeded', remaining: result.remaining });
        }
        next();
    };
}

// Reads (GET) of these path segments are security-sensitive and must be audited too.
const SENSITIVE_READ_PATTERNS = [
    /\/wallet/i, /\/treasury/i, /\/admin/i, /\/keys?/i, /\/secrets?/i,
    /\/validators?/i, /\/transactions?/i, /\/vault/i, /\/config/i,
];

// ── Audit logger ──
async function auditLog(req, res, next) {
    const start = Date.now();

    res.on('finish', async () => {
        try {
            const duration = Date.now() - start;
            const address = req.user?.address || 'anonymous';
            const isSensitiveRead = req.method === 'GET'
                && SENSITIVE_READ_PATTERNS.some((re) => re.test(req.originalUrl));
            if (req.method !== 'GET' || isSensitiveRead) {
                await query(
                    `INSERT INTO ai_logs (module, action, severity, input_data, output_data, processing_ms)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        'audit',
                        `${req.method} ${req.originalUrl}`,
                        res.statusCode >= 400 ? 'warning' : 'info',
                        JSON.stringify({ address, ip: req.ip }),
                        JSON.stringify({ status: res.statusCode }),
                        duration,
                    ]
                );
            }
        } catch (err) {
            // Non-blocking audit — don't crash the request
        }
    });
    next();
}

module.exports = {
    authenticateToken,
    verifyWalletSignature,
    requireRole,
    enterpriseRateLimit,
    auditLog,
};
