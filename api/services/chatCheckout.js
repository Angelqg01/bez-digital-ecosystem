'use strict';

/**
 * services/chatCheckout.js — compra de BEZ con tarjeta iniciada desde el chat.
 *
 * Este servicio SÓLO crea la Checkout Session. Lo delicado ya existe y no se duplica: routes/webhooks.js
 * verifica la firma de Stripe y RETIENE la compra de BEZ hasta que cardFundsVerifier confirma los fondos
 * (cardSettlementWorker entrega). Los PLANES no pasan por aquí: se contratan con los Payment Links del
 * catálogo (config/stripe-payment-links.js) y los registra services/planSubscriptions.
 *
 * Reglas:
 *  · El cliente sólo elige un importe (con mínimo y máximo); la moneda y el producto los fija el servidor.
 *  · La identidad sale de la sesión, nunca del cuerpo. La wallet que recibirá el BEZ es la de la cuenta,
 *    y sólo si es una wallet REAL (firmada por su dueño, o gestionada y ya provisionada): una cuenta de
 *    email sin wallet tiene una dirección provisional que no es de nadie, y entregar ahí perdería el BEZ.
 *  · Las URLs de retorno las fija el servidor (CHAT_CHECKOUT_RETURN_BASE); el cliente no elige destino.
 */

const { query } = require('../db/pool');

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
const urls = () => ({
    success_url: `${returnBase()}/?checkout=success&kind=bez&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnBase()}/?checkout=cancelled&kind=bez`,
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
        ...urls(),
    });
    return { url: session.url, sessionId: session.id };
}

module.exports = { CheckoutError, createBezCheckout, deliverableWallet, __setStripe };
