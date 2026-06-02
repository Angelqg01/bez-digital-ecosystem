const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const verifyAdminToken = (req, res, next) => {
    const expectedToken = process.env.ADMIN_TOKEN;
    if (!expectedToken) {
        logger.error('CRITICAL: ADMIN_TOKEN is not set in the environment variables.');
        return res.status(500).json({ error: 'Server configuration error: Admin token not set.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or malformed token.' });
    }

    const providedToken = authHeader.slice(7);
    if (providedToken !== expectedToken) {
        return res.status(403).json({ error: 'Forbidden: Invalid admin token.' });
    }

    next();
};

module.exports = { verifyAdminToken };
