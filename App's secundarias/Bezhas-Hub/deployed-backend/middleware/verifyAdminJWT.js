const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key';
const db = require('../database/inMemoryDB');

// Load authorized admin wallets from environment (same source as admin.auth.routes)
const SUPER_ADMIN_WALLETS = (process.env.SUPER_ADMIN_WALLETS || '')
    .split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
    .split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
const TREASURY_WALLET = (process.env.TREASURY_WALLET || '').trim().toLowerCase();
const COMMUNITY_WALLET = (process.env.COMMUNITY_WALLET || '').trim().toLowerCase();

// Startup diagnostic: log loaded wallet counts (never log actual addresses)
if (SUPER_ADMIN_WALLETS.length === 0) {
    console.warn('⚠️ verifyAdminJWT: SUPER_ADMIN_WALLETS env is EMPTY — wallet-based admin auth will fail');
} else {
    console.log(`✅ verifyAdminJWT: Loaded ${SUPER_ADMIN_WALLETS.length} super-admin wallet(s), ${ADMIN_WALLETS.length} admin wallet(s)`);
}

/**
 * Resolve admin role from wallet address (env-configured wallets)
 */
function getWalletAdminRole(address) {
    const normalized = address.toLowerCase();
    if (SUPER_ADMIN_WALLETS.includes(normalized)) return { role: 'SUPER_ADMIN', id: normalized };
    if (TREASURY_WALLET && normalized === TREASURY_WALLET) return { role: 'TREASURY', id: normalized };
    if (COMMUNITY_WALLET && normalized === COMMUNITY_WALLET) return { role: 'COMMUNITY', id: normalized };
    if (ADMIN_WALLETS.includes(normalized)) return { role: 'ADMIN', id: normalized };
    return null;
}

function verifyAdminJWT(req, res, next) {
    // ⚠️ SECURITY: Dev bypass ONLY in development with explicit flag AND warning
    if (process.env.NODE_ENV === 'development' && process.env.AUTH_BYPASS_ENABLED === 'true') {
        console.warn('⚠️ WARNING: Admin authentication bypass is ENABLED. This should NEVER be used in production!');
        req.admin = { id: 'dev-admin', role: 'admin', isDev: true };
        return next();
    }

    // ── AUTH METHOD 1: Wallet-based authentication via x-wallet-address header ──
    const walletAddress = req.headers['x-wallet-address'];
    if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        const walletRole = getWalletAdminRole(walletAddress);
        if (walletRole) {
            req.admin = { id: walletRole.id, role: walletRole.role, isWallet: true };
            return next();
        }
        // Wallet provided but not in admin list → fall through to JWT check
    }

    // ── AUTH METHOD 2: JWT / Bearer token ──
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token o wallet de admin requerido.' });
    }

    // DEMO MODE: Allow specific demo token
    if (token === 'demo-admin-token-123') {
        req.admin = { id: 'demo-admin', role: 'admin', isDemo: true };
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // If the token explicitly carries a role, honor it
        if (decoded.role === 'admin' || decoded.role === 'dev') {
            req.admin = decoded;
            return next();
        }

        // Otherwise, resolve user by id and check stored role
        if (decoded.id && db.users.has(decoded.id)) {
            const user = db.users.get(decoded.id);
            if (user.role === 'admin' || (Array.isArray(user.roles) && user.roles.includes('ADMIN'))) {
                req.admin = { id: decoded.id, role: 'admin' };
                return next();
            }
        }

        return res.status(403).json({ error: 'Acceso denegado. No eres admin.' });
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido.' });
    }
}

module.exports = verifyAdminJWT;
