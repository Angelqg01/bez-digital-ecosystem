'use strict';

/**
 * Tests del canal de entrada: normalización del WebChannel, espera de resultado
 * (waitForTask) y la vía síncrona end-to-end (canal → orquestador → Soporte).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const WebChannel = require('../src/channels/WebChannel');
const Orchestrator = require('../src/core/Orchestrator');
const EventBus = require('../src/core/EventBus');
const TenantManager = require('../src/core/TenantManager');
const ModelGateway = require('../src/cognition/ModelGateway');

// ── WebChannel ──────────────────────────────────────────────────

test('WebChannel.parseInbound normaliza y exige texto', () => {
  const web = new WebChannel();
  const input = web.parseInbound({ text: '  hola  ', sessionId: 's1' });
  assert.deepEqual(input, { text: 'hola', customerId: 's1', channel: 'web', meta: {} });

  assert.throws(() => web.parseInbound({ text: '   ' }), /falta "text"/);
});

test('WebChannel.formatOutbound extrae la respuesta y la marca de escalado', () => {
  const web = new WebChannel();
  const resuelto = web.formatOutbound({ id: 't1', status: 'completed', result: { outcome: 'ok', resolution: { reply: 'Aquí tienes los pasos.' } } });
  assert.equal(resuelto.reply, 'Aquí tienes los pasos.');
  assert.equal(resuelto.escalated, false);

  const escalado = web.formatOutbound({ id: 't2', status: 'completed', result: { outcome: 'escalated', resolution: { reply: 'Un humano lo revisará.' } } });
  assert.equal(escalado.escalated, true);
});

// ── waitForTask ─────────────────────────────────────────────────

test('waitForTask resuelve cuando la tarea termina', async () => {
  const orch = new Orchestrator({ tenantId: 'acme', bus: new EventBus('acme'), audit: { log() {} } });
  const p = orch.waitForTask('t1', { timeoutMs: 1000 });
  orch.bus.emit('task:completed', { id: 't1', status: 'completed' });
  const task = await p;
  assert.equal(task.status, 'completed');
});

test('waitForTask expira si la tarea nunca termina', async () => {
  const orch = new Orchestrator({ tenantId: 'acme', bus: new EventBus('acme'), audit: { log() {} } });
  await assert.rejects(() => orch.waitForTask('nunca', { timeoutMs: 30 }), /timeout/);
});

// ── End-to-end síncrono (canal web → orquestador → Soporte) ─────

async function tenantWithSupport() {
  const tenants = new TenantManager({ modelGateway: new ModelGateway({ providers: {} }) }); // simulado
  await tenants.provision({ tenantId: 'acme', plan: 'pro', departments: ['support'], tools: {} });
  return tenants;
}

test('vía síncrona: consulta resuelta por la KB devuelve respuesta sin escalar', async () => {
  const tenants = await tenantWithSupport();
  await tenants.get('acme').knowledgeBase.ingest({
    title: 'Restablecer contraseña',
    body: 'Para restablecer tu contraseña ve a Login, pulsa "He olvidado mi contraseña" y sigue el enlace del email.',
    tags: ['login', 'contraseña'],
  });

  const web = new WebChannel();
  const input = web.parseInbound({ text: '¿Cómo restablezco mi contraseña?', sessionId: 'c1' });
  const task = await tenants.handleAndWait('acme', input, { timeoutMs: 5000 });

  assert.equal(task.status, 'completed');
  assert.equal(task.department, 'support');
  assert.equal(task.result.outcome, 'ok');
  const out = web.formatOutbound(task);
  assert.equal(out.escalated, false);
  assert.ok(out.reply.length > 0);
});

test('vía síncrona: incidencia urgente escala al humano', async () => {
  const tenants = await tenantWithSupport();
  const task = await tenants.handleAndWait('acme', { text: 'la app no funciona y es urgente', channel: 'web', customerId: 'c2' }, { timeoutMs: 5000 });

  assert.equal(task.result.outcome, 'escalated');
  assert.equal(new WebChannel().formatOutbound(task).escalated, true);
});
