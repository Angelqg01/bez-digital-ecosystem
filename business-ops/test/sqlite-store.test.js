'use strict';

/**
 * Tests del SqliteStore: contrato Store completo, aislamiento por tenant,
 * persistencia de plataforma (tenants + claves de API) y — lo importante —
 * supervivencia a un "reinicio" (cerrar y reabrir el mismo fichero).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const createStore = require('../src/platform/createStore');
const SqliteStore = require('../src/platform/SqliteStore');
const ApiKeyRegistry = require('../src/platform/ApiKeyRegistry');
const MemoryManager = require('../src/cognition/MemoryManager');

function tempDb(name) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-')), `${name}.db`);
  return file;
}

test('createStore: con sqlitePath devuelve SqliteStore; sin nada, memoria', async () => {
  const file = tempDb('factory');
  const store = createStore({ sqlitePath: file });
  assert.equal(store.constructor.name, 'SqliteStore');
  const mem = createStore({});
  assert.equal(mem.constructor.name, 'InMemoryStore');
  await store.connect();
  await store.disconnect();
});

test('contrato Store: interacciones aisladas por tenant y filtradas por agente', async () => {
  const store = new SqliteStore({ filePath: tempDb('contract') });
  await store.connect();

  await store.saveInteraction({ tenantId: 'acme', agentId: 'sales.outreach', summary: 'a1', outcome: 'ok' });
  await store.saveInteraction({ tenantId: 'acme', agentId: 'support.triage', summary: 'a2', outcome: 'ok' });
  await store.saveInteraction({ tenantId: 'beta', agentId: 'sales.outreach', summary: 'b1', outcome: 'ok' });

  const acmeAll = await store.recallInteractions({ tenantId: 'acme' });
  assert.equal(acmeAll.length, 2, 'no debe ver interacciones de otro tenant');

  const acmeSales = await store.recallInteractions({ tenantId: 'acme', agentId: 'sales.outreach' });
  assert.equal(acmeSales.length, 1);
  assert.equal(acmeSales[0].summary, 'a1');
  await store.disconnect();
});

test('contrato Store: recall devuelve los más recientes primero y respeta k', async () => {
  const store = new SqliteStore({ filePath: tempDb('recall') });
  await store.connect();
  for (let i = 1; i <= 5; i++) {
    await store.saveInteraction({ tenantId: 'acme', agentId: 'x', summary: `s${i}`, outcome: 'ok' });
  }
  const top2 = await store.recallInteractions({ tenantId: 'acme', k: 2 });
  assert.deepEqual(top2.map((r) => r.summary), ['s5', 's4']);
  await store.disconnect();
});

test('contrato Store: hechos aislados por tenant, con upsert', async () => {
  const store = new SqliteStore({ filePath: tempDb('facts') });
  await store.connect();
  await store.setFact({ tenantId: 'acme', key: 'idioma', value: 'es' });
  await store.setFact({ tenantId: 'beta', key: 'idioma', value: 'en' });
  await store.setFact({ tenantId: 'acme', key: 'idioma', value: 'ca' }); // upsert

  assert.equal(await store.getFact({ tenantId: 'acme', key: 'idioma' }), 'ca');
  assert.equal(await store.getFact({ tenantId: 'beta', key: 'idioma' }), 'en');
  assert.equal(await store.getFact({ tenantId: 'acme', key: 'nada' }), null);
  await store.disconnect();
});

test('auditoría: appendAudit persiste y auditFor filtra por tenant', async () => {
  const store = new SqliteStore({ filePath: tempDb('audit') });
  await store.connect();
  await store.appendAudit({ tenantId: 'acme', event: 'task:queued', taskId: 't1' });
  await store.appendAudit({ tenantId: 'beta', event: 'task:queued', taskId: 't2' });

  const acme = store.auditFor('acme');
  assert.equal(acme.length, 1);
  assert.equal(acme[0].event, 'task:queued');
  assert.equal(acme[0].taskId, 't1');
  await store.disconnect();
});

test('REINICIO: tenants, claves y memoria sobreviven a cerrar y reabrir', async () => {
  const file = tempDb('reboot');

  // Vida 1: aprovisionar y escribir.
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();
  await store1.upsertTenant({ tenantId: 'acme', plan: 'pro', departments: ['sales', 'support'] });
  const keys1 = new ApiKeyRegistry({ store: store1 });
  const apiKey = keys1.issue('acme');
  await store1.saveInteraction({ tenantId: 'acme', agentId: 'sales.outreach', summary: 'lead caliente', outcome: 'ok' });
  await store1.setFact({ tenantId: 'acme', key: 'sector', value: 'logística' });
  await store1.disconnect();  // ← "apagón"

  // Vida 2: proceso nuevo sobre el mismo fichero.
  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();

  const tenants = await store2.listTenants();
  assert.deepEqual(tenants, [{ tenantId: 'acme', plan: 'pro', departments: ['sales', 'support'], businessId: null }]);

  const keys2 = new ApiKeyRegistry({ store: store2 });
  assert.equal(keys2.resolve(apiKey), null, 'antes de hidratar no conoce la clave');
  const n = await keys2.hydrate();
  assert.equal(n, 1);
  assert.equal(keys2.resolve(apiKey), 'acme', 'tras hidratar, la clave del cliente sigue siendo válida');

  const recall = await store2.recallInteractions({ tenantId: 'acme' });
  assert.equal(recall[0].summary, 'lead caliente');
  assert.equal(await store2.getFact({ tenantId: 'acme', key: 'sector' }), 'logística');
  await store2.disconnect();
});

test('rotación de clave: la anterior deja de resolver y la nueva persiste', async () => {
  const store = new SqliteStore({ filePath: tempDb('rotate') });
  await store.connect();
  const keys = new ApiKeyRegistry({ store });
  const k1 = keys.issue('acme');
  const k2 = keys.issue('acme');           // rota
  assert.equal(keys.resolve(k1), null);
  assert.equal(keys.resolve(k2), 'acme');

  await new Promise((r) => setImmediate(r)); // deja asentar la persistencia async
  const fresh = new ApiKeyRegistry({ store });
  await fresh.hydrate();
  assert.equal(fresh.resolve(k2), 'acme', 'solo la clave vigente sobrevive');
  assert.equal(fresh.resolve(k1), null);
  await store.disconnect();
});

test('MemoryManager funciona igual sobre SqliteStore (mismo contrato)', async () => {
  const store = new SqliteStore({ filePath: tempDb('memory') });
  await store.connect();
  const mem = new MemoryManager({ tenantId: 'acme', store });
  await mem.connect();
  await mem.store({ agentId: 'a', summary: 'hola', outcome: 'ok' });
  const rec = await mem.recall('hola', { agentId: 'a' });
  assert.equal(rec.length, 1);
  assert.equal(rec[0].summary, 'hola');
  await store.disconnect();
});
