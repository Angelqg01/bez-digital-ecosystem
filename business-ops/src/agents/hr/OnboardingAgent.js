'use strict';

const BaseAgent = require('../BaseAgent');

/** Onboarding — prepara el plan de incorporación de una nueva persona. */
class OnboardingAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'hr.onboarding',
      name: 'Onboarding',
      department: 'hr',
      modelTier: 'mid',
      capabilities: ['hr:onboard'],
      systemPrompt: 'Diseñas planes de onboarding: accesos, formación, primeros objetivos y checklist de los primeros 30 días.',
    });
  }

  async run(task) {
    const plan = await this.think(`Prepara el plan de onboarding para: "${task.payload?.role || task.payload?.text || ''}". Incluye accesos, formación y checklist de 30 días.`);
    return { plan, status: 'ok' };
  }
}

module.exports = OnboardingAgent;
