'use strict';

/**
 * abTest — decide si una diferencia entre dos variantes es real o es ruido.
 *
 * El error más común en analítica de campañas: "la variante B convierte al
 * 8 % y la A al 4 %, cambiamos a B" — con 25 impresiones cada una. Con esas
 * cifras, un solo clic mueve el porcentaje cuatro puntos. Actuar sobre eso no
 * es optimizar: es perseguir ruido, y encima con confianza.
 *
 * Aquí se hace la prueba de verdad (test z de dos proporciones, bilateral, con
 * proporción combinada) y se admite el resultado más frecuente y menos
 * vendible: **todavía no se sabe**. Un analista que solo sabe declarar
 * ganadores declara ganadores falsos.
 *
 * Sin modelo, a propósito: pedirle significancia estadística a un LLM da un
 * número que suena bien y nadie puede reproducir.
 */

/** Impresiones mínimas por variante para que la prueba signifique algo. */
const MIN_SAMPLE = 100;
/** Conversiones mínimas totales: con 2 conversiones no hay nada que comparar. */
const MIN_CONVERSIONS = 10;
/** Nivel de significancia habitual. */
const ALPHA = 0.05;

/**
 * Función de error (Abramowitz & Stegun 7.1.26). Error máximo ~1.5e-7,
 * de sobra para decidir si un p-valor cae por debajo de 0.05.
 */
function erf(x) {
  const signo = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return signo * y;
}

/** Función de distribución acumulada de la normal estándar. */
function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Compara dos variantes.
 *
 * @param {{name?, impressions, conversions}} a
 * @param {{name?, impressions, conversions}} b
 * @param {{alpha?, minSample?, minConversions?}} opts
 * @returns {{
 *   conclusive: boolean, winner: string|null, pValue: number|null,
 *   lift: number|null, rateA: number, rateB: number, verdict: string,
 *   neededPerVariant: number|null
 * }}
 */
function compare(a = {}, b = {}, { alpha = ALPHA, minSample = MIN_SAMPLE, minConversions = MIN_CONVERSIONS } = {}) {
  const nA = Number(a.impressions) || 0;
  const nB = Number(b.impressions) || 0;
  const cA = Number(a.conversions) || 0;
  const cB = Number(b.conversions) || 0;
  const nombreA = a.name || 'A';
  const nombreB = b.name || 'B';

  const rateA = nA ? cA / nA : 0;
  const rateB = nB ? cB / nB : 0;
  const base = {
    rateA: Number(rateA.toFixed(4)),
    rateB: Number(rateB.toFixed(4)),
    lift: rateA > 0 ? Number(((rateB - rateA) / rateA).toFixed(4)) : null,
  };

  // Guardas de muestra ANTES de calcular nada: sin datos suficientes, el
  // p-valor sería técnicamente correcto y prácticamente engañoso.
  if (nA < minSample || nB < minSample) {
    return {
      ...base, conclusive: false, winner: null, pValue: null,
      neededPerVariant: minSample,
      verdict: `Muestra insuficiente (${nA} y ${nB} impresiones; hacen falta ${minSample} por variante). `
        + 'La diferencia que se ve ahora mismo cabe dentro del azar.',
    };
  }
  if (cA + cB < minConversions) {
    return {
      ...base, conclusive: false, winner: null, pValue: null,
      neededPerVariant: null,
      verdict: `Solo ${cA + cB} conversiones en total (hacen falta ${minConversions}). `
        + 'Con tan pocas, un puñado de clics cambia el ganador.',
    };
  }

  // Test z de dos proporciones con proporción combinada.
  const pooled = (cA + cB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (se === 0) {
    return {
      ...base, conclusive: false, winner: null, pValue: null, neededPerVariant: null,
      verdict: 'Las dos variantes tienen exactamente el mismo comportamiento: no hay diferencia que medir.',
    };
  }

  const z = (rateB - rateA) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));   // bilateral

  if (pValue >= alpha) {
    return {
      ...base, conclusive: false, winner: null,
      pValue: Number(pValue.toFixed(4)), neededPerVariant: null,
      verdict: `Sin diferencia significativa (p = ${pValue.toFixed(3)}, umbral ${alpha}). `
        + 'Mantener la variante actual y seguir midiendo sale más barato que cambiar por ruido.',
    };
  }

  const winner = rateB > rateA ? nombreB : nombreA;
  return {
    ...base, conclusive: true, winner,
    pValue: Number(pValue.toFixed(4)), neededPerVariant: null,
    verdict: `Gana ${winner} con diferencia significativa (p = ${pValue.toFixed(3)}): `
      + `${(rateA * 100).toFixed(2)} % frente a ${(rateB * 100).toFixed(2)} %.`,
  };
}

/**
 * Resume varios canales sin compararlos entre sí con una prueba: canales
 * distintos tienen audiencias distintas y no son un experimento controlado.
 * Se ordenan y se marca cuáles tienen datos suficientes para opinar.
 */
function rankChannels(channels = [], { minSample = MIN_SAMPLE } = {}) {
  return channels
    .map((c) => {
      const n = Number(c.impressions) || 0;
      const conv = Number(c.conversions) || 0;
      return {
        name: c.name,
        impressions: n,
        conversions: conv,
        rate: n ? Number((conv / n).toFixed(4)) : 0,
        reliable: n >= minSample,
      };
    })
    .sort((x, y) => y.rate - x.rate);
}

module.exports = { compare, rankChannels, normalCdf, erf, MIN_SAMPLE, MIN_CONVERSIONS, ALPHA };
