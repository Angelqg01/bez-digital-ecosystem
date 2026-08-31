'use strict';

/**
 * Tests de resiliencia del ModelGateway: modo simulado, reintentos con backoff,
 * errores no reintentables y timeout. El `sleep` se inyecta para no esperar de verdad.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ModelGateway = require('../src/cognition/ModelGateway');

/** Provider falso cuyo create() ejecuta el siguiente comportamiento de la lista. */
function fakeProvider(steps) {
  let i = 0;
  return {
    calls: () => i,
    messages: {
      create: async () => {
        const step = steps[Math.min(i, steps.length - 1)];
        i++;
        return typeof step === 'function' ? step() : step;
      },
    },
  };
}

const reply = (text = 'ok', input = 1, output = 1) => ({
  content: [{ type: 'text', text }],
  usage: { input_tokens: input, output_tokens: output },
});

const httpError = (status) => () => { const e = new Error(`http ${status}`); e.status = status; throw e; };

test('modo simulado (sin provider) devuelve texto simulado y emite onUsage', async () => {
  const usages = [];
  const gw = new ModelGateway({ providers: {}, onUsage: (u) => usages.push(u) });

  const r = await gw.complete({ tier: 'frontier', messages: [{ role: 'user', content: 'hola' }], meta: { tenantId: 'acme' } });
  assert.match(r.text, /SIMULADO/);
  assert.equal(r.model, 'claude-opus-4-8');       // tier frontier → modelo vigente
  assert.equal(usages.length, 1);
  assert.equal(usages[0].meta.tenantId, 'acme');
  assert.equal(usages[0].simulated, true);
});

test('reintenta ante 429 y acaba devolviendo el resultado', async () => {
  const prov = fakeProvider([httpError(429), httpError(429), reply('listo', 10, 5)]);
  let sleeps = 0;
  const gw = new ModelGateway({
    providers: { anthropic: prov }, maxRetries: 3,
    sleep: async () => { sleeps++; }, random: () => 0,
  });

  const r = await gw.complete({ tier: 'fast', messages: [{ role: 'user', content: 'x' }] });
  assert.equal(r.text, 'listo');
  assert.equal(r.model, 'claude-haiku-4-5');       // tier fast → modelo vigente
  assert.equal(prov.calls(), 3, 'dos fallos + un acierto');
  assert.equal(sleeps, 2, 'un backoff por cada reintento');
});

test('un error 4xx no reintentable se propaga sin reintentar', async () => {
  const prov = fakeProvider([httpError(400)]);
  let sleeps = 0;
  const gw = new ModelGateway({ providers: { anthropic: prov }, maxRetries: 3, sleep: async () => { sleeps++; } });

  await assert.rejects(() => gw.complete({ tier: 'fast', messages: [{ role: 'user', content: 'x' }] }), /http 400/);
  assert.equal(prov.calls(), 1);
  assert.equal(sleeps, 0, 'no debe dormir/reintentar');
});

test('agota los reintentos y lanza el último error', async () => {
  const prov = fakeProvider([httpError(503)]);
  const gw = new ModelGateway({ providers: { anthropic: prov }, maxRetries: 2, sleep: async () => {}, random: () => 0 });

  await assert.rejects(() => gw.complete({ tier: 'mid', messages: [] }), /http 503/);
  assert.equal(prov.calls(), 3, '1 intento + 2 reintentos');
});

test('timeout: una llamada que no resuelve se corta y se rechaza', async () => {
  const prov = { messages: { create: () => new Promise(() => {}) } }; // nunca resuelve
  const gw = new ModelGateway({ providers: { anthropic: prov }, timeoutMs: 30, maxRetries: 0 });

  await assert.rejects(() => gw.complete({ tier: 'fast', messages: [] }), /timeout/i);
});

test('en éxito normaliza el usage y lo pasa a onUsage', async () => {
  const prov = fakeProvider([reply('hi', 100, 50)]);
  const usages = [];
  const gw = new ModelGateway({ providers: { anthropic: prov }, onUsage: (u) => usages.push(u) });

  const r = await gw.complete({ tier: 'fast', messages: [{ role: 'user', content: 'x' }], meta: { tenantId: 'acme' } });
  assert.deepEqual(r.usage, { inputTokens: 100, outputTokens: 50 });
  assert.equal(usages[0].usage.outputTokens, 50);
});
