/**
 * ============================================================================
 * STRIPE PAYMENT ROUTES
 * ============================================================================
 * 
 * Endpoints para procesamiento de pagos con Stripe
 */

const express = require('express');
const router = express.Router();
const {
    STRIPE_CONFIG,
    createNFTCheckoutSession,
    createSubscriptionCheckoutSession,
    createTokenPurchaseSession,
    getCheckoutSession,
    createPaymentIntent,
    cancelSubscription,
    getCustomerSubscriptions,
    createRefund,
    handleStripeWebhook
} = require('../services/stripe.service');
const { verifyTokenMiddleware } = require('../middleware/refreshTokenSystem');
const { protect, requireAdmin } = require('../middleware/auth.middleware');

/**
 * GET /api/stripe/config
 * Obtener configuración pública de Stripe
 */
router.get('/config', (req, res) => {
    res.json({
        publishableKey: STRIPE_CONFIG.PUBLISHABLE_KEY,
        currency: STRIPE_CONFIG.CURRENCY
    });
});

/**
 * POST /api/stripe/create-nft-session
 * Crear sesión de pago para NFT
 */
router.post('/create-nft-session', verifyTokenMiddleware, async (req, res) => {
    try {
        const { nftId, name, description, price, image, collection } = req.body;
        const userId = req.user.userId;

        if (!nftId || !name || !price) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['nftId', 'name', 'price']
            });
        }

        const result = await createNFTCheckoutSession(
            { id: nftId, name, description, price, image, collection },
            {
                userId,
                walletAddress: req.user.walletAddress,
                email: req.body.email || `${userId}@bezhas.com`
            }
        );

        if (!result.success) {
            return res.status(500).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Create NFT session error:', error);
        res.status(500).json({
            error: 'Failed to create checkout session',
            message: error.message
        });
    }
});

/**
 * POST /api/stripe/create-subscription-session
 * Crear sesión de pago para suscripción Premium
 */
router.post('/create-subscription-session', verifyTokenMiddleware, async (req, res) => {
    try {
        const { plan } = req.body; // 'monthly', 'yearly', 'lifetime'
        const userId = req.user.userId;

        if (!plan || !['monthly', 'yearly', 'lifetime'].includes(plan)) {
            return res.status(400).json({
                error: 'Invalid plan',
                validPlans: ['monthly', 'yearly', 'lifetime']
            });
        }

        const result = await createSubscriptionCheckoutSession(
            plan,
            {
                userId,
                walletAddress: req.user.walletAddress,
                email: req.body.email || `${userId}@bezhas.com`
            }
        );

        if (!result.success) {
            return res.status(500).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Create subscription session error:', error);
        res.status(500).json({
            error: 'Failed to create subscription session',
            message: error.message
        });
    }
});

/**
 * POST /api/stripe/create-token-purchase-session
 * Crear sesión de pago para compra de tokens BZS
 */
router.post('/create-token-purchase-session', verifyTokenMiddleware, async (req, res) => {
    try {
        const { tokenAmount } = req.body;
        const userId = req.user.userId;

        if (!tokenAmount || tokenAmount < 1) {
            return res.status(400).json({
                error: 'Invalid token amount',
                minimum: 1
            });
        }

        const result = await createTokenPurchaseSession(
            tokenAmount,
            {
                userId,
                walletAddress: req.user.walletAddress,
                email: req.body.email || `${userId}@bezhas.com`
            }
        );

        if (!result.success) {
            return res.status(500).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Create token purchase session error:', error);
        res.status(500).json({
            error: 'Failed to create token purchase session',
            message: error.message
        });
    }
});

/**
 * GET /api/stripe/session/:sessionId
 * Obtener detalles de sesión de pago
 */
router.get('/session/:sessionId', verifyTokenMiddleware, async (req, res) => {
    try {
        const { sessionId } = req.params;

        const result = await getCheckoutSession(sessionId);

        if (!result.success) {
            return res.status(404).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({
            error: 'Failed to retrieve session',
            message: error.message
        });
    }
});

/**
 * POST /api/stripe/create-payment-intent
 * Crear intento de pago directo
 */
router.post('/create-payment-intent', verifyTokenMiddleware, async (req, res) => {
    try {
        const { amount, metadata } = req.body;
        const userId = req.user.userId;

        if (!amount || amount < 0.50) {
            return res.status(400).json({
                error: 'Invalid amount',
                minimum: 0.50
            });
        }

        const result = await createPaymentIntent(amount, {
            ...metadata,
            userId
        });

        if (!result.success) {
            return res.status(500).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            error: 'Failed to create payment intent',
            message: error.message
        });
    }
});

/**
 * GET /api/stripe/subscriptions
 * Obtener suscripciones activas del usuario
 */
router.get('/subscriptions', verifyTokenMiddleware, async (req, res) => {
    try {
        const email = req.query.email || `${req.user.userId}@bezhas.com`;

        const result = await getCustomerSubscriptions(email);

        if (!result.success) {
            return res.status(500).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({
            error: 'Failed to retrieve subscriptions',
            message: error.message
        });
    }
});

/**
 * POST /api/stripe/cancel-subscription
 * Cancelar suscripción
 */
router.post('/cancel-subscription', verifyTokenMiddleware, async (req, res) => {
    try {
        const { subscriptionId } = req.body;
        const userId = req.user.userId;

        if (!subscriptionId) {
            return res.status(400).json({
                error: 'Subscription ID required'
            });
        }

        const result = await cancelSubscription(subscriptionId, userId);

        if (!result.success) {
            return res.status(500).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            error: 'Failed to cancel subscription',
            message: error.message
        });
    }
});

/**
 * POST /api/stripe/refund (Admin only)
 * Crear reembolso
 */
router.post('/refund', protect, requireAdmin, async (req, res) => {
    try {
        const { paymentIntentId, amount, reason } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({
                error: 'Payment intent ID required'
            });
        }

        const result = await createRefund(paymentIntentId, amount, reason);

        if (!result.success) {
            return res.status(500).json({
                error: result.error
            });
        }

        res.json(result);

    } catch (error) {
        console.error('Create refund error:', error);
        res.status(500).json({
            error: 'Failed to create refund',
            message: error.message
        });
    }
});

// NOTE: Webhook endpoint has been moved to stripe-webhook.routes.js
// which is mounted BEFORE express.json() in server.js for correct raw body handling.

module.exports = router;
