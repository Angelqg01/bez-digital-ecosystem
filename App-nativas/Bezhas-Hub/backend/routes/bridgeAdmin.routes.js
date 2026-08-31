/**
 * Bridge API Keys Management Routes
 * Admin routes para gestionar las API Keys del Bridge
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { verifyAdminToken } = require('../middleware/admin.middleware');
const BridgeApiKey = require('../models/BridgeApiKey.model');

/**
 * GET /api/v1/bridge/admin/keys
 * Listar todas las API Keys
 */
router.get('/keys', verifyAdminToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, platform, active } = req.query;

        const query = {};
        if (platform) query.platform = platform;
        if (active !== undefined) query.active = active === 'true';

        const keys = await BridgeApiKey.find(query)
            .populate('userId', 'username email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await BridgeApiKey.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                keys: keys.map(key => ({
                    _id: key._id,
                    name: key.name,
                    key: key.key.substring(0, 10) + '...' + key.key.slice(-4), // Ocultar mayoría de la key
                    platform: key.platform,
                    permissions: key.permissions,
                    active: key.active,
                    lastUsedAt: key.lastUsedAt,
                    stats: key.stats,
                    expiresAt: key.expiresAt,
                    user: key.userId,
                    createdAt: key.createdAt
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Bridge Admin: List keys error');
        res.status(500).json({
            success: false,
            error: 'Failed to list API keys',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/bridge/admin/keys
 * Crear nueva API Key
 */
router.post('/keys', verifyAdminToken, async (req, res) => {
    try {
        const {
            userId,
            name,
            description,
            platform,
            permissions = {},
            rateLimit = {},
            expiresAt = null,
            ipWhitelist = []
        } = req.body;

        if (!userId || !name || !platform) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'userId, name, and platform are required'
            });
        }

        // Generar nueva API key
        const key = BridgeApiKey.generateKey();

        const apiKey = await BridgeApiKey.create({
            key,
            name,
            description,
            userId,
            platform,
            permissions: {
                inventory: permissions.inventory || false,
                logistics: permissions.logistics || false,
                payments: permissions.payments || false,
                orders: permissions.orders || false
            },
            rateLimit: {
                requestsPerMinute: rateLimit.requestsPerMinute || 100,
                requestsPerDay: rateLimit.requestsPerDay || 10000
            },
            expiresAt,
            ipWhitelist,
            active: true
        });

        logger.info({
            apiKeyId: apiKey._id,
            userId,
            platform,
            createdBy: req.admin._id
        }, 'Bridge Admin: API key created');

        res.status(201).json({
            success: true,
            message: 'API key created successfully',
            data: {
                _id: apiKey._id,
                key: apiKey.key, // SOLO mostrar completa al crear
                name: apiKey.name,
                platform: apiKey.platform,
                permissions: apiKey.permissions,
                rateLimit: apiKey.rateLimit,
                expiresAt: apiKey.expiresAt,
                createdAt: apiKey.createdAt
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Bridge Admin: Create key error');
        res.status(500).json({
            success: false,
            error: 'Failed to create API key',
            message: error.message
        });
    }
});

/**
 * PATCH /api/v1/bridge/admin/keys/:id
 * Actualizar API Key (activar/desactivar, cambiar permisos, etc.)
 */
router.patch('/keys/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Campos permitidos para actualizar
        const allowedUpdates = ['name', 'description', 'active', 'permissions', 'rateLimit', 'expiresAt', 'ipWhitelist'];
        const requestedUpdates = Object.keys(updates);
        const isValidOperation = requestedUpdates.every(update => allowedUpdates.includes(update));

        if (!isValidOperation) {
            return res.status(400).json({
                success: false,
                error: 'Invalid updates',
                message: `Only these fields can be updated: ${allowedUpdates.join(', ')}`
            });
        }

        const apiKey = await BridgeApiKey.findById(id);

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        // Aplicar actualizaciones
        requestedUpdates.forEach(update => {
            apiKey[update] = updates[update];
        });

        await apiKey.save();

        logger.info({
            apiKeyId: apiKey._id,
            updates: requestedUpdates,
            updatedBy: req.admin._id
        }, 'Bridge Admin: API key updated');

        res.status(200).json({
            success: true,
            message: 'API key updated successfully',
            data: {
                _id: apiKey._id,
                name: apiKey.name,
                platform: apiKey.platform,
                permissions: apiKey.permissions,
                active: apiKey.active,
                expiresAt: apiKey.expiresAt,
                updatedAt: apiKey.updatedAt
            }
        });
    } catch (error) {
        logger.error({ err: error, keyId: req.params.id }, 'Bridge Admin: Update key error');
        res.status(500).json({
            success: false,
            error: 'Failed to update API key',
            message: error.message
        });
    }
});

/**
 * DELETE /api/v1/bridge/admin/keys/:id
 * Eliminar API Key
 */
router.delete('/keys/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;

        const apiKey = await BridgeApiKey.findByIdAndDelete(id);

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        logger.info({
            apiKeyId: apiKey._id,
            platform: apiKey.platform,
            deletedBy: req.admin._id
        }, 'Bridge Admin: API key deleted');

        res.status(200).json({
            success: true,
            message: 'API key deleted successfully'
        });
    } catch (error) {
        logger.error({ err: error, keyId: req.params.id }, 'Bridge Admin: Delete key error');
        res.status(500).json({
            success: false,
            error: 'Failed to delete API key',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/bridge/admin/keys/:id/stats
 * Obtener estadísticas detalladas de una API Key
 */
router.get('/keys/:id/stats', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;

        const apiKey = await BridgeApiKey.findById(id).populate('userId', 'username email');

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                _id: apiKey._id,
                name: apiKey.name,
                platform: apiKey.platform,
                user: apiKey.userId,
                stats: {
                    ...apiKey.stats.toObject(),
                    successRate: apiKey.stats.totalRequests > 0
                        ? ((apiKey.stats.successfulRequests / apiKey.stats.totalRequests) * 100).toFixed(2) + '%'
                        : '0%'
                },
                lastUsedAt: apiKey.lastUsedAt,
                createdAt: apiKey.createdAt,
                active: apiKey.active,
                isExpired: apiKey.isExpired()
            }
        });
    } catch (error) {
        logger.error({ err: error, keyId: req.params.id }, 'Bridge Admin: Get key stats error');
        res.status(500).json({
            success: false,
            error: 'Failed to get API key stats',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/bridge/admin/keys/:id/regenerate
 * Regenerar API Key (crear nueva clave manteniendo config)
 */
router.post('/keys/:id/regenerate', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;

        const apiKey = await BridgeApiKey.findById(id);

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'API key not found'
            });
        }

        // Generar nueva key
        const newKey = BridgeApiKey.generateKey();
        apiKey.key = newKey;

        // Resetear estadísticas
        apiKey.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            lastError: null
        };
        apiKey.lastUsedAt = null;

        await apiKey.save();

        logger.info({
            apiKeyId: apiKey._id,
            platform: apiKey.platform,
            regeneratedBy: req.admin._id
        }, 'Bridge Admin: API key regenerated');

        res.status(200).json({
            success: true,
            message: 'API key regenerated successfully',
            data: {
                _id: apiKey._id,
                key: apiKey.key, // Mostrar nueva key completa
                name: apiKey.name,
                platform: apiKey.platform,
                updatedAt: apiKey.updatedAt
            }
        });
    } catch (error) {
        logger.error({ err: error, keyId: req.params.id }, 'Bridge Admin: Regenerate key error');
        res.status(500).json({
            success: false,
            error: 'Failed to regenerate API key',
            message: error.message
        });
    }
});

module.exports = router;
