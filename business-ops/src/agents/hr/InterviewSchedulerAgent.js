'use strict';

const BaseAgent = require('../BaseAgent');

/** Interview Scheduler — propone huecos y prepara la convocatoria de entrevista. */
class InterviewSchedulerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'hr.scheduler',
      name: 'Interview Scheduler',
      department: 'hr',
      modelTier: 'fast',
      capabilities: ['hr:schedule'],
      systemPrompt: 'Coordinas entrevistas: propones franjas, preparas el orden del día y el correo de convocatoria.',
    });
  }

  async run(task) {
    const proposal = await this.think(`Prepara la convocatoria de entrevista para: ${JSON.stringify(task.payload?.candidate || task.payload?.text || {})}. Propón 3 franjas y un orden del día.`);
    return { proposal, status: 'ok' };
  }
}

module.exports = InterviewSchedulerAgent;
