/**
 * usageBilling.js — Facturación por uso del plan Starter.
 *
 * Flujo:
 *  1. subscribeStarter(appId, email) crea el customer + suscripción Stripe
 *     con el precio medido (STRIPE_STARTER_METERED_PRICE_ID) y 15 días de
 *     prueba gratis; upsert en gateway_subscriptions con plan 'starter'.
 *  2. recordUsage(appId, usage) calcula los créditos (usage-pricing.js) y los
 *     reporta al Billing Meter de Stripe (event `bezhas_api_credits`).
 *     Fail-open: si Stripe no responde, la llamada del cliente NO falla —
 *     el uso se registra en gateway_usage_ledger y se reintenta después.
 *
 * Env requerido: STRIPE_SECRET_KEY, STRIPE_STARTER_METERED_PRICE_ID.
 */

'use strict';

// Perezoso a proposito: construirlo al importar tumbaba TODA la API cuando
// faltaba STRIPE_SECRET_KEY ("Neither apiKey nor config.authenticator
// provided"), aunque nada del resto de la plataforma dependa de los pagos.
// Asi el fallo se queda en la facturacion, que es de quien es.
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe no configurado: falta STRIPE_SECRET_KEY');
  }
  _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}
const { query } = require('../db/pool');
const { calculateCallCost, STARTER_TRIAL_DAYS } = require('../config/usage-pricing');

const METER_EVENT_NAME = 'bezhas_api_credits';
const STARTER_PRICE_ID = process.env.STRIPE_STARTER_METERED_PRICE_ID || '';

/**
 * Alta en el plan Starter (pago por uso, 15 días gratis).
 * Devuelve { customerId, subscriptionId, trialEnd }.
 */
async function subscribeStarter({ appId, email, name }) {
    if (!STARTER_PRICE_ID) {
        const err = new Error('STRIPE_STARTER_METERED_PRICE_ID not configured');
        err.code = 'STARTER_PRICE_MISSING';
        throw err;
    }

    // Reusar customer si la app ya tiene uno.
    const existing = await query(
        'SELECT stripe_customer_id FROM gateway_subscriptions WHERE app_id = $1',
        [appId]
    ).catch(() => ({ rows: [] }));
    let customerId = existing.rows[0]?.stripe_customer_id || null;

    if (!customerId) {
        const customer = await getStripe().customers.create({
            email, name, metadata: { app_id: appId, plan_id: 'starter' },
        });
        customerId = customer.id;
    }

    const subscription = await getStripe().subscriptions.create({
        customer: customerId,
        items: [{ price: STARTER_PRICE_ID }],
        trial_period_days: STARTER_TRIAL_DAYS,
        // Sin método de pago durante el trial; al acabar, Stripe genera
        // factura y pausa si no hay payment method.
        trial_settings: { end_behavior: { missing_payment_method: 'pause' } },
        metadata: { app_id: appId, plan_id: 'starter', billing: 'payg' },
    });

    await query(
        `INSERT INTO gateway_subscriptions (app_id, plan_id, status, renews_at, stripe_customer_id, stripe_subscription_id)
         VALUES ($1, 'starter', 'active', NOW() + INTERVAL '1 month', $2, $3)
         ON CONFLICT (app_id) DO UPDATE
           SET plan_id = 'starter', status = 'active',
               stripe_customer_id = $2, stripe_subscription_id = $3, updated_at = NOW()`,
        [appId, customerId, subscription.id]
    );

    return {
        customerId,
        subscriptionId: subscription.id,
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        trialDays: STARTER_TRIAL_DAYS,
    };
}

/**
 * Registra el uso de una llamada API-SDK y lo reporta a Stripe.
 * @param {string} appId
 * @param {{model?:string, inputTokens?:number, outputTokens?:number, action?:string, ref?:string}} usage
 */
async function recordUsage(appId, usage = {}) {
    const cost = calculateCallCost(usage);

    // Ledger local SIEMPRE (auditoría + reintentos), independiente de Stripe.
    await query(
        `INSERT INTO gateway_usage_ledger (app_id, action, credits, billable_eur, raw_cost_eur, meta)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [appId, usage.action || 'api_call', cost.credits, cost.billableEUR, cost.rawCostEUR,
         JSON.stringify({ model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, ref: usage.ref })]
    ).catch((e) => console.error('[usageBilling] ledger insert failed:', e.message));

    const { rows } = await query(
        `SELECT stripe_customer_id FROM gateway_subscriptions
         WHERE app_id = $1 AND plan_id = 'starter' AND status = 'active'`,
        [appId]
    ).catch(() => ({ rows: [] }));
    const customerId = rows[0]?.stripe_customer_id;
    if (!customerId) return { ...cost, reported: false, reason: 'no_starter_subscription' };

    try {
        await getStripe().billing.meterEvents.create({
            event_name: METER_EVENT_NAME,
            payload: {
                stripe_customer_id: customerId,
                value: String(cost.credits),
            },
            // Idempotencia por referencia de llamada si el caller la aporta.
            ...(usage.ref ? { identifier: `${appId}:${usage.ref}` } : {}),
        });
        return { ...cost, reported: true };
    } catch (e) {
        console.error('[usageBilling] meter event failed (queued in ledger):', e.message);
        return { ...cost, reported: false, reason: e.message };
    }
}

module.exports = { subscribeStarter, recordUsage, METER_EVENT_NAME };
