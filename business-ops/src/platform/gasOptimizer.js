'use strict';

/**
 * gasOptimizer — decide si conviene ejecutar una transacción ahora o esperar,
 * comparando el gas actual contra un umbral REAL del tenant, no contra la
 * "sensación" del modelo al leer un número de gwei.
 *
 * El umbral (`thresholdGwei`) no lo inventa este módulo: es una decisión de
 * negocio (cuánto está dispuesto a pagar el tenant por ir rápido) que debe
 * configurarse explícitamente. Sin ella, el módulo no recomienda nada.
 */

/**
 * @param {number} currentGwei
 * @param {number} thresholdGwei   - por encima de esto, se recomienda esperar
 * @param {number[]} [historyGwei] - muestras recientes, para dar contexto de percentil
 */
function evaluate(currentGwei, thresholdGwei, historyGwei = []) {
  if (!(currentGwei >= 0)) return { recommendation: null, reason: 'currentGwei inválido' };
  if (!(thresholdGwei > 0)) return { recommendation: null, reason: 'sin thresholdGwei configurado: no se recomienda nada' };

  const recommendation = currentGwei <= thresholdGwei ? 'execute_now' : 'wait';

  let percentile = null;
  if (historyGwei.length >= 5) {
    const menores = historyGwei.filter((g) => g <= currentGwei).length;
    percentile = Number((menores / historyGwei.length).toFixed(3));
  }

  return {
    recommendation,
    currentGwei,
    thresholdGwei,
    percentile,   // p. ej. 0.1 = el gas actual está entre los más baratos vistos
    overThresholdPct: thresholdGwei > 0 ? Number(((currentGwei - thresholdGwei) / thresholdGwei).toFixed(4)) : null,
    reason: null,
  };
}

module.exports = { evaluate };
