'use strict';

/**
 * Tests del CostTracker: cálculo de coste por tarifa, acumulación e
 * aislamiento entre tenants.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const CostTracker = require('../src/platform/CostTracker');

const M = 1_000_000; // 1M tokens

test('calcula el coste según la tarifa del modelo', () => {
  const ct = new CostTracker();
  // Opus: $5 input + $25 output por 1M → 1M+1M = $30.
  ct.record({ model: 'claude-opus-4-8', usage: { inputTokens: M, outputTokens: M }, meta: { tenantId: 'acme' } });

  const u = ct.usageFor('acme');
  assert.equal(u.calls, 1);
  assert.equal(u.costUsd, 30);
  assert.equal(u.inputTokens, M);
});

test('acumula varias llamadas del mismo tenant', () => {
  const ct = new CostTracker();
  ct.record({ model: 'claude-opus-4-8', usage: { inputTokens: M, outputTokens: M }, meta: { tenantId: 'acme' } }); // $30
  ct.record({ model: 'claude-haiku-4-5', usage: { inputTokens: M, outputTokens: M }, meta: { tenantId: 'acme' } }); // $1 + $5 = $6

  const u = ct.usageFor('acme');
  assert.equal(u.calls, 2);
  assert.equal(u.costUsd, 36);
  assert.equal(u.inputTokens, 2 * M);
  assert.equal(u.outputTokens, 2 * M);
});

test('aísla el consumo entre tenants', () => {
  const ct = new CostTracker();
  ct.record({ model: 'claude-sonnet-4-6', usage: { inputTokens: M, outputTokens: 0 }, meta: { tenantId: 'acme' } });   // $3
  ct.record({ model: 'claude-sonnet-4-6', usage: { inputTokens: 0, outputTokens: M }, meta: { tenantId: 'globex' } }); // $15

  assert.equal(ct.usageFor('acme').costUsd, 3);
  assert.equal(ct.usageFor('globex').costUsd, 15);
  assert.equal(ct.usageFor('desconocido').calls, 0, 'tenant sin registros → ceros');
});

test('modelo desconocido: cuenta la llamada pero coste 0', () => {
  const ct = new CostTracker();
  ct.record({ model: 'modelo-inexistente', usage: { inputTokens: 1000, outputTokens: 1000 }, meta: { tenantId: 'x' } });
  const u = ct.usageFor('x');
  assert.equal(u.calls, 1);
  assert.equal(u.costUsd, 0);
});

test('total() agrega el consumo de toda la plataforma', () => {
  const ct = new CostTracker();
  ct.record({ model: 'claude-haiku-4-5', usage: { inputTokens: M, outputTokens: M }, meta: { tenantId: 'a' } }); // $6
  ct.record({ model: 'claude-haiku-4-5', usage: { inputTokens: M, outputTokens: M }, meta: { tenantId: 'b' } }); // $6

  const t = ct.total();
  assert.equal(t.calls, 2);
  assert.equal(t.costUsd, 12);
});

test('reset borra el consumo de un tenant', () => {
  const ct = new CostTracker();
  ct.record({ model: 'claude-haiku-4-5', usage: { inputTokens: M, outputTokens: 0 }, meta: { tenantId: 'a' } });
  ct.reset('a');
  assert.equal(ct.usageFor('a').calls, 0);
});
