'use strict';

const BaseAgent = require('../BaseAgent');

/** Forecast — proyecta la caja a partir de ingresos/gastos y señala riesgos de liquidez. */
class ForecastAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.forecast',
      name: 'Cashflow Forecast',
      department: 'finance',
      modelTier: 'mid',
      capabilities: ['finance:forecast'],
      systemPrompt: 'Proyectas el flujo de caja a partir de los datos dados. Señalas con claridad cualquier riesgo de liquidez y el mes en que ocurriría.',
    });
  }

  async run(task) {
    const data = task.payload?.data || task.payload?.text || {};
    const forecast = await this.think(`Haz una previsión de caja a partir de estos datos: ${JSON.stringify(data)}.`);
    return { forecast, status: 'ok' };
  }
}

module.exports = ForecastAgent;
