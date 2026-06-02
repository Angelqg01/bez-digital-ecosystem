/**
 * AI Gateway Routes
 * 
 * Exposes the MCP Intelligence integration to the frontend/API consumers.
 * 
 * Routes:
 *   POST /api/ai-gateway/process-intent  → Full intent processing pipeline
 *   POST /api/ai-gateway/check-gas       → Quick gas analysis
 *   POST /api/ai-gateway/calculate-swap  → BEZ <-> FIAT swap calculation
 *   POST /api/ai-gateway/check-compliance → Regulatory check
 *   GET  /api/ai-gateway/health          → MCP server health
 */

const express = require('express');
const router = express.Router();
const aiGateway = require('../services/aiGateway.service');

// Middleware: ensure gateway is initialized
router.use(async (req, res, next) => {
    try {
        await aiGateway.initialize();
        next();
    } catch (error) {
        res.status(503).json({
            error: 'AI Gateway not available',
            message: error.message,
        });
    }
});

/**
 * POST /api/ai-gateway/process-intent
 * Full pipeline: Gas → Compliance → Execute
 */
router.post('/process-intent', async (req, res) => {
    try {
        const intent = req.body;

        if (!intent.walletAddress) {
            return res.status(400).json({ error: 'walletAddress is required' });
        }

        const result = await aiGateway.processIntent(intent);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai-gateway/check-gas
 */
router.post('/check-gas', async (req, res) => {
    try {
        const { transactionType, estimatedValueUSD } = req.body;
        const result = await aiGateway.checkGas(transactionType, estimatedValueUSD);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai-gateway/calculate-swap
 */
router.post('/calculate-swap', async (req, res) => {
    try {
        const { direction, amount, fiatCurrency } = req.body;
        const result = await aiGateway.calculateSwap(direction, amount, fiatCurrency);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/ai-gateway/check-compliance
 */
router.post('/check-compliance', async (req, res) => {
    try {
        const { walletAddress, amountBEZ, fiatRegion } = req.body;
        const result = await aiGateway.checkCompliance(walletAddress, amountBEZ, fiatRegion);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ai-gateway/health
 */
router.get('/health', async (req, res) => {
    const health = await aiGateway.healthCheck();
    res.json(health);
});

module.exports = router;
