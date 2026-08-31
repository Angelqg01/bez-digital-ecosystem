'use strict';

/**
 * Telemetry: observabilidad pasiva. Contadores por evento del bus, latencia de
 * tarea y de modelo, trazas por tenant, y export Prometheus.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Telemetry = require('../src/platform/Telemetry');
const EventBus = require('../src/core/EventBus');

test('cuenta tareas por estado/departamento desde el bus', () => {
  let now = 1000;
  const tel = new Telemetry({ clock: () => now });
  const bus = new EventBus('acme');
  tel.attach(bus, 'acme');

  bus.emit('task:queued', { id: 't1', department: 'sales' });
  now = 1250;
  bus.emit('task:completed', { id: 't1', department: 'sales', startedAt: 1000, ms: 250 });
  bus.emit('task:failed', { id: 't2', department: 'support', startedAt: 1000, ms: 40 });

  const snap = tel.snapshot();
  assert.equal(snap.counters['operant_tasks_total{tenant="acme",status="queued"}'], 1);
  assert.equal(snap.counters['operant_tasks_total{tenant="acme",status="completed",department="sales"}'], 1);
  assert.equal(snap.counters['operant_errors_total{tenant="acme",department="support"}'], 1);
  assert.equal(snap.histograms.operant_task_duration_ms.count, 2);
});

test('trazas: guarda por tenant, más reciente primero, con latencia', () => {
  const tel = new Telemetry({ clock: () => 5000 });
  const bus = new EventBus('acme');
  tel.attach(bus, 'acme');
  bus.emit('task:completed', { id: 'a', department: 'sales', type: 'sales:inbound', ms: 120 });
  bus.emit('task:completed', { id: 'b', department: 'support', type: 'support:ticket', ms: 300 });

  const traces = tel.traces('acme');
  assert.equal(traces.length, 2);
  assert.equal(traces[0].taskId, 'b', 'más reciente primero');
  assert.equal(traces[0].ms, 300);
  assert.equal(tel.traces('otro').length, 0, 'aísla por tenant');
});

test('métricas de modelo: llamadas, tokens, latencia y fallback', () => {
  const tel = new Telemetry();
  tel.recordModel({ tier: 'fast', usage: { inputTokens: 10, outputTokens: 5 }, meta: { tenantId: 'acme' }, latencyMs: 42, simulated: false });
  tel.recordModel({ tier: 'frontier', usage: {}, meta: { tenantId: 'acme' }, latencyMs: 999, fallback: true });

  const snap = tel.snapshot();
  assert.equal(snap.counters['operant_model_calls_total{tenant="acme",tier="fast",simulated="false"}'], 1);
  assert.equal(snap.counters['operant_model_input_tokens_total{tenant="acme",tier="fast"}'], 10);
  assert.equal(snap.counters['operant_model_fallback_total{tenant="acme",tier="frontier"}'], 1);
  assert.equal(snap.histograms.operant_model_latency_ms.count, 2);
});

test('HITL y tool-calls se cuentan', () => {
  const tel = new Telemetry();
  const bus = new EventBus('acme');
  tel.attach(bus, 'acme');
  bus.emit('hitl:pending', { approvalId: 'x' });
  bus.emit('hitl:resolved', { approvalId: 'x', approved: true });
  bus.emit('agent:tool-call', { tool: 'email', status: 'executed' });

  const snap = tel.snapshot();
  assert.equal(snap.counters['operant_hitl_total{tenant="acme",state="pending"}'], 1);
  assert.equal(snap.counters['operant_hitl_total{tenant="acme",state="approved"}'], 1);
  assert.equal(snap.counters['operant_tool_calls_total{tenant="acme",tool="email",status="executed"}'], 1);
});

test('export Prometheus: TYPE + series + buckets del histograma', () => {
  const tel = new Telemetry();
  tel.inc('operant_tasks_total', { status: 'completed' }, 3);
  tel.observe('operant_task_duration_ms', 120);
  const text = tel.prometheus();
  assert.match(text, /# TYPE operant_tasks_total counter/);
  assert.match(text, /operant_tasks_total\{status="completed"\} 3/);
  assert.match(text, /# TYPE operant_task_duration_ms histogram/);
  assert.match(text, /operant_task_duration_ms_bucket\{le="\+Inf"\} 1/);
  assert.match(text, /operant_task_duration_ms_count 1/);
});

test('mide el coste de la supervisión humana: espera HITL, reintentos y dead-letter', () => {
  let now = 1000;
  const tel = new Telemetry({ clock: () => now });
  const bus = new EventBus('acme');
  tel.attach(bus, 'acme');

  // Una tarea entra en la bandeja y espera 90 s a que alguien decida.
  bus.emit('task:awaiting_approval', { id: 't1', department: 'finance' });
  const snapPending = tel.snapshot();
  assert.equal(snapPending.gauges['operant_hitl_in_flight{tenant="acme"}'], 1,
    'mientras espera, debe constar como pendiente');

  bus.emit('task:resumed', { id: 't1', waitedMs: 90_000 });
  const snap = tel.snapshot();
  assert.equal(snap.gauges['operant_hitl_in_flight{tenant="acme"}'], 0,
    'al reanudarse deja de estar pendiente');
  assert.equal(snap.counters['operant_hitl_requests_total{tenant="acme"}'], 1);
  assert.equal(snap.histograms['operant_hitl_wait_ms'].count, 1);
  assert.equal(snap.histograms['operant_hitl_wait_ms'].max, 90_000);

  // Segunda aprobación de la MISMA tarea: waitedMs es acumulado, así que sólo
  // debe observarse el tramo nuevo (30 s), no los 120 s totales.
  bus.emit('task:awaiting_approval', { id: 't1', department: 'finance' });
  bus.emit('task:resumed', { id: 't1', waitedMs: 120_000 });
  assert.equal(tel.snapshot().histograms['operant_hitl_wait_ms'].max, 90_000,
    'el segundo tramo son 30 s, no 120 s: no puede contarse dos veces');

  // Reintentos y dead-letter.
  bus.emit('task:retrying', { id: 't2', department: 'sales' });
  bus.emit('task:retrying', { id: 't2', department: 'sales' });
  bus.emit('task:failed', { id: 't2', department: 'sales', deadLetter: true, startedAt: 1000 });
  bus.emit('task:failed', { id: 't3', department: 'sales', startedAt: 1000 });

  const s2 = tel.snapshot();
  assert.equal(s2.counters['operant_task_retries_total{tenant="acme",department="sales"}'], 2);
  assert.equal(s2.counters['operant_dead_letter_total{tenant="acme",department="sales"}'], 1,
    'sólo la tarea con deadLetter cuenta; un fallo normal no');

  // Las series nuevas salen en el export de Prometheus con su tipo.
  const prom = tel.prometheus();
  assert.match(prom, /# TYPE operant_hitl_in_flight gauge/);
  assert.match(prom, /# TYPE operant_hitl_wait_ms histogram/);
  assert.match(prom, /operant_dead_letter_total\{tenant="acme",department="sales"\} 1/);
});
