'use strict';
const BaseConnector = require('./BaseConnector');

/** CRMConnector — stub. Conectar a HubSpot/Pipedrive/Salesforce en producción. */
class CRMConnector extends BaseConnector {
  constructor(opts) { super(opts); this.name = 'crm'; this._leads = []; }
  async execute(method, args) {
    if (method === 'upsertLead') { this._leads.push(args); return { id: this._leads.length, ...args }; }
    if (method === 'listLeads') { return this._leads; }
    throw new Error(`crm: método desconocido ${method}`);
  }
}
module.exports = CRMConnector;
