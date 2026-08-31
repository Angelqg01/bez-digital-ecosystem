'use strict';
const BaseConnector = require('./BaseConnector');

/**
 * TwentyCRM — connector al CRM propio (open source, auto-alojado).
 * Sustituye a HubSpot/Pipedrive. Habla con la API REST de Twenty.
 *
 * Sin TWENTY_API_URL/KEY → modo simulado (igual que el resto del stack), para
 * poder probar el flujo de ventas sin levantar el contenedor.
 *
 * Métodos que usan los agentes de ventas:
 *   - upsertLead({ companyName, contactName, role, fitScore })
 *   - updateDealStage({ dealId, stage })
 *   - listLeads()
 */
class TwentyCRM extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'crm';
    this.apiUrl = (config.apiUrl || process.env.TWENTY_API_URL || '').replace(/\/$/, '');
    this.apiKey = config.apiKey || process.env.TWENTY_API_KEY || '';
    this._fetch = config.fetch || globalThis.fetch;
    this._sim = []; // memoria de respaldo en modo simulado
    this.simulated = !this.apiUrl || !this.apiKey;
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'upsertLead': return this.upsertLead(args);
      case 'updateDealStage': return this.updateDealStage(args);
      case 'listLeads': return this.listLeads();
      default: throw new Error(`crm: método desconocido ${method}`);
    }
  }

  async upsertLead({ companyName, contactName, role, fitScore } = {}) {
    if (this.simulated) {
      const lead = { id: `sim-${this._sim.length + 1}`, companyName, contactName, role, fitScore, simulated: true };
      this._sim.push(lead);
      return lead;
    }
    // 1) Empresa  2) Persona asociada (GraphQL/REST de Twenty).
    const company = await this._post('/rest/companies', { name: companyName });
    const person = await this._post('/rest/people', {
      name: { firstName: contactName, lastName: '' },
      jobTitle: role,
      companyId: company.id,
    });
    return { id: company.id, personId: person.id, companyName, contactName, role, fitScore };
  }

  async updateDealStage({ dealId, stage } = {}) {
    if (this.simulated) return { id: dealId, stage, simulated: true };
    return this._patch(`/rest/opportunities/${dealId}`, { stage });
  }

  async listLeads() {
    if (this.simulated) return this._sim;
    const res = await this._get('/rest/companies');
    return res?.data || res || [];
  }

  // ── HTTP helpers ──────────────────────────────────────────────────
  async _req(path, method, body) {
    const resp = await this._fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!resp.ok) {
      const err = new Error(`twenty: HTTP ${resp.status} en ${method} ${path}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json().catch(() => ({}));
    return data?.data ?? data;
  }
  _get(p) { return this._req(p, 'GET'); }
  _post(p, b) { return this._req(p, 'POST', b); }
  _patch(p, b) { return this._req(p, 'PATCH', b); }
}

module.exports = TwentyCRM;
