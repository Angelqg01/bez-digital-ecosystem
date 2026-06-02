/**
 * VIP Middleware - Verificación de features VIP
 * Protege endpoints y features premium
 */

const User = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Middleware: Verificar si el usuario tiene VIP activo
 */
const requireVIP = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;

        if (!userId) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Debes estar autenticado para acceder a esta función'
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'Usuario no encontrado'
            });
        }

        // Verificar status VIP
        if (user.vipStatus !== 'active') {
            return res.status(403).json({
                error: 'VIP subscription required',
                message: 'Esta función requiere una suscripción VIP activa',
                currentStatus: user.vipStatus,
                requiresVIP: true
            });
        }

        // Verificar si la suscripción ha expirado
        if (user.vipEndDate && new Date(user.vipEndDate) < new Date()) {
            // Actualizar status a expirado
            user.vipStatus = 'expired';
            await user.save();

            return res.status(403).json({
                error: 'VIP subscription expired',
                message: 'Tu suscripción VIP ha expirado. Por favor renuévala para continuar.',
                expiredAt: user.vipEndDate,
                requiresVIP: true
            });
        }

        // Adjuntar info VIP al request
        req.vip = {
            tier: user.vipTier,
            status: user.vipStatus,
            features: user.vipFeatures,
            endDate: user.vipEndDate
        };

        next();

    } catch (error) {
        logger.error({
            error: error.message,
            userId: req.user?._id
        }, 'Error in requireVIP middleware');

        return res.status(500).json({
            error: 'Server error',
            message: 'Error al verificar suscripción VIP'
        });
    }
};

/**
 * Middleware: Verificar tier VIP específico
 */
const requireVIPTier = (minTier) => {
    const tierOrder = ['bronze', 'silver', 'gold', 'platinum'];
    const minTierIndex = tierOrder.indexOf(minTier);

    if (minTierIndex === -1) {
        throw new Error(`Invalid VIP tier: ${minTier}`);
    }

    return async (req, res, next) => {
        try {
            const userId = req.user?._id || req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required'
                });
            }

            const user = await User.findById(userId);

            if (!user || user.vipStatus !== 'active') {
                return res.status(403).json({
                    error: 'VIP subscription required',
                    message: `Esta función requiere VIP ${minTier} o superior`,
                    requiredTier: minTier
                });
            }

            const userTierIndex = tierOrder.indexOf(user.vipTier);

            if (userTierIndex < minTierIndex) {
                return res.status(403).json({
                    error: 'Insufficient VIP tier',
                    message: `Esta función requiere VIP ${minTier} o superior. Tu tier actual es ${user.vipTier}`,
                    requiredTier: minTier,
                    currentTier: user.vipTier
                });
            }

            req.vip = {
                tier: user.vipTier,
                status: user.vipStatus,
                features: user.vipFeatures,
                endDate: user.vipEndDate
            };

            next();

        } catch (error) {
            logger.error({
                error: error.message,
                userId: req.user?._id
            }, 'Error in requireVIPTier middleware');

            return res.status(500).json({
                error: 'Server error',
                message: 'Error al verificar tier VIP'
            });
        }
    };
};

/**
 * Middleware: Verificar feature VIP específico
 */
const requireVIPFeature = (featureName) => {
    return async (req, res, next) => {
        try {
            const userId = req.user?._id || req.user?.id;

            if (!userId) {
                return res.status(401).json({
                    error: 'Authentication required'
                });
            }

            const user = await User.findById(userId);

            if (!user || user.vipStatus !== 'active') {
                return res.status(403).json({
                    error: 'VIP subscription required',
                    message: 'Esta función requiere una suscripción VIP activa',
                    requiredFeature: featureName
                });
            }

            if (!user.vipFeatures || !user.vipFeatures[featureName]) {
                return res.status(403).json({
                    error: 'Feature not available',
                    message: `Esta función no está disponible en tu plan VIP actual`,
                    requiredFeature: featureName,
                    currentTier: user.vipTier
                });
            }

            req.vip = {
                tier: user.vipTier,
                status: user.vipStatus,
                features: user.vipFeatures,
                endDate: user.vipEndDate
            };

            next();

        } catch (error) {
            logger.error({
                error: error.message,
                userId: req.user?._id,
                featureName
            }, 'Error in requireVIPFeature middleware');

            return res.status(500).json({
                error: 'Server error'
            });
        }
    };
};

/**
 * Helper: Verificar si un usuario tiene VIP activo (sin middleware)
 */
async function checkUserHasVIP(userId) {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return { hasVIP: false, reason: 'user_not_found' };
        }

        if (user.vipStatus !== 'active') {
            return { hasVIP: false, reason: 'inactive', status: user.vipStatus };
        }

        if (user.vipEndDate && new Date(user.vipEndDate) < new Date()) {
            return { hasVIP: false, reason: 'expired', expiredAt: user.vipEndDate };
        }

        return {
            hasVIP: true,
            tier: user.vipTier,
            features: user.vipFeatures,
            endDate: user.vipEndDate
        };

    } catch (error) {
        logger.error({
            error: error.message,
            userId
        }, 'Error checking user VIP status');

        return { hasVIP: false, reason: 'error', error: error.message };
    }
}

module.exports = {
    requireVIP,
    requireVIPTier,
    requireVIPFeature,
    checkUserHasVIP
};
