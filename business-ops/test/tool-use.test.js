'use strict';

/**
 * Tool-use end-to-end: el modelo invoca conectores, cada invocación pasa por
 * PolicyEngine/RedLines, las líneas rojas esperan al humano (HITL) y los
 * rechazos se realimentan al modelo como tool_result para que adapte el plan.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ModelGateway = require('../src/cognition/ModelGateway');
const BaseAgent = require('../src/agents/BaseAgent');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const HITLGate = require('../src/core/HITLGate');
const { buildToolDefinitions, categoryForToolCall } = require('../src/cognition/toolCatalog');

// ── Dobles ──────────────────────────────────────────────────────────

/** Provider falso: devuelve las respuestas scripteadas (formato SDK Anthropic). */
function scriptedProvider(responses) {
  let i = 0;
  const calls = [];
  return {
    calls,
    messages: {
      create: async (args) => {
        calls.push(args);
        const r = responses[Math.min(i, responses.length - 1)];
        i++;
        return r;
      },
    },
  };
}

const textResponse = (text) => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5 },
});

const toolResponse = (name, input, id = 'tu_1') => ({
  content: [
    { type: 'text', text: `Voy a usar ${name}.` },
    { type: 'tool_use', id, name, input },
  ],
  stop_reason: 'tool_use',
  usage: { input_tokens: 10, output_tokens: 5 },
});

/** Conector falso que registra las ejecuciones. */
function fakeConnector(name, reply = { ok: true }) {
  return {
    name,
    executed: [],
    async execute(method, args) {
      this.executed.push({ method, args });
      return { connector: name, method, ...reply };
    },
  };
}

function makeAgent({ provider, tools, hitl }) {
  const gateway = new ModelGateway({ providers: { anthropic: provider }, sleep: async () => {} });
  return new BaseAgent({
    id: 'test.agent', department: 'sales', tenantId: 'acme',
    model: gateway,
    guardrails: new PolicyEngine({ tenantId: 'acme' }),
    hitl,
    tools,
    modelTier: 'fast',
  });
}

// ── Catálogo ────────────────────────────────────────────────────────

test('buildToolDefinitions: una herramienta por conector, con métodos enumerados', async () => {
  const defs = await buildToolDefinitions({ email: fakeConnector('email'), crm: fakeConnector('crm') });
  assert.equal(defs.length, 2);
  const email = defs.find((d) => d.name === 'email');
  assert.match(email.description, /send/);
  assert.deepEqual(email.input_schema.properties.method.enum, ['send']);
  assert.deepEqual(email.input_schema.required, ['method']);
});

test('categoryForToolCall: mapea a las categorías que vigilan las RedLines', () => {
  assert.deepEqual(categoryForToolCall('email', 'send', { cold: true }),
    { category: 'outbound', cold: true, recipientCount: 1 });
  assert.equal(categoryForToolCall('stripe', 'createPaymentLink', {}).category, 'billing');
  assert.equal(categoryForToolCall('stripe', 'transfer', {}).category, 'payment', 'mover fondos = línea roja');
  assert.equal(categoryForToolCall('fs', 'remove', {}).category, 'filesystem');
  assert.equal(categoryForToolCall('desconocido', 'x', {}).category, 'desconocido');
});

// ── Gateway ─────────────────────────────────────────────────────────

test('completeWithTools: parsea bloques tool_use y devuelve toolCalls', async () => {
  const prov = scriptedProvider([toolResponse('crm', { method: 'listLeads', args: {} })]);
  const gw = new ModelGateway({ providers: { anthropic: prov } });
  const r = await gw.completeWithTools({ tier: 'fast', messages: [{ role: 'user', content: 'lista' }], tools: [{ name: 'crm' }] });
  assert.equal(r.toolCalls.length, 1);
  assert.equal(r.toolCalls[0].name, 'crm');
  assert.equal(r.toolCalls[0].input.method, 'listLeads');
  assert.equal(r.stopReason, 'tool_use');
  assert.equal(prov.calls[0].tools.length, 1, 'las tools viajan al proveedor');
});

test('completeWithTools: en modo simulado responde texto sin toolCalls', async () => {
  const gw = new ModelGateway({ providers: {} });
  const r = await gw.completeWithTools({ tier: 'fast', messages: [{ role: 'user', content: 'hola' }], tools: [{ name: 'crm' }] });
  assert.match(r.text, /SIMULADO/);
  assert.deepEqual(r.toolCalls, []);
});

// ── Bucle agéntico ──────────────────────────────────────────────────

