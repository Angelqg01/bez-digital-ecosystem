'use strict';

/**
 * vestingMath — cuánto token está liberado a una fecha, con fórmula, no con
 * la lectura que haga un modelo de una tabla de vesting.
 *
 * Mismo motivo que `priceCatalog`/`capTableMath`: cuánto BEZ-Coin tiene
 * liberado un fundador o inversor es un número con consecuencia directa en
 * presión de venta y dilución percibida — equivocarlo por unas semanas cambia
 * la lectura de "cuánto puede vender esta persona hoy".
 *
 * Esquema estándar: cliff + vesting lineal mensual tras el cliff.
 */

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.4375;   // mes medio; consistente para todo el cálculo

function monthsBetween(from, to) {
  return (new Date(to).getTime() - new Date(from).getTime()) / (DAY_MS * MONTH_DAYS);
}

/**
 * @param {object} grant
 * @param {number} grant.totalTokens
 * @param {string|number} grant.startDate
 * @param {number} grant.cliffMonths
 * @param {number} grant.vestingMonths   - duración total del vesting (incluye el cliff)
 * @param {string|number} [atDate]
 * @returns {{vested:number, unvested:number, vestedPct:number, cliffPassed:boolean, nextUnlockDate:string|null, nextUnlockAmount:number|null}}
 */
function evaluate(grant = {}, atDate = Date.now()) {
  const { totalTokens, startDate, cliffMonths, vestingMonths } = grant;
  if (!Number.isFinite(totalTokens) || !startDate || !Number.isFinite(cliffMonths) || !Number.isFinite(vestingMonths) || vestingMonths <= 0) {
    return { vested: null, unvested: null, vestedPct: null, cliffPassed: null, nextUnlockDate: null, nextUnlockAmount: null, reason: 'datos de vesting insuficientes' };
  }

  const elapsed = monthsBetween(startDate, atDate);
  const cliffPassed = elapsed >= cliffMonths;

  let vested;
  if (!cliffPassed) {
    vested = 0;
  } else if (elapsed >= vestingMonths) {
    vested = totalTokens;
  } else {
    // Lineal mensual: el cliff libera de golpe su parte proporcional, y el
    // resto se reparte a partes iguales mes a mes hasta el final.
    vested = totalTokens * (elapsed / vestingMonths);
  }
  vested = Math.min(totalTokens, Math.max(0, vested));
  const unvested = totalTokens - vested;

  let nextUnlockDate = null;
  let nextUnlockAmount = null;
  if (elapsed < vestingMonths) {
    const start = new Date(startDate).getTime();
    const nextMonthMark = cliffPassed ? Math.floor(elapsed) + 1 : Math.ceil(cliffMonths);
    const nextDate = start + nextMonthMark * MONTH_DAYS * DAY_MS;
    const vestedAtNext = Math.min(totalTokens, totalTokens * (Math.min(nextMonthMark, vestingMonths) / vestingMonths));
    nextUnlockDate = new Date(nextDate).toISOString();
    nextUnlockAmount = Number((vestedAtNext - vested).toFixed(6));
  }

  return {
    vested: Number(vested.toFixed(6)),
    unvested: Number(unvested.toFixed(6)),
    vestedPct: Number((vested / totalTokens).toFixed(4)),
    cliffPassed,
    nextUnlockDate,
    nextUnlockAmount,
    reason: null,
  };
}

/** Evalúa varios grants y ordena por proximidad del próximo desbloqueo. */
function evaluateAll(grants = [], atDate = Date.now()) {
  const results = grants.map((g) => ({ holder: g.holder, ...evaluate(g, atDate) }));
  const conProximoDesbloqueo = results.filter((r) => r.nextUnlockDate);
  conProximoDesbloqueo.sort((a, b) => new Date(a.nextUnlockDate) - new Date(b.nextUnlockDate));
  return { results, upcoming: conProximoDesbloqueo };
}

module.exports = { evaluate, evaluateAll, monthsBetween, MONTH_DAYS };
