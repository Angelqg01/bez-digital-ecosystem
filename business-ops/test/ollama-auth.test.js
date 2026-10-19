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
