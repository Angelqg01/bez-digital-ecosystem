/**
 * ============================================================================
 * BEZHAS SUBSCRIPTION MIDDLEWARE
 * ============================================================================
 * 
 * Middleware para:
 * - Verificar acceso a features según tier
 * - Verificar límites de uso
 * - Rate limiting por tier para AI
 * - Adjuntar info de suscripción al request
 * 
 * @version 2.0.0
 * @date 2026-01-27
 */

const subscriptionService = require('../services/subscription.service');
const tokenomicsService = require('../services/tokenomics.service');
const { getTierConfig, tierHasAccess, TIER_HIERARCHY } = require('../config/tier.config');

/**
 * Middleware para verificar acceso a un feature específico
 * 
 * @example
 * router.post('/proposals', requireFeature('canCreateProposals'), controller.create)
 */
const requireFeature = (feature) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id && !req.user?._id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Debes iniciar sesión para acceder a esta función',
                    code: 'AUTH_REQUIRED'
                });
            }

            const userId = req.user.id || req.user._id;
            const result = await subscriptionService.checkFeatureAccess(userId, feature);

            if (!result.hasAccess) {
                return res.status(403).json({
                    error: 'FeatureNotAvailable',
                    message: `Esta función requiere suscripción ${result.requiredTier}`,
                    code: 'UPGRADE_REQUIRED',
                    currentTier: result.currentTier,
                    requiredTier: result.requiredTier,
                    feature,
                    upgradeUrl: '/vip'
                });
            }

            // Adjuntar info del tier al request
            req.subscription = req.subscription || {};
            req.subscription.tier = result.currentTier;
            req.subscription.config = getTierConfig(result.currentTier);

            next();
        } catch (error) {
            console.error('[Subscription Middleware] Feature check error:', error);
            next(error);
        }
    };
};

/**
 * Middleware para verificar límite de uso
 * 
 * @example
 * router.post('/posts', checkLimit('postsPerMonth'), controller.create)
 */
const checkLimit = (limitType, options = {}) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id && !req.user?._id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Debes iniciar sesión',
                    code: 'AUTH_REQUIRED'
                });
            }

            const userId = req.user.id || req.user._id;
            const result = await subscriptionService.checkLimit(userId, limitType);

            if (!result.allowed) {
                return res.status(429).json({
                    error: 'LimitExceeded',
                    message: `Has alcanzado tu límite de ${limitType}`,
                    code: 'LIMIT_EXCEEDED',
                    current: result.current,
                    limit: result.limit,
                    remaining: result.remaining,
                    percentUsed: result.percentUsed,
                    resetAt: result.resetAt,
                    tier: result.tier,
                    upgradeUrl: '/vip',
                    tip: 'Actualiza tu plan para obtener más capacidad'
                });
            }

            // Adjuntar info del límite al request
            req.usageInfo = result;

            // Función para incrementar uso después de operación exitosa
            if (options.autoIncrement !== false) {
                req.incrementUsage = async (amount = 1) => {
                    await subscriptionService.incrementUsage(userId, limitType, amount);
                };
            }

            next();
        } catch (error) {
            console.error('[Subscription Middleware] Limit check error:', error);
            next(error);
        }
    };
};

/**
 * Middleware para verificar tier mínimo requerido
 * 
 * @example
 * router.get('/api/advanced', requireTier('CREATOR'), controller.getData)
 */
const requireTier = (minimumTier) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id && !req.user?._id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Debes iniciar sesión',
                    code: 'AUTH_REQUIRED'
                });
            }

            const userId = req.user.id || req.user._id;
            const subscription = await subscriptionService.getUserSubscription(userId);

            if (!tierHasAccess(subscription.tier, minimumTier)) {
                return res.status(403).json({
                    error: 'TierRequired',
                    message: `Esta función requiere suscripción ${minimumTier} o superior`,
                    code: 'TIER_REQUIRED',
                    currentTier: subscription.tier,
                    requiredTier: minimumTier,
                    upgradeUrl: '/vip'
                });
            }

            req.subscription = subscription;
            next();
        } catch (error) {
            console.error('[Subscription Middleware] Tier check error:', error);
            next(error);
        }
    };
};

/**
 * Middleware para adjuntar info de suscripción sin bloquear
 * 
 * @example
 * router.get('/profile', attachSubscription, controller.getProfile)
 */
const attachSubscription = async (req, res, next) => {
    try {
        if (req.user?.id || req.user?._id) {
            const userId = req.user.id || req.user._id;
            req.subscription = await subscriptionService.getUserSubscription(userId);
        }
        next();
    } catch (error) {
        // No bloquear, solo log
        console.warn('[Subscription] Error attaching subscription:', error.message);
        next();
    }
};

/**
 * Middleware para verificar modelo AI permitido y rate limit
 * 
 * @example
 * router.post('/ai/chat', checkAIAccess(), controller.chat)
 */
