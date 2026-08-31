'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const InMemoryStore = require('../src/platform/InMemoryStore');
const SqliteStore = require('../src/platform/SqliteStore');
const MemoryManager = require('../src/cognition/MemoryManager');
const VectorDB = require('../src/connectors/VectorDB');

function tempDb(name) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-')), `${name}.db`);
  return file;
}

test('MemoryManager: RAG por similitud coseno en InMemoryStore', async () => {
  const store = new InMemoryStore();
  const embedder = async (text) => {
    if (text.includes('ventas')) return [1, 0, 0];
    if (text.includes('soporte')) return [0, 1, 0];
    return [0, 0, 1];
  };

  const mem = new MemoryManager({ tenantId: 'acme', store, embedder });

  // Guardar interacciones cronológicamente (primero soporte, luego ventas)
  await mem.store({ agentId: 'test-agent', summary: 'soporte técnico básico', outcome: 'ok', embedding: [0, 1, 0] });
  await mem.store({ agentId: 'test-agent', summary: 'reunión de ventas con deal', outcome: 'ok', embedding: [1, 0, 0] });

  // Si buscamos sin embedding, nos devuelve el más reciente primero (ventas, luego soporte)
  const crono = await mem.recall('ventas', { agentId: 'test-agent', k: 5 });
  assert.equal(crono[0].summary, 'reunión de ventas con deal');
  assert.equal(crono[1].summary, 'soporte técnico básico');

  // Si hacemos una query semántica para "soporte" usando el embedder,
  // el artículo de soporte debe ordenarse primero a pesar de ser más antiguo cronológicamente.
  const query = 'soporte';
  const recalled = await mem.recall(query, { agentId: 'test-agent', k: 2 });
  
  assert.equal(recalled.length, 2);
  assert.equal(recalled[0].summary, 'soporte técnico básico');
  assert.ok(recalled[0].score > 0.9);
});

test('MemoryManager: RAG por similitud coseno en SqliteStore', async () => {
  const file = tempDb('vector-sqlite');
  const store = new SqliteStore({ filePath: file });
  await store.connect();

  const embedder = async (text) => {
    if (text.includes('ventas')) return [1, 0, 0];
    if (text.includes('soporte')) return [0, 1, 0];
    return [0, 0, 1];
  };

  const mem = new MemoryManager({ tenantId: 'acme', store, embedder });

  await mem.store({ agentId: 'test-agent', summary: 'soporte técnico básico', outcome: 'ok', embedding: [0, 1, 0] });
  await mem.store({ agentId: 'test-agent', summary: 'reunión de ventas con deal', outcome: 'ok', embedding: [1, 0, 0] });

  // Buscar por similitud de "soporte"
  const recalled = await mem.recall('soporte', { agentId: 'test-agent', k: 2 });

  assert.equal(recalled.length, 2);
  assert.equal(recalled[0].summary, 'soporte técnico básico');
  assert.ok(recalled[0].score > 0.9);

  await store.disconnect();
});

test('VectorDB: persistencia a través del store', async () => {
  const store = new InMemoryStore();
  const db = new VectorDB({ tenantId: 'acme', config: { store } });

  const docId = await db.execute('upsert', { id: 'doc-1', title: 'Configuración', body: 'Pasos para instalar', tags: ['ayuda'] });
  assert.equal(docId, 'doc-1');

  // Rehidratar en un nuevo VectorDB usando el mismo store
  const db2 = new VectorDB({ tenantId: 'acme', config: { store } });
  const results = await db2.execute('search', { query: 'instalar', k: 5 });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'doc-1');
});
