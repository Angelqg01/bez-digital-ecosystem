'use strict';

const BaseConnector = require('./BaseConnector');

/**
 * RuntimeToolsConnector — las herramientas del runtime de BeZhas (puente L1↔L2,
 * gas, validadores, despliegues, incidencias) disponibles para los agentes de
 * aquí.
 *
 * Por qué entra como conector y no como 33 herramientas sueltas
 * -------------------------------------------------------------
 * El tool-use de esta plataforma es «un conector = una herramienta», con firma
 * `{ method, args }`. Encaja: el `method` es el nombre de la tool del runtime.
 * Así, añadir una tool allí no obliga a tocar nada aquí.
 *
 * Los permisos ahora pasan por DOS sitios, y es a propósito
 * ---------------------------------------------------------
 * Antes cada invocación pasaba solo por `permissions/` de agent-lib. Ahora,
 * cuando la llamada nace de un agente de esta plataforma:
 *
 *   1. `PolicyEngine`/`RedLines` de aquí deciden ANTES de salir (con la
 *      categoría que asigna `toolCatalog.categoryForToolCall`).
 *   2. `invokeWithPermissions` del runtime decide DESPUÉS, con su propio rol y
 *      su límite de tasa.
 *
 * No es duplicación: son dos preguntas distintas. La primera es «¿puede este
 * agente, de este tenant, hacer esto?»; la segunda, «¿puede este usuario del
 * runtime ejecutar esta tool?». Quitar la primera dejaría a los agentes de
 * negocio invocando infraestructura sin pasar por las líneas rojas del tenant.
 *
 * Solo lectura en la práctica: las tools que despliegan o firman no están en la
 * lista blanca de abajo. Añadir una que escriba exige darle categoría propia en
 * `toolCatalog`, para que RedLines pueda verla.
 */
class RuntimeToolsConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'runtime';
    this.baseUrl = (config.baseUrl || process.env.BEZHAS_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    this.timeoutMs = Number(config.timeoutMs || process.env.RUNTIME_TOOLS_TIMEOUT_MS || 15000);
    this._fetch = config.fetch || globalThis.fetch;
    this._token = config.token || null;

    // Circuito, igual que BeZhasCoreConnector: si el runtime está caído, no
    // gastamos un timeout por cada invocación.
    this.failureThreshold = Number(config.failureThreshold || 3);
    this.cooldownMs = Number(config.cooldownMs || 60_000);
    this._failures = 0;
    this._openUntil = 0;
    this._now = config.now || (() => Date.now());
  }

  get circuit() {
    return this._now() < this._openUntil ? 'open' : 'closed';
  }

  /**
   * Herramientas admitidas. Lista blanca explícita: lo que no está aquí no se
   * invoca, aunque el runtime lo ofrezca. Un catálogo remoto que crece solo no
   * puede ampliar en silencio lo que los agentes de negocio pueden tocar.
   */
  static get TOOLS() {
    return {
      'validator-status': 'Salud de un validador: latido, uptime, contribución y stake. args: { operator }',
      'bridge-health': 'Estado del puente L1↔L2: mensajes pendientes y finalización. args: {}',
      'gas-analytics': 'Consumo y precio del gas en la red. args: { window? }',
      'blockchain-validator': 'Comprobaciones de integridad de la cadena. args: {}',
      'sector-query': 'Consulta datos de un sector del ecosistema. args: { sector, query }',
      'incident-report': 'Parte de incidencias del runtime. args: { since? }',
    };
  }

  async execute(method, args = {}) {
    if (!RuntimeToolsConnector.TOOLS[method]) {
      throw new Error(`runtime: herramienta no admitida: ${method}`);
    }
    if (this.circuit === 'open') {
      return { simulated: true, reason: `runtime no disponible (circuito abierto tras ${this._failures} fallos)` };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await this._fetch(`${this.baseUrl}/api/runtime/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
        },
        body: JSON.stringify({ tool: method, params: args }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this._failures = 0;
      return { ...data, simulated: false };
    } catch (err) {
      this._failures++;
      if (this._failures >= this.failureThreshold) {
        this._openUntil = this._now() + this.cooldownMs;
      }
      // Degrada como el resto de conectores: nunca rompe la tarea del agente.
      return { simulated: true, reason: `runtime no disponible (${err.message})` };
    }
  }
}

module.exports = RuntimeToolsConnector;
