const jwt = require('jsonwebtoken');
const db = require('../database/inMemoryDB');

function getJwtSecret() {
    if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production');
    }
    return process.env.JWT_SECRET || 'bezhas-local-dev-only-secret';
}

const CORE_ADMIN_ROLES = new Set([
    'admin',
    'dev',
    'developer',
    'devops',
    'security',
    'human_resources',
    'super_admin',
    'ADMIN',
    'DEVELOPER',
    'DEVOPS',
    'SECURITY',
    'HUMAN_RESOURCES',
    'SUPER_ADMIN',
]);



async function verifyAdminJWT(req, res, next) {
    // ⚠️ SECURITY: Dev bypass ONLY in development with explicit flag AND warning
    if (process.env.NODE_ENV === 'development' && process.env.AUTH_BYPASS_ENABLED === 'true') {
        console.warn('⚠️ WARNING: Admin authentication bypass is ENABLED. This should NEVER be used in production!');
        req.admin = { id: 'dev-admin', role: 'admin', isDev: true };
        return next();
    }

    // ── AUTH METHOD: JWT / Bearer token ──
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token o wallet de admin requerido.' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());

        // If the token explicitly carries a role, honor it
        if (CORE_ADMIN_ROLES.has(decoded.role)) {
            if (!decoded.twoFactorVerified && !decoded.bootstrap) {
                return res.status(403).json({ error: 'Acceso denegado. 2FA requerido para administradores.' });
            }
            req.admin = decoded;
            return next();
        }

        const User = require('../models/pg/User');
        const user = await User.findById(decoded.id);
        if (user) {
            const isAdmin = user.roles && (
                user.roles.includes('ADMIN') || 
                user.roles.includes('DEVELOPER') ||
                user.roles.includes('DEVOPS') ||
                user.roles.includes('SECURITY') ||
                user.roles.includes('HUMAN_RESOURCES') ||
                user.roles.includes('SUPER_ADMIN')
            );
            
            if (isAdmin) {
                if (!decoded.twoFactorVerified) {
                    return res.status(403).json({ error: 'Acceso denegado. 2FA requerido para administradores.' });
                }
                req.admin = { id: decoded.id, role: 'admin' };
                return next();
            }
        }
        
        // Also fallback to inMemoryDB if necessary
        if (decoded.id && db.users.has(decoded.id)) {
            const user = db.users.get(decoded.id);
            if (user.role === 'admin' || user.role === 'HUMAN_RESOURCES' || (Array.isArray(user.roles) && user.roles.some(r => ['ADMIN', 'DEVELOPER', 'DEVOPS', 'SECURITY', 'HUMAN_RESOURCES', 'SUPER_ADMIN'].includes(r)))) {
                if (!decoded.twoFactorVerified) {
                    return res.status(403).json({ error: 'Acceso denegado. 2FA requerido para administradores.' });
                }
                req.admin = { id: decoded.id, role: 'admin' };
                return next();
            }
        }

        return res.status(403).json({ error: 'Acceso denegado. No eres admin.' });
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
    }
}

module.exports = verifyAdminJWT;
