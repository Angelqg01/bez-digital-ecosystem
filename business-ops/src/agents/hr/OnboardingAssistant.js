'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * OnboardingAssistant — responde de manera interactiva a dudas de nuevos empleados
 * sobre accesos, políticas, guías de estilo y uso de repositorios basándose en
 * la base de conocimiento (documentación interna estilo Notion).
 */
class OnboardingAssistant extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'hr.onboarding-assistant',
      name: 'Onboarding Assistant',
      department: 'hr',
      modelTier: 'mid',
      capabilities: ['hr:onboard'],
      systemPrompt: 'Eres un asistente de Onboarding para nuevos empleados. Das la bienvenida y respondes dudas sobre accesos, repositorios y políticas de la empresa basándote en la base de conocimiento. Eres cercano, servicial y claro.',
    });
  }

  async run(task) {
    const query = task.payload?.text || '';

    // Buscar documentación relevante
    let docs = [];
    const vectorDb = this.tools.vectordb;
    if (vectorDb) {
      try {
        docs = await vectorDb.execute('search', { query, k: 3 });
      } catch (err) {
        docs = this.knowledgeBase ? await this.knowledgeBase.search(query, { k: 3 }) : [];
      }
    } else {
      docs = this.knowledgeBase ? await this.knowledgeBase.search(query, { k: 3 }) : [];
    }

    const kbContext = docs.map((d, i) => `[${i + 1}] ${d.title}: ${d.snippet || d.body}`).join('\n');

    const reply = await this.think(
      `Responde a la duda del nuevo empleado.\n\n` +
      `PREGUNTA: "${query}"\n\n` +
      `DOCUMENTACIÓN ENCONTRADA:\n${kbContext || '(no se encontró documentación relevante)'}\n\n` +
      `Instrucciones: Si no encuentras información sobre la duda específica en la documentación dada, sugiérele contactar a su mentor o al equipo de soporte de RR.HH.`,
      { useMemory: false }
    );

    return {
      reply,
      docsMatched: docs.map(d => d.title),
      status: 'ok',
    };
  }
}

module.exports = OnboardingAssistant;
