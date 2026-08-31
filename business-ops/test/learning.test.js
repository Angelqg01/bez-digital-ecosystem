'use strict';

/**
 * LearningEngine: cierra el bucle "aprender de cada interacción".
 * Contratos:
 *  - destila un playbook de la memoria episódica y lo persiste;
 *  - sin datos suficientes no inventa nada;
 *  - el playbook persistido se reinyecta en los prompts del agente;
 *  - sobrevive a reinicios (fact del tenant).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LearningEngine = require('../src/cognition/LearningEngine');
const MemoryManager = require('../src/cognition/MemoryManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const SqliteStore = require('../src/platform/SqliteStore');
const BaseAgent = require('../src/agents/BaseAgent');
const PolicyEngine = require('../src/guardrails/PolicyEngine');

function tempDb(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-')), `${name}.db`);
}

test('bucket clasifica outcomes en positivo / atención / neutro', () => {
  assert.equal(LearningEngine.bucket('ok'), 'positivo');
  assert.equal(LearningEngine.bucket('escalated'), 'atencion');
  assert.equal(LearningEngine.bucket('rejected'), 'atencion');
  assert.equal(LearningEngine.bucket('algo'), 'neutro');
});

test('sin datos suficientes no destila (no inventa)', async () => {
  const memory = new MemoryManager({ tenantId: 'acme' });
  const eng = new LearningEngine({ memory, model: new ModelGateway({ providers: {} }), tenantId: 'acme' });
  await memory.store({ agentId: 'sales.outreach', summary: 'un caso', outcome: 'ok' });
  const r = await eng.cycle('sales.outreach');
  assert.equal(r.updated, false);
  assert.match(r.reason, /suficientes/);
});

test('destila un playbook con métricas y lo persiste', async () => {
  const memory = new MemoryManager({ tenantId: 'acme' });
  const eng = new LearningEngine({ memory, model: new ModelGateway({ providers: {} }), tenantId: 'acme' });
  for (let i = 0; i < 4; i++) await memory.store({ agentId: 'support.manager', summary: `resuelto con KB #${i}`, outcome: 'ok' });
  for (let i = 0; i < 2; i++) await memory.store({ agentId: 'support.manager', summary: `escalado urgente #${i}`, outcome: 'escalated' });

  const r = await eng.cycle('support.manager');
  assert.equal(r.updated, true);
  assert.equal(r.metrics.total, 6);
  assert.equal(r.metrics.resueltoSolo, 4);
  assert.equal(r.metrics.requirioAtencion, 2);
  assert.equal(r.metrics.tasaAutonomia, 0.67);

  const pb = await eng.getPlaybook('support.manager');
  assert.ok(pb && pb.text.length > 0, 'el playbook queda persistido');
});

test('el playbook persistido se reinyecta en el prompt del agente', async () => {
  const memory = new MemoryManager({ tenantId: 'acme' });
  await memory.setFact('playbook:test.agent', { text: 'QUÉ FUNCIONA: citar el SLA de 1h.', metrics: {}, at: 't' });

  // Provider espía: captura el system prompt que recibe el modelo.
  let capturedSystem = '';
  const provider = { messages: { create: async ({ system }) => { capturedSystem = system; return { content: [{ type: 'text', text: 'ok' }], usage: {} }; } } };
  const agent = new BaseAgent({
    id: 'test.agent', tenantId: 'acme', department: 'support',
    model: new ModelGateway({ providers: { anthropic: provider } }),
    memory, guardrails: new PolicyEngine({ tenantId: 'acme' }),
    systemPrompt: 'Eres un agente.',
  });

  await agent.think('una consulta');
  assert.match(capturedSystem, /PLAYBOOK APRENDIDO/);
  assert.match(capturedSystem, /SLA de 1h/);
});

test('REINICIO: el playbook sobrevive (fact del tenant en SQLite)', async () => {
  const file = tempDb('learn');
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();
  const mem1 = new MemoryManager({ tenantId: 'acme', store: store1 });
  const eng1 = new LearningEngine({ memory: mem1, model: new ModelGateway({ providers: {} }), tenantId: 'acme' });
  for (let i = 0; i < 3; i++) await mem1.store({ agentId: 'sales.outreach', summary: `caso ${i}`, outcome: 'ok' });
  await eng1.cycle('sales.outreach');
  await store1.disconnect();

  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const mem2 = new MemoryManager({ tenantId: 'acme', store: store2 });
  const eng2 = new LearningEngine({ memory: mem2, tenantId: 'acme' });
  const pb = await eng2.getPlaybook('sales.outreach');
  assert.ok(pb, 'el playbook debe sobrevivir al reinicio');
  await store2.disconnect();
});

test('learnAll recorre agentes y cuenta los actualizados', async () => {
  const memory = new MemoryManager({ tenantId: 'acme' });
  const eng = new LearningEngine({ memory, model: new ModelGateway({ providers: {} }), tenantId: 'acme' });
  for (let i = 0; i < 3; i++) await memory.store({ agentId: 'a', summary: `x${i}`, outcome: 'ok' });
  // 'b' tiene solo 1 → no se actualiza.
  await memory.store({ agentId: 'b', summary: 'y', outcome: 'ok' });

  const r = await eng.learnAll(['a', 'b']);
  assert.equal(r.agents, 2);
  assert.equal(r.updated, 1);
});
