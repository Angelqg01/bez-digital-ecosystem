'use strict';

/**
 * Tests de la capa de persistencia (ruta InMemoryStore, sin infraestructura).
 *
 * Verifican el contrato del Store y que Memory/Audit lo usan bien:
 *   - aislamiento entre tenants,
 *   - filtrado por agente y orden (más reciente primero),
 *   - que la memoria es COMPARTIDA entre instancias del mismo tenant
 *     (lo que en producción se traduce en "sobrevive a reinicios" con Postgres).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const InMemoryStore = require('../src/platform/InMemoryStore');
const createStore = require('../src/platform/createStore');
const MemoryManager = require('../src/cognition/MemoryManager');
const AuditLog = require('../src/guardrails/AuditLog');

test('createStore: sin DATABASE_URL devuelve InMemoryStore', () => {
  const store = createStore({});
  assert.ok(store instanceof InMemoryStore);
});

test('Store: interacciones aisladas por tenant y filtradas por agente', async () => {
  const store = new InMemoryStore();
  await store.saveInteraction({ tenantId: 'acme', agentId: 'sales.negotiator', summary: 'cerró deal A', outcome: 'won' });
  await store.saveInteraction({ tenantId: 'acme', agentId: 'sales.outreach', summary: 'envió email', outcome: 'ok' });
  await store.saveInteraction({ tenantId: 'globex', agentId: 'sales.negotiator', summary: 'otro tenant', outcome: 'won' });

  const acme = await store.recallInteractions({ tenantId: 'acme', k: 10 });
  assert.equal(acme.length, 2, 'acme solo ve lo suyo');
  assert.equal(acme.every(i => i.tenantId === 'acme'), true);

  const negotiator = await store.recallInteractions({ tenantId: 'acme', agentId: 'sales.negotiator', k: 10 });
  assert.equal(negotiator.length, 1);
  assert.equal(negotiator[0].summary, 'cerró deal A');
});

test('Store: recall devuelve los más recientes primero y respeta k', async () => {
  const store = new InMemoryStore();
  for (let n = 1; n <= 5; n++) {
    await store.saveInteraction({ tenantId: 'acme', agentId: 'a', summary: `caso ${n}`, outcome: 'ok' });
  }
  const recent = await store.recallInteractions({ tenantId: 'acme', agentId: 'a', k: 2 });
  assert.equal(recent.length, 2);
  assert.equal(recent[0].summary, 'caso 5');
  assert.equal(recent[1].summary, 'caso 4');
});

test('Store: hechos (setFact/getFact) aislados por tenant', async () => {
  const store = new InMemoryStore();
  await store.setFact({ tenantId: 'acme', key: 'tono', value: { estilo: 'cercano' } });

  assert.deepEqual(await store.getFact({ tenantId: 'acme', key: 'tono' }), { estilo: 'cercano' });
  assert.equal(await store.getFact({ tenantId: 'globex', key: 'tono' }), null, 'otro tenant no lo ve');
  assert.equal(await store.getFact({ tenantId: 'acme', key: 'inexistente' }), null);
});

test('MemoryManager sobre store compartido: memoria persiste entre instancias del mismo tenant', async () => {
  const store = new InMemoryStore();

  // "Sesión 1": un agente recuerda algo.
  const mem1 = new MemoryManager({ tenantId: 'acme', store });
  await mem1.store({ agentId: 'sales.negotiator', summary: 'rebatió objeción de precio', outcome: 'won' });
  await mem1.setFact('icp', { sector: 'retail' });

  // "Sesión 2" (simula un reinicio: nueva instancia, mismo store durable).
  const mem2 = new MemoryManager({ tenantId: 'acme', store });
  const recalled = await mem2.recall('', { agentId: 'sales.negotiator', k: 5 });
  assert.equal(recalled.length, 1);
  assert.equal(recalled[0].summary, 'rebatió objeción de precio');
  assert.deepEqual(await mem2.getFact('icp'), { sector: 'retail' });
});

test('MemoryManager: aislamiento entre tenants sobre el mismo store', async () => {
  const store = new InMemoryStore();
  const acme = new MemoryManager({ tenantId: 'acme', store });
  const globex = new MemoryManager({ tenantId: 'globex', store });

  await acme.store({ agentId: 'a', summary: 'secreto de acme', outcome: 'ok' });
  const leak = await globex.recall('', { agentId: 'a', k: 10 });
  assert.equal(leak.length, 0, 'globex NO ve la memoria de acme');
});

test('AuditLog persiste en el store además de bufferizar', async () => {
  const store = new InMemoryStore();
  const audit = new AuditLog({ tenantId: 'acme', store });
  audit.log({ event: 'task:queued', taskId: 't1' });
  audit.log({ event: 'hitl:requested', approvalId: 'a1' });

  // appendAudit es async pero se invoca de forma síncrona dentro de log();
  // dejamos drenar la microcola antes de comprobar.
  await Promise.resolve();
  const persisted = store.auditFor('acme');
  assert.equal(persisted.length, 2);
  assert.equal(persisted[0].event, 'task:queued');
  assert.equal(audit.query({ event: 'hitl:requested' }).length, 1);
});
