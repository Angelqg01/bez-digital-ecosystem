'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * RegulatoryAdvisorAgent — responde dudas normativas (RGPD, ENS, NIS2, DORA,
 * Ley Crea y Crece, Veri*factu) en el contexto de BeZhas. Asesoría práctica,
 * nunca vinculante: no sustituye a un abogado ni certifica cumplimiento.
 */
class RegulatoryAdvisorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'legal.regulatory-advisor',
      name: 'Regulatory Advisor',
      department: 'legal',
      modelTier: 'mid',
      capabilities: ['legal:regulatory'],
      systemPrompt:
        'Eres un asesor normativo práctico para una empresa Web3 española (RGPD, ENS, NIS2, DORA, Ley Crea y Crece, ' +
        'Veri*factu). Das orientación concreta y aplicable, pero SIEMPRE aclaras que no eres asesoría legal vinculante ' +
        'y que las decisiones de cumplimiento las valida un profesional.',
    });
  }

  async run(task) {
    const answer = await this.think(`Duda normativa/de cumplimiento: "${task.payload?.text || ''}"`, { useMemory: true });
    return { answer, status: 'ok' };
  }
}
module.exports = RegulatoryAdvisorAgent;
