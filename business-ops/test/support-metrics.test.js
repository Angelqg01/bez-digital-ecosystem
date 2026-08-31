'use strict';

/**
 * Tests de SupportMetrics: agregación de KPIs desde el bus y end-to-end vía
 * TenantManager (un ticket real incrementa el informe).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const SupportMetrics = require('../src/platform/SupportMetrics');
const EventBus = require('../src/core/EventBus');
const TenantManager = require('../src/core/TenantManager');
const ModelGateway = require('../src/cognition/ModelGateway');

const completed = (overrides = {}) => ({
  id: 't', department: 'support', createdAt: new Date(0).toISOString(),
  result: { outcome: 'ok', triage: { category: 'howto' } }, ...overrides,
});

test('agrega resueltos, escalados y categorías desde el bus', () => {
  const bus = new EventBus('acme');
  const m = new SupportMetrics({ clock: () => 1500 }); // latencia determinista: 1500ms desde epoch
  m.attach(bus, 'acme');

  bus.emit('task:completed', completed({ result: { outcome: 'ok', triage: { category: 'howto' } } }));
  bus.emit('task:completed', completed({ result: { outcome: 'ok', triage: { category: 'technical' } } }));
  bus.emit('task:completed', completed({ result: { outcome: 'escalated', triage: { category: 'technical' } } }));
  bus.emit('task:failed', completed({ result: {} }));

  const r = m.report('acme');
  assert.equal(r.handled, 3);
  assert.equal(r.resolved, 2);
  assert.equal(r.escalated, 1);
  assert.equal(r.failed, 1);
  assert.equal(r.resolutionRate, 2 / 3);
  assert.equal(r.escalationRate, 1 / 3);
  assert.deepEqual(r.byCategory, { howto: 1, technical: 2 });
  assert.equal(r.avgLatencyMs, 1500);
});

test('ignora tareas de otros departamentos y aísla por tenant', () => {
  const bus = new EventBus('acme');
  const m = new SupportMetrics();
  m.attach(bus, 'acme');

  bus.emit('task:completed', completed({ department: 'sales' }));
  assert.equal(m.report('acme').handled, 0, 'solo cuenta support');
  assert.equal(m.report('globex').handled, 0, 'tenant sin datos → ceros');
});

test('end-to-end: un ticket real aparece en el informe del tenant', async () => {
  const metrics = new SupportMetrics();
  const tenants = new TenantManager({ modelGateway: new ModelGateway({ providers: {} }), metrics });
  await tenants.provision({ tenantId: 'acme', plan: 'pro', departments: ['support'], tools: {} });

  await tenants.handleAndWait('acme', { text: 'la app no funciona y es urgente', channel: 'web', customerId: 'c1' }, { timeoutMs: 5000 });

  const r = metrics.report('acme');
  assert.equal(r.handled, 1);
  assert.equal(r.resolved + r.escalated, 1);
  assert.equal(r.escalated, 1, 'incidencia urgente → escalada');
});
