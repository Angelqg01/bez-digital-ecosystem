/**
 * ============================================================================
 * HTTPS ENFORCEMENT MIDDLEWARE
 * ============================================================================
 * 
 * Fuerza todas las conexiones a HTTPS en producción
 */

/**
 * Middleware para forzar HTTPS
 */
function httpsEnforcement(req, res, next) {
    // Solo en producción
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // Verificar si la request es segura
    const isSecure = req.secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        req.headers['x-forwarded-ssl'] === 'on';

    if (!isSecure) {
        // Redirigir a HTTPS
        const httpsUrl = `https://${req.hostname}${req.url}`;
        return res.redirect(301, httpsUrl);
    }

    // Headers de seguridad adicionales
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    next();
}

/**
 * Middleware para headers de seguridad adicionales
 */
function securityHeaders(req, res, next) {
    // Prevenir clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevenir MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // XSS Protection (para browsers antiguos)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy
    res.setHeader('Permissions-Policy',
        'geolocation=(), microphone=(), camera=(), payment=()'
    );

    // Content Security Policy (básico)
    if (process.env.ENABLE_CSP === 'true') {
        res.setHeader('Content-Security-Policy',
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' wss: ws:; " +
            "font-src 'self' data:; " +
            "object-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'"
        );
    }

    next();
}

/**
 * Verificar que la request viene de un origen permitido
 */
function validateOrigin(req, res, next) {
    // Use ALLOWED_ORIGINS (same as CORS middleware in server.js)
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.get('origin') || req.get('referer');

    // Permitir requests sin origin (como Postman o curl)
    if (!origin) {
        return next();
    }

    // En desarrollo, permitir todos los orígenes
    if (process.env.NODE_ENV !== 'production') {
        return next();
    }

    // Verificar si el origin está permitido
    const isAllowed = allowedOrigins.some(allowed =>
        origin.startsWith(allowed) || origin.includes(allowed.replace(/^https?:\/\//, ''))
    );

    if (!isAllowed) {
        console.error(`[CORS] Origin not allowed: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
        return res.status(403).json({
            error: 'Origin not allowed',
            message: 'Your origin is not in the allowed list'
        });
    }

    next();
}

module.exports = {
    httpsEnforcement,
    securityHeaders,
    validateOrigin
};
