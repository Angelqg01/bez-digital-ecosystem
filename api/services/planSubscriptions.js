'use strict';

/**
 * planSubscriptions — compra, asignación y ciclo de vida de los planes.
 *
 *   checkout.session.completed (metadata.plan_id)
 *     → registrarCompra: queda en plan_purchases SIEMPRE
 *       · con client_reference_id de una app activa → plan activo ya
 *       · sin él → 'pending_assignment' hasta que alguien lo reclame
 *   reclamar(sesión, app)   → el titular (o un admin) asigna la compra a su app
 *   customer.subscription.updated/deleted → estado del plan según Stripe
 *   charge.refunded (completo) de una factura de plan → plan cancelado y la
 *     suscripción de Stripe cancelada, para que no se vuelva a cobrar
 *
 * No se asigna por email: los emails de `users` no están verificados (ver la
 * migración 061).
 */

const { query } = require('../db/pool');
const { getPlan } = require('../config/plans');
const logger = require('../utils/logger');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idDe = (v) => (typeof v === 'string' ? v : v?.id) || null;

class PlanError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.name = 'PlanError';
        this.code = code;
        this.status = status;
    }
}

/** Estado de Stripe → estado del plan en la plataforma. */
function estadoDe(sub, borrada = false) {
    if (borrada) return 'canceled';
    switch (sub.status) {
        case 'active':
        case 'trialing':
            return 'active';
        case 'past_due':
        case 'unpaid':
        case 'incomplete':
        case 'paused':
            return 'past_due';
        default:
            return 'canceled'; // canceled, incomplete_expired
    }
}

/** Fin del periodo en curso. Desde la API 2025-03 vive en cada item. */
function finDePeriodo(sub) {
    const s = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
    return Number.isFinite(s) ? new Date(s * 1000) : null;
}

/** Activa el plan de una compra en su app (gateway_subscriptions). */
async function activar(compra) {
    const intervalo = compra.billing === 'annual' ? "INTERVAL '1 year'" : "INTERVAL '1 month'";
    await query(
        `INSERT INTO gateway_subscriptions (app_id, plan_id, status, renews_at, stripe_customer_id, stripe_subscription_id)
         VALUES ($1, $2, 'active', NOW() + ${intervalo}, $3, $4)
         ON CONFLICT (app_id) DO UPDATE
           SET plan_id = $2, status = 'active', renews_at = NOW() + ${intervalo},
               stripe_customer_id = $3, stripe_subscription_id = $4, updated_at = NOW()`,
        [compra.app_id, compra.plan_id, compra.stripe_customer_id, compra.stripe_subscription_id]
    );
    logger.info({ appId: compra.app_id, planId: compra.plan_id, via: compra.assigned_via }, 'Plan activado');
}

async function appActiva(appId) {
    if (!appId || !UUID.test(appId)) return false;
    const { rows } = await query('SELECT 1 FROM app_registry WHERE id = $1 AND is_active = TRUE', [appId]);
    return rows.length > 0;
}

/**
 * Registra la compra de un plan. Idempotente por sesión de Checkout: Stripe
 * reenvía el evento hasta recibir un 2xx.
 * @returns {Promise<{estado: string, compra?: object}>}
 */
async function registrarCompra(session, { eventId, cuenta = 'principal' } = {}) {
    const planId = session.metadata?.plan_id;
    if (!getPlan(planId)) {
        logger.error({ sessionId: session.id, planId }, 'plan_id desconocido en la sesión: pago sin plan, conciliar a mano');
        return { estado: 'plan_desconocido' };
    }
    const billing = session.metadata?.billing === 'annual' ? 'annual' : 'monthly';
    const appId = (await appActiva(session.client_reference_id)) ? session.client_reference_id : null;

    const { rows } = await query(
        `INSERT INTO plan_purchases
           (stripe_account, checkout_session_id, stripe_customer_id, stripe_subscription_id, customer_email,
            plan_id, billing, app_id, assigned_via, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (checkout_session_id) DO NOTHING
         RETURNING *`,
        [cuenta, session.id, idDe(session.customer), idDe(session.subscription),
            session.customer_details?.email || null, planId, billing, appId,
            appId ? 'client_reference_id' : null, appId ? 'active' : 'pending_assignment']
    );
    if (!rows.length) return { estado: 'repetido' };
    const compra = rows[0];

    if (!appId) {
        logger.warn({ eventId, sessionId: session.id, planId, clientReferenceId: session.client_reference_id || null },
            'Plan comprado sin app: pendiente de que el cliente lo reclame o un admin lo asigne');
        return { estado: 'pendiente', compra };
    }
    await activar(compra);
    return { estado: 'activado', compra };
}

