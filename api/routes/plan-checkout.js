'use strict';

/**
 * routes/plan-checkout.js — contratar un plan desde el Hub (/api/billing).
 *
 *   GET  /account         estado de la cuenta: BeZhas ID, email verificado y plan vigente
 *   POST /plan-checkout   sesión de Stripe Checkout de un plan de pago; al pagar, vuelve a la app de origen
 *   POST /plan-free       activa Starter (sin pago)
 *
 * Requiere sesión y email confirmado (por eso existe la confirmación: el plan se cuelga de la cuenta del
 * titular verificado). El plan se activa por el webhook de Stripe de siempre (checkout.session.completed,
 * metadata.plan_id + client_reference_id = app de la cuenta); esta ruta nunca activa un plan de pago.
 */
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const { authenticateToken } = require('../middleware/security');
const { STRIPE_PAYMENT_LINKS } = require('../config/stripe-payment-links');
const { getPlan } = require('../config/plans');
const { safeReturnTo } = require('../lib/returnTo');
const { ensureAccountApp, currentPlan, startFree } = require('../services/accountApp');
const logger = require('../utils/logger');

const router = Router();
const PAID = ['creator_pro', 'business', 'enterprise_vip'];
const hubUrl = () => String(process.env.HUB_PUBLIC_URL || 'https://hub.bezhas.com').replace(/\/+$/, '');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos.' } });

let stripeClient = null;
const getStripe = () => {
    if (stripeClient) return stripeClient;
    if (!process.env.STRIPE_SECRET_KEY) return null;
    stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return stripeClient;
};
const __setStripe = (c) => { stripeClient = c; };

async function loadUser(id) {
    const { rows } = await query('SELECT id, email, username, bezhas_id, email_verified_at FROM users WHERE id = $1 LIMIT 1', [id]);
    return rows[0] || null;
}

router.get('/account', authenticateToken, async (req, res) => {
    try {
        const user = await loadUser(req.user.userId);
        if (!user) return res.status(401).json({ error: 'Sesión inválida' });
        res.json({
            success: true,
            account: {
                bezhasId: user.bezhas_id,
                email: user.email,
                username: user.username,
                emailVerified: !!user.email_verified_at,
                plan: await currentPlan(user.id),
            },
        });
    } catch (e) {
        res.status(500).json({ error: 'No se pudo leer la cuenta' });
    }
});

const exigirVerificado = async (req, res) => {
    const user = await loadUser(req.user.userId);
    if (!user) { res.status(401).json({ error: 'Sesión inválida' }); return null; }
    if (!user.email) { res.status(409).json({ error: 'Tu cuenta no tiene email: añádelo para contratar un plan.', code: 'EMAIL_REQUIRED' }); return null; }
    if (!user.email_verified_at) { res.status(403).json({ error: 'Confirma tu email para contratar un plan.', code: 'EMAIL_NOT_VERIFIED' }); return null; }
    return user;
};

router.post('/plan-checkout', limiter, authenticateToken, [
    body('planId').isIn(PAID).withMessage('Plan no válido'),
    body('billing').optional().isIn(['monthly', 'annual']),
    body('returnTo').optional({ nullable: true }).isString(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const user = await exigirVerificado(req, res);
        if (!user) return;
        const stripe = getStripe();
        if (!stripe) return res.status(503).json({ error: 'Los pagos no están disponibles ahora mismo.', code: 'PAYMENTS_UNAVAILABLE' });

        const planId = req.body.planId;
        const billing = req.body.billing === 'annual' ? 'annual' : 'monthly';
        const priceId = STRIPE_PAYMENT_LINKS.plans[planId]?.[billing]?.priceId;
        if (!priceId || !getPlan(planId)) return res.status(400).json({ error: 'Plan no disponible' });

        const returnTo = safeReturnTo(req.body.returnTo);
        const appId = await ensureAccountApp(user);
        const q = returnTo ? `&return=${encodeURIComponent(returnTo)}` : '';
        const meta = { plan_id: planId, billing, user_id: String(user.id), bezhas_id: user.bezhas_id || '' };

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            client_reference_id: appId,
            customer_email: user.email,
            metadata: meta,
            subscription_data: { metadata: meta },
            automatic_tax: { enabled: true },
            billing_address_collection: 'required',
            tax_id_collection: { enabled: true },
            success_url: `${hubUrl()}/suscripcion/listo?session_id={CHECKOUT_SESSION_ID}${q}`,
            cancel_url: `${hubUrl()}/planes?cancelled=1${q}`,
        });
        res.json({ success: true, url: session.url });
    } catch (e) {
        logger.error({ error: e.message }, 'plan-checkout falló');
        res.status(500).json({ error: 'No se pudo iniciar el pago' });
    }
});

router.post('/plan-free', limiter, authenticateToken, async (req, res) => {
    try {
        const user = await exigirVerificado(req, res);
        if (!user) return;
        await startFree(user);
        res.json({ success: true, plan: await currentPlan(user.id) });
    } catch (e) {
        logger.error({ error: e.message }, 'plan-free falló');
        res.status(500).json({ error: 'No se pudo activar el plan' });
    }
});

module.exports = router;
module.exports.__setStripe = __setStripe;
