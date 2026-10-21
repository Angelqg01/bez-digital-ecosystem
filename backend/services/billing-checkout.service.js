'use strict';

/**
 * ============================================================================
 * COBROS CON STRIPE: PLANES Y COMPRA DE BEZ  (una sola implementación)
 * ============================================================================
 *
 * Lo usan, con las mismas reglas: la API REST (`/api/checkout/*`), el chat, las
 * apps nativas y el MCP. Nadie más crea sesiones de pago de planes ni de BEZ.
 *
 * Reglas (aquí hay dinero real):
 *  - PRECIOS SOLO DEL SERVIDOR. El cliente envía un plan y un ciclo, nunca un
 *    importe. El precio y la divisa salen de `config/tier.config.js`.
 *  - IDENTIDAD SOLO DE LA SESIÓN. El usuario viene de la sesión autenticada;
 *    se ata a Stripe con `client_reference_id` y metadatos propios.
 *  - REDIRECCIONES SOLO NUESTRAS. `success_url`/`cancel_url` salen de
 *    FRONTEND_URL, jamás de la petición. La URL de pago que se devuelve se
 *    comprueba (https + dominio de Stripe) antes de entregarla.
 *  - NUNCA TARJETAS. El cliente paga en la página alojada de Stripe; ni el chat
 *    ni las apps ni el MCP ven datos de pago.
 *  - ACTIVAR SOLO TRAS PAGO. El plan se activa desde el webhook firmado, con
 *    `payment_status` pagado, la sesión atada al usuario y el plan validado.
 *    Es idempotente: un evento repetido no cambia nada.
 */

const { SUBSCRIPTION_TIERS } = require('../config/tier.config');

const SOURCE_PLAN = 'bezhas_plan';
const { getPack } = require('../config/credit-packs');
const SOURCE_CREDITS = 'bezhas_credits';
const SOURCE_BEZ = 'bezhas_bez_purchase';
const CYCLES = Object.freeze(['monthly', 'yearly']);
const FREE_PLAN = 'FREE';
const STRIPE_HOSTS = () => ['checkout.stripe.com', 'billing.stripe.com',
    ...String(process.env.STRIPE_EXTRA_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)];
// Un price de Stripe real es `price_` + alfanumérico; los marcadores de posición de la config (price_creator_monthly) no valen.
const REAL_PRICE_ID = /^price_[A-Za-z0-9]{14,}$/;
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;
const WALLET = /^0x[a-fA-F0-9]{40}$/;

const err = (status, code, message) => Object.assign(new Error(message), { status, code });

let stripeClient = null;
const getStripe = () => {
    if (!stripeClient) {
        if (!process.env.STRIPE_SECRET_KEY) throw err(503, 'PAYMENTS_UNAVAILABLE', 'Los pagos no están configurados');
        stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
    return stripeClient;
};
/** Solo para pruebas: inyecta un cliente de Stripe simulado. */
const _setStripeForTests = (client) => { stripeClient = client; };

function auditEvent(kind, level, data) {
    try { require('../middleware/auditLogger').audit.admin(kind, level, data); } catch (_) { /* la auditoría nunca rompe un cobro */ }
}

// ─── Catálogo ───────────────────────────────────────────────────────────────

const toCents = (amount) => Math.round(Number(amount) * 100);

function planFromTier(tier) {
    return {
        id: tier.id,
        key: String(tier.id).toUpperCase(),
        name: tier.displayName || tier.name,
        description: tier.description,
        currency: String(tier.price.currency || 'EUR').toUpperCase(),
        priceMonthly: tier.price.monthly,
        priceYearly: tier.price.yearly,
        purchasable: Number(tier.price.monthly) > 0,
    };
}

/** Planes que se pueden comprar con Stripe (precio > 0). Sin ids de Stripe ni datos internos. */
function listPlans() {
    return Object.values(SUBSCRIPTION_TIERS).map(planFromTier);
}

function purchasablePlan(planId) {
    if (typeof planId !== 'string' || !/^[a-z]{3,20}$/i.test(planId)) throw err(400, 'INVALID_PLAN', 'Plan no válido');
    const tier = Object.values(SUBSCRIPTION_TIERS).find((t) => String(t.id).toLowerCase() === planId.toLowerCase());
    if (!tier || !(Number(tier.price.monthly) > 0)) throw err(400, 'INVALID_PLAN', 'Ese plan no se puede comprar');
    return tier;
}

function validCycle(cycle) {
    const c = cycle === undefined || cycle === null ? 'monthly' : cycle;
    if (!CYCLES.includes(c)) throw err(400, 'INVALID_CYCLE', 'Ciclo de facturación no válido (monthly o yearly)');
    return c;
}

// ─── URLs ───────────────────────────────────────────────────────────────────

/** Origen del frontend, configurado en servidor. En producción exige https. */
function frontendOrigin() {
    const raw = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    let u;
    try { u = new URL(raw); } catch (_) { throw err(503, 'PAYMENTS_UNAVAILABLE', 'Los pagos no están configurados (FRONTEND_URL)'); }
    const secure = u.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && u.protocol === 'http:');
    if (!secure || u.username || u.password) throw err(503, 'PAYMENTS_UNAVAILABLE', 'FRONTEND_URL no es válida');
    return u.origin;
}

