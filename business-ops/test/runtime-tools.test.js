'use strict';

/**
 * RuntimeToolsConnector — las tools del runtime de BeZhas dentro del tool-use
 * de esta plataforma.
 *
 * Lo que se protege: que una invocación nacida de un agente de negocio pase por
 * el PolicyEngine de ESTE tenant antes de salir, que la lista blanca sea de
 * verdad una lista blanca, y que un runtime caído no rompa la tarea.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const RuntimeToolsConnector = require('../src/connectors/RuntimeToolsConnector');
const { categoryForToolCall, buildToolDefinitions } = require('../src/cognition/toolCatalog');

const conector = (over = {}) => new RuntimeToolsConnector({
  tenantId: 'bezhas',
  config: { baseUrl: 'http://runtime-de-prueba', ...over },
});

test('invoca la tool del runtime con su nombre como metodo', async () => {
  const llamadas = [];
  const c = conector({
    fetch: async (url, opts) => {
      llamadas.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, json: async () => ({ status: 'success', data: { is_active: true } }) };
    },
  });

  const r = await c.execute('validator-status', { operator: '0xabc' });
  assert.equal(llamadas[0].url, 'http://runtime-de-prueba/api/runtime/invoke');
  assert.deepEqual(llamadas[0].body, { tool: 'validator-status', params: { operator: '0xabc' } });
  assert.equal(r.simulated, false);
});

test('la lista blanca es una lista blanca: lo no declarado no sale', async () => {
  const c = conector({ fetch: async () => { throw new Error('no deberia llamarse'); } });
  await assert.rejects(() => c.execute('borrar-todo', {}), /no admitida/);
});

test('un runtime caido degrada, no rompe la tarea', async () => {
  const c = conector({ fetch: async () => { throw new Error('ECONNREFUSED'); } });
  const r = await c.execute('bridge-health', {});
  assert.equal(r.simulated, true);
  assert.match(r.reason, /no disponible/);
});

test('el circuito se abre tras fallos seguidos y deja de gastar timeouts', async () => {
  let intentos = 0;
  const c = conector({ fetch: async () => { intentos++; throw new Error('caido'); } });
  for (let i = 0; i < 5; i++) await c.execute('gas-analytics', {});
  assert.equal(c.circuit, 'open');
  assert.equal(intentos, 3, 'tras el umbral no se vuelve a salir a la red');
});

// ── Lo que hace que esto sea seguro y no un atajo ─────────────────────────

test('cada invocacion recibe categoria de politica: nada esquiva al PolicyEngine', () => {
  for (const tool of Object.keys(RuntimeToolsConnector.TOOLS)) {
    const cat = categoryForToolCall('runtime', tool, {});
    assert.ok(cat.category, `${tool} sin categoria`);
    assert.match(cat.category, /^infra_(read|write)$/);
  }
});

test('lo que escribe se separa de lo que consulta', () => {
  assert.equal(categoryForToolCall('runtime', 'validator-status', {}).category, 'infra_read');
  assert.equal(categoryForToolCall('runtime', 'deploy-check', {}).category, 'infra_write');
});

test('el modelo ve la herramienta con sus metodos', async () => {
  const defs = await buildToolDefinitions({ runtime: conector() });
  const def = defs.find((d) => d.name.includes('runtime'));
  assert.ok(def, 'el catalogo no expone runtime al modelo');
  assert.match(JSON.stringify(def), /validator-status/);
});
