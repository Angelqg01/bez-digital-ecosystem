'use strict';

const { createBillingProvider } = require('./billingProvider');

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Billing — suscripciones por plan y previsualización de factura.
 *
 * ── Desde la integración con BeZhas ─────────────────────────────────────────
 * El COBRO real ya no vive aquí. OPERANT se sirve como SubApp del Gateway de
 * BeZhas: el cliente paga su suscripción a BeZhas, y es BeZhas quien decide si
 * una tarea entra en la cuota del plan o se factura por créditos de pago por
 * uso (api/services/operantUsage.js). Facturar también desde aquí sería cobrar
 * dos veces lo mismo.
 *
 * Lo que queda es la PREVISUALIZACIÓN: una estimación en euros del ciclo, útil
 * en el panel del operador y en el digest, con el coste de tokens subyacente
 * (COGS) al lado. `provider` sigue existiendo para los despliegues autónomos
 * de OPERANT (fuera del ecosistema BeZhas), donde sí cobra él.
 */
class Billing {
  constructor({ provider, plans } = {}) {
    this.provider = provider || createBillingProvider();
    this.plans = plans || require('../../config/plans.json');
    this._subs = new Map(); // tenantId -> { plan, since, providerRef }
  }

  /** Da de alta (o cambia) la suscripción de un tenant. */
  async subscribe(tenantId, plan) {
    if (!this.plans[plan]) throw new Error(`plan inválido: ${plan}`);
    const providerRef = await this.provider.createSubscription({ tenantId, plan });
    const sub = { plan, since: new Date().toISOString(), providerRef };
    this._subs.set(tenantId, sub);
    return sub;
  }

  getSubscription(tenantId) {
    return this._subs.get(tenantId) || null;
  }

  /**
   * Previsualiza la factura del periodo a partir del uso medido.
   * @param {object} usage - { callsUsed, modelCostUsd }
   */
  invoicePreview(tenantId, { callsUsed = 0, modelCostUsd = 0 } = {}) {
    const plan = this.getSubscription(tenantId)?.plan || 'starter';
    const p = this.plans[plan] || {};
    const base = p.monthlyPriceEur || 0;
    const included = p.maxAgentCallsMonth || 0;
    const overageCalls = Math.max(0, callsUsed - included);

    // El excedente lo tarifica BeZhas por créditos (coste real × 1,25), no un
    // precio por llamada fijado aquí: poner una segunda tarifa en este archivo
    // garantizaba que las dos se separasen con el tiempo. Se muestra el número
    // de llamadas y se remite a la factura del Gateway.
    const billedByBezhas = p.billing && String(p.billing).startsWith('bezhas');

    const lineItems = [{ concept: `Plan ${plan}`, amountEur: base }];
    if (overageCalls > 0) {
      lineItems.push({
        concept: `Excedente: ${overageCalls} llamadas`,
        amountEur: null,
        note: billedByBezhas
          ? 'Facturado por BeZhas como créditos de pago por uso (GET /api/operant/usage)'
          : 'Sin tarifa de excedente configurada',
      });
    }

    return {
      tenantId,
      plan,
      callsUsed,
      includedCalls: included,
      overageCalls,
      modelCostUsd: round2(modelCostUsd), // coste de tokens subyacente (COGS), informativo
      lineItems,
      totalEur: round2(base),
      currency: 'EUR',
      billedBy: billedByBezhas ? 'bezhas-gateway' : 'operant',
      overageBilledBy: billedByBezhas ? 'bezhas-gateway' : null,
    };
  }
}

module.exports = Billing;
