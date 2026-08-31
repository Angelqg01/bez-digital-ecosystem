'use strict';

const BaseAgent = require('../BaseAgent');

/** Content Planner — propone calendario y temas de contenido alineados al negocio. */
class ContentPlannerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'marketing.content',
      name: 'Content Planner',
      department: 'marketing',
      modelTier: 'mid',
      capabilities: ['marketing:request'],
      systemPrompt: 'Eres un estratega de contenido. Propones un calendario editorial con temas, formato y objetivo de cada pieza.',
    });
  }

  async run(task) {
    const plan = await this.think(`Propón un plan de contenido para: "${task.payload?.text || ''}". Incluye 5 piezas con tema, formato y objetivo.`);
    return { plan, status: 'ok' };
  }
}

module.exports = ContentPlannerAgent;