const checkAIAccess = (options = {}) => {
    return async (req, res, next) => {
        try {
            if (!req.user?.id && !req.user?._id) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Debes iniciar sesión',
                    code: 'AUTH_REQUIRED'
                });
            }

            const userId = req.user.id || req.user._id;
            const requestedModel = req.body.model || options.defaultModel || 'gpt-3.5-turbo';

            // Obtener suscripción
            const subscription = await subscriptionService.getUserSubscription(userId);
            const allowedModels = subscription.ai.models;

            // Verificar modelo permitido
            if (!allowedModels.includes('all') && !allowedModels.includes(requestedModel)) {
                return res.status(403).json({
                    error: 'ModelNotAllowed',
                    message: `El modelo ${requestedModel} no está disponible en tu plan`,
                    code: 'MODEL_NOT_ALLOWED',
                    requestedModel,
                    allowedModels,
                    currentTier: subscription.tier,
                    upgradeUrl: '/vip'
                });
            }

            // Verificar rate limit
            const rateLimit = await tokenomicsService.checkAIRateLimit(userId, subscription.tier);

            if (!rateLimit.allowed) {
                return res.status(429).json({
                    error: 'AIRateLimitExceeded',
                    message: 'Has alcanzado tu límite diario de consultas AI',
                    code: 'AI_RATE_LIMIT',
                    current: rateLimit.current,
                    limit: rateLimit.limit,
                    remaining: 0,
                    resetAt: rateLimit.resetAt,
                    tier: subscription.tier,
                    upgradeUrl: '/vip'
                });
            }

            // Adjuntar info al request
            req.aiModel = requestedModel;
            req.subscription = subscription;
            req.aiRateLimit = rateLimit;

            // Función para incrementar contador después de uso
            req.recordAIUsage = async () => {
                await tokenomicsService.incrementAIRateLimit(userId);
            };

            next();
        } catch (error) {
            console.error('[AI Access Middleware] Error:', error);
            next(error);
        }
    };
};

/**
 * Middleware para verificar y cobrar por uso de AI
 * 
 * @example
 * router.post('/ai/generate', chargeForAI(), controller.generate)
 */
const chargeForAI = (options = {}) => {
    return async (req, res, next) => {
        try {
            // Primero verificar acceso
            const userId = req.user?.id || req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    code: 'AUTH_REQUIRED'
                });
            }

            const subscription = await subscriptionService.getUserSubscription(userId);

            // Estimar costo
            const model = req.body.model || options.defaultModel || 'gpt-3.5-turbo';
            const estimatedUsage = {
                inputTokens: options.estimatedInputTokens || 500,
                outputTokens: options.estimatedOutputTokens || 500
            };

            const costEstimate = tokenomicsService.calculateAICost(
                model,
                estimatedUsage,
                subscription.tier
            );

            // Adjuntar al request para uso posterior
            req.aiCostEstimate = costEstimate;
            req.subscription = subscription;

            // Función para registrar costo real después de la operación
            req.finalizeAICost = async (actualUsage) => {
                const finalCost = tokenomicsService.calculateAICost(
                    model,
                    actualUsage,
                    subscription.tier
                );

                // TODO: Debitar de wallet del usuario
                // await walletService.debit(userId, finalCost.finalCost, 'AI_USAGE');

                await tokenomicsService.incrementAIRateLimit(userId);

                return finalCost;
            };

            next();
        } catch (error) {
            console.error('[Charge AI Middleware] Error:', error);
            next(error);
        }
    };
};

/**
 * Middleware para verificar firma de staking
 * (Usado en endpoints que necesitan verificar tier para APY)
 * 
 * @example
 * router.get('/staking/info', verifyStakingSignature, controller.getInfo)
 */
const verifyStakingSignature = async (req, res, next) => {
    try {
        const signature = req.headers['x-staking-signature'] || req.query.signature;

        if (!signature) {
            // Si no hay firma, adjuntar tier por defecto
            if (req.user?.id || req.user?._id) {
                const userId = req.user.id || req.user._id;
                req.stakingInfo = await subscriptionService.getStakingInfo(userId);
            }
            return next();
        }

        const verification = subscriptionService.verifyStakingSignature(signature);

        if (!verification.valid) {
            return res.status(401).json({
                error: 'InvalidSignature',
                message: verification.error,
                code: 'INVALID_STAKING_SIGNATURE'
            });
        }

        req.stakingInfo = {
            tier: verification.tier,
            multiplier: verification.multiplier,
            effectiveAPY: verification.effectiveAPY,
            verified: true
        };

        next();
    } catch (error) {
        console.error('[Staking Signature Middleware] Error:', error);
        next(error);
    }
};

/**
 * Middleware para subsidio de gas
 * Calcula cuánto gas subsidiar según tier
 * 
 * @example
 * router.post('/tx/send', calculateGasSubsidy, controller.sendTx)
 */
const calculateGasSubsidy = async (req, res, next) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            req.gasSubsidy = { subsidyPercent: 0, gasFree: false };
            return next();
        }

        const subscription = await subscriptionService.getUserSubscription(userId);
        const gasConfig = subscription.gas;

        // Estimar gas si se proporciona
        const gasLimit = req.body.gasLimit || 100000;
        const gasEstimate = await tokenomicsService.estimateGasCost(gasLimit, subscription.tier);

        req.gasSubsidy = {
            ...gasEstimate,
            maxSubsidyPerTx: gasConfig.maxSubsidyPerTx,
            monthlyBudget: gasConfig.monthlySubsidyBudget,
            priorityFee: gasConfig.priorityFee
        };
        req.subscription = subscription;

        next();
    } catch (error) {
        console.error('[Gas Subsidy Middleware] Error:', error);
        next(error);
    }
};

module.exports = {
    requireFeature,
    checkLimit,
    requireTier,
    attachSubscription,
    checkAIAccess,
    chargeForAI,
    verifyStakingSignature,
    calculateGasSubsidy
};
