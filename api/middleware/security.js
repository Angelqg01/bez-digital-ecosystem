/**
 * Security middleware — RBAC, audit logging, per-enterprise rate limiting.
 */
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const { checkRateLimit } = require('../cache/redis');
const { JWT_SECRET, DEV_MODE } = require('../config/secrets');

// ── JWT authentication ──
function authenticateToken(req, res, next) {
    // DEV MODE: bypass auth and inject a dev user
    if (DEV_MODE) {
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

        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ error: 'Invalid signature' });
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

// ── Audit logger ──
async function auditLog(req, res, next) {
    const start = Date.now();

    res.on('finish', async () => {
        try {
            const duration = Date.now() - start;
            const address = req.user?.address || 'anonymous';
            if (req.method !== 'GET') {
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
