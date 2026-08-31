'use strict';

/**
 * slashingWatch — clasifica eventos de slashing/jailing de validadores por
 * gravedad real (% de stake penalizado), sin adivinar cuando faltan datos.
 *
 * Un validador penalizado le cuesta stake real al Treasury si delega ahí; la
 * urgencia depende del PORCENTAJE penalizado, no de si hubo o no un evento —
 * un 0.01% es ruido operativo, un 5% es una alarma de verdad (suele indicar
 * double-signing, no downtime).
 */

const SEVERITY_BANDS = [
  { from: 0.05, level: 'critico' },   // double-signing típico
  { from: 0.01, level: 'alto' },
  { from: 0, level: 'menor' },
];

/**
 * @param {{id, stakedAmount, slashedAmount, jailed, jailedUntil}} v
 * @returns {{id, slashedPct:number|null, level:string|null, jailed:boolean, reason:string|null}}
 */
function evaluate(v = {}) {
  const { id, stakedAmount, slashedAmount, jailed = false, jailedUntil = null } = v;
  if (!id) return { id: null, slashedPct: null, level: null, jailed: false, reason: 'validador sin id' };

  if (!(stakedAmount > 0) || slashedAmount == null) {
    return { id, slashedPct: null, level: null, jailed: !!jailed, jailedUntil, reason: 'sin datos de slashing para este validador: no se opina' };
  }
  if (slashedAmount === 0) {
    return { id, slashedPct: 0, level: null, jailed: !!jailed, jailedUntil, reason: null };
  }

  const slashedPct = Number((slashedAmount / stakedAmount).toFixed(6));
  const level = SEVERITY_BANDS.find((b) => slashedPct >= b.from).level;
  return { id, slashedPct, level, jailed: !!jailed, jailedUntil, reason: null };
}

/** Evalúa varios validadores; devuelve solo los que tienen slashing real, por gravedad. */
function evaluateAll(validators = []) {
  const results = validators.map(evaluate);
  const afectados = results.filter((r) => r.slashedPct > 0);
  afectados.sort((a, b) => b.slashedPct - a.slashedPct);
  return {
    results,
    affected: afectados,
    critical: afectados.filter((r) => r.level === 'critico'),
    unknown: results.filter((r) => r.reason != null),
  };
}

module.exports = { evaluate, evaluateAll, SEVERITY_BANDS };
