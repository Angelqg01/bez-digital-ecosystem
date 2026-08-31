'use strict';
const BaseAgent = require('../BaseAgent');
const { calcRunway, isCritical } = require('./runwayMath');

/**
 * TreasuryRunwayAgent — lee el balance real del Treasury DAO (BeZhasCoreConnector)
 * y razona sobre runway (meses de autonomía) dado un gasto mensual estimado.
 * Solo lee y analiza: nunca mueve fondos (eso es TokenDisbursementAgent, y
 * siempre pasa por la línea roja crypto_asset_movement).
 */
class TreasuryRunwayAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'treasury.runway',
      name: 'Treasury Runway',
      department: 'treasury',
      modelTier: 'fast',
      capabilities: ['treasury:runway'],
      systemPrompt:
        'Eres el analista de tesorería de BeZhas. Con el balance real del Treasury DAO y un gasto mensual estimado, ' +
        'calculas el runway y avisas con antelación si se acerca a un umbral crítico. Nunca mueves fondos.',
    });
  }

  async run(task) {
    const core = this.tools['bezhas-core'];
    if (!core) throw new Error('bezhas-core: conector no disponible');

    const treasury = await core.execute('treasuryStats');
    const monthlyBurnUsd = Number(task.payload?.monthlyBurnUsd || process.env.TREASURY_MONTHLY_BURN_USD || 5000);
    const balanceUsd = Number(treasury.balanceUsd || 0);
    const runwayMonths = calcRunway(balanceUsd, monthlyBurnUsd);

    const analysis = await this.think(
      `Balance del Treasury DAO: $${balanceUsd} (${treasury.simulated ? 'DATO SIMULADO — el stack de BeZhas no respondió' : 'dato real'}). ` +
      `Gasto mensual estimado: $${monthlyBurnUsd}. Runway calculado: ${runwayMonths ?? 'desconocido'} meses. ` +
      `En 2-3 frases, valora si esto es motivo de preocupación y qué haría un CFO con esta información.`,
      { useMemory: false, maxTokens: 300 },
    );

    const critical = isCritical(runwayMonths, treasury.simulated);
    if (critical) {
      this.bus?.emit('treasury:runway_critical', { tenantId: this.tenantId, balanceUsd, runwayMonths, timestamp: Date.now() });
      await this.remember({ summary: `Runway crítico: ${runwayMonths} meses (balance $${balanceUsd})`, treasury });
    }

    return { treasury, monthlyBurnUsd, runwayMonths, analysis, critical, status: 'ok' };
  }
}
module.exports = TreasuryRunwayAgent;
