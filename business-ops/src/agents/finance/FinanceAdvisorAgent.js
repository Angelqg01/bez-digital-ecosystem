'use strict';

const BaseAgent = require('../BaseAgent');

/** Finance Advisor — responde dudas de contabilidad/fiscalidad. Nunca mueve dinero. */
class FinanceAdvisorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.advisor',
      name: 'Finance Advisor',
      department: 'finance',
      modelTier: 'mid',
      capabilities: ['finance:request'],
      systemPrompt: 'Eres un asesor financiero práctico (contabilidad, fiscalidad, tesorería). NUNCA mueves dinero ni das asesoría legal vinculante.',
    });
  }

  async run(task) {
    const answer = await this.think(`Duda financiera del cliente: "${task.payload?.text || ''}"`);
    return { answer, status: 'ok' };
  }
}

module.exports = FinanceAdvisorAgent;
