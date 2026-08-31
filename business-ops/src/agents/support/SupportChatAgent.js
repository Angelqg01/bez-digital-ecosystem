'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * SupportChatAgent — resuelve consultas buscando en VectorDB/KnowledgeBase y
 * apoyándose en la memoria episódica del cliente. Responde de forma empática.
 */
class SupportChatAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.chat-agent',
      name: 'Support Chat Agent',
      department: 'support',
      modelTier: 'mid',
      capabilities: ['support:chat'],
      systemPrompt: 'Eres un agente de soporte empático y profesional. Resuelves dudas de clientes en su mismo idioma basándote únicamente en los artículos de conocimiento encontrados y en el historial previo.',
    });
  }

  async run(task) {
    const query = task.payload?.text || '';
    const customerId = task.payload?.customerId;

    // 1) La KnowledgeBase del tenant es la fuente canónica (ahí ingesta el
    //    endpoint /kb, con búsqueda semántica si hay embedder). El VectorDB
    //    solo complementa si devuelve algo: un índice vacío no debe tapar
    //    a la KB (bug real: vectordb presente pero vacío → 0 hits → escalaba).
    let hits = this.knowledgeBase ? await this.knowledgeBase.search(query, { k: 3 }) : [];
    if (!hits.length && this.tools.vectordb) {
      try {
        hits = await this.tools.vectordb.execute('search', { query, k: 3 }) || [];
      } catch { /* índice externo caído: seguimos con lo que haya */ }
    }

    // 2) Recuperar memoria episódica (historial de interacciones de este cliente)
    let history = '';
    if (customerId && this.memory) {
      try {
        const past = await this.memory.recall(`cliente ${customerId}`, { agentId: this.id, k: 3 });
        if (past.length > 0) {
          history = past.map((h, i) => `Historial ${i+1}: ${h.summary}`).join('\n');
        }
      } catch (e) { /* ignore memory errors */ }
    }

    const kbContext = hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.snippet || h.body}`).join('\n');
    const grounded = hits.length > 0;

    const response = await this.think(
      `Responde a la consulta del cliente de manera empática.\n\n` +
      `CONSULTA: "${query}"\n\n` +
      `CONOCIMIENTO DISPONIBLE:\n${kbContext || '(no hay artículos de conocimiento)'}\n\n` +
      `HISTORIAL DEL CLIENTE:\n${history || '(sin historial previo)'}\n\n` +
      `Instrucciones: Si el conocimiento no es suficiente para responder la pregunta, di claramente que no dispones de esa información y que un agente humano lo revisará.`,
      { useMemory: true }
    );

    return {
      reply: response,
      hits: hits.map(h => ({ id: h.id, title: h.title, score: h.score })),
      grounded,
      status: 'ok',
    };
  }
}

module.exports = SupportChatAgent;
