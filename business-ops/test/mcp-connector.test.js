'use strict';

/**
 * MCPConnector contra un servidor MCP real (fixture por stdio): handshake,
 * descubrimiento de herramientas, ejecución, errores, y la integración
 * completa con el bucle agéntico (el modelo invoca una herramienta MCP y la
 * llamada pasa por PolicyEngine con la categoría del conector).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const MCPConnector = require('../src/connectors/MCPConnector');
const BaseAgent = require('../src/agents/BaseAgent');
const ModelGateway = require('../src/cognition/ModelGateway');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const { buildToolDefinitions, categoryForConnectorCall } = require('../src/cognition/toolCatalog');

const FIXTURE = path.join(__dirname, 'fixtures', 'mcp-fake-server.js');

function makeConnector(extra = {}) {
  return new MCPConnector({
    tenantId: 'acme',
    config: { name: 'fake', command: process.execPath, args: [FIXTURE], ...extra },
  });
}

test('handshake + describeTools: descubre las herramientas reales del servidor', async () => {
  const mcp = makeConnector();
  try {
    const tools = await mcp.describeTools();
    assert.deepEqual(tools.map((t) => t.name), ['echo', 'sumar']);
    assert.match(tools[0].description, /texto/);
    assert.equal(tools[1].input_schema.required.length, 2);
  } finally {
    await mcp.disconnect();
  }
});

test('execute: invoca una herramienta MCP y normaliza la respuesta', async () => {
  const mcp = makeConnector();
  try {
    const eco = await mcp.execute('echo', { text: 'hola OPERANT' });
    assert.equal(eco.text, 'eco: hola OPERANT');
    const suma = await mcp.execute('sumar', { a: 2, b: 3 });
    assert.equal(suma.text, '5');
    assert.deepEqual(suma.structured, { resultado: 5 });
  } finally {
    await mcp.disconnect();
  }
});

test('execute: isError del servidor se convierte en excepción', async () => {
  const mcp = makeConnector();
  try {
    await assert.rejects(() => mcp.execute('noExiste', {}), /herramienta desconocida/);
  } finally {
    await mcp.disconnect();
  }
});

test('buildToolDefinitions: el conector MCP expone sus métodos reales al modelo', async () => {
  const mcp = makeConnector();
  try {
    const defs = await buildToolDefinitions({ fake: mcp });
    assert.equal(defs.length, 1);
    assert.deepEqual(defs[0].input_schema.properties.method.enum, ['echo', 'sumar']);
    assert.match(defs[0].description, /servidor MCP/);
  } finally {
    await mcp.disconnect();
  }
});

test('categoría de política: los conectores MCP caen en su policyCategory', async () => {
  const mcp = makeConnector({ policyCategory: 'external' });
  assert.deepEqual(categoryForConnectorCall(mcp, 'fake', 'echo', {}), { category: 'external' });
  // Los conectores clásicos siguen con su mapeo específico.
  assert.equal(categoryForConnectorCall({ name: 'email' }, 'email', 'send', {}).category, 'outbound');
  await mcp.disconnect();
});

test('bucle agéntico end-to-end: el modelo invoca la herramienta MCP de verdad', async () => {
  const responses = [
    {
      content: [{ type: 'tool_use', id: 't1', name: 'fake', input: { method: 'sumar', args: { a: 40, b: 2 } } }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 5, output_tokens: 5 },
    },
    {
      content: [{ type: 'text', text: 'La suma es 42.' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 5, output_tokens: 5 },
    },
  ];
  let i = 0;
  const provider = { messages: { create: async () => responses[Math.min(i++, responses.length - 1)] } };

  const mcp = makeConnector();
  const agent = new BaseAgent({
    id: 'test.mcp', department: 'operations', tenantId: 'acme',
    model: new ModelGateway({ providers: { anthropic: provider } }),
    guardrails: new PolicyEngine({ tenantId: 'acme' }),
    tools: { fake: mcp },
    modelTier: 'fast',
  });

  try {
    const out = await agent.thinkAndAct('¿Cuánto es 40 + 2? Usa la herramienta.');
    assert.equal(out.text, 'La suma es 42.');
    assert.deepEqual(out.actions, [{ tool: 'fake', method: 'sumar', status: 'executed' }]);
  } finally {
    await mcp.disconnect();
  }
});

test('política del tenant: block sobre "external" corta las herramientas MCP', async () => {
  const responses = [
    {
      content: [{ type: 'tool_use', id: 't1', name: 'fake', input: { method: 'echo', args: { text: 'x' } } }],
      stop_reason: 'tool_use',
      usage: { input_tokens: 5, output_tokens: 5 },
    },
    { content: [{ type: 'text', text: 'Entendido, esa herramienta está bloqueada.' }], stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 5 } },
  ];
  let i = 0;
  const provider = { messages: { create: async () => responses[Math.min(i++, responses.length - 1)] } };

  const mcp = makeConnector();
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  guardrails.setOverride('external', 'block'); // el tenant endurece TODO lo externo

  const agent = new BaseAgent({
    id: 'test.mcp', department: 'operations', tenantId: 'acme',
    model: new ModelGateway({ providers: { anthropic: provider } }),
    guardrails,
    tools: { fake: mcp },
    modelTier: 'fast',
  });

  try {
    const out = await agent.thinkAndAct('haz un eco');
    assert.deepEqual(out.actions, [{ tool: 'fake', method: 'echo', status: 'blocked' }]);
    assert.match(out.text, /bloqueada/);
  } finally {
    await mcp.disconnect();
  }
});
