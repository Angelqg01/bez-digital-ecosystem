'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PlatformKnowledge, withPlatformKnowledge } = require('../src/platform/PlatformKnowledge');
const KnowledgeBase = require('../src/platform/KnowledgeBase');

const silencio = { warn() {} };
const respuesta = (status, body) => ({ ok: status < 400, status, json: async () => body });

test('envía tenant, pregunta y clave interna, y adapta los resultados', async () => {
  let llamada;
  const pk = new PlatformKnowledge({
    apiUrl: 'https://api.bezhas.com/', internalKey: 'clave', logger: silencio,
    fetchImpl: async (url, init) => { llamada = { url, init }; return respuesta(200, { resultados: [{ documento: 'd1', titulo: 'CargoLink', fragmento: 'Logística', relevancia: 0.8 }] }); },
  });
  const hits = await pk.search('bezhas', '¿Qué es CargoLink?', { k: 2 });
  assert.equal(llamada.url, 'https://api.bezhas.com/api/operant-knowledge/search');
  assert.equal(llamada.init.headers['x-api-key'], 'clave');
  assert.deepEqual(JSON.parse(llamada.init.body), { tenantId: 'bezhas', pregunta: '¿Qué es CargoLink?', limite: 2 });
  assert.deepEqual(hits, [{ id: 'd1', title: 'CargoLink', snippet: 'Logística', score: 0.8, source: 'bezhas' }]);
});

test('falla abierto: error HTTP, excepción o sin configurar → []', async () => {
  assert.deepEqual(await new PlatformKnowledge({ apiUrl: 'x', internalKey: 'k', logger: silencio, fetchImpl: async () => respuesta(503, {}) }).search('t', 'q'), []);
  assert.deepEqual(await new PlatformKnowledge({ apiUrl: 'x', internalKey: 'k', logger: silencio, fetchImpl: async () => { throw new Error('ECONNREFUSED'); } }).search('t', 'q'), []);
  let llamado = false;
  const sin = new PlatformKnowledge({ apiUrl: '', internalKey: '', fetchImpl: async () => { llamado = true; } });
  assert.equal(sin.enabled, false);
  assert.deepEqual(await sin.search('t', 'q'), []);
  assert.equal(llamado, false);
});

test('withPlatformKnowledge: primero la plataforma, luego lo local sin repetir título; el resto va a la KB', async () => {
  const kb = new KnowledgeBase({ tenantId: 'bezhas' });
  await kb.ingest({ id: 'a1', title: 'CargoLink', body: 'copia local de CargoLink logística' });
  await kb.ingest({ id: 'a2', title: 'Horario', body: 'horario de soporte logística' });
  const plataforma = { enabled: true, search: async (tenantId) => (tenantId === 'bezhas' ? [{ id: 'd1', title: 'CargoLink', snippet: 'vigente', score: 0.9, source: 'bezhas' }] : []) };
  const envuelta = withPlatformKnowledge(kb, plataforma, 'bezhas');
  const hits = await envuelta.search('logística', { k: 3 });
  assert.deepEqual(hits.map((h) => h.id), ['d1', 'a2']);
  assert.equal(envuelta.size, kb.size);
  await envuelta.ingest({ id: 'a3', title: 'Nuevo', body: 'x' });
  assert.equal(kb.size, 3);
});

test('sin plataforma activa devuelve la KB tal cual', () => {
  const kb = new KnowledgeBase({ tenantId: 't' });
  assert.equal(withPlatformKnowledge(kb, { enabled: false }, 't'), kb);
});