/** ¿La app pertenece a la organización? (app_registry.enterprise_id ↔ organizations.legacy_enterprise_id) */
async function appDeOrganizacion(appId, orgId) {
    if (!UUID.test(appId || '')) return false;
    const { rows } = await query(
        `SELECT 1 FROM app_registry a
           JOIN organizations o ON o.legacy_enterprise_id = a.enterprise_id
          WHERE a.id = $1 AND o.id = $2 AND a.is_active = TRUE`,
        [appId, orgId]
    );
    return rows.length > 0;
}

/**
 * Asigna una compra pendiente a una app de la organización. El id de la sesión
 * de Checkout hace de justificante: sólo lo recibe quien pagó. El UPDATE es
 * condicional para que dos reclamos simultáneos no se lleven la misma compra.
 */
async function reclamar({ sessionId, appId, orgId, userId }) {
    if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId || '')) throw new PlanError('sessionId no válido', 'SESION_INVALIDA');
    if (!(await appDeOrganizacion(appId, orgId))) throw new PlanError('La app no pertenece a esta organización', 'APP_AJENA', 403);

    const { rows } = await query(
        `UPDATE plan_purchases SET app_id = $2, assigned_via = 'reclamo', status = 'active', updated_at = NOW()
          WHERE checkout_session_id = $1 AND status = 'pending_assignment' AND app_id IS NULL
          RETURNING *`,
        [sessionId, appId]
    );
    // Mismo error si no existe o ya se asignó: no revelar qué sesiones existen.
    if (!rows.length) throw new PlanError('Compra no encontrada o ya asignada', 'NO_RECLAMABLE', 409);
    await activar(rows[0]);
    logger.info({ purchaseId: rows[0].id, appId, orgId, userId }, 'Compra de plan reclamada');
    return rows[0];
}

/** customer.subscription.updated / customer.subscription.deleted */
async function alCambiarSuscripcion(sub, { borrada = false } = {}) {
    const estado = estadoDe(sub, borrada);
    const compras = await query(
        `UPDATE plan_purchases SET status = $2, updated_at = NOW()
          WHERE stripe_subscription_id = $1 AND status <> 'refunded'
            AND NOT (status = 'pending_assignment' AND $2 = 'active')
          RETURNING id`,
        [sub.id, estado]
    );
    const fin = finDePeriodo(sub);
    const planes = await query(
        `UPDATE gateway_subscriptions
            SET status = $2, renews_at = COALESCE($3, renews_at), updated_at = NOW()
          WHERE stripe_subscription_id = $1
          RETURNING app_id`,
        [sub.id, estado, fin]
    );
    logger.info({ subscriptionId: sub.id, estado, compras: compras.rowCount, apps: planes.rowCount }, 'Suscripción de plan actualizada');
    return { estado, apps: planes.rows.map((r) => r.app_id) };
}

/**
 * Reembolso COMPLETO de una factura de plan: se corta el acceso y se cancela
 * la suscripción en Stripe (si no, el mes siguiente se volvería a cobrar). Un
 * reembolso parcial es un gesto comercial y no toca el plan.
 * @param {object} charge  cargo del evento
 * @param {object|null} stripe  cliente de la cuenta que cobró (o null)
 */
async function alReembolsar(charge, stripe) {
    if (!charge.refunded || !charge.customer) return { accion: 'ninguna' };
    if (!stripe) {
        logger.warn({ chargeId: charge.id }, 'Reembolso sin cliente de Stripe para comprobar si era de un plan');
        return { accion: 'ninguna' };
    }
    // El webhook puede ir en una versión de la API sin `charge.invoice`: se
    // consulta con la del SDK, que sí la trae.
    const cargo = await stripe.charges.retrieve(charge.id, { expand: ['invoice'] });
    const factura = cargo.invoice && typeof cargo.invoice === 'object' ? cargo.invoice : null;
    const subId = idDe(factura?.subscription) || idDe(factura?.parent?.subscription_details?.subscription);
    if (!subId) return { accion: 'ninguna' };

    const { rows } = await query(
        `UPDATE plan_purchases SET status = 'refunded', updated_at = NOW()
          WHERE stripe_subscription_id = $1 RETURNING id`,
        [subId]
    );
    if (!rows.length) return { accion: 'ninguna' };
    await query(
        `UPDATE gateway_subscriptions SET status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = $1`,
        [subId]
    );
    try {
        await stripe.subscriptions.cancel(subId);
    } catch (err) {
        // Ya cancelada: es lo que se quería.
        if (err?.code !== 'resource_missing' && !/canceled/i.test(err?.message || '')) {
            logger.error({ subscriptionId: subId, error: err.message }, 'Plan reembolsado pero la suscripción NO se pudo cancelar en Stripe: cancelarla a mano');
            return { accion: 'plan_cancelado', subId, stripeCancelada: false };
        }
    }
    logger.info({ subscriptionId: subId, chargeId: charge.id }, 'Plan reembolsado: acceso cortado y suscripción cancelada');
    return { accion: 'plan_cancelado', subId, stripeCancelada: true };
}

module.exports = { registrarCompra, reclamar, alCambiarSuscripcion, alReembolsar, estadoDe, PlanError };
