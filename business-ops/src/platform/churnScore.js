'use strict';

/**
 * churnScore — riesgo de que un cliente se vaya, a partir de señales REALES.
 *
 * No hay modelo aquí, y es a propósito. Predecir abandono con un LLM da un
 * número que nadie puede discutir ni auditar; esto suma factores explícitos y
 * devuelve cuáles pesaron, para que quien lo lea pueda estar en desacuerdo con
 * motivo. Un comercial que no entiende por qué una cuenta está "en riesgo" no
 * la va a llamar.
 *
 * Las señales salen de lo que la plataforma ya observa de verdad:
 *   - `churn_intent` detectado por `SentimentAgent` (dijo que quiere irse).
 *   - Valoraciones CSAT bajas (`platform/csat.js`).
 *   - Tickets escalados: cada uno es un problema que el sistema no resolvió.
 *   - Silencio: días sin actividad frente a su ritmo habitual.
 *   - Facturas impagadas.
 *
 * Regla que evita el peor error: **sin señales suficientes se devuelve `null`,
 * no cero**. "No sabemos" y "está sano" son cosas distintas; confundirlas hace
 * que un cliente recién llegado, del que no hay datos, aparezca como seguro
 * justo antes de irse.
 */

const WEIGHTS = {
  churnIntent: 45,       // lo dijo con palabras: la señal más fuerte que hay
  detractorCsat: 25,     // puntuó 1-2
  escalations: 15,       // problemas que necesitaron a una persona
  inactivity: 10,        // dejó de usarlo
  unpaidInvoices: 20,    // deuda: a veces es el paso previo a irse
  supportVolume: 10,     // muchos tickets = fricción sostenida
};

/** Mínimo de señales observables para que el número signifique algo. */
const MIN_SIGNALS = 2;

const BANDS = [
  { from: 70, level: 'alto' },
  { from: 40, level: 'medio' },
  { from: 0, level: 'bajo' },
];

/**
 * @param {object} s
 * @param {boolean} s.churnIntent        - SentimentAgent detectó intención de baja
 * @param {number}  s.detractorResponses - respuestas CSAT de 1-2
 * @param {number}  s.csatResponses      - total de respuestas CSAT
 * @param {number}  s.escalations
 * @param {number}  s.ticketsTotal
 * @param {number}  s.daysSinceLastActivity
 * @param {number}  s.expectedActivityDays - cada cuántos días suele aparecer
 * @param {number}  s.unpaidInvoices
 * @returns {{score:number|null, level:string|null, factors:Array, observed:number, note:string}}
 */
function evaluate(s = {}) {
  const factors = [];
  let score = 0;
  let observed = 0;   // cuántas señales había datos para mirar

  // 1. Dijo que se quiere ir.
  if (s.churnIntent != null) {
    observed++;
    if (s.churnIntent) {
      score += WEIGHTS.churnIntent;
      factors.push({ id: 'churn_intent', points: WEIGHTS.churnIntent, detail: 'Expresó intención de darse de baja en un ticket.' });
    }
  }

  // 2. CSAT. Solo cuenta si contestó algo: sin respuestas no hay señal.
  if (s.csatResponses > 0) {
    observed++;
    const ratio = (s.detractorResponses || 0) / s.csatResponses;
    if (ratio > 0) {
      const pts = Math.round(WEIGHTS.detractorCsat * ratio);
      score += pts;
      factors.push({ id: 'csat_detractor', points: pts, detail: `${s.detractorResponses} de ${s.csatResponses} valoraciones fueron de 1-2.` });
    }
  }

  // 3. Escalados sobre el total de tickets.
  if (s.ticketsTotal > 0) {
    observed++;
    const ratio = (s.escalations || 0) / s.ticketsTotal;
    if (ratio > 0.3) {
      const pts = Math.round(WEIGHTS.escalations * Math.min(1, ratio));
      score += pts;
      factors.push({ id: 'escalations', points: pts, detail: `${s.escalations} de ${s.ticketsTotal} tickets necesitaron a una persona.` });
    }
    // Volumen alto de tickets: fricción aunque se resuelvan.
    if (s.ticketsTotal >= 10) {
      score += WEIGHTS.supportVolume;
      factors.push({ id: 'support_volume', points: WEIGHTS.supportVolume, detail: `${s.ticketsTotal} tickets abiertos: fricción sostenida.` });
    }
  }

  // 4. Silencio, medido contra SU ritmo, no contra uno absoluto: un cliente
  //    que escribe cada seis meses no está en riesgo por llevar dos sin hablar.
  if (s.daysSinceLastActivity != null && s.expectedActivityDays > 0) {
    observed++;
    const veces = s.daysSinceLastActivity / s.expectedActivityDays;
    if (veces >= 3) {
      const pts = Math.round(WEIGHTS.inactivity * Math.min(1, veces / 5));
      score += pts;
      factors.push({ id: 'inactivity', points: pts, detail: `${s.daysSinceLastActivity} días sin actividad (lo habitual son ${s.expectedActivityDays}).` });
    }
  }

  // 5. Impagos.
  if (s.unpaidInvoices != null) {
    observed++;
    if (s.unpaidInvoices > 0) {
      const pts = Math.min(WEIGHTS.unpaidInvoices, s.unpaidInvoices * 10);
      score += pts;
      factors.push({ id: 'unpaid_invoices', points: pts, detail: `${s.unpaidInvoices} factura(s) sin pagar.` });
    }
  }

  if (observed < MIN_SIGNALS) {
    return {
      score: null, level: null, factors, observed,
      note: `Datos insuficientes (${observed} señal(es) observable(s), hacen falta ${MIN_SIGNALS}). `
        + 'Un cliente del que no sabemos nada no es un cliente sano: es un desconocido.',
    };
  }

  score = Math.max(0, Math.min(100, score));
  const level = BANDS.find((b) => score >= b.from).level;
  factors.sort((a, b) => b.points - a.points);

  return {
    score, level, factors, observed,
    note: factors.length
      ? `Riesgo ${level} (${score}/100). Principal motivo: ${factors[0].detail}`
      : `Riesgo ${level} (${score}/100). Sin señales negativas.`,
  };
}

module.exports = { evaluate, WEIGHTS, BANDS, MIN_SIGNALS };