/** La URL de pago devuelta debe ser https y de un dominio de Stripe. Si no, no se entrega. */
function assertStripeUrl(url) {
    let u;
    try { u = new URL(url); } catch (_) { throw err(502, 'INVALID_CHECKOUT_URL', 'Stripe devolvió una URL no válida'); }
    if (u.protocol !== 'https:' || u.username || u.password || !STRIPE_HOSTS().includes(u.hostname.toLowerCase())) {
        throw err(502, 'INVALID_CHECKOUT_URL', 'Stripe devolvió una URL no permitida');
    }
    return u.toString();
}

const userIdOf = (user) => String((user && (user.id || user._id)) || '');

function requireUser(user) {
    const id = userIdOf(user);
    if (!id) throw err(401, 'UNAUTHENTICATED', 'Sesión inválida');
    return id;
}

// ─── Crear sesiones de pago ─────────────────────────────────────────────────

/**
 * Suscripción a un plan. Devuelve { sessionId, url } de la página de pago de Stripe.
 */
async function createPlanCheckout({ user, planId, cycle }) {
    const userId = requireUser(user);
    const tier = purchasablePlan(planId);
    const billing = validCycle(cycle);
    const price = billing === 'yearly' ? tier.price.yearly : tier.price.monthly;
    if (!(Number(price) > 0)) throw err(400, 'INVALID_CYCLE', 'Ese plan no tiene ciclo anual');

    // Quien ya tiene una suscripción activa no abre otra (se cobraría dos veces): mejora la existente.
    const currentSub = user.stripe_subscription_id || user.stripeSubscriptionId;
    const currentPlan = String(user.subscription || '').toLowerCase();
    if (currentSub && currentPlan && currentPlan !== 'free' && currentPlan !== 'starter') {
        return upgradeExistingSubscription({ userId, tier, billing, price, currentPlan, subscriptionId: currentSub });
    }

    const origin = frontendOrigin();
    const currency = String(tier.price.currency || 'EUR').toLowerCase();
    const priceId = tier.price.stripePriceId && tier.price.stripePriceId[billing];
    const lineItem = REAL_PRICE_ID.test(String(priceId || ''))
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
                currency,
                unit_amount: toCents(price),
                recurring: { interval: billing === 'yearly' ? 'year' : 'month' },
                product_data: { name: `BeZhas ${tier.displayName || tier.name}`, description: tier.description },
            },
        };

    const meta = { source: SOURCE_PLAN, bz_user_id: userId, bz_plan: String(tier.id).toLowerCase(), bz_cycle: billing };
    const params = {
        mode: 'subscription',
        line_items: [lineItem],
        client_reference_id: userId,
        metadata: meta,
        // `metadata` de la sesión no pasa a la suscripción: sin esto los eventos de renovación/cancelación no saben de quién son.
        subscription_data: { metadata: meta },
        allow_promotion_codes: true,
        success_url: `${origin}/vip/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/vip?checkout=cancelled`,
    };
    const customer = user.stripe_customer_id || user.stripeCustomerId;
    if (customer) params.customer = customer;
    else if (user.email) params.customer_email = user.email;

    // Mismo usuario, plan y ciclo en 5 minutos → misma sesión (un doble clic no crea dos).
    const idempotencyKey = `bz-plan-${userId}-${meta.bz_plan}-${billing}-${Math.floor(Date.now() / 300000)}`;
    const session = await getStripe().checkout.sessions.create(params, { idempotencyKey });
    const url = assertStripeUrl(session.url);
    auditEvent('CHECKOUT_PLAN_CREATED', 'info', { userId, plan: meta.bz_plan, cycle: billing, sessionId: session.id });
    return { sessionId: session.id, url, plan: meta.bz_plan, cycle: billing, amount: Number(price), currency: currency.toUpperCase() };
}

