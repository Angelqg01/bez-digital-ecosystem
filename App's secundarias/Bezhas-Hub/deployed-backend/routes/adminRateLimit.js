/**
 * ============================================================================
 * ADMIN RATE LIMIT ROUTES - Gestión de Rate Limiters
 * ============================================================================
 * 
 * Endpoints administrativos para:
 * - Ver estadísticas de rate limiting por usuario
 * - Resetear límites de usuarios específicos
 * - Configurar límites personalizados
 * - Ver usuarios penalizados
 * - Remover penalizaciones
 */

const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/auth.middleware');
const { audit } = require('../middleware/auditLogger');

// Importar rate limiters (serán inicializados en server.js)
let advancedRateLimiter;
let messageRateLimiter;

// Función para inicializar los limiters
function initializeRateLimiters(advanced, message) {
    advancedRateLimiter = advanced;
    messageRateLimiter = message;
}

/**
 * GET /api/admin/rate-limit/stats/:userId
 * Obtener estadísticas de rate limiting de un usuario
 */
router.get('/stats/:userId', protect, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.admin.id;

        const stats = {
            advanced: await advancedRateLimiter?.getUserStats(userId),
            message: await messageRateLimiter?.getUserStats(userId)
        };

        audit.admin('RATE_LIMIT_STATS_VIEWED', requireAdminId, userId, {
            endpoint: '/api/admin/rate-limit/stats'
        });

        res.json({
            success: true,
            userId,
            stats
        });
    } catch (error) {
        console.error('Error getting rate limit stats:', error);
        res.status(500).json({
            error: 'Failed to get rate limit stats',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/rate-limit/reset/:userId
 * Resetear todos los límites de un usuario
 */
router.post('/reset/:userId', protect, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.admin.id;
        const { reason } = req.body;

        const results = {
            advanced: 0,
            message: 0
        };

        if (advancedRateLimiter) {
            results.advanced = await advancedRateLimiter.resetUserLimit(userId);
        }

        if (messageRateLimiter) {
            results.message = await messageRateLimiter.resetUserLimits(userId, requireAdminId);
        }

        audit.admin('RATE_LIMIT_RESET', requireAdminId, userId, {
            keysDeleted: results.advanced + results.message,
            reason: reason || 'Admin reset'
        });

        res.json({
            success: true,
            message: 'Rate limits reset successfully',
            keysDeleted: results
        });
    } catch (error) {
        console.error('Error resetting rate limits:', error);
        res.status(500).json({
            error: 'Failed to reset rate limits',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/rate-limit/penalty/remove/:userId
 * Remover penalización de un usuario
 */
router.post('/penalty/remove/:userId', protect, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.admin.id;
        const { reason } = req.body;

        if (!messageRateLimiter) {
            return res.status(503).json({
                error: 'Message rate limiter not available'
            });
        }

        // Remover penalty key
        const penaltyKey = `${messageRateLimiter.config.keyPrefix}penalty:${userId}`;
        await messageRateLimiter.redis.del(penaltyKey);

        // Remover violations
        const violationsKey = `${messageRateLimiter.config.keyPrefix}violations:${userId}`;
        await messageRateLimiter.redis.del(violationsKey);

        audit.admin('PENALTY_REMOVED', requireAdminId, userId, {
            reason: reason || 'Admin intervention'
        });

        res.json({
            success: true,
            message: 'Penalty removed successfully'
        });
    } catch (error) {
        console.error('Error removing penalty:', error);
        res.status(500).json({
            error: 'Failed to remove penalty',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/rate-limit/penalized
 * Listar usuarios penalizados actualmente
 */
router.get('/penalized', protect, requireAdmin, async (req, res) => {
    try {
        const adminId = req.admin.id;

        if (!messageRateLimiter) {
            return res.status(503).json({
                error: 'Message rate limiter not available'
            });
        }

        const pattern = `${messageRateLimiter.config.keyPrefix}penalty:*`;
        const keys = await messageRateLimiter.redis.keys(pattern);

        const penalizedUsers = [];
        const now = Date.now();

        for (const key of keys) {
            const userId = key.split(':').pop();
            const penaltyEnd = await messageRateLimiter.redis.get(key);

            if (penaltyEnd && parseInt(penaltyEnd) > now) {
                penalizedUsers.push({
                    userId,
                    penaltyEnd: parseInt(penaltyEnd),
                    remainingSeconds: Math.ceil((parseInt(penaltyEnd) - now) / 1000)
                });
            }
        }

        audit.admin('PENALIZED_USERS_VIEWED', requireAdminId, 'system', {
            count: penalizedUsers.length
        });

        res.json({
            success: true,
            count: penalizedUsers.length,
            users: penalizedUsers
        });
    } catch (error) {
        console.error('Error getting penalized users:', error);
        res.status(500).json({
            error: 'Failed to get penalized users',
            message: error.message
        });
    }
});

/**
 * PUT /api/admin/rate-limit/config/endpoint
 * Configurar límites personalizados para un endpoint
 */
router.put('/config/endpoint', protect, requireAdmin, async (req, res) => {
    try {
        const { endpoint, windowMs, maxRequests, message } = req.body;
        const adminId = req.admin.id;

        if (!endpoint || !windowMs || !maxRequests) {
            return res.status(400).json({
                error: 'Missing required fields: endpoint, windowMs, maxRequests'
            });
        }

        if (!advancedRateLimiter) {
            return res.status(503).json({
                error: 'Advanced rate limiter not available'
            });
        }

        const oldConfig = advancedRateLimiter.getEndpointConfig(endpoint);

        advancedRateLimiter.setEndpointConfig(endpoint, {
            windowMs,
            maxRequests,
            message: message || 'Rate limit exceeded'
        });

        audit.admin('RATE_LIMIT_CONFIG_CHANGED', requireAdminId, endpoint, {
            oldConfig,
            newConfig: { windowMs, maxRequests, message }
        });

        res.json({
            success: true,
            message: 'Endpoint rate limit configured',
            endpoint,
            config: {
                windowMs,
                maxRequests,
                message
            }
        });
    } catch (error) {
        console.error('Error configuring endpoint rate limit:', error);
        res.status(500).json({
            error: 'Failed to configure rate limit',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/rate-limit/config
 * Obtener configuración actual de rate limiters
 */
router.get('/config', protect, requireAdmin, async (req, res) => {
    try {
        const adminId = req.admin.id;

        const config = {
            advanced: advancedRateLimiter ? {
                enabled: advancedRateLimiter.config.enabled,
                endpoints: advancedRateLimiter.config.endpoints,
                roles: advancedRateLimiter.config.roles
            } : null,
            message: messageRateLimiter ? {
                enabled: messageRateLimiter.config.enabled,
                baseLimit: messageRateLimiter.config.baseLimit,
                burstLimit: messageRateLimiter.config.burstLimit,
                hourlyLimit: messageRateLimiter.config.hourlyLimit,
                modelLimits: messageRateLimiter.config.modelLimits,
                penalties: messageRateLimiter.config.penalties
            } : null
        };

        audit.admin('RATE_LIMIT_CONFIG_VIEWED', requireAdminId, 'system', {});

        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Error getting rate limit config:', error);
        res.status(500).json({
            error: 'Failed to get config',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/rate-limit/cleanup
 * Limpiar datos expirados de rate limiting
 */
router.post('/cleanup', protect, requireAdmin, async (req, res) => {
    try {
        const adminId = req.admin.id;

        const results = {
            advanced: 0,
            message: 0
        };

        if (advancedRateLimiter) {
            results.advanced = await advancedRateLimiter.cleanup();
        }

        // Message limiter no tiene cleanup explícito (usa TTL de Redis)

        audit.admin('RATE_LIMIT_CLEANUP', requireAdminId, 'system', {
            keysRemoved: results.advanced
        });

        res.json({
            success: true,
            message: 'Cleanup completed',
            keysRemoved: results
        });
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({
            error: 'Failed to cleanup',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/rate-limit/top-users
 * Obtener usuarios con más requests (top 20)
 */
router.get('/top-users', protect, requireAdmin, async (req, res) => {
    try {
        const adminId = req.admin.id;
        const { limit = 20 } = req.query;

        if (!messageRateLimiter) {
            return res.status(503).json({
                error: 'Message rate limiter not available'
            });
        }

        // Buscar todas las keys hourly
        const pattern = `${messageRateLimiter.config.keyPrefix}hourly:*`;
        const keys = await messageRateLimiter.redis.keys(pattern);

        const userStats = [];

        for (const key of keys) {
            const userId = key.split(':').pop();
            const count = await messageRateLimiter.redis.zcard(key);
            userStats.push({ userId, messageCount: count });
        }

        // Ordenar por messageCount descendente
        userStats.sort((a, b) => b.messageCount - a.messageCount);

        const topUsers = userStats.slice(0, parseInt(limit));

        audit.admin('TOP_USERS_VIEWED', requireAdminId, 'system', {
            count: topUsers.length
        });

        res.json({
            success: true,
            count: topUsers.length,
            users: topUsers
        });
    } catch (error) {
        console.error('Error getting top users:', error);
        res.status(500).json({
            error: 'Failed to get top users',
            message: error.message
        });
    }
});

module.exports = { router, initializeRateLimiters };
