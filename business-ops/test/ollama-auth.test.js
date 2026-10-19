'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const OllamaProvider = require('../src/cognition/providers/ollama');

test('con OLLAMA_API_KEY el proveedor manda Authorization: Bearer; sin clave no manda nada', async () => {
  const vistas = [];
  const fetch = async (url, opts) => { vistas.push(opts.headers); return { ok: true, json: async () => ({ message: { content: 'ok' }, prompt_eval_count: 1, eval_count: 1 }) }; };
  await new OllamaProvider({ baseUrl: 'https://x.test', apiKey: 'k-secreta', fetch }).messages.create({ model: 'm', messages: [{ role: 'user', content: 'hola' }] });
  await new OllamaProvider({ baseUrl: 'http://localhost:11434', apiKey: '', fetch }).messages.create({ model: 'm', messages: [{ role: 'user', content: 'hola' }] });
  assert.equal(vistas[0].Authorization, 'Bearer k-secreta');
  assert.equal(vistas[1].Authorization, undefined);
});

test('temperatura baja por defecto, configurable con OLLAMA_TEMPERATURE', async () => {
  const cuerpos = [];
  const fetch = async (_u, opts) => { cuerpos.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ message: { content: 'ok' }, prompt_eval_count: 1, eval_count: 1 }) }; };
  const p = new OllamaProvider({ baseUrl: 'http://x', fetch });
  await p.messages.create({ model: 'm', messages: [{ role: 'user', content: 'hola' }], max_tokens: 50 });
  assert.equal(cuerpos[0].options.temperature, 0.2);
  assert.equal(cuerpos[0].options.num_predict, 50);
  process.env.OLLAMA_TEMPERATURE = '0.7';
  await p.messages.create({ model: 'm', messages: [{ role: 'user', content: 'hola' }] });
  delete process.env.OLLAMA_TEMPERATURE;
  assert.equal(cuerpos[1].options.temperature, 0.7);
});
