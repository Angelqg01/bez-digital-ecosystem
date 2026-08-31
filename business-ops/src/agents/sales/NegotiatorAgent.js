'use strict';

const BaseAgent = require('../BaseAgent');

/** Negotiator — clasifica respuestas y maneja objeciones. */
class NegotiatorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.negotiator',
      name: 'Negotiator',
      department: 'sales',
      modelTier: 'frontier',
      capabilities: ['sales:negotiate'],
      systemPrompt: 'Eres un agente de negociación. Clasificas cada respuesta como [POSITIVO/NEUTRO/NEGATIVO] y propones la siguiente respuesta. Rediriges al valor, no al precio. Cerrar contrato o dar descuento requiere aprobación humana.',
    });
  }

  async run(task) {
    const reply = task.payload?.reply || '';
    const analysis = await this.think(`Clasifica y responde a esta respuesta de un prospecto: "${reply}"`);
    return { analysis, status: 'ok' };
  }
}
module.exports = NegotiatorAgent;
