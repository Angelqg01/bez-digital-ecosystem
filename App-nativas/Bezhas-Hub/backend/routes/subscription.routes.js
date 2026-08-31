/**
 * ============================================================================
 * SUBSCRIPTION ROUTES
 * ============================================================================
 * 
 * API endpoints for the unified subscription system.
 * Handles Stripe payments, token locks, and tier management.
 * 
 * @version 2.0.0
 */

const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const subscriptionService = require('../services/subscription.service');
const tokenomicsService = require('../services/tokenomics.service');
const { SUBSCRIPTION_TIERS, getTierConfig, calculatePotentialROI } = require('../config/tier.config');

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

/**
 * @route   GET /api/subscription/status
 * @desc    Get user's current subscription status
 * @access  Private (wallet required)
 */
router.get('/status', protect, async (req, res) => {
    try {
        const walletAddress = req.user?.walletAddress || req.headers['x-wallet-address'];

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: 'Wallet address required'
            });
        }

        const subscription = await subscriptionService.getUserSubscription(
            req.user?._id?.toString(),
            walletAddress
        );

        res.json({
            success: true,
            ...subscription
        });

    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subscription status',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/subscription/tiers
 * @desc    Get all available subscription tiers
 * @access  Public
 */
router.get('/tiers', (req, res) => {
    try {
        const tiers = Object.entries(SUBSCRIPTION_TIERS).map(([key, config]) => ({
            id: key,
            ...config,
            // Remove sensitive info
            features: config.features
        }));

        res.json({
            success: true,
            tiers
        });

    } catch (error) {
        console.error('Get tiers error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tiers'
        });
    }
});

// ============================================================================
// STRIPE CHECKOUT
// ============================================================================

/**
 * @route   POST /api/subscription/checkout
 * @desc    Create Stripe checkout session for subscription
 * @access  Private
 */
router.post('/checkout', protect, async (req, res) => {
    try {
        const { tier, billingCycle = 'monthly' } = req.body;
        const walletAddress = req.user?.walletAddress || req.headers['x-wallet-address'];

        if (!tier || !['CREATOR', 'BUSINESS'].includes(tier.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tier. Choose CREATOR or BUSINESS'
            });
        }

        if (!['monthly', 'yearly'].includes(billingCycle)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid billing cycle. Choose monthly or yearly'
            });
        }

        const session = await subscriptionService.createCheckoutSession({
            userId: req.user._id.toString(),
            email: req.user.email,
            walletAddress,
            tier: tier.toUpperCase(),
            billingCycle
        });

        res.json({
            success: true,
            checkoutUrl: session.url,
            sessionId: session.id
        });

    } catch (error) {
        console.error('Create checkout error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating checkout session',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/subscription/checkout/success
 * @desc    Handle successful checkout (called by frontend after redirect)
 * @access  Private
 */
router.post('/checkout/success', protect, async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Session ID required'
            });
        }

        const result = await subscriptionService.handleCheckoutSuccess(sessionId);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Checkout success error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing checkout success',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/subscription/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post('/cancel', protect, async (req, res) => {
    try {
        const result = await subscriptionService.cancelSubscription(req.user._id.toString());

        res.json({
            success: true,
            message: 'Subscription cancelled. Access remains until period end.',
            ...result
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling subscription',
            error: error.message
        });
    }
});

// ============================================================================
// TOKEN LOCK
// ============================================================================

/**
 * @route   POST /api/subscription/token-lock
 * @desc    Register token lock for free tier access
 * @access  Private
 */
router.post('/token-lock', protect, async (req, res) => {
    try {
        const { tier, txHash } = req.body;
        const walletAddress = req.user?.walletAddress || req.headers['x-wallet-address'];

        if (!tier || !['CREATOR', 'BUSINESS'].includes(tier.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tier'
            });
        }

        if (!txHash) {
            return res.status(400).json({
                success: false,
                message: 'Transaction hash required'
            });
        }

        const result = await subscriptionService.registerTokenLock({
            userId: req.user._id.toString(),
            walletAddress,
            tier: tier.toUpperCase(),
            txHash
        });

        res.json({
            success: true,
            message: 'Token lock registered successfully',
            ...result
        });

    } catch (error) {
        console.error('Register token lock error:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering token lock',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/subscription/token-lock/status
 * @desc    Get token lock status
 * @access  Private
 */
router.get('/token-lock/status', protect, async (req, res) => {
    try {
        const walletAddress = req.user?.walletAddress || req.headers['x-wallet-address'];

        const lockStatus = await subscriptionService.getTokenLockStatus(walletAddress);

        res.json({
            success: true,
            ...lockStatus
        });

    } catch (error) {
        console.error('Get token lock status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching token lock status'
        });
    }
});

// ============================================================================
// STAKING SIGNATURE
// ============================================================================

/**
 * @route   GET /api/subscription/staking-signature
 * @desc    Get signature for smart contract tier verification
 * @access  Private
 */
router.get('/staking-signature', protect, async (req, res) => {
    try {
        const walletAddress = req.user?.walletAddress || req.headers['x-wallet-address'];

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: 'Wallet address required'
            });
        }

        const signatureData = await subscriptionService.generateStakingSignature(
            req.user._id.toString(),
            walletAddress
        );

        res.json({
            success: true,
            ...signatureData
        });

    } catch (error) {
        console.error('Generate staking signature error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating staking signature',
            error: error.message
        });
    }
});

