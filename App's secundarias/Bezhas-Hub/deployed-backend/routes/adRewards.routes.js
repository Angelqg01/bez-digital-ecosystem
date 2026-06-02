/**
 * @fileoverview Ad Rewards Routes - Endpoints para Watch-to-Earn
 * @description API REST para el sistema de recompensas por visualización de anuncios
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const adRewardsService = require('../services/ad-rewards.service');
const priceOracle = require('../services/price-oracle.service');
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================
// RATE LIMITING
// ============================================

// Limitar reclamaciones de recompensas (prevenir abuso)
const claimLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // Máximo 10 reclamaciones por minuto
    message: 'Demasiadas reclamaciones. Intenta nuevamente en 1 minuto.',
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================
// VALIDACIONES
// ============================================

const claimAdRewardValidation = [
    body('userId')
        .notEmpty()
        .withMessage('userId es requerido')
        .isString()
        .withMessage('userId debe ser un string'),
    body('adType')
        .notEmpty()
        .withMessage('adType es requerido')
        .isIn(['adsense', 'admob_rewarded', 'direct_sponsor'])
        .withMessage('adType inválido'),
    body('eventType')
        .notEmpty()
        .withMessage('eventType es requerido')
        .isIn(['impression', 'click', 'rewarded_view', 'sponsored_view'])
        .withMessage('eventType inválido'),
    body('context')
        .notEmpty()
        .withMessage('context es requerido')
        .isString()
        .withMessage('context debe ser un string'),
    body('adEventId')
        .notEmpty()
        .withMessage('adEventId es requerido')
        .isString()
        .withMessage('adEventId debe ser un string'),
    body('creatorId')
        .optional()
        .isString()
        .withMessage('creatorId debe ser un string')
];

// ============================================
// ENDPOINTS
// ============================================

/**
 * @route   POST /api/ad-rewards/claim
 * @desc    Reclama recompensa por visualización de anuncio
 * @access  Public (con rate limiting)
 * @body    {userId, adType, eventType, context, adEventId, creatorId?}
 */
router.post('/claim', claimLimiter, claimAdRewardValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { userId, adType, eventType, context, creatorId, adEventId } = req.body;

        logger.info({
            userId,
            adType,
            eventType,
            context,
            adEventId
        }, 'Ad reward claim request received');

        // Procesar reclamación (FIAT-FIRST)
        const result = await adRewardsService.processAdRewardClaim({
            userId,
            adType,
            eventType,
            context,
            creatorId,
            adEventId
        });

        logger.info({ result }, 'Ad reward claim processed successfully');

        res.json({
            success: true,
            message: 'Recompensa reclamada exitosamente',
            data: result
        });

    } catch (error) {
        logger.error({ error, body: req.body }, 'Error processing ad reward claim');

        res.status(500).json({
            success: false,
            error: 'Error al procesar la reclamación de recompensa',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/ad-rewards/stats/:userId
 * @desc    Obtiene estadísticas de recompensas de un usuario
 * @access  Public
 */
router.get('/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        logger.debug({ userId }, 'Fetching user reward stats');

        const stats = await adRewardsService.getUserRewardStats(userId);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error({ error, userId: req.params.userId }, 'Error fetching user stats');

        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/ad-rewards/price
 * @desc    Obtiene el precio actual de BEZ/EUR del oráculo
 * @access  Public
 */
router.get('/price', async (req, res) => {
    try {
        const price = await priceOracle.getBezEurPrice();
        const cacheInfo = priceOracle.getCacheInfo();

        res.json({
            success: true,
            data: {
                bezEurPrice: price,
                timestamp: new Date(),
                cache: {
                    age: cacheInfo.age,
                    isValid: cacheInfo.isValid
                }
            }
        });

    } catch (error) {
        logger.error({ error }, 'Error fetching BEZ/EUR price');

        res.status(500).json({
            success: false,
            error: 'Error al obtener precio',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   POST /api/ad-rewards/convert
 * @desc    Convierte entre EUR y BEZ
 * @access  Public
 * @body    {amount, from: 'eur'|'bez'}
 */
router.post('/convert', [
    body('amount')
        .notEmpty()
        .withMessage('amount es requerido')
        .isFloat({ min: 0 })
        .withMessage('amount debe ser un número positivo'),
    body('from')
        .notEmpty()
        .withMessage('from es requerido')
        .isIn(['eur', 'bez'])
        .withMessage('from debe ser "eur" o "bez"')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { amount, from } = req.body;
        let result;

        if (from === 'eur') {
            result = await priceOracle.convertEurToBez(amount);
            res.json({
                success: true,
                data: {
                    from: { amount, currency: 'EUR' },
                    to: { amount: result, currency: 'BEZ' }
                }
            });
        } else {
            result = await priceOracle.convertBezToEur(amount);
            res.json({
                success: true,
                data: {
                    from: { amount, currency: 'BEZ' },
                    to: { amount: result, currency: 'EUR' }
                }
            });
        }

    } catch (error) {
        logger.error({ error, body: req.body }, 'Error converting currency');

        res.status(500).json({
            success: false,
            error: 'Error al convertir moneda',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route   GET /api/ad-rewards/rates
 * @desc    Obtiene las tarifas de anuncios y splits de revenue
 * @access  Public
 */
router.get('/rates', (req, res) => {
    res.json({
        success: true,
        data: {
            adRates: adRewardsService.AD_RATES_EUR,
            revenueSplit: adRewardsService.REVENUE_SPLIT,
            eventTypes: adRewardsService.AD_EVENT_TYPES
        }
    });
});

/**
 * @route   POST /api/ad-rewards/verify-ad-view
 * @desc    Verifica que un anuncio fue visto completamente (para rewarded ads)
 * @access  Public
 * @body    {adEventId, duration, completed}
 */
router.post('/verify-ad-view', [
    body('adEventId')
        .notEmpty()
        .withMessage('adEventId es requerido'),
    body('duration')
        .optional()
        .isInt({ min: 0 })
        .withMessage('duration debe ser un número positivo'),
    body('completed')
        .notEmpty()
        .withMessage('completed es requerido')
        .isBoolean()
        .withMessage('completed debe ser boolean')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    try {
        const { adEventId, duration, completed } = req.body;

        logger.info({ adEventId, duration, completed }, 'Ad view verification request');

        // TODO: Implementar lógica de verificación
        // - Verificar que el adEventId existe
        // - Verificar que no ha sido reclamado antes
        // - Verificar duración mínima (para rewarded ads)
        // - Marcar como verificado en base de datos

        res.json({
            success: true,
            data: {
                verified: completed,
                eligibleForReward: completed && duration >= 15, // Mínimo 15 segundos
                adEventId
            }
        });

    } catch (error) {
        logger.error({ error, body: req.body }, 'Error verifying ad view');

        res.status(500).json({
            success: false,
            error: 'Error al verificar visualización',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
