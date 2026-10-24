/**
 * routes/gas-tank.js — Gas Tank de una organización (saldo prepago en créditos).
 *
 *   GET  /api/organizations/:orgId/gas-tank/packages
 *   GET  /api/organizations/:orgId/gas-tank/balance
 *   GET  /api/organizations/:orgId/gas-tank/activity?limit=&before=
 *   POST /api/organizations/:orgId/gas-tank/recharge/checkout   { packageId } | { amountEur }
 *   PATCH /api/organizations/:orgId/gas-tank/settings           { autoRecharge, thresholdEur, rechargeEur, monthlyCapEur }
 *
 * La recarga se acredita desde el webhook de Stripe (checkout.session.completed con
 * metadata.gas_tank_org_id → services/gasTank/recharge), nunca desde esta ruta.
 */
const { Router } = require('express');
const { body, query: q, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authenticateToken, requireOrgRole } = require('../middleware/security');
const cfg = require('../config/gas-tank');
const ledger = require('../services/gasTank/ledger');

const router = Router();

const ANY_MEMBER = ['owner', 'admin', 'developer', 'auditor', 'financial', 'operator'];
const RECHARGERS = ['owner', 'admin', 'financial'];

// Perezoso: ver usageBilling.js (sin STRIPE_SECRET_KEY no debe caer toda la API).
let _stripe = null;
function getStripe() {
    if (_stripe) return _stripe;
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe no configurado: falta STRIPE_SECRET_KEY');
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return _stripe;
}

const gasUrl = () => String(process.env.GAS_PUBLIC_URL || 'https://gas.bezhas.com').replace(/\/+$/, '');

const publicPackage = (p) => ({ id: p.id, eur: p.eur, bonusPct: p.bonusPct, credits: cfg.rechargeCredits(p.eur, p) });

router.get('/:orgId/gas-tank/packages', authenticateToken, requireOrgRole(...ANY_MEMBER), (req, res) => {
    res.json({
        success: true,
        eurPerCredit: cfg.EUR_PER_CREDIT,
        minEur: cfg.MIN_RECHARGE_EUR,
        maxEur: cfg.MAX_RECHARGE_EUR,
        packages: cfg.RECHARGE_PACKAGES.map(publicPackage),
    });
});

router.get('/:orgId/gas-tank/balance', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    const b = await ledger.getBalance(req.params.orgId);
    res.json({ success: true, ...b, balanceEur: b.balanceCredits * cfg.EUR_PER_CREDIT, eurPerCredit: cfg.EUR_PER_CREDIT });
});

router.get('/:orgId/gas-tank/activity', authenticateToken, requireOrgRole(...ANY_MEMBER), [
    q('limit').optional().isInt({ min: 1, max: 200 }),
    q('before').optional().isISO8601(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const items = await ledger.activity(req.params.orgId, { limit: req.query.limit, before: req.query.before || null });
    res.json({ success: true, items });
});

router.post('/:orgId/gas-tank/recharge/checkout', authenticateToken, requireOrgRole(...RECHARGERS), [
    body('packageId').optional().isString(),
    body('amountEur').optional().isFloat({ min: cfg.MIN_RECHARGE_EUR, max: cfg.MAX_RECHARGE_EUR }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const pkg = req.body.packageId ? cfg.getPackage(req.body.packageId) : null;
    if (req.body.packageId && !pkg) return res.status(400).json({ error: 'Paquete desconocido' });
    const eur = pkg ? pkg.eur : Number(req.body.amountEur);
    if (!pkg && !(eur >= cfg.MIN_RECHARGE_EUR)) return res.status(400).json({ error: 'Indica packageId o amountEur' });

    const orgId = req.params.orgId;
    const credits = cfg.rechargeCredits(eur, pkg);
    try {
        await ledger.ensureAccount(orgId);
        const session = await getStripe().checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: 'eur',
                    unit_amount: Math.round(eur * 100),
                    product_data: { name: 'Recarga Gas Tank BeZhas', description: `${credits.toLocaleString('es-ES')} créditos` },
                },
            }],
            client_reference_id: orgId,
            metadata: { gas_tank_org_id: orgId, gas_tank_package_id: pkg ? pkg.id : '' },
            payment_intent_data: { metadata: { gas_tank_org_id: orgId } },
            success_url: `${gasUrl()}/recharge?status=ok`,
            cancel_url: `${gasUrl()}/recharge?status=cancelled`,
        });
        res.json({ success: true, url: session.url, credits });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo iniciar el pago', details: error.message });
    }
});

// ── Ajustes de auto-recarga (importes en EUR hacia fuera, créditos en la base) ──
router.patch('/:orgId/gas-tank/settings', authenticateToken, requireOrgRole(...RECHARGERS), [
    body('autoRecharge').optional().isBoolean(),
    body('thresholdEur').optional().isFloat({ min: 0, max: cfg.MAX_RECHARGE_EUR }),
    body('rechargeEur').optional().isFloat({ min: cfg.MIN_RECHARGE_EUR, max: cfg.MAX_RECHARGE_EUR }),
    body('monthlyCapEur').optional({ nullable: true }).isFloat({ min: cfg.MIN_RECHARGE_EUR }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { autoRecharge, thresholdEur, rechargeEur, monthlyCapEur } = req.body;
    const orgId = req.params.orgId;

    if (autoRecharge === true) {
        const { rows } = await query(
            'SELECT stripe_default_payment_method_id FROM organization_billing_profiles WHERE organization_id = $1', [orgId]
        );
        if (!rows[0]?.stripe_default_payment_method_id) {
            return res.status(409).json({ error: 'Guarda un método de pago en Facturación antes de activar la auto-recarga' });
        }
    }
    await ledger.ensureAccount(orgId);
    const toCredits = (v) => (v === undefined ? undefined : v === null ? null : cfg.creditsForEur(Number(v)));
    const vals = { auto: autoRecharge, thr: toCredits(thresholdEur), rec: toCredits(rechargeEur), cap: toCredits(monthlyCapEur) };
    await query(
        `UPDATE gas_tank_accounts SET
            auto_recharge_enabled = COALESCE($2, auto_recharge_enabled),
            threshold_credits     = COALESCE($3, threshold_credits),
            recharge_credits      = COALESCE($4, recharge_credits),
            monthly_cap_credits   = CASE WHEN $5::boolean THEN $6 ELSE monthly_cap_credits END,
            updated_at = NOW()
          WHERE organization_id = $1`,
        [orgId, vals.auto ?? null, vals.thr ?? null, vals.rec ?? null, vals.cap !== undefined, vals.cap ?? null]
    );
    res.json({ success: true, ...(await ledger.getBalance(orgId)) });
});

module.exports = router;
