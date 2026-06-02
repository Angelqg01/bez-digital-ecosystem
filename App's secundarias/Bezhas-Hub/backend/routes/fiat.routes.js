const express = require('express');
const router = express.Router();
const { processFiatPayment, getBezPriceInEur, getBezPriceInUsd, getPriceInfo, calculateBezOutput, getSafeStatus, getBankDetails } = require('../services/fiat-gateway.service');
const priceOracle = require('../services/price-oracle.service');
const { getDistributionStats, simulateDistribution } = require('../services/token-distribution.service');

/**
 * Middleware to protect admin-only routes
 * Checks for admin secret in header
 */
const requireAdmin = (req, res, next) => {
    const adminSecret = req.headers['x-admin-secret'];

    if (adminSecret && adminSecret === process.env.ADMIN_SECRET) {
        return next();
    }

    res.status(403).json({
        error: "Unauthorized: Admin access required",
        message: "This endpoint requires admin authentication"
    });
};

/**
 * GET /api/fiat/bank-details
 * Public endpoint to get bank account information
 */
router.get('/bank-details', (req, res) => {
    try {
        const details = getBankDetails();
        res.json({
            success: true,
            data: details
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/fiat/price-info
 * Public endpoint to get complete price information from QuickSwap Oracle
 */
router.get('/price-info', async (req, res) => {
    try {
        const priceInfo = await priceOracle.getOracleInfo();
        res.json({
            success: true,
            priceInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/fiat/price
 * Public endpoint to get current BEZ price in EUR and USD
 */
router.get('/price', async (req, res) => {
    try {
        const [priceEur, priceUsd] = await Promise.all([
            getBezPriceInEur(),
            getBezPriceInUsd()
        ]);

        const cacheInfo = priceOracle.getCacheInfo();

        res.json({
            success: true,
            priceEur,
            priceUsd,
            source: cacheInfo.source || 'quickswap',
            poolAddress: cacheInfo.poolAddress,
            lastUpdate: cacheInfo.timestamp,
            cacheValid: cacheInfo.isValid
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/fiat/calculate
 * Calculate how many BEZ tokens for a given EUR amount
 * Body: { amountEur: number }
 */
router.post('/calculate', async (req, res) => {
    const { amountEur } = req.body;

    if (!amountEur || isNaN(amountEur) || amountEur <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid amount. Must be a positive number"
        });
    }

    try {
        const bezAmount = await calculateBezOutput(parseFloat(amountEur));
        const price = await getBezPriceInEur();

        res.json({
            success: true,
            input: {
                amountEur: parseFloat(amountEur),
                currency: 'EUR'
            },
            output: {
                amountBez: bezAmount,
                token: 'BEZ'
            },
            rate: price
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/fiat/confirm-payment
 * ADMIN ONLY: Confirms bank transfer received and disperses tokens
 * Body: { userWallet, amountEur, referenceId }
 */
router.post('/confirm-payment', requireAdmin, async (req, res) => {
    const { userWallet, amountEur, referenceId } = req.body;

    // Validation
    if (!userWallet || !amountEur) {
        return res.status(400).json({
            success: false,
            error: "Missing required fields: userWallet and amountEur"
        });
    }

    // Validate Ethereum address
    if (!/^0x[a-fA-F0-9]{40}$/.test(userWallet)) {
        return res.status(400).json({
            success: false,
            error: "Invalid wallet address format"
        });
    }

    if (isNaN(amountEur) || parseFloat(amountEur) <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid amount. Must be a positive number"
        });
    }

    try {
        const result = await processFiatPayment(userWallet, parseFloat(amountEur));

        // TODO: Update database here
        // If you have a FiatOrder model:
        // await FiatOrder.findOneAndUpdate(
        //     { _id: referenceId }, 
        //     { 
        //         status: 'COMPLETED', 
        //         txHash: result.txHash,
        //         completedAt: new Date()
        //     }
        // );

        res.json({
            success: true,
            message: "Payment confirmed and tokens dispersed successfully",
            data: result,
            reference: referenceId
        });
    } catch (error) {
        console.error('❌ Payment confirmation failed:', error.message);

        res.status(500).json({
            success: false,
            error: error.message,
            reference: referenceId
        });
    }
});

/**
 * GET /api/fiat/status
 * ADMIN ONLY: Get Safe Wallet status and configuration
 */
router.get('/status', requireAdmin, async (req, res) => {
    try {
        const status = await getSafeStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Health check for Fiat Gateway
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Fiat Gateway',
        status: 'operational',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/fiat/distribution-stats
 * Public endpoint showing current distribution rates and configuration
 */
router.get('/distribution-stats', (req, res) => {
    try {
        const stats = getDistributionStats();
        res.json({
            success: true,
            distributionConfig: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/fiat/simulate-distribution
 * Simulate token distribution for a given BEZ amount
 * Body: { bezAmount: number }
 */
router.post('/simulate-distribution', async (req, res) => {
    const { bezAmount } = req.body;

    if (!bezAmount || isNaN(bezAmount) || bezAmount <= 0) {
        return res.status(400).json({
            success: false,
            error: "Invalid bezAmount. Must be a positive number"
        });
    }

    try {
        const simulation = simulateDistribution(parseFloat(bezAmount));
        const priceEur = await getBezPriceInEur();

        res.json({
            success: true,
            input: {
                bezAmount: parseFloat(bezAmount),
                equivalentEUR: (parseFloat(bezAmount) * priceEur).toFixed(2)
            },
            distribution: {
                userReceives: {
                    bez: simulation.user.toFixed(4),
                    eur: (simulation.user * priceEur).toFixed(4),
                    percent: simulation.rates.userPercent + '%'
                },
                burned: {
                    bez: simulation.burn.toFixed(4),
                    eur: (simulation.burn * priceEur).toFixed(4),
                    percent: simulation.rates.burnPercent + '%'
                },
                treasury: {
                    bez: simulation.treasury.toFixed(4),
                    eur: (simulation.treasury * priceEur).toFixed(4),
                    percent: simulation.rates.treasuryPercent + '%'
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
