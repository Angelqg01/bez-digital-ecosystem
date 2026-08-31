'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * InvestorScorerAgent — puntúa un contacto de capital institucional (VC,
 * family office, fondo) 0-100 según encaje de tesis, cheque medio y etapa.
 * Migra la lógica que hoy vive suelta en la hoja "BeZhas CRM Capital
 * Institucional" a un flujo con memoria y aprendizaje continuo.
 */
class InvestorScorerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'fundraising.investor-scorer',
      name: 'Investor Scorer',
      department: 'fundraising',
      modelTier: 'fast',
      capabilities: ['fundraising:score'],
      systemPrompt:
        'Calificas contactos de capital institucional (VC, family office, fondo) 0-100 según encaje con la tesis ' +
        'de BeZhas (infraestructura Web3 B2B, RWA, logística/economía azul). Alto = tesis explícita en deep tech/' +
        'infraestructura/logística con cheques en etapa seed-A. Devuelves SOLO un número 0-100 y una razón de una línea.',
    });
  }

  async run(task) {
    const lead = task.payload?.lead || {};
    if (this.business && this.business.isExcluded(lead)) {
      return { score: 0, rationale: 'Cuenta excluida.', status: 'ok' };
    }

    const out = await this.think(
      `Puntúa este contacto de capital institucional 0-100: ${JSON.stringify(lead)}`,
      { useMemory: false, maxTokens: 200 },
    );
    const score = Math.min(100, parseInt((out.match(/\d{1,3}/) || [50])[0], 10));

    await this.remember({ summary: `Inversor ${lead.company || lead.empresa || '?'} puntuado ${score}`, score });
    return { score, rationale: out, status: 'ok' };
  }
}
module.exports = InvestorScorerAgent;
