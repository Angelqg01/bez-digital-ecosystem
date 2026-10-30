/**
 * routes/gas-tank.js — Gas Tank de una organización (saldo prepago en créditos).
 *
 *   GET  /api/organizations/:orgId/gas-tank/packages
 *   GET  /api/organizations/:orgId/gas-tank/balance
 *   GET  /api/organizations/:orgId/gas-tank/activity?limit=&before=
 *   POST /api/organizations/:orgId/gas-tank/recharge/checkout   { packageId } | { amountEur }
 *   POST /api/organizations/:orgId/gas-tank/fee-voucher         { appId, sender, target, selector, amountBez }
 *   POST /api/organizations/:orgId/gas-tank/sponsor             { appId, userOp }   → paymasterAndData firmado
 *   POST /api/organizations/:orgId/gas-tank/sponsor/release     { userOp }
 *   PATCH /api/organizations/:orgId/gas-tank/settings           { autoRecharge, thresholdEur, rechargeEur, monthlyCapEur }
 *   GET  /api/organizations/:orgId/gas-tank/policy              política de patrocinio + plantillas
 *   PUT  /api/organizations/:orgId/gas-tank/policy              { active, allowedTargets, maxCostCreditsPerOp, dailyCapCredits }
 *   POST /api/organizations/:orgId/gas-tank/simulate            { calls: [{ target, selector }], gasUsed, gasPriceGwei, protocolFeeBez }
 *   GET  /api/organizations/:orgId/gas-tank/apps                apps de la organización y su URL ERC-7677
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
const paymasterService = require('../services/gasTank/paymasterService');
const policyAdmin = require('../services/gasTank/policyAdmin');

const router = Router();

const ANY_MEMBER = ['owner', 'admin', 'developer', 'auditor', 'financial', 'operator'];
const RECHARGERS = ['owner', 'admin', 'financial'];
const SPONSORS = ['owner', 'admin', 'developer', 'operator'];
// Quién decide qué se patrocina con el dinero de la organización: no un developer ni un operador.
const POLICY_EDITORS = ['owner', 'admin'];

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

// ── Patrocinio de UserOperations (ERC-4337) ──
// Los errores del servicio llevan code/status propios (política denegada 403, sin saldo 402, no configurado 503…).
const sponsorError = (res, err) => {
    const status = Number.isInteger(err.status) ? err.status : 500;
    if (status >= 500 && status !== 503) return res.status(500).json({ error: 'No se pudo procesar el patrocinio' });
    return res.status(status).json({ error: err.message, code: err.code });
};
const bigintSafe = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));

router.post('/:orgId/gas-tank/fee-voucher', authenticateToken, requireOrgRole(...SPONSORS), [
    body('appId').isString().notEmpty(),
    body('sender').isString(),
    body('target').isString(),
    body('selector').matches(/^0x[0-9a-fA-F]{8}$/),
    body('amountBez').isFloat({ gt: 0 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const { appId, sender, target, selector, amountBez } = req.body;
        res.json({ success: true, voucher: bigintSafe(await paymasterService.issueFeeVoucher({ orgId: req.params.orgId, appId, sender, target, selector, amountBez })) });
    } catch (err) { sponsorError(res, err); }
});

router.post('/:orgId/gas-tank/sponsor', authenticateToken, requireOrgRole(...SPONSORS), [
    body('appId').isString().notEmpty(),
    body('userOp').isObject(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const out = await paymasterService.sponsorUserOp({ orgId: req.params.orgId, appId: req.body.appId, userOp: req.body.userOp });
        res.json({ success: true, ...bigintSafe(out) });
    } catch (err) { sponsorError(res, err); }
});

router.post('/:orgId/gas-tank/sponsor/release', authenticateToken, requireOrgRole(...SPONSORS), [
    body('userOp').isObject(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        res.json({ success: true, ...bigintSafe(await paymasterService.releaseSponsorship({ orgId: req.params.orgId, userOp: req.body.userOp })) });
    } catch (err) { sponsorError(res, err); }
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

// ── Política de patrocinio (panel: Políticas, Presupuestos, Simulador, Apps) ──
const policyError = (res, err) => {
    if (err instanceof policyAdmin.PolicyInputError) return res.status(400).json({ error: err.message, code: err.code, field: err.field });
    return res.status(500).json({ error: 'No se pudo procesar la política' });
};

router.get('/:orgId/gas-tank/policy', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    try {
        res.json({
            success: true,
            policy: await policyAdmin.getPolicy(req.params.orgId),
            templates: policyAdmin.TEMPLATES,
            limits: { maxCostCreditsPerOp: policyAdmin.MAX_COST_PER_OP_CREDITS, maxDailyCapCredits: policyAdmin.MAX_DAILY_CAP_CREDITS },
            eurPerCredit: cfg.EUR_PER_CREDIT,
        });
    } catch (err) { policyError(res, err); }
});

router.put('/:orgId/gas-tank/policy', authenticateToken, requireOrgRole(...POLICY_EDITORS), async (req, res) => {
    try {
        res.json({ success: true, policy: await policyAdmin.savePolicy(req.params.orgId, req.body || {}) });
    } catch (err) { policyError(res, err); }
});

router.post('/:orgId/gas-tank/simulate', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    try {
        res.json({ success: true, ...(await policyAdmin.simulate(req.params.orgId, req.body || {})) });
    } catch (err) { policyError(res, err); }
});

router.get('/:orgId/gas-tank/apps', authenticateToken, requireOrgRole(...ANY_MEMBER), async (req, res) => {
    try {
        res.json({ success: true, apps: await policyAdmin.listApps(req.params.orgId) });
    } catch (err) { policyError(res, err); }
});

module.exports = router;
