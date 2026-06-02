/**
 * routes/ai-billing.js — AI billing & subscription endpoints
 *
 * Public:   GET  /prices, /subscriptions, POST /estimate
 * Authed:   POST /record-usage, /pay-invoice, /subscribe
 *           GET  /invoices, /stats, /subscription
 */
const { Router } = require('express');
const { body, query: qv, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const pricing = require('../services/aiPricingService');
const billing = require('../services/aiBillingService');

const router = Router();

function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return false; }
    return true;
}

const VALID_PROVIDERS = ['claude', 'gemini', 'kimi', 'ollama'];
const VALID_TIERS = ['free', 'starter', 'professional', 'enterprise'];

// ═══════════════════════════════════════════════
//  PUBLIC — Price catalogue
// ═══════════════════════════════════════════════

router.get('/prices', (_req, res) => {
    res.json(pricing.getPriceCatalogue());
});

router.get('/subscriptions', (_req, res) => {
    res.json(pricing.getSubscriptionTiers());
});

// Estimate (no auth needed)
router.post('/estimate', [
    body('provider').isIn(VALID_PROVIDERS).withMessage('Invalid provider'),
    body('model').isString().notEmpty(),
    body('inputTokens').isInt({ gt: 0 }),
    body('outputTokens').isInt({ min: 0 }),
    body('subscriptionTier').optional().isIn(VALID_TIERS),
    body('execSeconds').optional().isInt({ min: 0 }),
], (req, res) => {
    if (!validate(req, res)) return;
    try {
        const { provider, model, inputTokens, outputTokens, subscriptionTier, execSeconds } = req.body;
        const invoice = pricing.calculateInvoice(provider, model, inputTokens, outputTokens, subscriptionTier || 'free', execSeconds || 0);
        res.json(invoice);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════
//  AUTHENTICATED — Usage & billing
// ═══════════════════════════════════════════════

router.post('/record-usage', authenticateToken, [
    body('enterpriseAddress').isEthereumAddress().withMessage('Invalid enterprise address'),
    body('provider').isIn(VALID_PROVIDERS),
    body('model').isString().notEmpty(),
    body('inputTokens').isInt({ gt: 0 }),
    body('outputTokens').isInt({ min: 0 }),
    body('execSeconds').optional().isInt({ min: 0 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const result = await billing.recordUsage({
            userId: req.user.userId,
            enterpriseAddress: req.body.enterpriseAddress,
            provider: req.body.provider,
            model: req.body.model,
            inputTokens: req.body.inputTokens,
            outputTokens: req.body.outputTokens,
            execSeconds: req.body.execSeconds || 0,
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/invoices', authenticateToken, [
    qv('status').optional().isIn(['pending', 'paid', 'overdue', 'cancelled']),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const invoices = await billing.getUserInvoices(req.user.userId, req.query.status || 'pending');
        res.json({ invoices });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pay-invoice', authenticateToken, [
    body('invoiceId').isInt({ gt: 0 }),
    body('enterpriseAddress').isEthereumAddress(),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const result = await billing.payInvoice(req.body.invoiceId, req.user.userId, req.body.enterpriseAddress);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await billing.getUserStats(req.user.userId);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/subscription', authenticateToken, async (req, res) => {
    try {
        const tier = await billing.getActiveSubscriptionTier(req.user.userId);
        const meta = pricing.SUBSCRIPTION_TIERS[tier];
        res.json({ tier, ...meta });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/subscribe', authenticateToken, [
    body('tier').isIn(VALID_TIERS).withMessage('Invalid tier'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const result = await billing.purchaseSubscription(req.user.userId, req.body.tier);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
