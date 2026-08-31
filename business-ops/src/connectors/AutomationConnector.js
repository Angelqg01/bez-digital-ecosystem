'use strict';
const BaseConnector = require('./BaseConnector');

/**
 * AutomationConnector — n8n auto-alojado como "pegamento de eventos".
 * Sustituye a Zapier/Make. Cierra el punto 6 de la Fase B del stack soberano.
 *
 * Sin N8N_API_URL → modo simulado (igual que el resto del stack), para poder
 * probar el flujo sin levantar el contenedor.
 *
 *   docker compose -f infra/docker-compose.full.yml --profile business up -d
 *   N8N_API_URL=http://localhost:5678  N8N_API_KEY=...  N8N_WEBHOOK_URL=http://localhost:5678
 *
 * La API key se crea dentro de n8n (Settings → n8n API → Create an API key).
 *
 * ── Nota de seguridad (importante) ────────────────────────────────────────
 * Un workflow de n8n puede hacer CUALQUIER cosa: enviar correo, publicar,
 * llamar a una API de pagos. Por eso disparar un workflow NO es una acción
 * inocua: `trigger` y `run` viajan con categoría de política `automation`,
 * y un tenant puede endurecerla de un golpe:
 *
 *   PUT /tenants/:id/policies/automation  { "rule": "always_approve" }
 *
 * Las lecturas (`listWorkflows`, `getExecution`) van con categoría
 * `automation_read`, para poder dejar leer sin dejar ejecutar.
 *
 * Métodos:
 *   - listWorkflows()                          lista los workflows del servidor
 *   - trigger({ workflow, payload })           dispara un webhook por su path
 *   - run({ workflowId, payload })             ejecuta un workflow por id (API)
 *   - getExecution({ id })                     consulta el resultado de una ejecución
 */
class AutomationConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'automation';
    this.apiUrl = (config.apiUrl || process.env.N8N_API_URL || '').replace(/\/$/, '');
    this.apiKey = config.apiKey || process.env.N8N_API_KEY || '';
    // El webhook puede vivir en otro host que la API (túnel, reverse proxy).
    this.webhookUrl = (config.webhookUrl || process.env.N8N_WEBHOOK_URL || this.apiUrl).replace(/\/$/, '');
    this._fetch = config.fetch || globalThis.fetch;
    this.simulated = !this.apiUrl;
    this._sim = { workflows: config.simWorkflows || [], executions: [] };
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'listWorkflows': return this.listWorkflows();
      case 'trigger': return this.trigger(args);
      case 'run': return this.run(args);
      case 'getExecution': return this.getExecution(args);
      default: throw new Error(`automation: método desconocido ${method}`);
    }
  }

  async listWorkflows() {
    if (this.simulated) return this._sim.workflows;
    const res = await this._req('/api/v1/workflows', 'GET');
    const list = res?.data || res || [];
    return list.map((w) => ({ id: w.id, name: w.name, active: w.active }));
  }

  /**
   * Dispara un workflow por su webhook. Es la vía natural del "pegamento":
   * el agente publica un evento y n8n hace el resto.
   */
  async trigger({ workflow, payload = {} } = {}) {
    if (!workflow) throw new Error('automation.trigger: falta "workflow" (path del webhook)');
    const path = String(workflow).replace(/^\/+/, '');
    if (this.simulated) {
      const exec = {
        id: `sim-exec-${this._sim.executions.length + 1}`,
        workflow: path,
        payload,
        status: 'success',
        tenantId: this.tenantId,
        simulated: true,
      };
      this._sim.executions.push(exec);
      return exec;
    }
    // El tenantId viaja en el cuerpo: los workflows compartidos necesitan saber
    // de quién es el evento (y así el aislamiento no depende del workflow).
    const body = { ...payload, tenantId: this.tenantId };
    const resp = await this._fetch(`${this.webhookUrl}/webhook/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = new Error(`n8n: HTTP ${resp.status} disparando webhook ${path}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json().catch(() => ({}));
    return { workflow: path, status: 'triggered', result: data };
  }

  /** Ejecuta un workflow por id vía API (para los que no tienen webhook). */
  async run({ workflowId, payload = {} } = {}) {
    if (!workflowId) throw new Error('automation.run: falta "workflowId"');
    if (this.simulated) {
      const exec = {
        id: `sim-exec-${this._sim.executions.length + 1}`,
        workflowId,
        payload,
        status: 'success',
        tenantId: this.tenantId,
        simulated: true,
      };
      this._sim.executions.push(exec);
      return exec;
    }
    const res = await this._req(`/api/v1/workflows/${workflowId}/run`, 'POST', {
      ...payload,
      tenantId: this.tenantId,
    });
    return { workflowId, status: 'running', executionId: res?.executionId ?? res?.id ?? null, result: res };
  }

  async getExecution({ id } = {}) {
    if (!id) throw new Error('automation.getExecution: falta "id"');
    if (this.simulated) {
      return this._sim.executions.find((e) => e.id === id) || { id, status: 'unknown', simulated: true };
    }
    const res = await this._req(`/api/v1/executions/${id}`, 'GET');
    return { id, status: res?.status ?? (res?.finished ? 'success' : 'running'), data: res };
  }

  // ── HTTP helpers ──────────────────────────────────────────────────
  async _req(path, method, body) {
    const resp = await this._fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // n8n usa una cabecera propia, no Bearer.
        'X-N8N-API-KEY': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const err = new Error(`n8n: HTTP ${resp.status} en ${method} ${path}`);
      err.status = resp.status;
      throw err;
    }
    return resp.json().catch(() => ({}));
  }
}

module.exports = AutomationConnector;