test('bucle: acción permitida se ejecuta y su resultado vuelve al modelo', async () => {
  const crm = fakeConnector('crm', { leads: 2 });
  const provider = scriptedProvider([
    toolResponse('crm', { method: 'listLeads', args: {} }),
    textResponse('Hay 2 leads en el CRM.'),
  ]);
  const agent = makeAgent({ provider, tools: { crm } });

  const out = await agent.thinkAndAct('¿Cuántos leads tenemos?');
  assert.equal(out.text, 'Hay 2 leads en el CRM.');
  assert.equal(out.turns, 2);
  assert.equal(crm.executed.length, 1, 'el conector se ejecutó de verdad');
  assert.deepEqual(out.actions, [{ tool: 'crm', method: 'listLeads', status: 'executed' }]);

  // El resultado de la herramienta volvió al modelo como tool_result:
  const secondCall = provider.calls[1];
  const toolResultMsg = secondCall.messages.at(-1);
  assert.equal(toolResultMsg.role, 'user');
  assert.equal(toolResultMsg.content[0].type, 'tool_result');
  assert.match(toolResultMsg.content[0].content, /leads/);
});

test('bucle: email en frío = línea roja → espera al humano y ejecuta tras aprobar', async () => {
  const email = fakeConnector('email');
  const hitl = new HITLGate({});
  // Humano automático: aprueba lo primero que llegue.
  hitl.notify = ({ approvalId }) => setImmediate(() => hitl.resolve(approvalId, true, 'ok, envíalo'));

  const provider = scriptedProvider([
    toolResponse('email', { method: 'send', args: { to: 'dir@puerto.es', subject: 'Propuesta', body: '...', cold: true } }),
    textResponse('Email enviado tras aprobación.'),
  ]);
  const agent = makeAgent({ provider, tools: { email }, hitl });

  const out = await agent.thinkAndAct('Contacta en frío al director del puerto');
  assert.equal(out.text, 'Email enviado tras aprobación.');
  assert.equal(email.executed.length, 1, 'se ejecutó DESPUÉS del sí humano');
});

test('bucle: rechazo humano NO ejecuta y se realimenta al modelo', async () => {
  const email = fakeConnector('email');
  const hitl = new HITLGate({});
  hitl.notify = ({ approvalId }) => setImmediate(() => hitl.resolve(approvalId, false, 'no contactar a ese cliente'));

  const provider = scriptedProvider([
    toolResponse('email', { method: 'send', args: { to: 'x@y.z', subject: 's', cold: true } }),
    textResponse('Entendido, no envío el correo y propongo otro plan.'),
  ]);
  const agent = makeAgent({ provider, tools: { email }, hitl });

  const out = await agent.thinkAndAct('Contacta en frío');
  assert.equal(email.executed.length, 0, 'NUNCA se ejecutó');
  assert.deepEqual(out.actions, [{ tool: 'email', method: 'send', status: 'rejected' }]);

  // El modelo recibió el rechazo (con la nota del humano) como tool_result:
  const feedback = provider.calls[1].messages.at(-1).content[0].content;
  assert.match(feedback, /rejected/);
  assert.match(feedback, /no contactar/);
  assert.match(out.text, /otro plan/);
});

test('bucle: un error del conector no rompe el bucle, vuelve como resultado', async () => {
  const crm = { name: 'crm', async execute() { throw new Error('CRM caído'); } };
  const provider = scriptedProvider([
    toolResponse('crm', { method: 'listLeads', args: {} }),
    textResponse('El CRM no responde, lo reintentaré más tarde.'),
  ]);
  const agent = makeAgent({ provider, tools: { crm } });

  const out = await agent.thinkAndAct('lista leads');
  assert.deepEqual(out.actions, [{ tool: 'crm', method: 'listLeads', status: 'error' }]);
  assert.match(provider.calls[1].messages.at(-1).content[0].content, /CRM caído/);
});

test('bucle: respeta maxTurns y lo marca como exhausted', async () => {
  const crm = fakeConnector('crm');
  const provider = scriptedProvider([
    toolResponse('crm', { method: 'listLeads', args: {} }), // siempre pide otra herramienta
  ]);
  const agent = makeAgent({ provider, tools: { crm } });

  const out = await agent.thinkAndAct('bucle infinito', { maxTurns: 3 });
  assert.equal(out.exhausted, true);
  assert.equal(out.turns, 3);
  assert.equal(crm.executed.length, 3);
});

test('sin conectores, thinkAndAct degrada a think() (solo texto)', async () => {
  const provider = scriptedProvider([textResponse('respuesta directa')]);
  const agent = makeAgent({ provider, tools: {} });
  const out = await agent.thinkAndAct('hola');
  assert.equal(out.text, 'respuesta directa');
  assert.deepEqual(out.actions, []);
});
