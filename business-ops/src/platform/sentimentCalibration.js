'use strict';

const { SEVERITY_ORDER } = require('./sentimentLexicon');

/**
 * sentimentCalibration — comprueba si el `SentimentAgent` acierta.
 *
 * Un detector de enfado sin verificar es una opinión con formato de métrica.
 * Aquí hay una oportunidad poco común: el CSAT (`platform/csat.js`) da la
 * VERDAD del mismo ticket unos días después. Cruzando lo que el agente predijo
 * con lo que el cliente acabó puntuando, se puede medir si la señal sirve.
 *
 * Se mide contra la decisión real que toma el sistema — "¿había que meter a una
 * persona?" — y no contra un parecido difuso de tonos:
 *   - Predicción positiva = gravedad >= `high` (lo que dispara escalado y aviso).
 *   - Verdad positiva     = el cliente puntuó <= 2 (detractor).
 *
 * De ahí salen las dos cifras que importan, que se compensan entre sí:
 *   - **Precisión**: de los que marcamos como riesgo, cuántos lo eran. Baja =
 *     alertas de más → la gente deja de mirarlas.
 *   - **Exhaustividad** (recall): de los clientes que acabaron enfadados,
 *     cuántos vimos venir. Baja = se nos escapan, que es el fallo caro.
 *
 * La exactitud a secas se omite a propósito: con pocos detractores, un detector
 * que no marque NADA saca un 95 % de acierto y es inútil.
 */

/** Umbral de predicción: a partir de aquí el sistema escala y avisa. */
const PREDICTED_FROM = 'high';
/** Verdad de campo: 1 y 2 son detractores (mismo criterio que csat.js). */
const DETRACTOR_MAX = 2;

/** ¿Esta gravedad cuenta como "predijimos riesgo"? */
function isPredictedRisk(severity, from = PREDICTED_FROM) {
  const i = SEVERITY_ORDER.indexOf(severity);
  const j = SEVERITY_ORDER.indexOf(from);
  return i >= 0 && j >= 0 && i >= j;
}

/**
 * Cruza predicciones con respuestas de CSAT por `taskId`.
 *
 * @param {Array<{taskId, severity, signals?}>} predictions
 * @param {Array<{taskId, rating}>} csatResponses
 * @returns informe de calibración
 */
function calibrate(predictions = [], csatResponses = [], { predictedFrom = PREDICTED_FROM } = {}) {
  const truth = new Map(csatResponses.map((r) => [r.taskId, r.rating]));

  let tp = 0, fp = 0, fn = 0, tn = 0;
  const misses = [];        // detractores que NO vimos venir (el fallo caro)
  const falseAlarms = [];   // avisos que no eran (el fallo que quema la alerta)

  for (const p of predictions) {
    const rating = truth.get(p.taskId);
    if (rating == null) continue;              // sin CSAT no hay verdad que comparar

    const predicted = isPredictedRisk(p.severity, predictedFrom);
    const actual = rating <= DETRACTOR_MAX;

    if (predicted && actual) tp++;
    else if (predicted && !actual) { fp++; falseAlarms.push({ taskId: p.taskId, severity: p.severity, rating }); }
    else if (!predicted && actual) { fn++; misses.push({ taskId: p.taskId, severity: p.severity, rating, signals: p.signals || [] }); }
    else tn++;
  }

  const matched = tp + fp + fn + tn;
  // Sin muestras devolvemos null, no 0: "aún no lo sabemos" y "lo hace fatal"
  // son cosas distintas y confundirlas lleva a desactivar algo que funciona.
  const precision = (tp + fp) ? tp / (tp + fp) : null;
  const recall = (tp + fn) ? tp / (tp + fn) : null;
  const f1 = (precision != null && recall != null && precision + recall > 0)
    ? (2 * precision * recall) / (precision + recall)
    : null;

  return {
    matched,
    truePositives: tp, falsePositives: fp, falseNegatives: fn, trueNegatives: tn,
    precision: precision == null ? null : Number(precision.toFixed(3)),
    recall: recall == null ? null : Number(recall.toFixed(3)),
    f1: f1 == null ? null : Number(f1.toFixed(3)),
    misses: misses.slice(-10),
    falseAlarms: falseAlarms.slice(-10),
    verdict: verdictOf({ matched, precision, recall }),
  };
}

/**
 * Traduce las cifras a una recomendación accionable. Sin esto, el informe es
 * un montón de números que nadie sabe qué hacer con ellos.
 */
function verdictOf({ matched, precision, recall }) {
  if (matched < 20) return 'muestras insuficientes para juzgar (hacen falta al menos 20 tickets con CSAT)';
  if (recall != null && recall < 0.5) return 'se escapan más de la mitad de los clientes enfadados: ampliar el léxico o bajar el umbral';
  if (precision != null && precision < 0.4) return 'demasiadas falsas alarmas: subir el umbral o afinar las señales antes de que se ignoren los avisos';
  if (precision != null && recall != null && precision >= 0.6 && recall >= 0.6) return 'calibración razonable';
  return 'aceptable, con margen de mejora';
}

/**
 * Guarda una predicción para poder contrastarla cuando llegue el CSAT.
 * Acotado: esto es una muestra para calibrar, no un histórico completo.
 */
async function recordPrediction({ store, tenantId, taskId, severity, signals = [], max = 1000 }) {
  if (!store?.getFact || !store?.setFact || !taskId) return { recorded: false };
  const key = 'support:sentiment_predictions';
  const list = (await store.getFact({ tenantId, key })) || [];
  if (list.some((p) => p.taskId === taskId)) return { recorded: false, duplicate: true };

  list.push({ taskId, severity, signals });
  if (list.length > max) list.splice(0, list.length - max);
  await store.setFact({ tenantId, key, value: list });
  return { recorded: true, total: list.length };
}

/** Informe de calibración de un tenant, cruzando predicciones y CSAT. */
async function report({ store, tenantId }) {
  if (!store?.getFact) return calibrate([], []);
  const predictions = (await store.getFact({ tenantId, key: 'support:sentiment_predictions' })) || [];
  const csatData = (await store.getFact({ tenantId, key: 'support:csat' })) || { responses: [] };
  return calibrate(predictions, csatData.responses || []);
}

module.exports = {
  calibrate, report, recordPrediction, isPredictedRisk, verdictOf,
  PREDICTED_FROM, DETRACTOR_MAX,
};
