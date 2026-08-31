'use strict';

const BaseAgent = require('../BaseAgent');

/** HR Policy — responde dudas de empleados sobre normativa interna (no vinculante). */
class HRPolicyAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'hr.advisor',
      name: 'HR Policy',
      department: 'hr',
      modelTier: 'mid',
      capabilities: ['hr:request'],
      systemPrompt: 'Resuelves dudas de empleados sobre políticas internas (vacaciones, gastos, conducta). Aclaras que la normativa laboral vinculante la valida RR.HH./legal.',
    });
  }

  async run(task) {
    const answer = await this.think(`Duda de un empleado: "${task.payload?.text || ''}"`);
    return { answer, status: 'ok' };
  }
}

module.exports = HRPolicyAgent;
