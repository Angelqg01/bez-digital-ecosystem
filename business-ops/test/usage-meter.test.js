'use strict';

/**
 * Tests del UsageMeter (cuotas por plan) y de su integración con el Orchestrator:
 * una solicitud por encima de la cuota se rechaza ANTES de hacer trabajo.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const UsageMeter = require('../src/platform/UsageMeter');
const Orchestrator = require('../src/core/Orchestrator');
const EventBus = require('../src/core/EventBus');

test('cuenta llamadas y bloquea al alcanzar el límite', () => {
  const meter = new UsageMeter();
  meter.setLimit('acme', 2);

  assert.deepEqual(meter.check('acme'), { allowed: true, used: 0, limit: 2, remaining: 2 });
  meter.record('acme');
  meter.record('acme');
  const q = meter.check('acme');
  assert.equal(q.allowed, false, 'agotada tras 2 llamadas');
  assert.equal(q.remaining, 0);
});

test('límite null = ilimitado', () => {
  const meter = new UsageMeter();
  meter.setLimit('acme', undefined); // sin maxAgentCallsMonth en el plan
  for (let i = 0; i < 100; i++) meter.record('acme');
  assert.equal(meter.check('acme').allowed, true);
  assert.equal(meter.check('acme').limit, null);
});

test('aísla el conteo por tenant y por mes', () => {
  let now = new Date('2026-06-08T00:00:00Z');
  const meter = new UsageMeter({ clock: () => now });
  meter.setLimit('acme', 1);

  meter.record('acme');
  assert.equal(meter.check('acme').allowed, false, 'junio agotado');

  now = new Date('2026-07-01T00:00:00Z'); // cambia de mes
  assert.equal(meter.check('acme').allowed, true, 'julio empieza a cero');
  assert.equal(meter.used('globex'), 0, 'otro tenant no se ve afectado');
});

test('Orchestrator.handle rechaza la solicitud si la cuota está agotada', async () => {
  const meter = new UsageMeter();
  meter.setLimit('acme', 0); // sin cupo

  const audited = [];
  const orch = new Orchestrator({
    tenantId: 'acme',
    usageMeter: meter,
    bus: new EventBus('acme'),
    audit: { log: (e) => audited.push(e) },
  });

  await assert.rejects(
    () => orch.handle({ text: 'quiero una demo', channel: 'web', customerId: 'c1' }),
    (err) => err.code === 'quota_exceeded',
  );
  assert.ok(audited.some((e) => e.event === 'quota:exceeded'), 'queda en auditoría');
});

test('Orchestrator.handle acepta la solicitud si hay cupo', async () => {
  const meter = new UsageMeter();
  meter.setLimit('acme', 5);

  const orch = new Orchestrator({
    tenantId: 'acme',
    usageMeter: meter,
    bus: new EventBus('acme'),
    audit: { log: () => {} },
  });
  orch.start(); // arranca la cola para que la tarea no quede atascada

  const taskId = await orch.handle({ text: 'quiero una demo', channel: 'web', customerId: 'c1' });
  assert.match(taskId, /^t_/);
});
