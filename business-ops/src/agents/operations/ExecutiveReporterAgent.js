'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * ExecutiveReporterAgent — consolida KPIs de los departamentos de Ventas,
 * Soporte y Finanzas en un reporte resumido y estructurado para el propietario del negocio.
 */
class ExecutiveReporterAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.executive-reporter',
      name: 'Executive Reporter',
      department: 'operations',
      modelTier: 'frontier',
      capabilities: ['operations:report'],
      systemPrompt: 'Eres un reportero ejecutivo experto. Consolidas métricas de ventas, soporte y finanzas en informes estructurados de alto nivel para el director ejecutivo de la empresa.',
    });
  }

  async run(task) {
    const { salesKpis = {}, supportKpis = {}, financeKpis = {} } = task.payload || {};

    const rawData = `
Métricas de Ventas:
- Leads calificados: ${salesKpis.qualifiedLeads || 0}
- Acuerdos cerrados: ${salesKpis.dealsWon || 0}
- Conversión: ${salesKpis.conversionPct || '0'}%

Métricas de Soporte:
- Tickets totales: ${supportKpis.totalTickets || 0}
- Tasa de resolución autónoma: ${supportKpis.resolutionPct || '0'}%
- Casos escalados al humano: ${supportKpis.escalatedTickets || 0}

Métricas Financieras:
- Ingresos: ${financeKpis.revenue || 0} EUR
- Gastos: ${financeKpis.expenses || 0} EUR
- Previsión de caja: ${financeKpis.cashflowForecast || 'Estable'}
`;

    const report = await this.think(
      `Genera un reporte conciso y de alta calidad para el director de la empresa consolidando el siguiente resumen:\n${rawData}`,
      { useMemory: false }
    );

    return { report, status: 'ok' };
  }
}

module.exports = ExecutiveReporterAgent;
