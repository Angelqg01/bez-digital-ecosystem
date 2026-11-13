'use strict';

/**
 * apiCredits — saldo prepago de la API para el plan Starter (pago por uso).
 *
 * El cliente recarga saldo con Stripe Checkout y lo gasta con su api-key: API,
 * MCP, chat y OPERANT. El modelo es el del crédito prepago de las APIs de IA:
 * primero se paga, luego se consume, y sin saldo la llamada responde 402.
 *
 * Una cuenta pasa a ser «prepago» con su primera recarga. Desde ese momento el
 * consumo sale del saldo y deja de enviarse al medidor de Stripe (si no, se
 * cobraría dos veces). Sólo aplica al plan Starter: los planes de cuota fija
 * no gastan saldo por lo que ya llevan incluido.
 *
 * Los créditos de una recarga se calculan SIEMPRE a partir de lo que Stripe
 * cobró, nunca de un número que viaje en la metadata de la sesión.
 */

const cfg = require('../../config/api-credits');
const { crearLibro, crearAlmacenPg, crearAlmacenMemoria } = require('./ledger');

const KIND = 'api_credits';

let _db = null;
let _libro = null;
let _stripe = null;

const db = () => _db || (_db = require('../../db/pool'));
const libro = () => _libro || (_libro = crearLibro(crearAlmacenPg(db())));

function getStripe() {
    if (_stripe) return _stripe;
    if (!process.env.STRIPE_SECRET_KEY) throw new CreditError(503, 'PAYMENTS_UNAVAILABLE', 'Los pagos no están disponibles ahora mismo.');
    _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    return _stripe;
}

class CreditError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

/** Plan activo de la app. Sin fila en gateway_subscriptions es Starter, como en gateway-metering. */
async function planActivo(appId) {
    const { rows } = await db().query(
        `SELECT plan_id FROM gateway_subscriptions WHERE app_id::text = $1 AND status = 'active'`, [String(appId)]);
    return rows[0] ? rows[0].plan_id : 'starter';
}

/**
 * Estado del saldo de una app.
 * @param {string} appId
 * @param {{plan?: string}} [opts] — si quien llama ya conoce el plan, ahorra una consulta.
 */
async function estado(appId, { plan } = {}) {
    const cuenta = await libro().getAccount(String(appId));
    const elPlan = plan || (cuenta.lifetime > 0 ? await planActivo(appId) : 'starter');
    return {
        prepaid: cuenta.lifetime > 0 && elPlan === 'starter',
        balanceCredits: cuenta.balance,
        balanceEUR: cfg.eurDe(cuenta.balance),
        lifetimeCredits: cuenta.lifetime,
        status: cuenta.status,
    };
}

/** ¿Puede esta app gastar al menos `minCredits`? Sólo decide algo si la cuenta es prepago. */
async function puedeGastar(appId, minCredits = 1, opts = {}) {
    const e = await estado(appId, opts);
    return { prepaid: e.prepaid, ok: !e.prepaid || (e.status === 'active' && e.balanceCredits >= minCredits), balanceCredits: e.balanceCredits };
}

/** Cobra un consumo ya producido. `{prepaid:false}` si la cuenta no es prepago: lo factura el medidor. */
async function cobrar(appId, credits, ref, meta = {}) {
    const e = await estado(appId);
    if (!e.prepaid) return { prepaid: false };
    const r = await libro().charge(String(appId), Math.max(0, Math.round(credits)), { ref, meta });
    return { prepaid: true, ...r };
}

const reservar = (appId, maxCredits, ref, meta = {}) => libro().reserve(String(appId), Math.max(1, Math.round(maxCredits)), { ref, meta });
const liquidar = (appId, ref, actualCredits, meta = {}) => libro().settle(String(appId), ref, Math.max(0, Math.round(actualCredits)), { meta });
const liberar = (appId, ref) => libro().release(String(appId), ref);

// ── Recarga ──────────────────────────────────────────────────────────────────

function baseDeRetorno() {
    const raw = String(process.env.API_CREDITS_RETURN_BASE || process.env.FRONTEND_URL || 'https://bezhas.com').trim().replace(/\/+$/, '');
    let u;
    try { u = new URL(raw); } catch { throw new CreditError(503, 'PAYMENTS_UNAVAILABLE', 'Retorno de pago mal configurado.'); }
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    if (u.protocol !== 'https:' && !(local && process.env.NODE_ENV !== 'production')) {
        throw new CreditError(503, 'PAYMENTS_UNAVAILABLE', 'Retorno de pago no seguro.');
    }
    return u.origin;
}

/** Importe a cobrar: el de un paquete, o uno libre dentro de los límites y con dos decimales. */
function importe({ packageId, amountEur }) {
    if (packageId) {
        const p = cfg.paquete(packageId);
        if (!p) throw new CreditError(400, 'INVALID_PACKAGE', 'Paquete de saldo desconocido.');
        return p.eur;
    }
    const { min, max } = cfg.limites();
    const eur = Number(amountEur);
    if (!Number.isFinite(eur) || eur < min || eur > max) {
        throw new CreditError(400, 'INVALID_AMOUNT', `El importe debe estar entre ${min} y ${max} EUR.`);
    }
    if (Math.abs(Math.round(eur * 100) / 100 - eur) > 1e-9) {
        throw new CreditError(400, 'INVALID_AMOUNT', 'El importe admite como máximo dos decimales.');
    }
    return eur;
}

