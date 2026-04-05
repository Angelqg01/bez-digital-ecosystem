const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key';
const db = require('../database/inMemoryDB');



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
        const decoded = jwt.verify(token, JWT_SECRET);

        // If the token explicitly carries a role, honor it
        if (decoded.role === 'admin' || decoded.role === 'dev' || decoded.role === 'human_resources' || decoded.role === 'super_admin') {
            if (!decoded.twoFactorVerified) {
                return res.status(403).json({ error: 'Acceso denegado. 2FA requerido para administradores.' });
            }
            req.admin = decoded;
            return next();
        }

        const User = require('../models/user.model');
        const user = await User.findById(decoded.id);
        if (user) {
            const isAdmin = user.roles && (
                user.roles.includes('ADMIN') || 
                user.roles.includes('DEVELOPER') ||
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
            if (user.role === 'admin' || user.role === 'HUMAN_RESOURCES' || (Array.isArray(user.roles) && user.roles.some(r => ['ADMIN', 'DEVELOPER', 'HUMAN_RESOURCES'].includes(r)))) {
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
