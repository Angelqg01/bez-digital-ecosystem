const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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
 *   2. Wallet address via x-wallet-address header (Web3 native)
 * 
 * This allows Web3 users to use the developer console without
 * needing to go through the full JWT login flow.
 */
const requireWalletOrJwt = async (req, res, next) => {
    // 1. Try JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');

            // Try to load user from DB if available
            if (mongoose.connection.readyState === 1) {
                const User = require('../models/user.model');
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
            // JWT failed, try wallet auth below
        }
    }

    // 2. Try wallet address header (Web3 auth)
    const walletAddress = req.headers['x-wallet-address'];
    if (walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        // If DB is available, try to find the user
        if (mongoose.connection.readyState === 1) {
            try {
                const User = require('../models/user.model');
                const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
                if (user) {
                    req.user = user;
                    return next();
                }
            } catch (err) {
                // DB lookup failed, use wallet-only context
            }
        }

        // Fallback: create minimal user context from wallet address
        req.user = {
            _id: walletAddress.toLowerCase(),
            id: walletAddress.toLowerCase(),
            walletAddress: walletAddress.toLowerCase(),
            role: 'USER'
        };
        return next();
    }

    // 3. No auth provided
    return res.status(401).json({
        success: false,
        error: 'Authentication required. Connect your wallet or provide a Bearer token.'
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
