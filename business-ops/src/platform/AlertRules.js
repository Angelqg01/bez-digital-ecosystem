'use strict';

/**
 * AlertRules — umbrales que convierten métricas en avisos accionables.
 *
 * Función PURA sobre un snapshot: no hace red, no lee reloj global, no guarda
 * estado. Así los umbrales se pueden probar exhaustivamente sin montar el
 * sistema, que es justo lo que hace falta en algo que despierta a una persona.
 *
 * Criterio de diseño: una alerta que salta cuando no debe se ignora a las dos
 * semanas, y entonces ya no sirve para nada. Por eso cada regla exige un
 * mínimo de muestras antes de opinar y los umbrales son deliberadamente
 * conservadores.
 */

const DEFAULTS = {
  // Tasa de error de tareas.
  errorRateWarn: 0.25,          // 25% de tareas fallidas
  errorRateMin: 8,              // …con al menos 8 tareas, si no es ruido estadístico

  // Tareas que agotaron sus reintentos y nadie ha tocado.
  deadLetterWarn: 3,

  // Cuota del plan: avisar ANTES de que corte, no cuando ya cortó.
  quotaWarnPct: 0.85,
  quotaCriticalPct: 0.95,

  // Latencia media del modelo.
  modelLatencyWarnMs: 20_000,
  modelLatencyMin: 5,           // …con al menos 5 llamadas

  // Degradación a simulado: el proveedor real falla y los agentes están
  // respondiendo con texto inventado mientras todo "parece" normal.
  fallbackWarn: 1,
};

/**
 * @param {object} snapshot
 * @param {number} snapshot.tasksCompleted
 * @param {number} snapshot.tasksFailed
 * @param {number} snapshot.deadLetter      - tareas en dead-letter sin resolver
 * @param {number} snapshot.quotaUsed
 * @param {number|null} snapshot.quotaLimit - null = plan sin límite
 * @param {number} snapshot.modelCalls
 * @param {number} snapshot.modelAvgMs
 * @param {number} snapshot.modelFallbacks  - respuestas degradadas a simulado
 * @param {object} [thresholds]
 * @returns {Array<{id, severity, title, detail}>}
 */
function evaluate(snapshot = {}, thresholds = {}) {
  const t = { ...DEFAULTS, ...thresholds };
  const alerts = [];

  const completed = snapshot.tasksCompleted || 0;
  const failed = snapshot.tasksFailed || 0;
  const total = completed + failed;

  // 1. Tasa de error.
  if (total >= t.errorRateMin) {
    const rate = failed / total;
    if (rate >= t.errorRateWarn) {
      alerts.push({
        id: 'error_rate',
        severity: 'warning',
        title: 'Tasa de fallo alta',
        detail: `${Math.round(rate * 100)}% de las tareas están fallando (${failed} de ${total}).`,
      });
    }
  }

  // 2. Dead-letter acumulándose: trabajo perdido que nadie ha mirado.
  const dead = snapshot.deadLetter || 0;
  if (dead >= t.deadLetterWarn) {
    alerts.push({
      id: 'dead_letter',
      severity: 'warning',
      title: 'Tareas en dead-letter sin revisar',
      detail: `${dead} tareas agotaron sus reintentos automáticos y esperan decisión humana.`,
    });
  }

  // 3. Cuota del plan. Crítico antes de cortar, no después.
  if (snapshot.quotaLimit) {
    const pct = (snapshot.quotaUsed || 0) / snapshot.quotaLimit;
    if (pct >= t.quotaCriticalPct) {
      alerts.push({
        id: 'quota',
        severity: 'critical',
        title: 'Cuota del plan casi agotada',
        detail: `Consumido el ${Math.round(pct * 100)}% (${snapshot.quotaUsed}/${snapshot.quotaLimit}). Al llegar al 100% se rechazan las solicitudes nuevas.`,
      });
    } else if (pct >= t.quotaWarnPct) {
      alerts.push({
        id: 'quota',
        severity: 'warning',
        title: 'Cuota del plan al límite',
        detail: `Consumido el ${Math.round(pct * 100)}% (${snapshot.quotaUsed}/${snapshot.quotaLimit}).`,
      });
    }
  }

  // 4. Latencia del modelo.
  if ((snapshot.modelCalls || 0) >= t.modelLatencyMin && (snapshot.modelAvgMs || 0) >= t.modelLatencyWarnMs) {
    alerts.push({
      id: 'model_latency',
      severity: 'warning',
      title: 'El motor IA va lento',
      detail: `Latencia media de ${Math.round(snapshot.modelAvgMs / 1000)}s por llamada (${snapshot.modelCalls} llamadas).`,
    });
  }

  // 5. Degradación a simulado — la más importante de todas: el sistema sigue
  // respondiendo, pero con texto inventado. Sin este aviso, un proveedor caído
  // pasa desapercibido porque nada "falla".
  const fallbacks = snapshot.modelFallbacks || 0;
  if (fallbacks >= t.fallbackWarn) {
    alerts.push({
      id: 'model_fallback',
      severity: 'critical',
      title: 'El motor IA está degradado a simulado',
      detail: `${fallbacks} respuestas se generaron en modo simulado porque el proveedor real falló. El contenido producido NO es fiable.`,
    });
  }

  return alerts;
}

/**
 * Extrae el snapshot que necesita evaluate() de las piezas vivas del sistema.
 * Separado a propósito: así `evaluate` sigue siendo pura y testeable, y aquí
 * vive el pegamento (que es lo que cambia cuando cambian las métricas).
 */
function snapshotFor({ telemetry, usageMeter, orchestrator, tenantId }) {
  const c = telemetry ? telemetry.snapshot().counters : {};
  const h = telemetry ? telemetry.snapshot().histograms : {};
  const sum = (prefix, extra = '') => Object.entries(c)
    .filter(([k]) => k.startsWith(prefix) && k.includes(`tenant="${tenantId}"`) && (!extra || k.includes(extra)))
    .reduce((acc, [, v]) => acc + v, 0);

  const quota = usageMeter?.check ? usageMeter.check(tenantId) : null;
  const tasks = orchestrator ? [...orchestrator._tasks.values()] : [];

  return {
    tasksCompleted: sum('operant_tasks_total', 'status="completed"'),
    tasksFailed: sum('operant_tasks_total', 'status="failed"'),
    deadLetter: tasks.filter((t) => t.deadLetter).length,
    quotaUsed: quota?.used ?? 0,
    quotaLimit: quota?.limit ?? null,
    modelCalls: sum('operant_model_calls_total'),
    modelAvgMs: h.operant_model_latency_ms?.avg || 0,
    modelFallbacks: sum('operant_model_fallback_total'),
  };
}

module.exports = { evaluate, snapshotFor, DEFAULTS };
