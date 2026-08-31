'use strict';

/**
 * UsageMeter — aplica las cuotas de plan por tenant.
 *
 * Cuenta las llamadas a agentes del mes en curso (vía ModelGateway.onUsage) y
 * permite cortar nuevas solicitudes cuando un tenant agota `maxAgentCallsMonth`.
 * El periodo es el mes natural (UTC); `clock` se inyecta para tests.
 *
 * Complementa al CostTracker (que mide gasto): aquí se mide y se *limita* el uso.
 */
class UsageMeter {
  constructor({ limits = {}, clock = () => new Date(), store = null } = {}) {
    this.limits = limits;          // tenantId -> nº máx. de llamadas/mes (null = sin límite)
    this.clock = clock;
    this.store = store;            // persistencia opcional (fact `usage:<YYYY-MM>` por tenant)
    this._counts = new Map();      // `${tenantId}:${YYYY-MM}` -> contador
  }

  /** Carga los contadores persistidos del periodo actual para estos tenants. */
  async hydrate(tenantIds = []) {
    if (!this.store?.getFact) return 0;
    let n = 0;
    for (const tenantId of tenantIds) {
      const v = await this.store.getFact({ tenantId, key: `usage:${this._period()}` });
      if (typeof v === 'number') { this._counts.set(this._key(tenantId), v); n++; }
    }
    return n;
  }

  /** Fija el límite mensual de un tenant (null = ilimitado). */
  setLimit(tenantId, maxCalls) {
    this.limits[tenantId] = (maxCalls === undefined ? null : maxCalls);
  }

  limitFor(tenantId) {
    const l = this.limits[tenantId];
    return l === undefined ? null : l;
  }

  /** Registra una llamada consumida por el tenant en el periodo actual. */
  record(tenantId) {
    if (!tenantId) return;
    const k = this._key(tenantId);
    const count = (this._counts.get(k) || 0) + 1;
    this._counts.set(k, count);
    if (this.store?.setFact) {
      // Best-effort: si falla, el contador sigue vivo en RAM (se cuenta igual).
      Promise.resolve(this.store.setFact({ tenantId, key: `usage:${this._period()}`, value: count }))
        .catch((err) => console.warn(`[usage:${tenantId}] no se pudo persistir: ${err.message}`));
    }
  }

  used(tenantId) {
    return this._counts.get(this._key(tenantId)) || 0;
  }

  /**
   * ¿Puede el tenant hacer una llamada más este mes?
   * @returns {{allowed:boolean, used:number, limit:number|null, remaining:number|null}}
   */
  check(tenantId) {
    const limit = this.limitFor(tenantId);
    const used = this.used(tenantId);
    const allowed = limit == null || used < limit;
    return { allowed, used, limit, remaining: limit == null ? null : Math.max(0, limit - used) };
  }

  reset(tenantId) {
    if (tenantId) this._counts.delete(this._key(tenantId));
    else this._counts.clear();
  }

  _period() {
    const d = this.clock();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  _key(tenantId) {
    return `${tenantId}:${this._period()}`;
  }
}

module.exports = UsageMeter;
