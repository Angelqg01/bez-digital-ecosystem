'use strict';

/**
 * Tests del bucle HITL (human-in-the-loop) end-to-end a nivel de agente.
 *
 * Verifican que una acción que cruza una línea roja:
 *   1. se BLOQUEA esperando aprobación (no se ejecuta sola),
 *   2. se EJECUTA al aprobarla,
 *   3. NO se ejecuta al rechazarla,
 * y que una acción normal pasa sin fricción.
 *
 * Sin frameworks: usa el runner nativo `node --test`.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const HITLGate = require('../src/core/HITLGate');
const AuditLog = require('../src/guardrails/AuditLog');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const BaseAgent = require('../src/agents/BaseAgent');

/** Conector falso que registra cada ejecución para poder verificarla. */
function makeFakeTool() {
  const calls = [];
  return {
    calls,
    async execute(method, args) {
      calls.push({ method, args });
      return { sent: true, method };
    },
  };
}

/** Monta un agente real con guardrails + gate reales y un conector falso. */
function setup() {
  const tenantId = 'acme';
  const bus = new EventBus(tenantId);
  const audit = new AuditLog({ tenantId });
  const guardrails = new PolicyEngine({ tenantId, plan: 'pro' });
  const hitl = new HITLGate({ bus, audit });
  const payment = makeFakeTool();
  const crm = makeFakeTool(); // herramienta inofensiva (no cruza líneas rojas)

  const agent = new BaseAgent({
    id: 'finance.ar-chaser',
    department: 'finance',
    tenantId,
    guardrails,
    hitl,
    bus,
    tools: { payment, crm },
  });

  return { agent, hitl, payment, crm, bus };
}

test('acción de línea roja: se ejecuta tras la APROBACIÓN humana', async () => {
  const { agent, hitl, payment } = setup();

  // 'payment' cruza la línea roja money_movement → debe bloquear.
  const pending = agent.act({ category: 'payment', tool: 'payment', method: 'send', args: { amount: 100 } });

  // El gate ya registró la solicitud de forma síncrona (antes del primer await).
  const inbox = hitl.listPending('acme');
  assert.equal(inbox.length, 1, 'debe haber exactamente 1 aprobación pendiente');
  assert.equal(payment.calls.length, 0, 'NO debe ejecutarse antes de aprobar');

  // Un humano aprueba desde el panel.
  const resolved = hitl.resolve(inbox[0].approvalId, true, 'ok, adelante');
  assert.equal(resolved, true);

  const result = await pending;
  assert.equal(result.sent, true, 'tras aprobar, la acción se ejecuta');
  assert.equal(payment.calls.length, 1, 'el conector se llamó una vez');
});

test('acción de línea roja: NO se ejecuta si se RECHAZA', async () => {
  const { agent, hitl, payment } = setup();

  const pending = agent.act({ category: 'payment', tool: 'payment', method: 'send', args: { amount: 100 } });
  const [appr] = hitl.listPending('acme');
  hitl.resolve(appr.approvalId, false, 'importe sospechoso');

  const result = await pending;
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'importe sospechoso');
  assert.equal(payment.calls.length, 0, 'el conector NUNCA se llamó');
});

test('acción normal (sin línea roja): se ejecuta directamente', async () => {
  const { agent, hitl, crm } = setup();

  // categoría 'note' + herramienta 'crm' → no sensible → pasa sin aprobación.
  const result = await agent.act({ category: 'note', tool: 'crm', method: 'log', args: {} });
  assert.equal(result.sent, true);
  assert.equal(crm.calls.length, 1);
  assert.equal(hitl.listPending('acme').length, 0, 'no debe generar aprobaciones');
});

test('emite hitl:pending en el bus para el panel', async () => {
  const { agent, hitl, bus } = setup();
  const events = [];
  bus.on('hitl:pending', (e) => events.push(e));

  const pending = agent.act({ category: 'transfer', tool: 'payment', method: 'send', args: {} });
  assert.equal(events.length, 1, 'debe notificar al panel');
  assert.ok(events[0].approvalId, 'el evento lleva el approvalId');

  hitl.resolve(events[0].approvalId, true);
  await pending;
});

test('sin gate HITL: la acción queda pendiente, nunca se ejecuta sola', async () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme', plan: 'pro' });
  const payment = makeFakeTool();
  const agent = new BaseAgent({ id: 'x', tenantId: 'acme', guardrails, tools: { payment } }); // sin hitl

  const result = await agent.act({ category: 'payment', tool: 'payment', method: 'send', args: {} });
  assert.equal(result.status, 'pending_approval');
  assert.equal(payment.calls.length, 0, 'fallback seguro: no se ejecuta sin gate');
});

test('Un aviso que falla NO tumba la plataforma, y la aprobación sigue viva', async () => {
  // Pasó de verdad: `getaddrinfo ENOTFOUND api.telegram.org` durante una
  // ejecución del embudo. La promesa rechazada sin capturar mató el proceso de
  // Node entero, con todas las tareas en vuelo dentro. El aviso sale a la red
  // y la red falla; eso no puede ser fatal.
  const rechazos = [];
  const capturar = (err) => rechazos.push(err);
  process.on('unhandledRejection', capturar);

  const gate = new HITLGate({
    tenantId: 'acme',
    notify: async () => { throw new Error('fetch failed: ENOTFOUND api.telegram.org'); },
  });

  const espera = gate.request({ tenantId: 'acme', agentId: 'sales.outreach', action: { tool: 'email', method: 'send' }, reason: 'frío' });

  // Deja correr la microcola para que el rechazo, de haberlo, aflore.
  await new Promise((r) => setTimeout(r, 20));
  process.off('unhandledRejection', capturar);
  assert.deepEqual(rechazos, [], 'un aviso fallido no puede dejar una promesa rechazada sin capturar');

  // Y lo importante: la aprobación sigue en la bandeja, decidible.
  const pendientes = gate.listPending('acme');
  assert.equal(pendientes.length, 1, 'la aprobación sigue pendiente aunque el aviso no llegara');

  gate.resolve(pendientes[0].approvalId, false, 'cerrada en el test');
  const decision = await espera;
  assert.equal(decision.approved, false);
});