/** Crea la sesión de Stripe Checkout. El saldo NO se abona aquí: lo hace el webhook al cobrar. */
async function crearCheckout({ appId, packageId, amountEur, email, userId }) {
    if (!appId) throw new CreditError(409, 'APP_REQUIRED', 'Tu cuenta todavía no tiene una aplicación a la que abonar el saldo.');
    const eur = importe({ packageId, amountEur });
    const credits = cfg.creditosDe(eur);
    const base = baseDeRetorno();
    const metadata = { kind: KIND, app_id: String(appId), ...(userId ? { user_id: String(userId) } : {}) };
    const session = await getStripe().checkout.sessions.create({
        mode: 'payment',
        line_items: [{
            quantity: 1,
            price_data: {
                currency: 'eur',
                unit_amount: Math.round(eur * 100),
                product_data: { name: 'Saldo API BeZhas', description: `${eur.toLocaleString('es-ES')} € de saldo para la API y el MCP de BeZhas` },
            },
        }],
        client_reference_id: String(appId),
        ...(email ? { customer_email: email } : {}),
        metadata,
        payment_intent_data: { metadata },
        success_url: `${base}/dashboard/credits?checkout=success`,
        cancel_url: `${base}/dashboard/credits?checkout=cancelled`,
    });
    return { url: session.url, sessionId: session.id, eur, credits };
}

const esSesionDeSaldo = (session) => Boolean(session && session.metadata && session.metadata.kind === KIND && session.metadata.app_id);

/** Abona una recarga pagada (webhook checkout.session.completed). Idempotente por sesión. */
async function acreditarSesion(session) {
    const appId = String(session.metadata.app_id);
    if (session.payment_status !== 'paid') throw new Error(`Sesión sin cobrar: ${session.payment_status}`);
    if (String(session.currency || '').toLowerCase() !== 'eur') throw new Error(`Moneda no admitida: ${session.currency}`);
    // Antes de impuestos: el IVA no es saldo. amount_total sólo como respaldo.
    const cents = Number.isInteger(session.amount_subtotal) ? session.amount_subtotal : session.amount_total;
    if (!Number.isInteger(cents) || cents <= 0) throw new Error('Sesión sin importe fiable');
    const eur = cents / 100;
    const credits = cfg.creditosDe(eur);
    const out = await libro().credit(appId, credits, { kind: 'recharge', ref: `stripe:${session.id}`, meta: { eur, sessionId: session.id } });
    if (out.applied) {
        // Primera recarga de una cuenta sin suscripción: queda dada de alta en Starter,
        // que es lo que el resto de la plataforma mira para saber si tiene plan.
        await db().query(
            `INSERT INTO gateway_subscriptions (app_id, plan_id, status)
             SELECT id, 'starter', 'active' FROM app_registry WHERE id::text = $1
             ON CONFLICT (app_id) DO NOTHING`, [appId]
        ).catch(() => {});
    }
    return { appId, eur, credits, applied: out.applied, balance: out.balance };
}

/** App de la organización del usuario (la que recibe el saldo desde el panel). */
async function appDeUsuario(userId) {
    const { rows } = await db().query(
        `SELECT a.id::text AS app_id
           FROM organization_members m
           JOIN organizations o ON o.id = m.organization_id
           JOIN app_registry a ON a.enterprise_id = o.legacy_enterprise_id AND a.is_active = TRUE
          WHERE m.user_id::text = $1 AND m.status = 'active'
          ORDER BY (m.role = 'owner') DESC, m.created_at, a.created_at
          LIMIT 1`, [String(userId)]);
    return rows[0] ? rows[0].app_id : null;
}

/** Lo que pinta la pantalla de saldo. */
async function resumen(appId) {
    const e = await estado(appId);
    const movimientos = (await libro().activity(String(appId), { limit: 30 }))
        // Las reservas y su liquidación son contabilidad interna: al cliente se le enseña el cobro neto.
        .filter((m) => m.kind !== 'hold')
        .map((m) => ({
            id: m.id, kind: m.kind === 'settle' ? 'charge' : m.kind,
            credits: m.kind === 'settle' ? -(m.meta.charged || 0) : m.credits,
            eur: cfg.eurDe(m.kind === 'settle' ? -(m.meta.charged || 0) : m.credits),
            balanceAfterEUR: cfg.eurDe(m.balanceAfter), at: m.at,
            concepto: m.meta && m.meta.action ? m.meta.action : null,
        }))
        .filter((m) => m.credits !== 0);
    return { ...e, ...catalogo(), activity: movimientos };
}

/** Lo que se vende y con qué modelos se puede gastar: no depende de la cuenta. */
function catalogo() {
    return {
        eurPerCredit: cfg.EUR_PER_CREDIT,
        packages: cfg.PAQUETES.map((p) => ({ ...p, credits: cfg.creditosDe(p.eur) })),
        limits: cfg.limites(),
        models: cfg.MODELOS_DISPONIBLES,
    };
}

module.exports = {
    estado, puedeGastar, cobrar, reservar, liquidar, liberar,
    crearCheckout, esSesionDeSaldo, acreditarSesion, appDeUsuario, resumen, catalogo,
    CreditError, KIND,
    /** Sólo para tests: inyecta almacén, base de datos y cliente de Stripe. */
    __set({ libro: l, db: d, stripe } = {}) { if (l !== undefined) _libro = l; if (d !== undefined) _db = d; if (stripe !== undefined) _stripe = stripe; },
    __memoria() { const l = crearLibro(crearAlmacenMemoria()); _libro = l; return l; },
};
