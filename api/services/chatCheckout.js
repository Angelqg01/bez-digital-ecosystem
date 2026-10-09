'use strict';

/**
 * services/chatCheckout.js — pagos con Stripe iniciados desde el chat.
 *
 * Este servicio SÓLO crea la Checkout Session y deja el estado del plan por usuario. Lo delicado ya
 * existe y no se duplica: routes/webhooks.js verifica la firma de Stripe, provisiona el plan y RETIENE
 * la compra de BEZ hasta que cardFundsVerifier confirma los fondos (cardSettlementWorker entrega).
 *
 * Reglas:
 *  · El precio sale del servidor (config/plans.js, ids de precio de Stripe; importes con tope en BEZ).
 *    El cliente sólo elige plan/ciclo o un importe.
 *  · La identidad sale de la sesión, nunca del cuerpo. La wallet que recibirá el BEZ es la de la cuenta,
 *    y sólo si es una wallet REAL (firmada por su dueño, o gestionada y ya provisionada): una cuenta de
 *    email sin wallet tiene una dirección provisional que no es de nadie, y entregar ahí perdería el BEZ.
 *  · Las URLs de retorno las fija el servidor (CHAT_CHECKOUT_RETURN_BASE); el cliente no elige destino.
 */

const { query } = require('../db/pool');
const { PLANS, getPlan } = require('../config/plans');

class CheckoutError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

let stripeClient = null;
function getStripe() {
    if (stripeClient) return stripeClient;
    if (!process.env.STRIPE_SECRET_KEY) throw new CheckoutError(503, 'PAYMENTS_UNAVAILABLE', 'Los pagos no están configurados.');
    stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return stripeClient;
}
/** Sólo para tests. */
function __setStripe(client) { stripeClient = client; }

// Nombre del plan en el chat (acciones/ACL) ← id de plan de la API.
const CHAT_PLAN_NAME = Object.freeze({ starter: 'free', creator_pro: 'creator', business: 'business', enterprise_vip: 'enterprise' });

function returnBase() {
    const raw = String(process.env.CHAT_CHECKOUT_RETURN_BASE || process.env.FRONTEND_URL || 'https://bezhas.com').trim().replace(/\/+$/, '');
    let u;
    try { u = new URL(raw); } catch { throw new CheckoutError(503, 'PAYMENTS_UNAVAILABLE', 'Retorno de pago mal configurado.'); }
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    if (u.protocol !== 'https:' && !(local && process.env.NODE_ENV !== 'production')) {
        // En producción el retorno debe ser https; localhost sólo en el stack de desarrollo local.
        if (!(local && process.env.ALLOW_LOCAL_CHECKOUT_RETURN === 'true')) throw new CheckoutError(503, 'PAYMENTS_UNAVAILABLE', 'Retorno de pago no seguro.');
    }
    return u.origin;
}
const urls = (kind) => ({
    success_url: `${returnBase()}/?checkout=success&kind=${kind}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnBase()}/?checkout=cancelled&kind=${kind}`,
});

