/**
 * Autenticación por token OAuth 2.1 (ES256) del MCP público para los endpoints de pago.
 *
 * El token lo emitió el propio backend tras el consentimiento de la persona; aquí se verifica
 * firma, emisor, audiencia y caducidad, se exige el scope concreto y se carga a la persona
 * dueña del token. Un token con otro algoritmo (el JWT de sesión es HS256) no entra por esta vía.
 */
const jwt = require('jsonwebtoken');
const tokens = require('../services/oauth/tokens');

const BEARER = /^Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)$/i;

/** ¿La cabecera trae un JWT firmado con ES256? (decide la vía de autenticación, no la valida) */
function isOAuthBearer(req) {
    const m = BEARER.exec(req.headers.authorization || '');
    if (!m) return false;
    const decoded = jwt.decode(m[1], { complete: true });
    return !!decoded && decoded.header && decoded.header.alg === 'ES256';
}

function requireOAuthScope(scope) {
    return async (req, res, next) => {
        const m = BEARER.exec(req.headers.authorization || '');
        if (!m) return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Falta el token de acceso.' });
        let claims;
        try {
            claims = tokens.verificarAccessToken(m[1]);
        } catch (_) {
            return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Token no válido o caducado.' });
        }
        if (!String(claims.scope || '').split(/\s+/).includes(scope)) {
            return res.status(403).json({ success: false, code: 'INSUFFICIENT_SCOPE', message: `El token no incluye el permiso ${scope}.` });
        }
        try {
            const user = await require('../models/pg/User').findById(claims.sub);
            if (!user) return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Cuenta no encontrada.' });
            req.user = user;
            req.authVia = 'oauth';
            return next();
        } catch (error) {
            console.error('[oauthBearer]', error.message);
            return res.status(503).json({ success: false, code: 'AUTH_UNAVAILABLE', message: 'Autorización no disponible temporalmente.' });
        }
    };
}

module.exports = { isOAuthBearer, requireOAuthScope };