/** Mejora de plan en la misma suscripción de Stripe: se cobra la diferencia prorrateada al momento. Solo hacia un plan superior. */
async function upgradeExistingSubscription({ userId, tier, billing, price, currentPlan, subscriptionId }) {
    const rank = (id) => {
        const t = Object.values(SUBSCRIPTION_TIERS).find((x) => String(x.id).toLowerCase() === id);
        return t ? Number(t.price.monthly) : 0;
    };
    const target = String(tier.id).toLowerCase();
    if (rank(target) <= rank(currentPlan)) {
        throw err(409, 'ALREADY_SUBSCRIBED', 'Ya tienes ese plan o uno superior. Cambia o cancela desde la gestión de tu suscripción.');
    }
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    // La suscripción debe ser de esta persona y estar viva.
    if (!sub || !sub.metadata || sub.metadata.bz_user_id !== userId || !['active', 'trialing', 'past_due'].includes(sub.status)) {
        throw err(409, 'SUBSCRIPTION_NOT_ACTIVE', 'No encontramos una suscripción activa que mejorar.');
    }
    const item = sub.items && sub.items.data && sub.items.data[0];
    if (!item) throw err(409, 'SUBSCRIPTION_NOT_ACTIVE', 'No encontramos una suscripción activa que mejorar.');
    const currency = String(tier.price.currency || 'EUR').toLowerCase();
    const meta = { ...sub.metadata, source: SOURCE_PLAN, bz_user_id: userId, bz_plan: target, bz_cycle: billing };
    await stripe.subscriptions.update(subscriptionId, {
        items: [{
            id: item.id,
            price_data: {
                currency,
                product: typeof item.price.product === 'string' ? item.price.product : item.price.product.id,
                unit_amount: toCents(price),
                recurring: { interval: billing === 'yearly' ? 'year' : 'month' },
            },
        }],
        metadata: meta,
        proration_behavior: 'always_invoice',     // cobra ya la diferencia
        payment_behavior: 'error_if_incomplete',  // si el cobro falla, el plan no cambia
    }, { idempotencyKey: `bz-upgrade-${userId}-${target}-${billing}-${Math.floor(Date.now() / 300000)}` });
    // El plan se aplica en nuestra base al recibir customer.subscription.updated (o ahora, de forma idempotente).
    await User().update(userId, { subscription: target.toUpperCase(), subscriptionBillingCycle: billing });
    auditEvent('PLAN_UPGRADED', 'info', { userId, from: currentPlan, to: target, cycle: billing });
    return { upgraded: true, plan: target, cycle: billing, amount: Number(price), currency: currency.toUpperCase() };
}

