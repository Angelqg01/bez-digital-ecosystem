'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * Resolver — redacta la respuesta final y decide si resuelve o escala.
 * Escala cuando: prioridad alta, sentimiento negativo, o la KB no fundamenta
 * la respuesta. Lo irreversible (un reembolso, una promesa contractual) lo
 * resolvería el humano vía el flujo de escalado.
 */
class ResolverAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.resolver',
      name: 'Resolver',
      department: 'support',
      modelTier: 'mid',
      capabilities: ['support:resolve'],
      systemPrompt: 'Eres un agente de soporte que redacta la respuesta final al cliente: clara, empática y accionable.',
    });
  }

  async run(task) {
    const { triage = {}, kb = {} } = task.payload || {};
    const escalate = triage.priority === 'high' || triage.sentiment === 'negative' || !kb.grounded;

    const reply = await this.think(
      `Redacta la respuesta final al cliente${escalate ? ' (indica que un agente humano revisará el caso en breve)' : ''}. ` +
      `Apóyate en este borrador: ${kb.draft || '(sin base de conocimiento)'}`,
      { useMemory: false },
    );

    return {
      escalate,
      reply,
      reason: escalate
        ? `escala por: ${[triage.priority === 'high' && 'prioridad alta', triage.sentiment === 'negative' && 'sentimiento negativo', !kb.grounded && 'sin base de conocimiento'].filter(Boolean).join(', ')}`
        : 'resuelto con la base de conocimiento',
      status: 'ok',
    };
  }
}

module.exports = ResolverAgent;
