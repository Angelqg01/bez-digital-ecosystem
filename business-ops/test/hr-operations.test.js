'use strict';

/**
 * Tests de los escuadrones de RR.HH. y Operaciones: enrutado por tipo y líneas
 * rojas (decisión de empleo, pago a proveedor) → pendientes de aprobación.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const HRManager = require('../src/agents/hr/HRManager');
const OperationsManager = require('../src/agents/operations/OperationsManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const MemoryManager = require('../src/cognition/MemoryManager');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const EventBus = require('../src/core/EventBus');

function ctx() {
  const tenantId = 'acme';
  return {
    tenantId,
    model: new ModelGateway({ providers: {} }),
    memory: new MemoryManager({ tenantId }),
    guardrails: new PolicyEngine({ tenantId, plan: 'enterprise' }),
    bus: new EventBus(tenantId),
  };
}

// ── RR.HH. ──────────────────────────────────────────────────────

test('RR.HH.: enruta cada tipo a su especialista', async () => {
  const m = new HRManager(ctx());
  assert.equal((await m.run({ type: 'hr:request', payload: { text: '¿cuántos días de vacaciones tengo?' } })).results[0].step, 'hr.advisor');
  assert.equal((await m.run({ type: 'hr:screen', payload: { candidate: { nombre: 'Ana', años: 5 } } })).results[0].step, 'hr.cv-screener');
  assert.equal((await m.run({ type: 'hr:onboard', payload: { role: 'Backend dev' } })).results[0].step, 'hr.onboarding');
});

test('RR.HH.: una decisión de empleo es línea roja → pendiente de aprobación', async () => {
  const out = await new HRManager(ctx()).run({ type: 'hr:screen', payload: { candidate: { nombre: 'Ana' }, decision: 'hire' } });
  const r = out.results[0].out;
  assert.ok(r.assessment);
  assert.equal(r.decision.status, 'pending_approval', 'contratar NO se decide solo');
});

// ── Operaciones ─────────────────────────────────────────────────

test('Operaciones: enruta cada tipo a su especialista', async () => {
  const m = new OperationsManager(ctx());
  assert.equal((await m.run({ type: 'operations:request', payload: { text: 'reorganizar el almacén' } })).results[0].step, 'operations.coordinator');
  assert.equal((await m.run({ type: 'operations:inventory', payload: { stock: { sku1: 3 } } })).results[0].step, 'operations.inventory');
  assert.equal((await m.run({ type: 'operations:report', payload: { data: { pedidos: 120 } } })).results[0].step, 'operations.report');
});

test('Operaciones: pagar a un proveedor es línea roja → pendiente de aprobación', async () => {
  const out = await new OperationsManager(ctx()).run({
    type: 'operations:procure',
    payload: { item: 'portátiles', vendor: 'TechCo', amount: 4000, pay: true },
  });
  const r = out.results[0].out;
  assert.ok(r.order);
  assert.equal(r.payment.status, 'pending_approval', 'pagar NO se hace solo');
});