async function loadUser(userId) {
    const { rows } = await query(
        `SELECT id, email, auth_type, custody_mode, wallet_address, primary_wallet_address, primary_smart_wallet_address
           FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (rows.length === 0) throw new CheckoutError(401, 'NO_USER', 'Sesión inválida.');
    return rows[0];
}

/** Wallet a la que se entregaría BEZ, o null si la cuenta no tiene una wallet real. */
function deliverableWallet(u) {
    const isRealWallet = u.auth_type === 'wallet';                                   // la firmó su dueño al entrar
    const isProvisionedManaged = u.custody_mode === 'managed' && !!u.primary_smart_wallet_address;
    if (!isRealWallet && !isProvisionedManaged) return null;
    const addr = String(u.primary_wallet_address || u.wallet_address || '');
    return /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
}

async function currentPlan(userId) {
    const { rows } = await query(
        `SELECT plan_id FROM user_subscriptions
          WHERE user_id = $1 AND status = 'active' AND (renews_at IS NULL OR renews_at > NOW()) LIMIT 1`, [userId]
    ).catch(() => ({ rows: [] }));
    return rows[0]?.plan_id || 'starter';
}

async function createPlanCheckout({ userId, planId, cycle }) {
    const plan = getPlan(String(planId || ''));
    if (!plan || !(plan.priceEUR > 0)) throw new CheckoutError(400, 'INVALID_PLAN', 'Ese plan no se puede comprar.');
    const billing = cycle === 'yearly' || cycle === 'annual' ? 'annual' : (cycle === undefined || cycle === 'monthly' ? 'monthly' : null);
    if (!billing) throw new CheckoutError(400, 'INVALID_CYCLE', 'Ciclo de facturación no válido (monthly o yearly).');
    const price = billing === 'annual' ? plan.stripe?.annualPriceId : plan.stripe?.monthlyPriceId;
    if (!price) throw new CheckoutError(503, 'PAYMENTS_UNAVAILABLE', 'Ese plan no está disponible para pago todavía.');

    if ((await currentPlan(userId)) === plan.id) throw new CheckoutError(409, 'ALREADY_SUBSCRIBED', 'Ya tienes este plan.');
    const user = await loadUser(userId);
    const sub = await query('SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = $1', [userId]).catch(() => ({ rows: [] }));
    const customer = sub.rows[0]?.stripe_customer_id;

    const session = await getStripe().checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price, quantity: 1 }],
        client_reference_id: String(userId),
        ...(customer ? { customer } : (user.email ? { customer_email: user.email } : {})),
        metadata: { kind: 'chat_plan', plan_id: plan.id, billing, user_id: String(userId) },
        subscription_data: { metadata: { kind: 'chat_plan', plan_id: plan.id, billing, user_id: String(userId) } },
        ...urls('plan'),
    });
    return { url: session.url, sessionId: session.id };
}

const bezLimits = () => ({
    min: Number(process.env.BEZ_PURCHASE_MIN_EUR || 10),
    max: Number(process.env.BEZ_PURCHASE_MAX_EUR || 5000),
});

async function createBezCheckout({ userId, amountEur }) {
    const { min, max } = bezLimits();
    const eur = Number(amountEur);
    if (!Number.isFinite(eur) || eur < min || eur > max) throw new CheckoutError(400, 'INVALID_AMOUNT', `El importe debe estar entre ${min} y ${max} EUR.`);
    const cents = Math.round(eur * 100);
    if (Math.abs(cents / 100 - eur) > 1e-9) throw new CheckoutError(400, 'INVALID_AMOUNT', 'El importe admite como máximo dos decimales.');

    const user = await loadUser(userId);
    const wallet = deliverableWallet(user);
    if (!wallet) throw new CheckoutError(409, 'WALLET_REQUIRED', 'Para comprar BEZ necesitas una wallet: entra con tu wallet o espera a que se cree la de tu cuenta.');

    const session = await getStripe().checkout.sessions.create({
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: cents, product_data: { name: 'BEZ-Coin', description: `Compra de BEZ a la wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)}` } } }],
        client_reference_id: wallet,                 // el webhook (walletDeSesion) lo lee de aquí
        ...(user.email ? { customer_email: user.email } : {}),
        metadata: { kind: 'chat_bez', walletAddress: wallet, user_id: String(userId) },
        payment_intent_data: { metadata: { kind: 'chat_bez', walletAddress: wallet, user_id: String(userId) } },
        ...urls('bez'),
    });
    return { url: session.url, sessionId: session.id };
}

// ── Webhook: estado del plan por usuario ─────────────────────────────────────

/** checkout.session.completed de un plan comprado en el chat (metadata.kind === 'chat_plan'). */
async function provisionUserPlan(session, eventId) {
    const userId = session.metadata?.user_id;
    const plan = getPlan(String(session.metadata?.plan_id || ''));
    if (!userId || !plan) throw new Error('Sesión de plan sin usuario o plan válidos');
    if (session.client_reference_id && String(session.client_reference_id) !== String(userId)) throw new Error('client_reference_id no coincide con el usuario');
    const billing = session.metadata?.billing === 'annual' ? 'annual' : 'monthly';
    const interval = billing === 'annual' ? "INTERVAL '1 year'" : "INTERVAL '1 month'";
    await query(
        `INSERT INTO user_subscriptions (user_id, plan_id, billing, status, renews_at, stripe_customer_id, stripe_subscription_id, last_event_id)
         VALUES ($1, $2, $3, 'active', NOW() + ${interval}, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE
           SET plan_id = $2, billing = $3, status = 'active', renews_at = NOW() + ${interval},
               stripe_customer_id = $4, stripe_subscription_id = $5, last_event_id = $6, updated_at = NOW()`,
        [userId, plan.id, billing, typeof session.customer === 'string' ? session.customer : null,
            typeof session.subscription === 'string' ? session.subscription : null, eventId || null]
    );
}

/** customer.subscription.updated|deleted: mantiene estado y renovación. Ignora lo que no es de un usuario del chat. */
async function handleSubscriptionEvent(event) {
    const sub = event.data.object;
    if (sub.metadata?.kind !== 'chat_plan') return false;
    const active = event.type !== 'customer.subscription.deleted' && ['active', 'trialing'].includes(sub.status);
    const renews = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    await query(
        `UPDATE user_subscriptions SET status = $2, renews_at = COALESCE($3::timestamptz, renews_at), last_event_id = $4, updated_at = NOW()
          WHERE stripe_subscription_id = $1`,
        [sub.id, active ? 'active' : 'canceled', renews, event.id]
    );
    return true;
}

module.exports = {
    CheckoutError, CHAT_PLAN_NAME, createPlanCheckout, createBezCheckout, currentPlan, deliverableWallet,
    provisionUserPlan, handleSubscriptionEvent, __setStripe, PLANS,
};
