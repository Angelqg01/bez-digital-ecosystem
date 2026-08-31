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