// ============================================================================
// ROI CALCULATOR
// ============================================================================

/**
 * @route   POST /api/subscription/calculate-roi
 * @desc    Calculate potential ROI for staking
 * @access  Public
 */
router.post('/calculate-roi', (req, res) => {
    try {
        const { stakeAmount, tier = 'STARTER', durationMonths = 12 } = req.body;

        if (!stakeAmount || stakeAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid stake amount required'
            });
        }

        const roi = calculatePotentialROI(stakeAmount, tier.toUpperCase(), durationMonths);

        res.json({
            success: true,
            ...roi
        });

    } catch (error) {
        console.error('Calculate ROI error:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating ROI'
        });
    }
});

/**
 * @route   POST /api/subscription/compare-roi
 * @desc    Compare ROI across all tiers
 * @access  Public
 */
router.post('/compare-roi', (req, res) => {
    try {
        const { stakeAmount, durationMonths = 12 } = req.body;

        if (!stakeAmount || stakeAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid stake amount required'
            });
        }

        const comparison = {};
        let bestTier = 'STARTER';
        let bestNetProfit = -Infinity;

        for (const tier of ['STARTER', 'CREATOR', 'BUSINESS']) {
            const roi = calculatePotentialROI(stakeAmount, tier, durationMonths);
            comparison[tier] = roi;

            if (roi.isProfitable && roi.netProfitBEZ > bestNetProfit) {
                bestTier = tier;
                bestNetProfit = roi.netProfitBEZ;
            }
        }

        res.json({
            success: true,
            stakeAmount,
            durationMonths,
            comparison,
            recommendation: {
                tier: bestTier,
                netProfit: bestNetProfit,
                reason: bestTier === 'STARTER'
                    ? 'For small amounts, the free tier is most profitable'
                    : `${bestTier} offers the best net ROI`
            }
        });

    } catch (error) {
        console.error('Compare ROI error:', error);
        res.status(500).json({
            success: false,
            message: 'Error comparing ROI'
        });
    }
});

// ============================================================================
// AI CREDITS
// ============================================================================

/**
 * @route   GET /api/subscription/ai-credits
 * @desc    Get AI credits usage for current user
 * @access  Private
 */
router.get('/ai-credits', protect, async (req, res) => {
    try {
        const subscription = await subscriptionService.getUserSubscription(
            req.user._id.toString(),
            req.user.walletAddress
        );

        const tierConfig = getTierConfig(subscription.tier);

        res.json({
            success: true,
            tier: subscription.tier,
            daily: {
                limit: tierConfig.ai.dailyQueries,
                used: subscription.aiCredits?.dailyUsed || 0,
                remaining: Math.max(0, tierConfig.ai.dailyQueries - (subscription.aiCredits?.dailyUsed || 0))
            },
            monthly: {
                limit: tierConfig.ai.monthlyQueries,
                used: subscription.aiCredits?.monthlyUsed || 0,
                remaining: Math.max(0, tierConfig.ai.monthlyQueries - (subscription.aiCredits?.monthlyUsed || 0))
            },
            models: tierConfig.ai.models
        });

    } catch (error) {
        console.error('Get AI credits error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching AI credits'
        });
    }
});

/**
 * @route   POST /api/subscription/ai-credits/use
 * @desc    Use an AI credit (internal API)
 * @access  Private
 */
router.post('/ai-credits/use', protect, async (req, res) => {
    try {
        const { model = 'gpt-3.5-turbo', tokens = 0 } = req.body;

        const result = await tokenomicsService.chargeForAIUsage(
            req.user._id.toString(),
            model,
            tokens
        );

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Use AI credit error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error using AI credit'
        });
    }
});

// ============================================================================
// GAS ESTIMATION
// ============================================================================

/**
 * @route   GET /api/subscription/gas-estimate
 * @desc    Get gas estimate with tier subsidy applied
 * @access  Private
 */
router.get('/gas-estimate', protect, async (req, res) => {
    try {
        const { gasLimit = 21000, priorityFee = 30 } = req.query;

        const subscription = await subscriptionService.getUserSubscription(
            req.user._id.toString(),
            req.user.walletAddress
        );

        const gasData = await tokenomicsService.estimateGasCost(
            parseInt(gasLimit),
            parseInt(priorityFee)
        );

        const tierConfig = getTierConfig(subscription.tier);
        const subsidyPercent = tierConfig.gas.subsidyPercent;
        const subsidyAmount = gasData.estimatedCostMATIC * subsidyPercent;
        const userPays = gasData.estimatedCostMATIC - subsidyAmount;

        res.json({
            success: true,
            tier: subscription.tier,
            original: gasData,
            subsidy: {
                percent: subsidyPercent * 100,
                amountMATIC: subsidyAmount,
                amountUSD: subsidyAmount * gasData.maticPriceUSD
            },
            userPays: {
                MATIC: userPays,
                USD: userPays * gasData.maticPriceUSD
            },
            isFreeGas: tierConfig.gas.gasFree
        });

    } catch (error) {
        console.error('Gas estimate error:', error);
        res.status(500).json({
            success: false,
            message: 'Error estimating gas'
        });
    }
});

// NOTE: Webhook endpoint has been moved to stripe-webhook.routes.js
// which is mounted BEFORE express.json() in server.js for correct raw body handling.

module.exports = router;
