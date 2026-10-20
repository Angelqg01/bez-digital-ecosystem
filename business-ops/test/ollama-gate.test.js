'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.OLLAMA_GATE_KEY = 'clave-de-prueba-de-al-menos-24-caracteres';
// Un «Ollama» de mentira.
const ollama = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, ruta: req.url })); });

test('la pasarela exige clave y sólo deja pasar las rutas que OPERANT necesita', async () => {
  await new Promise((r) => ollama.listen(0, '127.0.0.1', r));
  process.env.OLLAMA_TARGET = `http://127.0.0.1:${ollama.address().port}`;
  delete require.cache[require.resolve('../../scripts/ollama/ollama-gate.cjs')];
  const { crearServidor } = require('../../scripts/ollama/ollama-gate.cjs');
  const gate = crearServidor();
  await new Promise((r) => gate.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${gate.address().port}`;
  const auth = { Authorization: `Bearer ${process.env.OLLAMA_GATE_KEY}` };
  try {
    assert.equal((await fetch(`${base}/api/chat`, { method: 'POST', body: '{}' })).status, 401);                                   // sin clave
    assert.equal((await fetch(`${base}/api/chat`, { method: 'POST', body: '{}', headers: { Authorization: 'Bearer otra' } })).status, 401);
    assert.equal((await fetch(`${base}/api/pull`, { method: 'POST', body: '{}', headers: auth })).status, 403);                    // descargar modelos: no
    assert.equal((await fetch(`${base}/api/delete`, { method: 'DELETE', headers: auth })).status, 403);
    const ok = await fetch(`${base}/api/chat`, { method: 'POST', body: '{"a":1}', headers: { ...auth, 'content-type': 'application/json' } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).ruta, '/api/chat');
    assert.equal((await fetch(`${base}/api/tags`, { headers: auth })).status, 200);
  } finally { gate.closeAllConnections?.(); gate.close(); ollama.closeAllConnections?.(); ollama.close(); }
});
