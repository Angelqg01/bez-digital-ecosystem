'use strict';

/**
 * Tests del vertical de Soporte: recuperación de la KnowledgeBase y el pipeline
 * completo del escuadrón (triage → KB → resolver → escalado) en modo simulado.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const KnowledgeBase = require('../src/platform/KnowledgeBase');
const SupportManager = require('../src/agents/support/SupportManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const MemoryManager = require('../src/cognition/MemoryManager');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const EventBus = require('../src/core/EventBus');

// ── KnowledgeBase ───────────────────────────────────────────────

test('KnowledgeBase: recupera el artículo relevante y descarta lo que no encaja', async () => {
  const kb = new KnowledgeBase({ tenantId: 'acme' });
  await kb.ingest({ title: 'Configurar notificaciones', body: 'Ve a Ajustes > Notificaciones y activa el correo para recibir avisos por email.', tags: ['notificaciones', 'email'] });
  await kb.ingest({ title: 'Política de reembolsos', body: 'Los reembolsos se tramitan en 14 días desde facturación.', tags: ['facturación'] });

  const hits = await kb.search('¿cómo activo las notificaciones por email?');
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].title, 'Configurar notificaciones', 'el más relevante primero');

  assert.equal((await kb.search('xyzzy términos inexistentes')).length, 0);
});

// ── Escuadrón de Soporte ────────────────────────────────────────

function buildSupport() {
  const tenantId = 'acme';
  const knowledgeBase = new KnowledgeBase({ tenantId });
  const ctx = {
    tenantId,
    model: new ModelGateway({ providers: {} }), // simulado
    memory: new MemoryManager({ tenantId }),
    guardrails: new PolicyEngine({ tenantId, plan: 'pro' }),
    knowledgeBase,
    bus: new EventBus(tenantId),
  };
  return { manager: new SupportManager(ctx), knowledgeBase, bus: ctx.bus };
}

test('consulta resuelta por la KB: no escala', async () => {
  const { manager, knowledgeBase } = buildSupport();
  await knowledgeBase.ingest({ title: 'Configurar notificaciones', body: 'Activa el correo en Ajustes > Notificaciones para recibir avisos por email.', tags: ['email'] });

  const out = await manager.run({ type: 'support:ticket', payload: { text: '¿Cómo activo las notificaciones por email?', customerId: 'c1' } });

  assert.equal(out.triage.category, 'howto');
  assert.equal(out.kb.grounded, true, 'la KB fundamenta la respuesta');
  assert.equal(out.resolution.escalate, false);
  assert.equal(out.escalation, null);
  assert.equal(out.outcome, 'ok');
});

test('incidencia urgente/negativa: escala al humano y notifica por el bus', async () => {
  const { manager, bus } = buildSupport(); // KB vacía
  const escalations = [];
  bus.on('support:escalated', (e) => escalations.push(e));

  const out = await manager.run({ type: 'support:ticket', payload: { text: '¡La app no funciona, es urgente y estoy harto!', customerId: 'c9' } });

  assert.equal(out.triage.category, 'technical');
  assert.equal(out.triage.priority, 'high');
  assert.equal(out.triage.sentiment, 'negative');
  assert.equal(out.resolution.escalate, true);
  assert.ok(out.escalation, 'hay paquete de escalado');
  assert.equal(out.escalation.status, 'pending_human');
  assert.equal(out.outcome, 'escalated');
  assert.equal(escalations.length, 1, 'se notificó el escalado en el bus');
  assert.equal(escalations[0].customerId, 'c9');
});

test('consulta sin base de conocimiento: escala por falta de fundamento', async () => {
  const { manager } = buildSupport(); // KB vacía
  const out = await manager.run({ type: 'support:ticket', payload: { text: '¿Tenéis integración con SAP?', customerId: 'c2' } });

  assert.equal(out.kb.grounded, false);
  assert.equal(out.resolution.escalate, true);
  assert.match(out.resolution.reason, /sin base de conocimiento/);
});

test('regresión: un VectorDB presente pero VACÍO no tapa a la KnowledgeBase', async () => {
  // Bug real encontrado en vivo: el chat prefería el vectordb, que devolvía
  // 0 hits sin error, y nunca caía a la KB que SÍ tenía el artículo.
  const tenantId = 'acme';
  const knowledgeBase = new KnowledgeBase({ tenantId });
  await knowledgeBase.ingest({ title: 'Configurar notificaciones', body: 'Activa el correo en Ajustes > Notificaciones para recibir avisos por email.', tags: ['email'] });

  const vectordbVacio = { name: 'vectordb', async execute() { return []; } };
  const manager = new SupportManager({
    tenantId,
    model: new ModelGateway({ providers: {} }),
    memory: new MemoryManager({ tenantId }),
    guardrails: new PolicyEngine({ tenantId, plan: 'pro' }),
    knowledgeBase,
    bus: new EventBus(tenantId),
    tools: { vectordb: vectordbVacio },
  });

  const out = await manager.run({ type: 'support:ticket', payload: { text: '¿Cómo activo las notificaciones por email?', customerId: 'c7' } });
  assert.equal(out.kb.grounded, true, 'la KB debe fundamentar aunque el vectordb esté vacío');
  assert.equal(out.resolution.escalate, false);
});
