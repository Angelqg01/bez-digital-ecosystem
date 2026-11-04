'use strict';

/** calcRunway — meses de autonomía dado un balance y un gasto mensual. Pura, sin IA. */
function calcRunway(balanceUsd, monthlyBurnUsd) {
  const balance = Number(balanceUsd) || 0;
  const burn = Number(monthlyBurnUsd) || 0;
  if (burn <= 0) return null;
  return Math.round((balance / burn) * 10) / 10;
}

/** isCritical — por debajo de este runway (meses), un humano debería revisarlo ya. */
const CRITICAL_RUNWAY_MONTHS = 3;
function isCritical(runwayMonths, simulated) {
  return runwayMonths !== null && runwayMonths < CRITICAL_RUNWAY_MONTHS && !simulated;
}

module.exports = { calcRunway, isCritical, CRITICAL_RUNWAY_MONTHS };

/**
 * Valoración de una tesorería multi-divisa/multi-activo. Pura, sin IA.
 *
 * `calcRunway` recibe un único número en USD, así que ni el tipo de cambio
 * (AED/EUR) ni el depeg de una stablecoin lo movían: el aviso de "tesorería
 * crítica" tardaba en saltar justo cuando importa. Aquí cada posición se valora
 * con el precio del momento:
 *   - kind 'fiat':     amount × fx[asset]      (USD vale 1 si no hay fx)
 *   - kind 'stable':   amount × pegs[asset]    (1 si no hay precio de mercado)
 *   - kind 'volatile': amount × prices[asset]  (sin precio → no cuenta; se avisa)
 *
 * holdings: [{ asset: 'USDC', kind: 'stable', amount: 500000 }, …]
 */
const CONCENTRATION_LIMIT = 0.4; // una sola stablecoin no debería superar el 40 % del total

function valueHoldings(holdings = [], { fx = {}, pegs = {}, prices = {} } = {}) {
  const byAsset = {};
  const warnings = [];
  let totalUsd = 0;
  for (const h of holdings) {
    const amount = Number(h.amount) || 0;
    let unit;
    if (h.kind === 'fiat') unit = h.asset === 'USD' ? 1 : fx[h.asset];
    else if (h.kind === 'stable') unit = pegs[h.asset] ?? 1;
    else unit = prices[h.asset];
    if (unit === undefined || unit === null || !Number.isFinite(Number(unit))) {
      warnings.push(`Sin precio/tipo de cambio para ${h.asset}: no se valora.`);
      continue;
    }
    const usd = amount * Number(unit);
    byAsset[h.asset] = (byAsset[h.asset] || 0) + usd;
    totalUsd += usd;
  }
  for (const [asset, usd] of Object.entries(byAsset)) {
    const isStable = holdings.some((x) => x.asset === asset && x.kind === 'stable');
    if (isStable && totalUsd > 0 && usd / totalUsd > CONCENTRATION_LIMIT) {
      warnings.push(`Concentración en ${asset}: ${(100 * usd / totalUsd).toFixed(0)} % del total (límite ${CONCENTRATION_LIMIT * 100} %).`);
    }
  }
  return { totalUsd: Math.round(totalUsd), byAsset, warnings };
}

/** Runway con las posiciones valoradas, y bajo un depeg hipotético de todas las stablecoins. */
function calcRunwayFromHoldings(holdings, monthlyBurnUsd, market = {}, { stableShock = 0 } = {}) {
  const now = valueHoldings(holdings, market);
  const shockedPegs = { ...(market.pegs || {}) };
  for (const h of holdings) if (h.kind === 'stable') shockedPegs[h.asset] = (shockedPegs[h.asset] ?? 1) * (1 - stableShock);
  const stressed = valueHoldings(holdings, { ...market, pegs: shockedPegs });
  return {
    totalUsd: now.totalUsd,
    runwayMonths: calcRunway(now.totalUsd, monthlyBurnUsd),
    stressedRunwayMonths: calcRunway(stressed.totalUsd, monthlyBurnUsd),
    warnings: now.warnings,
  };
}

module.exports.valueHoldings = valueHoldings;
module.exports.calcRunwayFromHoldings = calcRunwayFromHoldings;
module.exports.CONCENTRATION_LIMIT = CONCENTRATION_LIMIT;
