'use strict';
const BaseConnector = require('./BaseConnector');

/**
 * BeZhasCoreConnector — puente de solo lectura hacia el stack real de
 * BeZhas-Blockchain (api/ en :3001): estado de la cadena, tesorería,
 * validadores y gas. Es el conector fundacional del departamento
 * Blockchain Ops — sin él, todo lo demás (compliance, tesorería, alertas)
 * trabajaría sobre datos inventados.
 *
 * Ningún método de este conector escribe nada: son GET puros contra
 * endpoints públicos de la API real. Cualquier acción que SÍ mueva algo
 * (deploy, transferencia, slashing...) vive en BlockchainConnector.js y
 * pasa por las líneas rojas de siempre.
 *
 * Sin BEZHAS_API_URL o si la API no responde (stack no levantado: falta
 * Redis/Postgres/Aegis) → modo simulado, igual que el resto de conectores.
 */
class BeZhasCoreConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'bezhas-core';
    this.baseUrl = (config.baseUrl || process.env.BEZHAS_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    this.timeoutMs = Number(config.timeoutMs || process.env.BEZHAS_API_TIMEOUT_MS || 3000);
    this._fetch = config.fetch || globalThis.fetch;

    // Circuit breaker: si el stack de BeZhas está caído, no tiene sentido
    // reintentar 4 llamadas HTTP (y esperar su timeout) en cada vigilancia.
    // Tras N fallos seguidos el circuito se abre y devolvemos el simulado al
    // instante durante `cooldownMs`; la primera llamada después del enfriado
    // vuelve a probar (media apertura) y cierra el circuito si funciona.
    this.failureThreshold = Number(config.failureThreshold || 3);
    this.cooldownMs = Number(config.cooldownMs || process.env.BEZHAS_API_COOLDOWN_MS || 60_000);
    this._failures = 0;
    this._openUntil = 0;
    this._now = config.now || (() => Date.now());
  }

  /** Estado del circuito (observabilidad/tests): 'closed' | 'open'. */
  get circuit() {
    return this._now() < this._openUntil ? 'open' : 'closed';
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'chainOverview': return this._get('/api/blockchain/overview');
      case 'validatorStats': return this._get('/api/validators/stats');
      case 'treasuryStats': return this._get('/api/treasury/stats');
      case 'gasStatus': return this._get('/api/gas/status');
      case 'governanceProposals': return this._get('/api/validators/governance/proposals');
      default: throw new Error(`bezhas-core: método desconocido ${method}`);
    }
  }

  async _get(path) {
    // Circuito abierto: el stack se sabe caído, no gastamos otro timeout.
    if (this.circuit === 'open') {
      return this._simulated(path, `circuito abierto tras ${this._failures} fallos`);
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await this._fetch(`${this.baseUrl}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._failures = 0;          // respondió: circuito sano
      return { ...data, simulated: false };
    } catch (err) {
      // Stack real no disponible (o endpoint caído): degrada a simulado,
      // nunca rompe la tarea del agente — mismo contrato que StripeConnector/EmailConnector.
      this._failures++;
      if (this._failures >= this.failureThreshold) {
        this._openUntil = this._now() + this.cooldownMs;
      }
      return this._simulated(path, err.message);
    }
  }

  _simulated(path, reason) {
    const base = { simulated: true, reason: `bezhas-core no disponible (${reason})` };
    if (path.includes('/overview')) {
      return { ...base, chainId: 2708, blockHeight: 0, status: 'unknown' };
    }
    if (path.includes('/validators/stats')) {
      return { ...base, activeValidators: 0, totalStaked: '0' };
    }
    if (path.includes('/treasury/stats')) {
      return { ...base, balanceBez: '0', balanceUsd: '0' };
    }
    if (path.includes('/gas/status')) {
      return { ...base, gasPriceGwei: 0 };
    }
    if (path.includes('/governance/proposals')) {
      return { ...base, proposals: [] };
    }
    return base;
  }
}
module.exports = BeZhasCoreConnector;
