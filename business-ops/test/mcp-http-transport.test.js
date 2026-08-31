'use strict';

/**
 * MCPConnector — transporte HTTP (Streamable HTTP, spec 2025-03-26).
 *
 * Lo que hay que blindar aquí y por qué:
 *   - Handshake `initialize` sin `command`: prueba que HTTP no arrastra código
 *     de stdio (que en Windows requiere shell y romperia el modo remoto).
 *   - Aceptar respuesta como JSON puro Y como `text/event-stream` (el servidor
 *     elige y ambos son válidos por spec — nos ha pasado con Microsoft Learn).
 *   - Cabecera `Mcp-Session-Id`: cuando el servidor la manda, hay que reenviarla
 *     en cada request o pierde el estado y `tools/call` devuelve error.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const MCPConnector = require('../src/connectors/MCPConnector');

/** Fábrica de un fetch mock con respuestas encoladas por método JSON-RPC. */
function mockFetch(handler) {
  const calls = [];
  const fn = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, headers: opts.headers, body });
    return handler(body, { url, headers: opts.headers });
  };
  return { fn, calls };
}

function jsonRes({ status = 200, body, sessionId = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json'
        : h.toLowerCase() === 'mcp-session-id' ? sessionId : null),
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function sseRes({ body, sessionId = null } = {}) {
  const text = `event: message\ndata: ${JSON.stringify(body)}\n\n`;
  return {
    ok: true,
    status: 200,
    headers: {
      get: (h) => (h.toLowerCase() === 'content-type' ? 'text/event-stream'
        : h.toLowerCase() === 'mcp-session-id' ? sessionId : null),
    },
    text: async () => text,
  };
}

test('detecta transporte HTTP cuando hay url', () => {
  const c = new MCPConnector({ tenantId: 't', config: { name: 'x', url: 'https://x/mcp' } });
  assert.equal(c.transport, 'http');
});

test('detecta transporte stdio cuando hay command', () => {
  const c = new MCPConnector({ tenantId: 't', config: { name: 'x', command: 'node' } });
  assert.equal(c.transport, 'stdio');
});

test('connect() sin url ni command falla claro', async () => {
  const c = new MCPConnector({ tenantId: 't', config: { name: 'x' } });
  await assert.rejects(() => c.connect(), /config\.command o config\.url requerido/);
});

test('HTTP: initialize + tools/list + tools/call (JSON puro)', async () => {
  const { fn, calls } = mockFetch((body) => {
    if (body.method === 'initialize') return jsonRes({ body: { jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18' } } });
    if (body.method === 'notifications/initialized') return jsonRes({ body: {} });
    if (body.method === 'tools/list')  return jsonRes({ body: { jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'search', description: 'Buscar', inputSchema: { type: 'object' } }] } } });
    if (body.method === 'tools/call')  return jsonRes({ body: { jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: 'resultado ok' }] } } });
    throw new Error(`método inesperado: ${body.method}`);
  });

  const c = new MCPConnector({ tenantId: 't', config: { name: 'demo', url: 'https://demo/mcp', fetch: fn } });

  const tools = await c.describeTools();
  assert.deepEqual(tools, [{ name: 'search', description: 'Buscar', input_schema: { type: 'object' } }]);

  const res = await c.execute('search', { q: 'hola' });
  assert.equal(res.text, 'resultado ok');
  assert.equal(res.ok, true);

  // El handshake (initialize + initialized) va antes de la primera llamada útil.
  const methods = calls.map((c) => c.body.method);
  assert.deepEqual(methods.slice(0, 2), ['initialize', 'notifications/initialized']);
});

test('HTTP: acepta respuesta text/event-stream tal cual (como Microsoft Learn)', async () => {
  const { fn } = mockFetch((body) => {
    if (body.method === 'initialize') return sseRes({ body: { jsonrpc: '2.0', id: body.id, result: {} } });
    if (body.method === 'notifications/initialized') return jsonRes({ body: {} });
    if (body.method === 'tools/list') return sseRes({ body: { jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'x' }] } } });
    throw new Error('nope');
  });

  const c = new MCPConnector({ tenantId: 't', config: { name: 'demo', url: 'https://demo/mcp', fetch: fn } });
  const tools = await c.describeTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'x');
});

test('HTTP: si el servidor manda Mcp-Session-Id, se reenvía en las siguientes llamadas', async () => {
  const { fn, calls } = mockFetch((body) => {
    if (body.method === 'initialize') return jsonRes({ body: { jsonrpc: '2.0', id: body.id, result: {} }, sessionId: 'sesion-42' });
    if (body.method === 'notifications/initialized') return jsonRes({ body: {} });
    if (body.method === 'tools/list') return jsonRes({ body: { jsonrpc: '2.0', id: body.id, result: { tools: [] } } });
    throw new Error('nope');
  });

  const c = new MCPConnector({ tenantId: 't', config: { name: 'demo', url: 'https://demo/mcp', fetch: fn } });
  await c.describeTools();

  const listCall = calls.find((c) => c.body.method === 'tools/list');
  assert.equal(listCall.headers['Mcp-Session-Id'], 'sesion-42', 'sin esto, el servidor pierde el estado y falla');
});

test('HTTP: un error JSON-RPC del servidor se propaga con el mensaje del servidor', async () => {
  const { fn } = mockFetch((body) => {
    if (body.method === 'initialize') return jsonRes({ body: { jsonrpc: '2.0', id: body.id, result: {} } });
    if (body.method === 'notifications/initialized') return jsonRes({ body: {} });
    if (body.method === 'tools/list') return jsonRes({ body: { jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'method not found' } } });
    throw new Error('nope');
  });

  const c = new MCPConnector({ tenantId: 't', config: { name: 'demo', url: 'https://demo/mcp', fetch: fn } });
  await assert.rejects(() => c.describeTools(), /method not found/);
});

test('HTTP: HTTP no-2xx se propaga con el status', async () => {
  const { fn } = mockFetch(() => jsonRes({ status: 503, body: {} }));
  const c = new MCPConnector({ tenantId: 't', config: { name: 'demo', url: 'https://demo/mcp', fetch: fn } });
  await assert.rejects(() => c.connect(), /HTTP 503/);
});

test('HTTP: cabeceras extra (API key del servidor) viajan en cada request', async () => {
  const { fn, calls } = mockFetch((body) => jsonRes({ body: { jsonrpc: '2.0', id: body.id, result: {} } }));
  const c = new MCPConnector({
    tenantId: 't',
    config: { name: 'demo', url: 'https://demo/mcp', headers: { 'X-Api-Key': 'secreto' }, fetch: fn },
  });
  await c.connect();
  assert.equal(calls[0].headers['X-Api-Key'], 'secreto');
  // Accept requerido por spec: JSON o SSE.
  assert.match(calls[0].headers.Accept, /application\/json/);
  assert.match(calls[0].headers.Accept, /text\/event-stream/);
});
