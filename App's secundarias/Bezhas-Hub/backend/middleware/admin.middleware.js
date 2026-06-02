const pino = require('pino');
const jwt = require('jsonwebtoken');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'DEVOPS', 'SECURITY', 'HUMAN_RESOURCES']);

const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or malformed token.' });
    }

    const providedToken = authHeader.slice(7);

    if (process.env.ADMIN_TOKEN && providedToken === process.env.ADMIN_TOKEN) {
        req.admin = { id: 'legacy-admin-token', role: 'ADMIN', legacy: true };
        return next();
    }

    if (!process.env.JWT_SECRET) {
        logger.error('CRITICAL: JWT_SECRET is not set for admin JWT verification.');
        return res.status(500).json({ error: 'Server configuration error: JWT secret not set.' });
    }

    try {
        const decoded = jwt.verify(providedToken, process.env.JWT_SECRET);
        const role = String(decoded.role || '').toUpperCase();
        const roles = Array.isArray(decoded.roles) ? decoded.roles.map((item) => String(item).toUpperCase()) : [];
        const isAdmin = ADMIN_ROLES.has(role) || roles.some((item) => ADMIN_ROLES.has(item));
        if (!isAdmin) {
            return res.status(403).json({ error: 'Forbidden: Admin role required.' });
        }
        if (!decoded.twoFactorVerified && !decoded.bootstrap) {
            return res.status(403).json({ error: 'Forbidden: 2FA required for admin access.' });
        }
        req.admin = decoded;
        return next();
    } catch {
        return res.status(403).json({ error: 'Forbidden: Invalid admin token.' });
    }
};

module.exports = { verifyAdminToken };
