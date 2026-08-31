'use strict';

/**
 * Degradación elegante del ModelGateway (fallbackToSimulated):
 * si el proveedor falla tras los reintentos, la tarea no muere — recibe una
 * respuesta simulada marcada con fallback:true y el error original.
 * Es el fallo real visto en vivo: clave sin crédito (400) y Ollama sin modelo (404).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ModelGateway = require('../src/cognition/ModelGateway');

function failingProvider(status) {
  let calls = 0;
  return {
    calls: () => calls,
    messages: {
      create: async () => {
        calls++;
        const e = new Error(`http ${status}`);
        e.status = status;
        throw e;
      },
    },
  };
}

test('fallback: error no reintentable (400 sin crédito) degrada a simulado', async () => {
  const prov = failingProvider(400);
  const usages = [];
  const gw = new ModelGateway({
    providers: { anthropic: prov }, fallbackToSimulated: true,
    sleep: async () => {}, random: () => 0,
    onUsage: (u) => usages.push(u),
  });

  const r = await gw.complete({ tier: 'fast', messages: [{ role: 'user', content: 'hola' }], meta: { tenantId: 'acme' } });
  assert.equal(prov.calls(), 1, 'sin reintentos para 4xx');
  assert.match(r.text, /SIMULADO/);
  assert.equal(r.fallback, true, 'marca que hubo degradación');
  assert.match(r.error, /http 400/, 'conserva el error original');
  assert.equal(usages.length, 1);
  assert.equal(usages[0].simulated, true, 'telemetría refleja la degradación');
});

test('fallback: reintentos agotados (503) degrada en vez de tumbar la tarea', async () => {
  const prov = failingProvider(503);
  const gw = new ModelGateway({
    providers: { anthropic: prov }, fallbackToSimulated: true, maxRetries: 2,
    sleep: async () => {}, random: () => 0,
  });

  const r = await gw.complete({ tier: 'mid', messages: [{ role: 'user', content: 'x' }] });
  assert.equal(prov.calls(), 3, 'agota 1 intento + 2 reintentos antes de degradar');
  assert.equal(r.fallback, true);
  assert.equal(r.simulated, true);
});

test('sin fallback (por defecto) el error se sigue propagando', async () => {
  const prov = failingProvider(400);
  const gw = new ModelGateway({ providers: { anthropic: prov }, sleep: async () => {} });
  await assert.rejects(() => gw.complete({ tier: 'fast', messages: [] }), /http 400/);
});
