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

test('respaldo por tier: si el proveedor primario falla, lo atiende el de respaldo y NO se degrada a simulado', async () => {
  const primario = failingProvider(503);
  const respaldo = { messages: { create: async () => ({ content: [{ type: 'text', text: 'respuesta real del respaldo' }], usage: { input_tokens: 1, output_tokens: 1 } }) } };
  const gw = new ModelGateway({
    providers: { ollama: primario, anthropic: respaldo },
    tierMap: { mid: { provider: 'ollama', model: 'qwen2.5:7b', fallback: { provider: 'anthropic', model: 'claude-sonnet-5-5' } } },
    fallbackToSimulated: true, maxRetries: 0, sleep: async () => {},
  });
  const r = await gw.complete({ tier: 'mid', messages: [{ role: 'user', content: 'hola' }] });
  assert.equal(r.text, 'respuesta real del respaldo');
  assert.notEqual(r.fallback, true);
  assert.equal(r.simulated, undefined);
});

test('respaldo por tier: si también falla, se degrada a simulado con los dos errores', async () => {
  const gw = new ModelGateway({
    providers: { ollama: failingProvider(503), anthropic: failingProvider(400) },
    tierMap: { mid: { provider: 'ollama', model: 'm', fallback: { provider: 'anthropic', model: 'c' } } },
    fallbackToSimulated: true, maxRetries: 0, sleep: async () => {},
  });
  const r = await gw.complete({ tier: 'mid', messages: [{ role: 'user', content: 'hola' }] });
  assert.equal(r.fallback, true);
  assert.match(r.error, /503/);
  assert.match(r.error, /respaldo anthropic/);
});

test('respaldo no configurado (sin proveedor registrado): se ignora', async () => {
  const gw = new ModelGateway({
    providers: { ollama: failingProvider(503) },
    tierMap: { mid: { provider: 'ollama', model: 'm', fallback: { provider: 'anthropic', model: 'c' } } },
    fallbackToSimulated: true, maxRetries: 0, sleep: async () => {},
  });
  const r = await gw.complete({ tier: 'mid', messages: [{ role: 'user', content: 'hola' }] });
  assert.equal(r.fallback, true);
});
