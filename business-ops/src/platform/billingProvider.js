'use strict';

/**
 * Proveedor de cobro. Sin STRIPE_SECRET_KEY → simulado (no cobra, devuelve ids
 * ficticios), igual que el resto del sistema. Con la clave → Stripe real.
 */
function createBillingProvider(env = process.env) {
  if (env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = require('stripe'); // dependencia opcional
      return new StripeProvider(new Stripe(env.STRIPE_SECRET_KEY), env);
    } catch (err) {
      console.warn(`[billing] Stripe no disponible (${err.message}). Modo simulado.`);
    }
  }
  return new SimulatedProvider();
}

/** Simulado: no llama a ningún servicio externo. */
class SimulatedProvider {
  constructor() { this.name = 'simulado'; }
  async createSubscription({ tenantId, plan }) {
    console.log(`[billing] (simulado) suscripción ${tenantId} → ${plan}`);
    return { id: `sub_sim_${tenantId}`, status: 'active', simulated: true };
  }
}

/**
 * Stripe real. Mapea plan → price id vía STRIPE_PRICE_<PLAN> (o plans[plan].stripePriceId).
 * No verificado en CI (requiere claves); mantener fino.
 */
class StripeProvider {
  constructor(stripe, env) { this.stripe = stripe; this.env = env; this.name = 'stripe'; }
  async createSubscription({ tenantId, plan }) {
    const priceId = this.env[`STRIPE_PRICE_${plan.toUpperCase()}`];
    if (!priceId) throw new Error(`falta STRIPE_PRICE_${plan.toUpperCase()}`);
    const customer = await this.stripe.customers.create({ name: tenantId, metadata: { tenantId } });
    const sub = await this.stripe.subscriptions.create({ customer: customer.id, items: [{ price: priceId }] });
    return { id: sub.id, status: sub.status, customerId: customer.id };
  }
}

module.exports = { createBillingProvider, SimulatedProvider, StripeProvider };
