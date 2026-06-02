/**
 * BeZhas VIP Routes
 * Sistema completo de membresías VIP con Stripe (LIVE MODE)
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const VIPSubscription = require('../models/VIPSubscription.model');
const vipController = require('../controllers/vip.controller');
const {
    createVIPSubscriptionSession,
    getUserSubscriptions,
    cancelVIPSubscription,
    upgradeVIPSubscription,
    checkUserVIPStatus,
    handleSubscriptionWebhook,
    VIP_TIERS
} = require('../services/vip.service');

/**
 * @route   POST /api/vip/create-subscription-session
 * @desc    Crear sesión de Stripe para suscripción VIP mensual recurrente
 * @access  Public (acepta usuarios guest)
 */
router.post('/create-subscription-session', async (req, res) => {
    try {
        const { tier, email, walletAddress } = req.body;

        if (!tier || !VIP_TIERS[tier]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid VIP tier. Choose from: bronze, silver, gold, platinum'
            });
        }

        // Información del usuario (puede ser guest o autenticado)
        const userInfo = {
            userId: req.user?._id?.toString() || `guest-${Date.now()}`,
            email: email || req.user?.email || '',
            walletAddress: walletAddress || req.user?.walletAddress || ''
        };

        const result = await createVIPSubscriptionSession(tier, userInfo);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Create VIP Subscription Session Error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            tier: req.body.tier
        });
        res.status(500).json({
            success: false,
            message: 'Error creating VIP subscription session',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * @route   GET /api/vip/my-subscriptions
 * @desc    Obtener suscripciones activas del usuario
 * @access  Private
 */
router.get('/my-subscriptions', protect, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const subscriptions = await getUserSubscriptions(userId);

        res.json({
            success: true,
            subscriptions
        });

    } catch (error) {
        console.error('Get Subscriptions Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subscriptions',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/vip/status
 * @desc    Verificar estado VIP del usuario
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const vipStatus = await checkUserVIPStatus(userId);

        res.json({
            success: true,
            ...vipStatus
        });

    } catch (error) {
        console.error('Check VIP Status Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking VIP status',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/vip/cancel-subscription
 * @desc    Cancelar suscripción VIP
 * @access  Private
 */
router.post('/cancel-subscription', protect, async (req, res) => {
    try {
        const { subscriptionId, immediate } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'Subscription ID is required'
            });
        }

        const result = await cancelVIPSubscription(subscriptionId, immediate);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Cancel Subscription Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling subscription',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/vip/upgrade-subscription
 * @desc    Cambiar tier de suscripción VIP
 * @access  Private
 */
router.post('/upgrade-subscription', protect, async (req, res) => {
    try {
        const { subscriptionId, newTier } = req.body;

        if (!subscriptionId || !newTier) {
            return res.status(400).json({
                success: false,
                message: 'Subscription ID and new tier are required'
            });
        }

        if (!VIP_TIERS[newTier]) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tier. Choose from: bronze, silver, gold, platinum'
            });
        }

        const result = await upgradeVIPSubscription(subscriptionId, newTier);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Upgrade Subscription Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error upgrading subscription',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/vip/tiers
 * @desc    Obtener información de todos los tiers VIP disponibles
 * @access  Public
 */
router.get('/tiers', (req, res) => {
    res.json({
        success: true,
        tiers: VIP_TIERS
    });
});

/**
 * @route   GET /api/vip/verify-session/:sessionId
 * @desc    Verificar sesión de Stripe después del pago
 * @access  Private
 */
router.get('/verify-session/:sessionId', protect, async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Retrieve the checkout session from Stripe
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            // Get subscription details
            const subscription = await stripe.subscriptions.retrieve(session.subscription);

            const tier = subscription.metadata.tier;
            const tierInfo = VIP_TIERS[tier];

            res.json({
                success: true,
                tierName: tierInfo?.name || 'VIP Member',
                tier: tier,
                price: tierInfo?.price || 0,
                subscriptionId: subscription.id,
                status: subscription.status,
                nextBilling: new Date(subscription.current_period_end * 1000).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Payment not completed'
            });
        }

    } catch (error) {
        console.error('Verify Session Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying session',
            error: error.message
        });
    }
});

// NOTE: Webhook endpoint has been moved to stripe-webhook.routes.js
// which is mounted BEFORE express.json() in server.js for correct raw body handling.

// ============================================================================
// LEGACY ROUTES (Kept for backwards compatibility)
// ============================================================================

/**
 * @route   POST /api/vip/subscribe
 * @desc    Suscribirse al sistema VIP
 * @access  Private
 */
router.post('/subscribe', protect, async (req, res) => {
    try {
        const { tier, duration, paymentMethod, autoRenew } = req.body;

        const tierPrices = {
            bronze: 9.99,
            silver: 19.99,
            gold: 49.99,
            platinum: 99.99
        };

        const price = tierPrices[tier];
        const totalAmount = price * duration;

        let paymentResult;

        if (paymentMethod === 'stripe') {
            // Crear sesión de pago con Stripe
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: `BeZhas VIP ${tier.toUpperCase()}`,
                                description: `Membresía VIP por ${duration} meses`,
                            },
                            unit_amount: Math.round(totalAmount * 100),
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${process.env.FRONTEND_URL}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.FRONTEND_URL}/vip`,
                customer_email: req.user.email,
                metadata: {
                    userId: req.user._id.toString(),
                    tier,
                    duration
                }
            });

            paymentResult = { sessionId: session.id, url: session.url };
        }

        // Crear suscripción en base de datos
        const subscription = {
            userId: req.user._id,
            subscriptionId: `VIP-${Date.now()}`,
            tier,
            startDate: new Date(),
            endDate: new Date(Date.now() + duration * 30 * 24 * 60 * 60 * 1000),
            isActive: true,
            autoRenew,
            paymentMethod,
            amount: totalAmount
        };

        // TODO: Guardar en MongoDB
        // await VIPSubscription.create(subscription);

        // Obtener beneficios del tier
        const benefits = getBenefitsByTier(tier);

        // Crear NFT Badge (simulado)
        const nftBadgeId = `NFT-BADGE-${tier.toUpperCase()}-${Date.now()}`;

        res.json({
            success: true,
            subscriptionId: subscription.subscriptionId,
            tier,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            benefits,
            nftBadgeId,
            payment: paymentResult
        });

    } catch (error) {
        console.error('VIP Subscribe Error:', error);
        res.status(500).json({
            message: 'Error creating VIP subscription',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/vip/upgrade
 * @desc    Mejorar nivel VIP
 * @access  Private
 */
router.post('/upgrade', protect, async (req, res) => {
    try {
        const { tier } = req.body;

        // TODO: Obtener suscripción actual
        // const currentSubscription = await VIPSubscription.findOne({ 
        //   userId: req.user._id, 
        //   isActive: true 
        // });

        // Calcular costo prorrateado
        const tierPrices = {
            bronze: 9.99,
            silver: 19.99,
            gold: 49.99,
            platinum: 99.99
        };

        const newPrice = tierPrices[tier];
        const currentPrice = 19.99; // Simulado
        const proRatedCost = newPrice - currentPrice;

        // Actualizar suscripción
        // currentSubscription.tier = tier;
        // await currentSubscription.save();

        const benefits = getBenefitsByTier(tier);

        res.json({
            success: true,
            tier,
            benefits,
            proRatedCost
        });

    } catch (error) {
        console.error('VIP Upgrade Error:', error);
        res.status(500).json({
            message: 'Error upgrading VIP tier',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/vip/status
 * @desc    Obtener estado VIP del usuario
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
    try {
        // TODO: Obtener desde MongoDB
        // const subscription = await VIPSubscription.findOne({ 
        //   userId: req.user._id,
        //   isActive: true
        // });

        // Simulación
        const subscription = {
            tier: 'gold',
            isActive: true,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2027-01-01'),
            nftBadge: 'NFT-BADGE-GOLD-12345'
        };

        if (!subscription) {
            return res.json({
                success: true,
                tier: null,
                isActive: false,
                benefits: getBenefitsByTier('bronze')
            });
        }

        const benefits = getBenefitsByTier(subscription.tier);
        const totalSavings = 1250.50; // Simulado

        res.json({
            success: true,
            tier: subscription.tier,
            isActive: subscription.isActive,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            benefits,
            totalSavings,
            nftBadge: subscription.nftBadge
        });

    } catch (error) {
        console.error('Get VIP Status Error:', error);
        res.status(500).json({
            message: 'Error getting VIP status',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/vip/claim-rewards
 * @desc    Reclamar recompensas VIP
 * @access  Private
 */
router.post('/claim-rewards', protect, async (req, res) => {
    try {
        // TODO: Obtener recompensas pendientes
        const rewards = {
            bezCoins: 500,
            nfts: ['NFT-REWARD-1', 'NFT-REWARD-2'],
            discountCoupons: ['COUPON-10OFF']
        };

        res.json({
            success: true,
            rewards,
            bezCoins: rewards.bezCoins,
            nfts: rewards.nfts
        });

    } catch (error) {
        console.error('Claim VIP Rewards Error:', error);
        res.status(500).json({
            message: 'Error claiming rewards',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/vip/savings
 * @desc    Obtener historial de ahorros VIP
 * @access  Private
 */
router.get('/savings', protect, async (req, res) => {
    try {
        // TODO: Calcular desde transacciones reales
        const savingsData = {
            totalSavings: 1250.50,
            monthlyBreakdown: [
                { month: 'Enero', savings: 125.30 },
                { month: 'Diciembre', savings: 98.20 },
                { month: 'Noviembre', savings: 156.00 }
            ],
            byCategory: {
                'Compras': 800.50,
                'Envíos': 250.00,
                'BEZ-Coin': 150.00,
                'Hoteles': 50.00
            }
        };

        res.json({
            success: true,
            ...savingsData
        });

    } catch (error) {
        console.error('Get VIP Savings Error:', error);
        res.status(500).json({
            message: 'Error getting savings',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/vip/benefits/:tier
 * @desc    Obtener beneficios de un tier específico
 * @access  Public
 */
router.get('/benefits/:tier', async (req, res) => {
    try {
        const { tier } = req.params;
        const benefits = getBenefitsByTier(tier);

        res.json({
            success: true,
            tier,
            benefits
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error getting benefits',
            error: error.message
        });
    }
});

/**
 * Función auxiliar para obtener beneficios por tier
 */
function getBenefitsByTier(tier) {
    const benefits = {
        bronze: {
            discount: 5,
            shippingDiscount: 10,
            prioritySupport: false,
            earlyAccess: false,
            nftBonus: 0,
            freeShipping: 'none',
            monthlyPrice: 9.99,
            features: [
                '5% descuento en todas las compras',
                '10% descuento en envíos',
                'Badge NFT exclusivo'
            ]
        },
        silver: {
            discount: 10,
            shippingDiscount: 20,
            prioritySupport: true,
            earlyAccess: true,
            nftBonus: 5,
            freeShipping: 'national',
            monthlyPrice: 19.99,
            features: [
                '10% descuento en todas las compras',
                '20% descuento en envíos',
                'Envío gratis nacional',
                'Soporte prioritario',
                'Acceso anticipado a nuevos productos',
                '5% bonus en compra de BEZ-Coin',
                'Badge NFT Silver exclusivo'
            ]
        },
        gold: {
            discount: 20,
            shippingDiscount: 30,
            prioritySupport: true,
            earlyAccess: true,
            nftBonus: 15,
            freeShipping: 'international',
            concierge: true,
            loungeAccess: true,
            monthlyPrice: 49.99,
            features: [
                '20% descuento en todas las compras',
                '30% descuento en envíos',
                'Envío gratis internacional',
                'Soporte prioritario 24/7',
                'Concierge service',
                'Acceso a lounges exclusivos',
                'Acceso anticipado VIP',
                '15% bonus en compra de BEZ-Coin',
                'Descuentos exclusivos en hoteles',
                'Badge NFT Gold exclusivo'
            ]
        },
        platinum: {
            discount: 30,
            shippingDiscount: 50,
            prioritySupport: true,
            earlyAccess: true,
            nftBonus: 25,
            freeShipping: 'worldwide',
            concierge: true,
            loungeAccess: true,
            personalShopper: true,
            exclusiveEvents: true,
            monthlyPrice: 99.99,
            features: [
                '30% descuento en todas las compras',
                '50% descuento en envíos',
                'Envío gratis mundial',
                'Soporte prioritario dedicado 24/7',
                'Concierge service premium',
                'Personal shopper dedicado',
                'Acceso a eventos exclusivos',
                'Acceso a lounges VIP worldwide',
                '25% bonus en compra de BEZ-Coin',
                'Descuentos premium en hoteles y viajes',
                'Regalos mensuales exclusivos',
                'Badge NFT Platinum exclusivo',
                'Invitaciones a eventos BeZhas'
            ]
        }
    };

    return benefits[tier] || benefits.bronze;
}

/**
 * @route   GET /api/vip/loyalty-stats
 * @desc    Obtener estadísticas de loyalty y gamificación del usuario
 * @access  Private
 */
router.get('/loyalty-stats', protect, vipController.getLoyaltyStats);

/**
 * @route   GET /api/vip/rewards-earnings
 * @desc    Obtener ganancias de rewards (para página Rewards)
 * @access  Private
 */
router.get('/rewards-earnings', protect, vipController.getRewardsEarnings);

module.exports = router;
