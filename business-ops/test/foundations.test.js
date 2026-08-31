'use strict';

/**
 * Cimientos soberanos (Fase A): embeddings reales en RAG, storage propio y
 * acceso sandboxed a archivos.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const KnowledgeBase = require('../src/platform/KnowledgeBase');
const StorageConnector = require('../src/connectors/StorageConnector');
const FileSystemConnector = require('../src/connectors/FileSystemConnector');
const { crossesRedLine } = require('../src/guardrails/RedLines');

// ── Embeddings semánticos en la KnowledgeBase ──────────────────────
// Embedder de juguete determinista: vector de frecuencias de unas palabras clave.
function toyEmbedder(vocab) {
  return async (text) => {
    const t = String(text).toLowerCase();
    return vocab.map((w) => (t.split(w).length - 1));
  };
}

test('KnowledgeBase: recupera por similitud semántica cuando hay embedder', async () => {
  const vocab = ['factura', 'pago', 'envío', 'devolución'];
  const kb = new KnowledgeBase({ tenantId: 't', embedder: toyEmbedder(vocab) });
  assert.equal(kb.semantic, true);
  await kb.ingest({ title: 'Pagos', body: 'cómo realizar un pago y descargar la factura del pago' });
  await kb.ingest({ title: 'Envíos', body: 'plazos de envío y seguimiento del envío' });

  const res = await kb.search('quiero mi factura del pago');
  assert.ok(res.length >= 1);
  assert.equal(res[0].title, 'Pagos', 'el artículo de pagos debe ir primero');
});

test('KnowledgeBase: sin embedder, sigue funcionando por términos (compatibilidad)', async () => {
  const kb = new KnowledgeBase({ tenantId: 't' });
  assert.equal(kb.semantic, false);
  await kb.ingest({ title: 'Devoluciones', body: 'política de devolución y reembolso' });
  const res = await kb.search('cómo hago una devolución');
  assert.equal(res[0].title, 'Devoluciones');
});

// ── StorageConnector (MinIO, modo simulado) ────────────────────────
test('StorageConnector: put/get/list/remove aislado por tenant', async () => {
  const s = new StorageConnector({ tenantId: 'acme' });
  const put = await s.execute('put', { name: 'facturas/2026-01.pdf', data: 'PDF-BYTES' });
  assert.ok(put.key.startsWith('acme/'), 'la clave se prefija con el tenant');

  const got = await s.execute('get', { name: 'facturas/2026-01.pdf' });
  assert.equal(got.data.toString(), 'PDF-BYTES');

  const list = await s.execute('list', { prefix: 'facturas/' });
  assert.equal(list.length, 1);

  const other = new StorageConnector({ tenantId: 'otro' });
  assert.equal((await other.execute('list', {})).length, 0, 'otro tenant no ve los archivos de acme');

  await s.execute('remove', { name: 'facturas/2026-01.pdf' });
  assert.equal((await s.execute('list', {})).length, 0);
});

// ── FileSystemConnector (sandbox) ──────────────────────────────────
test('FileSystemConnector: lee/escribe dentro del sandbox y rechaza fuera', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'operant-fs-'));
  const fsc = new FileSystemConnector({ tenantId: 't', config: { roots: [root] } });

  await fsc.execute('write', { file: 'salida/informe.txt', content: 'hola' });
  const read = await fsc.execute('read', { file: 'salida/informe.txt' });
  assert.equal(read.content, 'hola');

  const list = await fsc.execute('list', { dir: 'salida' });
  assert.ok(list.find((e) => e.name === 'informe.txt'));

  // Path traversal fuera del sandbox → rechazado.
  await assert.rejects(() => fsc.execute('read', { file: '../../etc/passwd' }), /fuera del sandbox/);

  await fs.rm(root, { recursive: true, force: true });
});

test('FileSystem: mover/borrar son líneas rojas; leer/escribir no', () => {
  assert.ok(crossesRedLine({ category: 'filesystem', method: 'remove' }), 'borrar pasa por HITL');
  assert.ok(crossesRedLine({ category: 'filesystem', method: 'move' }), 'mover pasa por HITL');
  assert.equal(crossesRedLine({ category: 'filesystem', method: 'write' }), null, 'escribir nuevo no');
  assert.equal(crossesRedLine({ category: 'filesystem', method: 'read' }), null, 'leer no');
});
