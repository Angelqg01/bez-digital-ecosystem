'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * KnowledgeBase Agent — RAG: recupera los artículos del cliente más relevantes
 * y redacta un borrador de respuesta apoyado SOLO en ellos. Si no hay base
 * suficiente, lo indica (para que el Resolver escale).
 */
class KnowledgeBaseAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.kb',
      name: 'Knowledge Base',
      department: 'support',
      modelTier: 'mid',
      capabilities: ['support:kb'],
      systemPrompt: 'Eres un agente de soporte. Respondes apoyándote únicamente en los artículos proporcionados; si no bastan, lo dices con claridad. No inventes.',
    });
  }

  async run(task) {
    const text = task.payload?.text || '';
    const hits = this.knowledgeBase ? await this.knowledgeBase.search(text, { k: 3 }) : [];

    const context = hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.snippet}`).join('\n');
    const draft = await this.think(
      'Responde a la consulta del cliente apoyándote SOLO en estos artículos de la base de conocimiento. ' +
      'Si no hay información suficiente, dilo explícitamente.\n\n' +
      `CONSULTA: ${text}\n\nARTÍCULOS:\n${context || '(ninguno relevante)'}`,
      { useMemory: false },
    );

    return {
      hits: hits.map((h) => ({ id: h.id, title: h.title, score: h.score })),
      grounded: hits.length > 0,
      draft,
      status: 'ok',
    };
  }
}

module.exports = KnowledgeBaseAgent;
