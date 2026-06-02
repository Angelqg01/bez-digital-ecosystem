const ApiLog = require('../models/ApiLog.model');
const ApiKey = require('../models/ApiKey.model');

/**
 * Middleware para logging automático de peticiones al SDK
 * Se debe aplicar DESPUÉS del middleware de autenticación de API Key
 */
const apiLogger = async (req, res, next) => {
    // Guardar el timestamp de inicio
    const startTime = Date.now();

    // Guardar el método send original
    const originalSend = res.send;

    // Variable para capturar el tamaño de la respuesta
    let responseSize = 0;

    // Sobrescribir res.send para capturar el tamaño
    res.send = function (data) {
        responseSize = Buffer.byteLength(JSON.stringify(data || ''), 'utf8');
        originalSend.call(this, data);
    };

    // Cuando la respuesta termine, guardar el log
    res.on('finish', async () => {
        try {
            // Solo loguear si hay una API Key presente
            if (!req.apiKey) return;

            const responseTime = Date.now() - startTime;

            // Crear el log
            await ApiLog.create({
                apiKey: req.apiKey._id,
                user: req.apiKey.user,
                request: {
                    method: req.method,
                    endpoint: req.originalUrl || req.url,
                    permission: req.requiredPermission, // Set by apiKeyAuth middleware
                    userAgent: req.get('user-agent'),
                    bodySize: req.get('content-length') || 0
                },
                response: {
                    statusCode: res.statusCode,
                    responseTime,
                    responseSize,
                    errorMessage: res.statusCode >= 400 ? res.statusMessage : undefined
                },
                client: {
                    ipAddress: req.ip || req.connection.remoteAddress,
                    country: req.get('cf-ipcountry'), // Cloudflare header
                    fingerprint: req.get('x-client-fingerprint')
                },
                timestamp: new Date()
            });

            // Actualizar métricas en el modelo de API Key (async, no bloquea respuesta)
            req.apiKey.incrementUsage().catch(err => {
                console.error('Error updating API Key usage:', err);
            });

        } catch (error) {
            // No bloquear la respuesta por errores de logging
            console.error('Error logging API request:', error);
        }
    });

    next();
};

/**
 * Middleware de rate limiting basado en logs
 * Verifica si el cliente ha excedido su límite de peticiones
 */
const rateLimitCheck = async (req, res, next) => {
    try {
        if (!req.apiKey) return next();

        const now = Date.now();
        const oneMinuteAgo = new Date(now - 60 * 1000);
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

        // Contar requests en el último minuto
        const requestsLastMinute = await ApiLog.countDocuments({
            apiKey: req.apiKey._id,
            timestamp: { $gte: oneMinuteAgo }
        });

        // Contar requests hoy
        const requestsToday = await ApiLog.countDocuments({
            apiKey: req.apiKey._id,
            timestamp: { $gte: oneDayAgo }
        });

        // Verificar límites
        const limitCheck = req.apiKey.checkRateLimit(requestsLastMinute, requestsToday);

        if (!limitCheck.allowed) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                reason: limitCheck.reason,
                retryAfter: 60 // segundos
            });
        }

        next();
    } catch (error) {
        console.error('Error checking rate limit:', error);
        // En caso de error, permitir la petición (fail-open)
        next();
    }
};

module.exports = {
    apiLogger,
    rateLimitCheck
};
