'use strict';

const BaseAgent = require('../BaseAgent');

/** SEO — sugiere palabras clave, estructura y mejoras on-page. */
class SeoAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'marketing.seo',
      name: 'SEO',
      department: 'marketing',
      modelTier: 'fast',
      capabilities: ['marketing:seo'],
      systemPrompt: 'Eres un especialista SEO. Propones palabras clave realistas (con intención de búsqueda), estructura de contenido y mejoras on-page concretas.',
    });
  }

  async run(task) {
    const out = await this.think(`Analiza SEO para: "${task.payload?.text || ''}". Devuelve 8 keywords con intención y 5 mejoras on-page.`, { maxTokens: 600 });
    return { seo: out, status: 'ok' };
  }
}

module.exports = SeoAgent;
