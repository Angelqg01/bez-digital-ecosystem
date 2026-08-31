'use strict';

const BaseAgent = require('../BaseAgent');

/** Lead Hunter — busca prospectos 24/7 según el ICP del cliente. */
class LeadHunterAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.lead-hunter',
      name: 'Lead Hunter',
      department: 'sales',
      modelTier: 'fast',
      capabilities: ['sales:hunt'],
      systemPrompt: 'Eres un agente de prospección. Identificas empresas que encajan con el perfil de cliente ideal (ICP). Devuelves datos concretos y verificables.',
    });
  }

  async run(task) {
    const icp = task.payload?.icp || {};
    const reasoning = await this.think(
      `Encuentra 5 prospectos que encajen con este ICP: ${JSON.stringify(icp)}. ` +
      `Para cada uno: empresa, motivo de encaje y siguiente acción.`
    );
    const result = { found: 5, reasoning, status: 'ok' };
    await this.remember({ task: 'sales:hunt', summary: `Prospección ICP ${icp.sector || ''}`, outcome: 'ok' });
    return result;
  }
}
module.exports = LeadHunterAgent;
