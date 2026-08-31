'use strict';

const BaseAgent = require('../BaseAgent');

/** Copywriter — redacta textos persuasivos (anuncios, emails, landing). */
class CopywriterAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'marketing.copy',
      name: 'Copywriter',
      department: 'marketing',
      modelTier: 'frontier',
      capabilities: ['marketing:copy'],
      systemPrompt: 'Eres un copywriter excelente. Escribes textos claros, específicos y persuasivos, nunca genéricos. Devuelves varias variantes cuando ayuda.',
    });
  }

  async run(task) {
    const { brief, format } = task.payload || {};
    const copy = await this.think(`Redacta el copy (${format || 'texto'}) para este brief: "${brief || task.payload?.text || ''}".`);
    return { copy, status: 'ok' };
  }
}

module.exports = CopywriterAgent;
