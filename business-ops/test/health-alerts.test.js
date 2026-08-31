'use strict';

/**
 * Umbrales de alerta y vigilante de salud.
 *
 * Dos propiedades importan más que la cobertura: (1) no gritar cuando no pasa
 * nada — una alerta con falsos positivos se silencia y deja de proteger; y
 * (2) no repetir el mismo aviso cada ciclo, por lo mismo.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { evaluate, DEFAULTS } = require('../src/platform/AlertRules');
const HealthWatchdog = require('../src/platform/HealthWatchdog');

const sano = {
  tasksCompleted: 50, tasksFailed: 1, deadLetter: 0,
  quotaUsed: 100, quotaLimit: 50_000,
  modelCalls: 40, modelAvgMs: 3_000, modelFallbacks: 0,
};
const ids = (alerts) => alerts.map((a) => a.id).sort();

// ── Reglas (función pura) ───────────────────────────────────────────────────

test('un sistema sano no genera ninguna alerta', () => {
  assert.deepEqual(evaluate(sano), []);
});

test('no opina sobre la tasa de error sin muestras suficientes', () => {
  // 2 de 3 fallando es 66%, pero con 3 tareas no significa nada todavía.
  const pocas = { ...sano, tasksCompleted: 1, tasksFailed: 2 };
  assert.ok(!ids(evaluate(pocas)).includes('error_rate'), 'no debe alarmar con 3 muestras');

  const suficientes = { ...sano, tasksCompleted: 4, tasksFailed: 6 };
  assert.ok(ids(evaluate(suficientes)).includes('error_rate'), 'con 10 muestras y 60% sí');
});

test('dead-letter acumulándose se avisa (es trabajo perdido que nadie mira)', () => {
  assert.ok(!ids(evaluate({ ...sano, deadLetter: 2 })).includes('dead_letter'));
  const a = evaluate({ ...sano, deadLetter: 3 }).find((x) => x.id === 'dead_letter');
  assert.ok(a);
  assert.match(a.detail, /3 tareas/);
});

test('la cuota avisa ANTES de cortar, y escala a crítico', () => {
  assert.deepEqual(evaluate({ ...sano, quotaUsed: 40_000, quotaLimit: 50_000 }), [], '80% aún no');

  const warn = evaluate({ ...sano, quotaUsed: 43_000, quotaLimit: 50_000 }).find((a) => a.id === 'quota');
  assert.equal(warn.severity, 'warning');

  const crit = evaluate({ ...sano, quotaUsed: 48_000, quotaLimit: 50_000 }).find((a) => a.id === 'quota');
  assert.equal(crit.severity, 'critical');
  assert.match(crit.detail, /se rechazan las solicitudes nuevas/);
});

test('un plan sin límite nunca dispara alerta de cuota', () => {
  const r = evaluate({ ...sano, quotaUsed: 999_999, quotaLimit: null });
  assert.ok(!ids(r).includes('quota'));
});

test('la degradación a simulado es crítica: el contenido deja de ser fiable', () => {
  const a = evaluate({ ...sano, modelFallbacks: 1 }).find((x) => x.id === 'model_fallback');
  assert.equal(a.severity, 'critical');
  assert.match(a.detail, /NO es fiable/);
});

test('la latencia del modelo no alarma con pocas llamadas', () => {
  const pocas = { ...sano, modelCalls: 2, modelAvgMs: 60_000 };
  assert.ok(!ids(evaluate(pocas)).includes('model_latency'));

  const muchas = { ...sano, modelCalls: 30, modelAvgMs: 60_000 };
  assert.ok(ids(evaluate(muchas)).includes('model_latency'));
});

test('los umbrales se pueden ajustar por despliegue', () => {
  const s = { ...sano, deadLetter: 1 };
  assert.ok(!ids(evaluate(s)).includes('dead_letter'), 'con el umbral por defecto, no');
  assert.ok(ids(evaluate(s, { deadLetterWarn: 1 })).includes('dead_letter'), 'con umbral 1, sí');
});

test('varias condiciones a la vez producen varias alertas', () => {
  const mal = {
    tasksCompleted: 2, tasksFailed: 10, deadLetter: 5,
    quotaUsed: 49_000, quotaLimit: 50_000,
    modelCalls: 20, modelAvgMs: 45_000, modelFallbacks: 7,
  };
  assert.deepEqual(ids(evaluate(mal)), ['dead_letter', 'error_rate', 'model_fallback', 'model_latency', 'quota']);
});

test('DEFAULTS expone los umbrales para poder documentarlos', () => {
  assert.ok(DEFAULTS.quotaCriticalPct > DEFAULTS.quotaWarnPct, 'crítico debe ir después del aviso');
  assert.ok(DEFAULTS.errorRateMin >= 5, 'hace falta un mínimo de muestras');
});

// ── Vigilante (deduplicación y resolución) ──────────────────────────────────

/**
 * Vigilante con un tenant falso cuyo snapshot controlamos desde el test.
 * `snapshotFn` se inyecta (como clock/fetch en el resto del código): aquí se
 * prueba la lógica de avisar y deduplicar, no el pegamento con Telemetry.
 */
function makeWatchdog(snapshotInicial) {
  const avisos = [];
  let snap = snapshotInicial;

  const wd = new HealthWatchdog({
    tenants: {
      list: () => ['acme'],
      get: () => ({ orchestrator: { _tasks: new Map() } }),
    },
    notifier: { alert: async (a) => { avisos.push(a); return { sent: true }; } },
    clock: () => 1_000,
    snapshotFn: () => snap,
  });

  return { wd, avisos, setSnap: (s) => { snap = s; } };
}

