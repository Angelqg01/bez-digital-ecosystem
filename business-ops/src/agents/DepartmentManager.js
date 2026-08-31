'use strict';

const BaseAgent = require('./BaseAgent');

/**
 * DepartmentManager — agente de Nivel 2.
 *
 * Dirige a un conjunto de especialistas de su departamento. No ejecuta el trabajo
 * de detalle: lo descompone, lo reparte entre sus especialistas, sintetiza el
 * resultado y reporta KPIs al Orchestrator.
 */
class DepartmentManager extends BaseAgent {
  constructor(ctx) {
    super({ ...ctx, tier: 'manager', modelTier: ctx.modelTier || 'frontier' });
    this.specialists = new Map(); // id -> agente
  }

  registerSpecialist(agent) {
    this.specialists.set(agent.id, agent);
    return agent;
  }

  getSpecialist(id) {
    return this.specialists.get(id);
  }

  /**
   * Recibe una tarea del orquestador, decide qué especialista la atiende
   * (o coordina varios) y devuelve el resultado.
   */
  async run(task) {
    const plan = await this._plan(task);
    const results = [];

    for (const step of plan) {
      const specialist = this.specialists.get(step.specialistId);
      if (!specialist) {
        results.push({ step, error: `especialista no encontrado: ${step.specialistId}` });
        continue;
      }
      const out = await specialist.run(step.task);
      results.push({ step: step.specialistId, out });
    }

    const synthesis = await this._synthesize(task, results);
    await this.remember({ task: task.type, summary: synthesis.summary, outcome: synthesis.outcome });
    return synthesis;
  }

  /**
   * Plan por defecto: enruta por task.type al especialista declarado en el routing.
   * Override para planificación más sofisticada con el modelo.
   */
  async _plan(task) {
    const specialistId = this.routing?.[task.type];
    if (specialistId) {
      return [{ specialistId, task }];
    }
    // Sin ruta directa: el primer especialista por defecto
    const first = this.specialists.keys().next().value;
    return [{ specialistId: first, task }];
  }

  async _synthesize(task, results) {
    return {
      department: this.department,
      task: task.type,
      results,
      summary: `${this.department}: ${results.length} paso(s) ejecutado(s)`,
      outcome: results.every(r => !r.error) ? 'ok' : 'partial',
    };
  }
}

module.exports = DepartmentManager;