/** Compra de un pack de créditos de chat (EUR, pago único). El pack lo define el servidor. */
async function createCreditsCheckout({ user, packId }) {
    const userId = requireUser(user);
    const pack = typeof packId === 'string' ? getPack(packId) : null;
    if (!pack) throw err(400, 'INVALID_PACK', 'Pack de créditos no válido');
    const origin = frontendOrigin();
    const meta = { source: SOURCE_CREDITS, bz_user_id: userId, bz_pack: pack.id };
    const params = {
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: toCents(pack.priceEur), product_data: { name: `BeZhas · ${pack.name}` } } }],
        client_reference_id: userId,
        metadata: meta,
        payment_intent_data: { metadata: meta },
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}&kind=credits`,
        cancel_url: `${origin}/home?checkout=cancelled`,
    };
    const customer = user.stripe_customer_id || user.stripeCustomerId;
    if (customer) params.customer = customer;
    else if (user.email) params.customer_email = user.email;
    const idempotencyKey = `bz-credits-${userId}-${pack.id}-${Math.floor(Date.now() / 300000)}`;
    const session = await getStripe().checkout.sessions.create(params, { idempotencyKey });
    const url = assertStripeUrl(session.url);
    auditEvent('CHECKOUT_CREDITS_CREATED', 'info', { userId, pack: pack.id, sessionId: session.id });
    return { sessionId: session.id, url, pack: pack.id, credits: pack.credits, amount: pack.priceEur, currency: 'EUR' };
}

function validEurAmount(amountEur) {
    const min = Number(process.env.BEZ_PURCHASE_MIN_EUR || 10);
    const max = Number(process.env.BEZ_PURCHASE_MAX_EUR || 5000);
    let n = amountEur;
    if (typeof n === 'string') {
        // Solo dígitos con hasta 2 decimales; sin regex anidada.
        const [whole, frac = '', ...rest] = n.trim().split('.');
        const digits = (t) => t.length > 0 && [...t].every((c) => c >= '0' && c <= '9');
        n = rest.length === 0 && whole.length <= 7 && digits(whole) && frac.length <= 2 && (frac === '' || digits(frac)) ? Number(n) : NaN;
    }
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
        throw err(400, 'INVALID_AMOUNT', 'Importe no válido (máximo 2 decimales)');
    }
    if (n < min || n > max) throw err(400, 'INVALID_AMOUNT', `El importe debe estar entre ${min} y ${max} EUR`);
    return n;
}

/**
 * Compra de BEZ con tarjeta (en EUR). El BEZ se entrega a la wallet vinculada de la cuenta cuando el webhook confirma el pago.
 */
async function createBezCheckout({ user, amountEur }) {
    const userId = requireUser(user);
    const eur = validEurAmount(amountEur);
    const wallet = String(user.wallet_address || user.walletAddress || '');
    if (!WALLET.test(wallet)) throw err(409, 'WALLET_REQUIRED', 'Vincula una wallet a tu cuenta para recibir el BEZ');
    const origin = frontendOrigin();
    const cents = Math.round(eur * 100);
    const meta = { type: 'token_purchase', source: SOURCE_BEZ, userId, walletAddress: wallet.toLowerCase(), eurAmount: eur.toFixed(2) };

    const idempotencyKey = `bz-bez-${userId}-${cents}-${Math.floor(Date.now() / 300000)}`;
    const session = await getStripe().checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
            quantity: 1,
            price_data: { currency: 'eur', unit_amount: cents, product_data: { name: 'Compra de BEZ', description: `BEZ por ${eur.toFixed(2)} EUR, al precio vigente en el momento del pago` } },
        }],
        client_reference_id: userId,
        metadata: meta,
        payment_intent_data: { metadata: meta },
        ...(user.email ? { customer_email: user.email } : {}),
        success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/buy-tokens?checkout=cancelled`,
    }, { idempotencyKey });
    const url = assertStripeUrl(session.url);
    auditEvent('CHECKOUT_BEZ_CREATED', 'info', { userId, eur, sessionId: session.id });
    return { sessionId: session.id, url, amount: eur, currency: 'EUR' };
}

/** Portal de facturación de Stripe: cambiar tarjeta, ver facturas, cancelar. */
async function createPortalSession({ user }) {
    requireUser(user);
    const customer = user.stripe_customer_id || user.stripeCustomerId;
    if (!customer) throw err(409, 'NO_SUBSCRIPTION', 'Todavía no tienes una suscripción de pago');
    const session = await getStripe().billingPortal.sessions.create({ customer, return_url: `${frontendOrigin()}/settings` });
    return { url: assertStripeUrl(session.url) };
}