test('el vigilante avisa una sola vez por alerta, no en cada ciclo', async () => {
  const malo = { ...sano, deadLetter: 5 };
  const { wd, avisos } = makeWatchdog(malo);

  const r1 = await wd.check();
  assert.equal(r1.fired.length, 1, 'primera vez: avisa');
  assert.equal(avisos.length, 1);

  const r2 = await wd.check();
  assert.equal(r2.fired.length, 0, 'sigue igual: NO repite el aviso');
  assert.equal(avisos.length, 1, 'repetirlo cada ciclo lo convertiría en ruido');

  await wd.check();
  assert.equal(avisos.length, 1);
});

test('el vigilante avisa cuando la condición se resuelve', async () => {
  const { wd, avisos, setSnap } = makeWatchdog({ ...sano, deadLetter: 5 });

  await wd.check();
  assert.equal(wd.active('acme').length, 1);

  setSnap(sano);                       // se arregló
  const r = await wd.check();

  assert.equal(r.cleared.length, 1);
  assert.equal(wd.active('acme').length, 0, 'deja de estar activa');
  assert.match(avisos.at(-1).title, /Resuelto/);
});

test('si una alerta empeora de aviso a crítica, se vuelve a avisar', async () => {
  const { wd, avisos, setSnap } = makeWatchdog({ ...sano, quotaUsed: 43_000, quotaLimit: 50_000 });

  await wd.check();
  assert.equal(avisos.length, 1);
  assert.match(avisos[0].title, /🟠/, 'aviso naranja');

  setSnap({ ...sano, quotaUsed: 49_000, quotaLimit: 50_000 });   // ahora crítica
  await wd.check();

  assert.equal(avisos.length, 2, 'empeorar merece un aviso nuevo');
  assert.match(avisos[1].title, /🔴/);
  assert.match(avisos[1].title, /empeorando/);
});

test('las alertas de salud van al bot de operaciones', async () => {
  const { wd, avisos } = makeWatchdog({ ...sano, modelFallbacks: 3 });
  await wd.check();
  assert.equal(avisos[0].department, 'operations');
  assert.equal(avisos[0].tenantId, 'acme');
});

test('un notificador que falla no rompe el ciclo de vigilancia', async () => {
  const wd = new HealthWatchdog({
    tenants: { list: () => ['acme'], get: () => ({ orchestrator: { _tasks: new Map() } }) },
    notifier: { alert: async () => { throw new Error('Telegram caído'); } },
    snapshotFn: () => ({ ...sano, deadLetter: 9 }),
  });

  await assert.doesNotReject(() => wd.check());
  assert.equal(wd.active('acme').length, 1, 'la alerta se registra aunque el aviso no salga');
});

test('sin tenants, el ciclo no hace nada', async () => {
  const wd = new HealthWatchdog({ tenants: { list: () => [], get: () => null }, notifier: { alert: async () => {} } });
  const r = await wd.check();
  assert.deepEqual(r, { fired: [], cleared: [] });
});

// ── El pegamento real con Telemetry ─────────────────────────────────────────
// Los tests del vigilante inyectan `snapshotFn` para aislar la lógica de aviso.
// Eso deja sin cubrir la extracción real de cifras, que es justo donde un
// cambio de nombre de métrica rompería las alertas en silencio.

test('snapshotFor extrae las cifras reales de Telemetry y del UsageMeter', () => {
  const Telemetry = require('../src/platform/Telemetry');
  const { snapshotFor } = require('../src/platform/AlertRules');

  const t = new Telemetry();
  t.inc('operant_tasks_total', { tenant: 'acme', status: 'completed', department: 'sales' }, 7);
  t.inc('operant_tasks_total', { tenant: 'acme', status: 'failed', department: 'sales' }, 2);
  t.inc('operant_tasks_total', { tenant: 'otro', status: 'failed', department: 'sales' }, 99);
  t.inc('operant_model_calls_total', { tenant: 'acme', tier: 'fast', simulated: 'false' }, 5);
  t.inc('operant_model_fallback_total', { tenant: 'acme', tier: 'fast' }, 2);
  t.observe('operant_model_latency_ms', 4000);
  t.observe('operant_model_latency_ms', 6000);

  const snap = snapshotFor({
    telemetry: t,
    usageMeter: { check: () => ({ used: 120, limit: 500 }) },
    orchestrator: { _tasks: new Map([['a', { deadLetter: true }], ['b', {}], ['c', { deadLetter: true }]]) },
    tenantId: 'acme',
  });

  assert.equal(snap.tasksCompleted, 7);
  assert.equal(snap.tasksFailed, 2, 'no debe contar los fallos de otro tenant');
  assert.equal(snap.deadLetter, 2);
  assert.equal(snap.quotaUsed, 120);
  assert.equal(snap.quotaLimit, 500);
  assert.equal(snap.modelCalls, 5);
  assert.equal(snap.modelFallbacks, 2);
  assert.equal(snap.modelAvgMs, 5000);
});

test('snapshotFor no rompe si aún no hay métricas ni cuota', () => {
  const Telemetry = require('../src/platform/Telemetry');
  const { snapshotFor, evaluate } = require('../src/platform/AlertRules');

  const snap = snapshotFor({
    telemetry: new Telemetry(), usageMeter: null,
    orchestrator: { _tasks: new Map() }, tenantId: 'nuevo',
  });

  assert.equal(snap.tasksCompleted, 0);
  assert.equal(snap.quotaLimit, null);
  assert.deepEqual(evaluate(snap), [], 'un tenant recién creado no debe disparar alertas');
});
