'use strict';

const BaseAgent = require('../BaseAgent');

/** Report — genera informes operativos a partir de los datos del periodo. */
class ReportAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.report',
      name: 'Report Generator',
      department: 'operations',
      modelTier: 'mid',
      capabilities: ['operations:report'],
      systemPrompt: 'Generas informes operativos claros: resumen ejecutivo, métricas clave, desviaciones y acciones recomendadas.',
    });
  }

  async run(task) {
    const report = await this.think(`Genera un informe operativo con estos datos: ${JSON.stringify(task.payload?.data || task.payload?.text || {})}.`);
    return { report, status: 'ok' };
  }
}

module.exports = ReportAgent;
