/**
 * gateway-auth.js — Authentication middleware for the BeZhas Gateway.
 * 
 * Supports two auth modes:
 *  1. API Key auth (server-to-server between registered apps)
 *  2. Cross-app JWT (user sessions shared across BeZhas apps via SSO)
 * 
 * Each registered app has an API key and a list of allowed scopes.
 */
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const logger = require('pino')({ level: 'info', name: 'gateway-auth' });

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-only-secret' : null);
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET is required for gateway auth.');
}

/**
 * Authenticate a registered app via x-api-key header.
 * Populates req.app with { id, name, scopes, tier }.
 */
async function authenticateApp(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Missing x-api-key header' });
    }

    try {
        const { rows } = await query(
            `SELECT id, app_name, scopes, tier, is_active 
             FROM app_registry 
             WHERE api_key_hash = encode(digest($1, 'sha256'), 'hex')`,
            [apiKey]
        );

        if (rows.length === 0) {
            logger.warn({ ip: req.ip }, 'Invalid gateway API key attempt');
            return res.status(401).json({ error: 'Invalid API key' });
        }

        const app = rows[0];
        if (!app.is_active) {
            return res.status(403).json({ error: 'App is deactivated' });
        }

        req.registeredApp = {
            id: app.id,
            name: app.app_name,
            scopes: app.scopes || [],
            tier: app.tier,
        };
        next();
    } catch (error) {
        logger.error({ error: error.message }, 'Gateway app auth failed');
        return res.status(500).json({ error: 'Authentication service error' });
    }
}

/**
 * Verify that the registered app has the required scope.
 * Must be called after authenticateApp.
 */
function requireScope(...scopes) {
    return (req, res, next) => {
        // API-key auth: check app scopes
        if (req.registeredApp) {
            const appScopes = req.registeredApp.scopes;
            if (appScopes.includes('admin')) return next();
            const hasScope = scopes.some(s => appScopes.includes(s));
            if (!hasScope) {
                return res.status(403).json({
                    error: `Insufficient scope. Required: ${scopes.join(' | ')}`,
                });
            }
            return next();
        }

        // JWT-only auth: derive scopes from user role
        if (req.user) {
            if (req.user.role === 'admin') return next();

            // Regular users can access consumer scopes
            const userScopes = ['wallet', 'staking', 'farming', 'governance', 'bridge', 'treasury', 'token', 'contracts'];
            const hasScope = scopes.some(s => userScopes.includes(s));
            if (!hasScope) {
                return res.status(403).json({
                    error: `Insufficient scope. Required: ${scopes.join(' | ')}`,
                });
            }
            return next();
        }

        return res.status(401).json({ error: 'Authentication required' });
    };
}

/**
 * Authenticate a cross-app user JWT (SSO token).
 * The token must contain: address, userId, role, app_origin.
 * Populates req.user with the decoded claims.
 */
function authenticateSSOToken(req, res, next) {
    // DEV MODE bypass
    if (process.env.NODE_ENV !== 'production') {
        req.user = {
            address: '0xDev0000000000000000000000000000000000001',
            userId: 1,
            role: 'admin',
            app_origin: 'dev',
        };
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'SSO access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired SSO token' });
        }
        req.user = decoded;
        next();
    });
}

/**
 * Combined middleware: accepts either API key OR JWT.
 * API key → populates req.registeredApp
 * JWT → populates req.user
 * At least one must be present.
 */
function authenticateGateway(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];

    if (apiKey) {
        return authenticateApp(req, res, () => {
            // If JWT is also present, decode it too (for user context)
            if (authHeader) {
                const token = authHeader.split(' ')[1];
                if (token) {
                    try {
                        req.user = jwt.verify(token, JWT_SECRET);
                    } catch (_) {
                        // API key is enough; JWT is optional bonus context
                    }
                }
            }
            next();
        });
    }

    if (authHeader) {
        return authenticateSSOToken(req, res, next);
    }

    return res.status(401).json({ error: 'Authentication required (API key or JWT)' });
}

module.exports = {
    authenticateApp,
    requireScope,
    authenticateSSOToken,
    authenticateGateway,
};
