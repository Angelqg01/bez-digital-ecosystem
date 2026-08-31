'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * OnChainMonitorAgent — lee el estado real de la cadena (BeZhasCoreConnector:
 * overview, validadores, tesorería, gas) y usa el modelo para interpretarlo,
 * no solo comparar umbrales. Es de solo lectura: nunca mueve nada, solo avisa.
 *
 * Si el stack de BeZhas-Blockchain no está levantado, el conector cae a modo
 * simulado — este agente lo detecta y lo reporta como la primera anomalía
 * ("el propio stack no responde"), en vez de fingir que todo está bien.
 */
class OnChainMonitorAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'blockchain.onchain-monitor',
      name: 'On-Chain Monitor',
      department: 'blockchain',
      modelTier: 'fast',
      capabilities: ['blockchain:monitor'],
      systemPrompt:
        'Eres el vigilante on-chain de BeZhas. Lees el estado de la cadena, validadores, tesorería y gas, ' +
        'e interpretas si hay algo que un humano debería revisar. Eres conciso y concreto: nada de relleno.',
    });
  }

  async run(task) {
    const core = this.tools['bezhas-core'];
    if (!core) throw new Error('bezhas-core: conector no disponible');

    const [overview, validators, treasury, gas] = await Promise.all([
      core.execute('chainOverview'),
      core.execute('validatorStats'),
      core.execute('treasuryStats'),
      core.execute('gasStatus'),
    ]);

    const snapshot = { overview, validators, treasury, gas };
    const anyStale = [overview, validators, treasury, gas].some((d) => d.simulated);

    const analysis = await this.think(
      `Analiza este snapshot on-chain de BeZhas y di, en 3-5 frases, si hay algo que requiera atención humana ` +
      `(caída de validadores, tesorería baja, gas anómalo, o que el propio stack no responda). ` +
      `Si todo está normal, dilo en una frase.\n\nSNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}`,
      { useMemory: false, maxTokens: 400 },
    );

    const alerts = [];
    if (anyStale) alerts.push('El stack de BeZhas-Blockchain no respondió (API caída o no levantada) — datos simulados.');
    if (!overview.simulated && overview.status && overview.status !== 'healthy' && overview.status !== 'unknown') {
      alerts.push(`Estado de la cadena: ${overview.status}`);
    }
    if (!treasury.simulated && Number(treasury.balanceUsd || 0) > 0 && Number(treasury.balanceUsd) < 1000) {
      alerts.push(`Tesorería baja: $${treasury.balanceUsd}`);
    }

    const anomalyDetected = alerts.length > 0;
    if (anomalyDetected) {
      this.bus?.emit('blockchain:anomaly_detected', { tenantId: this.tenantId, alerts, snapshot, timestamp: Date.now() });
      await this.remember({ summary: `Anomalía on-chain: ${alerts.join(' | ')}`, snapshot });
    }

    return { snapshot, analysis, alerts, anomalyDetected, status: 'ok' };
  }
}
module.exports = OnChainMonitorAgent;
