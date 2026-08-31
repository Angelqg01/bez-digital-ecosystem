'use strict';

const BaseAgent = require('../BaseAgent');
const sla = require('../../platform/slaBreach');

/**
 * SLAMonitorAgent — vigila el cumplimiento de los compromisos de servicio
 * (tiempo de respuesta, tiempo de resolución) prometidos a clientes o socios.
 *
 * El estado de cada caso (cumplido / incumplido / en riesgo / en curso) lo
 * calcula `platform/slaBreach.js` contra fechas reales, no contra la
 * impresión del modelo al leer una lista. Un caso todavía abierto y dentro de
 * plazo NO es "cumplido": puede acabar mal, y contarlo como éxito infla la
 * tasa de cumplimiento con casos que ni han tenido ocasión de fallar.
 *
 * Solo se avisa de lo que necesita acción (en riesgo o ya incumplido) — un
 * caso que va bien no genera ruido.
 */
class SLAMonitorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.sla-monitor',
      name: 'SLA Monitor',
      department: 'operations',
      modelTier: 'fast',
      capabilities: ['operations:sla'],
      systemPrompt:
        'Recibes el estado de cumplimiento de SLA YA CALCULADO. Redacta qué casos priorizar '
        + 'y por qué, en un párrafo breve. No inventes plazos ni contradigas el estado dado.',
    });
  }

  async run(task) {
    const cases = task.payload?.cases || [];
    if (!cases.length) {
      return { status: 'blocked', reason: 'sin casos que evaluar' };
    }

    const result = sla.evaluateAll(cases, { now: task.payload?.now });

    for (const c of result.breached) {
      this.bus?.emit('operations:sla_breached', { tenantId: this.tenantId, caseId: c.id, type: c.type, minutesLate: c.minutesLate });
    }
    for (const c of result.atRisk) {
      this.bus?.emit('operations:sla_at_risk', { tenantId: this.tenantId, caseId: c.id, type: c.type, minutesRemaining: c.minutesRemaining });
    }

    let summary = null;
    if (result.breached.length || result.atRisk.length) {
      const detalle = [
        ...result.breached.map((c) => `${c.id}: incumplido hace ${c.minutesLate} min`),
        ...result.atRisk.map((c) => `${c.id}: en riesgo, quedan ${c.minutesRemaining} min`),
      ].join('\n');
      summary = await this.think(`Prioriza estos casos de SLA:\n${detalle}`, { useMemory: false, maxTokens: 300 });
    }

    return {
      status: 'ok',
      complianceRate: result.complianceRate,
      breached: result.breached.length,
      atRisk: result.atRisk.length,
      onTrack: result.onTrack.length,
      compliant: result.compliant.length,
      summary,
    };
  }
}

module.exports = SLAMonitorAgent;
