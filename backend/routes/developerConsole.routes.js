const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwtSecret');
const mongoose = require('mongoose');
const {
    createApiKey,
    getApiKeys,
    getApiKeyById,
    updateApiKey,
    deleteApiKey,
    rotateApiKey,
    getApiKeyUsageStats,
    testApiKey,
    addWebhook,
    deleteWebhook,
    getWebhooks,
    getUsageStats
} = require('../controllers/developerConsole.controller');

/**
 * Flexible auth middleware for Developer Console.
 * Supports both:
 *   1. JWT Bearer token (traditional login)
 *   2. Wallet sign-in (SIWE): produces the same JWT
 * 
 * This allows Web3 users to use the developer console without
 * needing to go through the full JWT login flow.
 */
const requireWalletOrJwt = async (req, res, next) => {
    // 1. Try JWT first. La verificación se ejecuta siempre: un token ausente o inválido
    //    simplemente no autentica y se pasa a la autenticación por wallet.
    const authHeader = req.headers.authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    let decoded = null;
    try {
        decoded = jwt.verify(bearer, getJwtSecret());
    } catch (err) {
        decoded = null;
    }

    if (decoded) {
        try {
            // Try to load user from DB if available
            if (mongoose.connection.readyState === 1) {
                const User = require('../models/pg/User');
                const user = await User.findById(decoded.id).select('-password');
                if (user) {
                    req.user = user;
                    return next();
                }
            }

            // Fallback: use decoded JWT data directly
            req.user = { _id: decoded.id, id: decoded.id };
            return next();
        } catch (err) {
            // user lookup failed, try wallet auth below
        }
    }

    // 2. No auth provided. Los usuarios Web3 inician sesión con su wallet (SIWE, /api/wallet-auth)
    //    y reciben el mismo JWT; la cabecera `x-wallet-address` NO autentica (la declara el cliente).
    return res.status(401).json({
        success: false,
        error: 'Authentication required. Sign in (email or wallet signature) and send the Bearer token.'
    });
};

/**
 * @route   GET /api/developer/usage-stats/:address
 * @desc    Obtener estadísticas agregadas de uso por wallet address
 * @access  Public
 */
router.get('/usage-stats/:address', getUsageStats);

// All routes below require authentication (JWT or wallet address)
router.use(requireWalletOrJwt);

/**
 * @route   POST /api/developer/keys
 * @desc    Crear nueva API Key
 * @access  Private
 */
router.post('/keys', createApiKey);

/**
 * @route   GET /api/developer/keys
 * @desc    Obtener todas las API Keys del usuario
 * @access  Private
 */
router.get('/keys', getApiKeys);

/**
 * @route   GET /api/developer/keys/:id
 * @desc    Obtener detalles de una API Key específica
 * @access  Private
 */
router.get('/keys/:id', getApiKeyById);

/**
 * @route   PUT /api/developer/keys/:id
 * @desc    Actualizar API Key (permisos, nombre, etc)
 * @access  Private
 */
router.put('/keys/:id', updateApiKey);

/**
 * @route   DELETE /api/developer/keys/:id
 * @desc    Eliminar/Revocar API Key
 * @access  Private
 */
router.delete('/keys/:id', deleteApiKey);

/**
 * @route   POST /api/developer/keys/:id/rotate
 * @desc    Rotar API Key (generar nueva clave)
 * @access  Private
 */
router.post('/keys/:id/rotate', rotateApiKey);

/**
 * @route   GET /api/developer/keys/:id/usage
 * @desc    Obtener estadísticas de uso de una API Key
 * @access  Private
 */
router.get('/keys/:id/usage', getApiKeyUsageStats);

/**
 * @route   POST /api/developer/keys/:id/test
 * @desc    Probar API Key (hacer request de prueba)
 * @access  Private
 */
router.post('/keys/:id/test', testApiKey);

/**
 * @route   GET /api/developer/keys/:id/webhooks
 * @desc    Obtener webhooks de una API Key
 * @access  Private
 */
router.get('/keys/:id/webhooks', getWebhooks);

/**
 * @route   POST /api/developer/keys/:id/webhooks
 * @desc    Agregar webhook a una API Key
 * @access  Private
 */
router.post('/keys/:id/webhooks', addWebhook);

/**
 * @route   DELETE /api/developer/keys/:keyId/webhooks/:webhookId
 * @desc    Eliminar webhook de una API Key
 * @access  Private
 */
router.delete('/keys/:keyId/webhooks/:webhookId', deleteWebhook);

module.exports = router;