/** Estado de una sesión de pago, solo si es del propio usuario. */
async function getSessionForUser({ user, sessionId }) {
    const userId = requireUser(user);
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw err(400, 'INVALID_SESSION', 'Sesión de pago no válida');
    let s;
    try { s = await getStripe().checkout.sessions.retrieve(sessionId); } catch (e) {
        if (e && e.statusCode === 404) throw err(404, 'SESSION_NOT_FOUND', 'Sesión de pago no encontrada');
        throw e;
    }
    // Una sesión ajena se responde como inexistente (no se confirma que exista).
    if (s.client_reference_id !== userId) throw err(404, 'SESSION_NOT_FOUND', 'Sesión de pago no encontrada');
    const m = s.metadata || {};
    return { sessionId: s.id, status: s.status, paymentStatus: s.payment_status, kind: m.source === SOURCE_PLAN ? 'plan' : m.source === SOURCE_BEZ ? 'bez' : m.source === SOURCE_CREDITS ? 'credits' : 'other', plan: m.bz_plan || null };
}

// ─── Activación desde webhooks (ya verificados por la firma) ────────────────

const User = () => require('../models/pg/User');
const iso = (seconds) => (Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null);

function expiryFor(cycle, from = new Date()) {
    const d = new Date(from);
    if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
}

/** checkout.session.completed / async_payment_succeeded de una suscripción de plan. */
async function activatePlanFromSession(session) {
    const m = (session && session.metadata) || {};
    if (m.source !== SOURCE_PLAN) return { handled: false };
    if (session.mode !== 'subscription') return { handled: false };
    if (!['paid', 'no_payment_required'].includes(session.payment_status)) {
        return { handled: true, activated: false, reason: 'pending_payment' }; // pago asíncrono: llegará async_payment_succeeded
    }
    const userId = String(m.bz_user_id || '');
    if (!userId || session.client_reference_id !== userId) {
        auditEvent('CHECKOUT_PLAN_REJECTED', 'critical', { reason: 'user_mismatch', sessionId: session.id });
        return { handled: true, activated: false, error: 'La sesión no pertenece al usuario indicado', permanent: true };
    }
    let tier;
    let cycle;
    try { tier = purchasablePlan(m.bz_plan); cycle = validCycle(m.bz_cycle); } catch (e) {
        auditEvent('CHECKOUT_PLAN_REJECTED', 'critical', { reason: e.code, sessionId: session.id });
        return { handled: true, activated: false, error: e.message, permanent: true };
    }
    const user = await User().findById(userId);
    if (!user) {
        auditEvent('CHECKOUT_PLAN_REJECTED', 'critical', { reason: 'user_not_found', sessionId: session.id, userId });
        return { handled: true, activated: false, error: 'Usuario no encontrado', permanent: true };
    }
    const key = String(tier.id).toUpperCase();
    // Idempotente: el mismo evento repetido deja el mismo estado.
    await User().update(userId, {
        subscription: key,
        subscriptionStartedAt: new Date().toISOString(),
        subscriptionExpiresAt: expiryFor(cycle),
        subscriptionSource: 'stripe',
        subscriptionBillingCycle: cycle,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
        stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
    });
    auditEvent('CHECKOUT_PLAN_ACTIVATED', 'info', { userId, plan: key, cycle, sessionId: session.id, amount: (session.amount_total || 0) / 100 });
    return { handled: true, activated: true, userId, plan: key, cycle };
}

