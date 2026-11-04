'use strict';
const BaseAgent = require('../BaseAgent');
const { calcRunway, isCritical, calcRunwayFromHoldings } = require('./runwayMath');

const STABLE_SHOCK = 0.04; // depeg hipotético para la prueba de estrés (4 %)

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
    let balanceUsd = Number(treasury.balanceUsd || 0);
    let runwayMonths = calcRunway(balanceUsd, monthlyBurnUsd);
    let simulated = !!treasury.simulated;
    let multi = null;

    // Runway multi-divisa: bancos (AED/EUR/USD), stablecoins on-chain y Treasury DAO,
    // cada posición valorada con su tipo de cambio/peg y con prueba de estrés.
    const positionsTool = this.tools['treasury-positions'];
    if (positionsTool) {
      const [pos, market] = await Promise.all([positionsTool.execute('positions'), positionsTool.execute('market')]);
      if (pos.holdings.length) {
        const holdings = [...pos.holdings];
        if (!treasury.simulated && balanceUsd > 0) holdings.push({ asset: 'USD', kind: 'fiat', amount: balanceUsd, bank: 'Treasury DAO', source: 'bezhas-core' });
        const r = calcRunwayFromHoldings(holdings, monthlyBurnUsd, market, { stableShock: STABLE_SHOCK });
        balanceUsd = r.totalUsd;
        runwayMonths = r.runwayMonths;
        // Dato no fiable → no dispara alertas críticas reales: mercado caído o saldos de banco obsoletos.
        simulated = market.simulated || pos.stale.length > 0;
        multi = {
          totalUsd: r.totalUsd, runwayMonths: r.runwayMonths,
          stressedRunwayMonths: r.stressedRunwayMonths, stableShock: STABLE_SHOCK,
          warnings: [...pos.warnings, ...r.warnings, ...(market.simulated ? ['Precios de mercado no disponibles: se asume peg 1 y sin tipo de cambio.'] : [])],
          positions: holdings.length, staleCount: pos.stale.length, marketSimulated: market.simulated,
        };
      } else if (pos.warnings.length) {
        multi = { totalUsd: null, warnings: pos.warnings, positions: 0 };
      }
    }

    const analysis = await this.think(
      `Balance de tesorería: $${balanceUsd} (${simulated ? 'DATO NO FIABLE — stack, mercado o saldos de banco desactualizados' : 'dato real'}). ` +
      `Gasto mensual estimado: $${monthlyBurnUsd}. Runway calculado: ${runwayMonths ?? 'desconocido'} meses. ` +
      (multi?.stressedRunwayMonths != null ? `Con un depeg del ${STABLE_SHOCK * 100}% de las stablecoins: ${multi.stressedRunwayMonths} meses. ` : '') +
      (multi?.warnings?.length ? `Avisos: ${multi.warnings.join(' | ')} ` : '') +
      `En 2-3 frases, valora si esto es motivo de preocupación y qué haría un CFO con esta información.`,
      { useMemory: false, maxTokens: 300 },
    );

    const critical = isCritical(runwayMonths, simulated);
    if (critical) {
      this.bus?.emit('treasury:runway_critical', { tenantId: this.tenantId, balanceUsd, runwayMonths, timestamp: Date.now() });
      await this.remember({ summary: `Runway crítico: ${runwayMonths} meses (balance $${balanceUsd})`, treasury });
    }

    return { treasury, monthlyBurnUsd, runwayMonths, multiCurrency: multi, analysis, critical, status: 'ok' };
  }
}
module.exports = TreasuryRunwayAgent;
