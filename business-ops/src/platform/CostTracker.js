'use strict';

/**
 * CostTracker — acumula coste de tokens y nº de llamadas por tenant.
 *
 * Se engancha al ModelGateway vía `onUsage`. Permite ver el gasto en tiempo real
 * y es la base para aplicar cuotas por plan (UsageMeter, siguiente paso).
 *
 * Tarifas en USD por 1M de tokens (referencia API Claude, may-2026). Son
 * configurables vía constructor: ajústalas a la tarifa vigente cuando cambie.
 */
const DEFAULT_PRICES = {
  'claude-opus-4-8':   { input: 5.00, output: 25.00 },
  'claude-opus-4-7':   { input: 5.00, output: 25.00 },
  'claude-opus-4-6':   { input: 5.00, output: 25.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5':  { input: 1.00, output: 5.00 },
};

class CostTracker {
  constructor({ prices = DEFAULT_PRICES, store = null } = {}) {
    this.prices = prices;
    this.store = store;         // persistencia opcional (fact `cost:acc` por tenant)
    this._byTenant = new Map(); // tenantId -> { calls, inputTokens, outputTokens, costUsd }
  }

  static get DEFAULT_PRICES() { return DEFAULT_PRICES; }

  /** Carga los acumulados persistidos de estos tenants. */
  async hydrate(tenantIds = []) {
    if (!this.store?.getFact) return 0;
    let n = 0;
    for (const tenantId of tenantIds) {
      const v = await this.store.getFact({ tenantId, key: 'cost:acc' });
      if (v && typeof v === 'object') { this._byTenant.set(tenantId, v); n++; }
    }
    return n;
  }

  /** Registra una llamada al modelo. Forma del evento: la que emite ModelGateway.onUsage. */
  record({ model, usage = {}, meta = {} } = {}) {
    const tenantId = meta.tenantId || 'unknown';
    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;

    const price = this.prices[model] || { input: 0, output: 0 };
    const costUsd = (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;

    const acc = this._byTenant.get(tenantId) || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    acc.calls += 1;
    acc.inputTokens += inputTokens;
    acc.outputTokens += outputTokens;
    acc.costUsd += costUsd;
    this._byTenant.set(tenantId, acc);

    if (this.store?.setFact) {
      // Best-effort: si falla, el acumulado sigue vivo en RAM.
      Promise.resolve(this.store.setFact({ tenantId, key: 'cost:acc', value: acc }))
        .catch((err) => console.warn(`[cost:${tenantId}] no se pudo persistir: ${err.message}`));
    }

    return { tenantId, costUsd };
  }

  /** Consumo acumulado de un tenant. */
  usageFor(tenantId) {
    return this._byTenant.get(tenantId) || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }

  /** Consumo agregado de toda la plataforma. */
  total() {
    const t = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    for (const a of this._byTenant.values()) {
      t.calls += a.calls;
      t.inputTokens += a.inputTokens;
      t.outputTokens += a.outputTokens;
      t.costUsd += a.costUsd;
    }
    return t;
  }

  /** Reinicia el contador de un tenant (p.ej. al cerrar el ciclo de facturación) o de todos. */
  reset(tenantId) {
    if (tenantId) this._byTenant.delete(tenantId);
    else this._byTenant.clear();
  }
}

module.exports = CostTracker;
