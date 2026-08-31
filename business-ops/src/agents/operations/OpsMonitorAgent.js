'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * OpsMonitorAgent — monitoriza el estado del sistema a través del conector
 * SystemMonitor y lanza alertas si detecta anomalías.
 */
class OpsMonitorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.ops-monitor',
      name: 'Ops Monitor',
      department: 'operations',
      modelTier: 'fast',
      capabilities: ['operations:monitor'],
      systemPrompt: 'Eres un agente de monitoreo de sistemas. Evalúas métricas de hardware y red, e identificas anomalías.',
    });
  }

  async run(task) {
    const sysmon = this.tools.sysmon;
    if (!sysmon) {
      throw new Error('sysmon: conector SystemMonitor no disponible');
    }

    const metrics = await sysmon.execute('getSystemMetrics');
    const alerts = [];

    if (metrics.diskUsagePct > 80) {
      alerts.push(`Almacenamiento crítico: ${metrics.diskUsagePct}% en uso.`);
    }
    if (metrics.ramUsagePct > 90) {
      alerts.push(`Uso de RAM crítico: ${metrics.ramUsagePct}%`);
    }
    if (metrics.ollamaLatencyMs > 1000) {
      alerts.push(`Latencia de Ollama crítica: ${metrics.ollamaLatencyMs}ms`);
    }

    const anomalyDetected = alerts.length > 0;
    
    if (anomalyDetected) {
      const alertPayload = {
        tenantId: this.tenantId,
        metrics,
        alerts,
        timestamp: Date.now()
      };
      this.bus?.emit('operations:anomaly_detected', alertPayload);
      await this.remember({ summary: `Anomalía detectada: ${alerts.join(' | ')}`, metrics });
    }

    return {
      metrics,
      anomalyDetected,
      alerts,
      status: 'ok'
    };
  }
}

module.exports = OpsMonitorAgent;
