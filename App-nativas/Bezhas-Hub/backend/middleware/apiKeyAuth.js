const crypto = require('crypto');

// Simulación de API Keys (en producción usar DB)
// Formato: bzh_{tier}_{random_hash}
const validApiKeys = new Map([
    ['bzh_dev_1234567890abcdef', {
        tier: 'free',
        rateLimit: 100,
        name: 'Demo Developer Key',
        created: new Date().toISOString()
    }],
    ['bzh_pro_abcdef1234567890', {
        tier: 'pro',
        rateLimit: 1000,
        name: 'Pro Developer Key',
        created: new Date().toISOString()
    }],
    ['bzh_ent_fedcba0987654321', {
        tier: 'enterprise',
        rateLimit: null, // Sin límite
        name: 'Enterprise Key',
        created: new Date().toISOString()
    }]
]);

/**
 * Middleware de autenticación por API Key
 * Valida que la request incluya una API Key válida en el header X-API-Key
 */
const apiKeyAuth = (req, res, next) => {
    const apiKey = req.header('X-API-Key');

    if (!apiKey) {
        return res.status(401).json({
            error: 'Missing API Key',
            message: 'Obtén tu API Key en: http://localhost:3000/developers/register',
            code: 401
        });
    }

    const keyData = validApiKeys.get(apiKey);

    if (!keyData) {
        return res.status(403).json({
            error: 'Invalid API Key',
            message: 'La API Key proporcionada no es válida o ha sido revocada',
            code: 403
        });
    }

    // Adjuntar datos del tier al request para otros middlewares
    req.apiKey = apiKey;
    req.apiTier = keyData.tier;
    req.rateLimit = keyData.rateLimit;
    req.apiKeyName = keyData.name;

    next();
};

/**
 * Middleware opcional de autenticación
 * Permite acceso sin API Key pero adjunta datos si está presente
 */
const optionalApiKeyAuth = (req, res, next) => {
    const apiKey = req.header('X-API-Key');

    if (apiKey) {
        const keyData = validApiKeys.get(apiKey);
        if (keyData) {
            req.apiKey = apiKey;
            req.apiTier = keyData.tier;
            req.rateLimit = keyData.rateLimit;
            req.apiKeyName = keyData.name;
        }
    }

    next();
};

/**
 * Middleware para ocultar rutas internas en Swagger
 * Bloquea acceso a endpoints administrativos o internos desde la documentación pública
 */
const hideInternalRoutes = (req, res, next) => {
    const path = req.path.toLowerCase();

    // Lista de paths bloqueados en documentación pública
    const blockedPaths = [
        '/admin',
        '/internal',
        '/aegis',
        '/automation',
        '/ai/train',
        '/ai/model'
    ];

    // Si la ruta contiene algún path bloqueado, retornar 404
    if (blockedPaths.some(blocked => path.includes(blocked))) {
        return res.status(404).json({
            error: 'Endpoint not found',
            message: 'Este endpoint no está disponible en la API pública'
        });
    }

    next();
};

/**
 * Genera una nueva API Key (para implementación futura de portal de desarrolladores)
 */
const generateApiKey = (tier = 'free') => {
    const randomHash = crypto.randomBytes(8).toString('hex');
    return `bzh_${tier}_${randomHash}`;
};

/**
 * Valida el tier de la API Key
 */
const requireTier = (requiredTier) => {
    const tierLevels = { free: 1, pro: 2, enterprise: 3 };

    return (req, res, next) => {
        const userTier = req.apiTier || 'free';

        if (tierLevels[userTier] < tierLevels[requiredTier]) {
            return res.status(403).json({
                error: 'Insufficient API Tier',
                message: `Este endpoint requiere tier ${requiredTier} o superior. Tu tier actual: ${userTier}`,
                upgrade: 'https://bezhas.com/pricing'
            });
        }

        next();
    };
};

/**
 * Obtener todas las API Keys (solo para admin)
 */
const getAllApiKeys = () => {
    const keys = [];
    validApiKeys.forEach((data, key) => {
        keys.push({
            key: key.substring(0, 20) + '...',
            tier: data.tier,
            name: data.name,
            created: data.created
        });
    });
    return keys;
};

/**
 * Agregar una nueva API Key (solo para admin)
 */
const addApiKey = (key, data) => {
    validApiKeys.set(key, {
        tier: data.tier || 'free',
        rateLimit: data.rateLimit || 100,
        name: data.name || 'Unnamed Key',
        created: new Date().toISOString()
    });
};

module.exports = {
    apiKeyAuth,
    optionalApiKeyAuth,
    hideInternalRoutes,
    generateApiKey,
    requireTier,
    getAllApiKeys,
    addApiKey
};
