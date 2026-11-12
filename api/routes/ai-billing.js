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
const { resolverPrincipal } = require('../services/ai-workspace/principal');

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

/*
 * Rutas de escritura RETIRADAS (2026-11-12, revisión de seguridad H1, H2 y H4).
 *
 * Este módulo es el sistema de facturación de IA anterior al Gateway. Tres de
 * sus rutas movían dinero sin comprobar nada:
 *
 *   POST /subscribe      daba el nivel que pidiera el cliente sin iniciar ni
 *                        verificar ningún cobro.
 *   POST /pay-invoice    marcaba la factura como pagada con sólo LEER un saldo
 *                        del Paymaster: no transfería fondos ni pedía un recibo.
 *   POST /record-usage   facturaba los tokens que declarase el navegador.
 *
 * Ningún cliente las usa (sólo se consume GET /subscription). El plan se
 * contrata por Stripe Checkout y se activa desde su webhook verificado; el
 * consumo lo mide el servidor que llama al modelo. Se responde 410 en lugar de
 * borrar la ruta para que un cliente antiguo reciba un motivo y no un 404.
 */
function retirada(flujo) {
    return (_req, res) => res.status(410).json({
        error: 'Esta operación del sistema de facturación anterior está retirada.',
        code: 'AI_BILLING_RETIRED',
        use: flujo,
    });
}
router.post('/record-usage', authenticateToken,
    retirada('El consumo lo registra el servidor al ejecutar la llamada; no se declara desde el cliente.'));

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

router.post('/pay-invoice', authenticateToken,
    retirada('Las facturas se liquidan por Stripe; no existe pago por lectura de saldo.'));

router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await billing.getUserStats(req.user.userId);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Plan de la plataforma (organización → app → gateway_subscriptions) → nivel que entienden las SubApps.
const PLAN_A_TIER = { starter: 'starter', creator_pro: 'professional', business: 'professional', enterprise_vip: 'enterprise' };

router.get('/subscription', authenticateToken, async (req, res) => {
    try {
        // Manda el plan de la organización (gateway_subscriptions), que es el que se cobra.
        let tier = 'free';
        try {
            const principal = await resolverPrincipal(req.user);
            tier = PLAN_A_TIER[principal && principal.plan] || 'free';
        } catch (_) { /* sin plan resoluble: se queda en free */ }
        // La tabla antigua ai_subscriptions ya no se consulta: sus filas las escribía
        // POST /subscribe sin cobro verificado, así que no prueban que nadie haya pagado.
        const meta = pricing.SUBSCRIPTION_TIERS[tier];
        res.json({ tier, ...meta });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/subscribe', authenticateToken,
    retirada('POST /api/gateway/v1/subscription/checkout (Stripe Checkout). El plan se activa desde el webhook.'));

module.exports = router;