/** checkout.session.completed / async_payment_succeeded de un pack de créditos: suma el saldo una sola vez. */
async function activateCreditsFromSession(session) {
    const m = (session && session.metadata) || {};
    if (m.source !== SOURCE_CREDITS || session.mode !== 'payment') return { handled: false };
    if (session.payment_status !== 'paid') return { handled: true, granted: false, reason: 'pending_payment' };
    const userId = String(m.bz_user_id || '');
    const pack = getPack(m.bz_pack);
    if (!userId || session.client_reference_id !== userId || !pack) {
        auditEvent('CHECKOUT_CREDITS_REJECTED', 'critical', { sessionId: session.id, reason: !pack ? 'invalid_pack' : 'user_mismatch' });
        return { handled: true, granted: false, error: 'Sesión de créditos no válida', permanent: true };
    }
    // Se comprueba lo realmente pagado contra el precio del pack: nunca se entregan créditos por un pago menor.
    if (String(session.currency || '').toLowerCase() !== 'eur' || Number(session.amount_total) < toCents(pack.priceEur)) {
        auditEvent('CHECKOUT_CREDITS_REJECTED', 'critical', { sessionId: session.id, reason: 'amount_mismatch' });
        return { handled: true, granted: false, error: 'Importe pagado no coincide con el pack', permanent: true };
    }
    if (!(await User().findById(userId))) return { handled: true, granted: false, error: 'Usuario no encontrado', permanent: true };
    const granted = await require('./ai-workspace/credits').getCreditService().grantPack(userId, session.id, pack);
    if (granted) auditEvent('CREDITS_GRANTED', 'info', { userId, pack: pack.id, credits: pack.credits, sessionId: session.id });
    return { handled: true, granted, userId, credits: pack.credits };
}

async function downgrade(user, reason) {
    await User().update(user.id || user._id, {
        subscription: FREE_PLAN, subscriptionExpiresAt: null, subscriptionSource: null,
        subscriptionBillingCycle: null, stripeSubscriptionId: null,
    });
    auditEvent('PLAN_DOWNGRADED', 'info', { userId: user.id || user._id, reason });
}

/** customer.subscription.updated / deleted. */
async function handleSubscriptionEvent(event) {
    const sub = event.data.object;
    const user = await User().findByStripeSubscription(sub.id);
    if (!user) return { handled: false };
    if (event.type === 'customer.subscription.deleted') {
        await downgrade(user, 'subscription_deleted');
        return { handled: true, downgraded: true };
    }
    if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
        await downgrade(user, `status_${sub.status}`);
        return { handled: true, downgraded: true };
    }
    const planId = sub.metadata && sub.metadata.bz_plan;
    let key = null;
    try { key = String(purchasablePlan(planId).id).toUpperCase(); } catch (_) { /* conserva el plan actual */ }
    await User().update(user.id || user._id, {
        ...(key ? { subscription: key } : {}),
        subscriptionExpiresAt: iso(sub.current_period_end) || undefined,
    });
    return { handled: true, updated: true };
}

/** invoice.payment_succeeded (renovaciones) y invoice.payment_failed. */
async function handleInvoiceEvent(event) {
    const invoice = event.data.object;
    const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
    const user = subId ? await User().findByStripeSubscription(subId) : null;
    if (!user) return { handled: false };
    if (event.type === 'invoice.payment_failed') {
        auditEvent('PLAN_PAYMENT_FAILED', 'medium', { userId: user.id || user._id, invoiceId: invoice.id, attempt: invoice.attempt_count });
        return { handled: true, failed: true }; // Stripe reintenta; la baja llega con subscription.updated/deleted
    }
    const lines = (invoice.lines && invoice.lines.data) || [];
    const end = lines.reduce((max, l) => Math.max(max, (l.period && l.period.end) || 0), 0);
    if (end) await User().update(user.id || user._id, { subscriptionExpiresAt: iso(end) });
    return { handled: true, renewed: true };
}

/** Punto de entrada único desde el router de webhooks. */
async function handleEvent(event) {
    switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
            return event.data.object && event.data.object.metadata && event.data.object.metadata.source === SOURCE_CREDITS
                ? activateCreditsFromSession(event.data.object)
                : activatePlanFromSession(event.data.object);
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            return handleSubscriptionEvent(event);
        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
            return handleInvoiceEvent(event);
        default:
            return { handled: false };
    }
}

module.exports = {
    SOURCE_PLAN, SOURCE_BEZ, CYCLES,
    listPlans, purchasablePlan, createPlanCheckout, createBezCheckout, createCreditsCheckout, createPortalSession, getSessionForUser,
    assertStripeUrl, validEurAmount, frontendOrigin,
    activatePlanFromSession, activateCreditsFromSession, handleSubscriptionEvent, handleInvoiceEvent, handleEvent,
    _setStripeForTests,
};
