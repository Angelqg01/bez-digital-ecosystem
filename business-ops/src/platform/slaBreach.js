'use strict';

/**
 * slaBreach — determina si un caso cumple el SLA prometido, con fecha y
 * fórmula, no con la impresión general del modelo al leer una lista de casos.
 *
 * Dos tipos de SLA se miden distinto y no deben confundirse:
 *   - `response`  — tiempo hasta la primera respuesta
 *   - `resolution` — tiempo hasta cerrar el caso
 *
 * Un caso todavía abierto no es "cumplido" ni "incumplido" sin más: puede
 * estar `on_track`, `at_risk` (cerca del límite) o `breached` (ya lo pasó).
 * Tratar "abierto y dentro de plazo todavía" como si ya hubiera cumplido
 * infla la tasa de cumplimiento con casos que ni siquiera han tenido ocasión
 * de incumplir.
 *
 * La tasa de cumplimiento se calcula SOLO sobre casos ya completados — sin
 * completados, se devuelve `null`, no 0% ni 100%: no hay dato, no una cifra.
 */

/** Al entrar en esta fracción del plazo restante, pasa de on_track a at_risk. */
const AT_RISK_THRESHOLD = 0.15;   // último 15% del plazo

function deadlineOf(openedAt, slaMinutes) {
  return new Date(openedAt).getTime() + slaMinutes * 60_000;
}

/**
 * @param {object} c
 * @param {string} c.id
 * @param {string} c.type          - 'response' | 'resolution'
 * @param {string|number} c.openedAt
 * @param {number} c.slaMinutes
 * @param {string|number} [c.completedAt] - respondedAt o resolvedAt, según el tipo
 * @param {number} [now]
 * @returns {{id, status: 'compliant'|'breached'|'at_risk'|'on_track', deadline, minutesLate: number|null}}
 */
function evaluateCase(c = {}, now = Date.now()) {
  const deadline = deadlineOf(c.openedAt, c.slaMinutes);
  const totalMs = c.slaMinutes * 60_000;

  if (c.completedAt != null) {
    const completedAt = new Date(c.completedAt).getTime();
    const compliant = completedAt <= deadline;
    return {
      id: c.id, type: c.type, status: compliant ? 'compliant' : 'breached',
      deadline, completedAt,
      minutesLate: compliant ? 0 : Math.round((completedAt - deadline) / 60_000),
    };
  }

  // Todavía abierto: se compara contra AHORA, no contra un cierre que no existe.
  if (now > deadline) {
    return { id: c.id, type: c.type, status: 'breached', deadline, completedAt: null, minutesLate: Math.round((now - deadline) / 60_000) };
  }
  const restante = deadline - now;
  const status = restante <= totalMs * AT_RISK_THRESHOLD ? 'at_risk' : 'on_track';
  return { id: c.id, type: c.type, status, deadline, completedAt: null, minutesLate: null, minutesRemaining: Math.round(restante / 60_000) };
}

/**
 * @param {Array} cases
 * @returns {{
 *   results: Array, compliant: Array, breached: Array, atRisk: Array, onTrack: Array,
 *   complianceRate: number|null
 * }}
 */
function evaluateAll(cases = [], { now = Date.now() } = {}) {
  const results = cases.map((c) => evaluateCase(c, now));
  const compliant = results.filter((r) => r.status === 'compliant');
  const breachedCompleted = results.filter((r) => r.status === 'breached' && r.completedAt != null);
  const breachedOpen = results.filter((r) => r.status === 'breached' && r.completedAt == null);
  const atRisk = results.filter((r) => r.status === 'at_risk');
  const onTrack = results.filter((r) => r.status === 'on_track');

  // Solo cuentan los casos que YA tuvieron ocasión de cumplir o incumplir
  // (completados, o abiertos que ya pasaron su plazo). Uno "on_track" o
  // "at_risk" todavía puede acabar bien; contarlo ahora sesgaría la tasa.
  const decididos = compliant.length + breachedCompleted.length + breachedOpen.length;
  const complianceRate = decididos ? Number((compliant.length / decididos).toFixed(3)) : null;

  return {
    results,
    compliant,
    breached: [...breachedCompleted, ...breachedOpen],
    atRisk,
    onTrack,
    complianceRate,
  };
}

module.exports = { evaluateCase, evaluateAll, deadlineOf, AT_RISK_THRESHOLD };
