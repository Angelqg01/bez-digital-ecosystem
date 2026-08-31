'use strict';

/**
 * HITL robusto: timeout duro, escalado a un segundo canal antes del timeout,
 * y que una decisión humana tardía (llegada después del timeout) no se
 * pierda en silencio — queda auditada como voto tardío en vez de devolver
 * "ID desconocido" indistinguible de un error.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const AuditLog = require('../src/guardrails/AuditLog');
const HITLGate = require('../src/core/HITLGate');
const HitlNotifier = require('../src/platform/HitlNotifier');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeAudit() {
  const events = [];
  return { events, log: (e) => { events.push(e); return e; } };
}

test('timeout: la espera se cancela sola (no queda colgada) y equivale a un rechazo', async () => {
  const bus = new EventBus('acme');
  const busEvents = [];
  bus.on('hitl:resolved', (e) => busEvents.push(e));
  const audit = makeAudit();
  const hitl = new HITLGate({ bus, audit, timeoutMs: 30 });

  const decision = await hitl.request({ tenantId: 'acme', agentId: 'finance.ar-chaser', action: { category: 'payment' }, reason: 'cobro' });

  assert.equal(decision.approved, false);
  assert.equal(decision.timedOut, true);
  assert.match(decision.note, /timeout/);
  assert.equal(hitl.listPending('acme').length, 0, 'no debe quedar en la bandeja tras el timeout');
  assert.ok(busEvents.some((e) => e.status === 'timeout'), 'hitl:resolved debe emitirse también en timeout');
  assert.ok(audit.events.some((e) => e.event === 'hitl:resolved' && e.status === 'timeout'));
});

test('timeout: no rompe el flujo de BaseAgent.act (se resuelve, no lanza)', async () => {
  const BaseAgent = require('../src/agents/BaseAgent');
  const PolicyEngine = require('../src/guardrails/PolicyEngine');
  const bus = new EventBus('acme');
  const audit = makeAudit();
  const hitl = new HITLGate({ bus, audit, timeoutMs: 30 });
  const guardrails = new PolicyEngine({ tenantId: 'acme', plan: 'pro' });
  const payment = { calls: [], async execute(method, args) { this.calls.push({ method, args }); return { sent: true }; } };
  const agent = new BaseAgent({ id: 'finance.ar-chaser', tenantId: 'acme', guardrails, hitl, tools: { payment } });

  const result = await agent.act({ category: 'payment', tool: 'payment', method: 'send', args: {} });
  assert.equal(result.status, 'rejected');
  assert.equal(result.timedOut, true);
  assert.equal(payment.calls.length, 0, 'nunca se ejecuta sola por silencio');
});

test('escalado: dispara un segundo aviso antes del timeout duro, sin cancelar la espera', async () => {
  const bus = new EventBus('acme');
  const busEvents = [];
  bus.on('hitl:escalated', (e) => busEvents.push(e));
  const audit = makeAudit();
  const escalations = [];
  const hitl = new HITLGate({
    bus, audit,
    escalateAfterMs: 20,
    timeoutMs: 200,
    onEscalate: (a) => { escalations.push(a); },
  });

  const pending = hitl.request({ tenantId: 'acme', agentId: 'sales.negotiator', action: { category: 'contract' }, reason: 'firma' });
  await wait(60); // pasado el escalado, antes del timeout

  assert.equal(escalations.length, 1, 'debe haber escalado una vez');
  assert.equal(hitl.listPending('acme').length, 1, 'sigue pendiente: el escalado no cancela la espera');
  assert.equal(busEvents.length, 1);

  // La resuelve un humano tras el aviso escalado: debe seguir funcionando normal.
  const [appr] = hitl.listPending('acme');
  hitl.resolve(appr.approvalId, true, 'aprobado tras escalar');
  const decision = await pending;
  assert.equal(decision.approved, true);
});

test('escalado: no dispara dos veces ni sobrevive a una resolución antes de tiempo', async () => {
  const bus = new EventBus('acme');
  const audit = makeAudit();
  const escalations = [];
  const hitl = new HITLGate({ bus, audit, escalateAfterMs: 30, timeoutMs: 0, onEscalate: (a) => escalations.push(a) });

  const pending = hitl.request({ tenantId: 'acme', agentId: 'sales.negotiator', action: {}, reason: 'x' });
  const [appr] = hitl.listPending('acme');
  hitl.resolve(appr.approvalId, true); // resuelto ANTES de que el escalado dispare
  await pending;

  await wait(60); // si el timer de escalado no se limpió, dispararía aquí
  assert.equal(escalations.length, 0, 'una resolución a tiempo debe cancelar el escalado pendiente');
});

test('voto tardío: una decisión que llega DESPUÉS del timeout no se pierde en silencio', async () => {
  const bus = new EventBus('acme');
  const audit = makeAudit();
  const hitl = new HITLGate({ bus, audit, timeoutMs: 20 });

  await hitl.request({ tenantId: 'acme', agentId: 'finance.ar-chaser', action: { category: 'payment' }, reason: 'cobro' });
  const [{ approvalId }] = (() => {
    // approvalId ya no está en listPending tras el timeout; lo recuperamos del audit.
    const req = audit.events.find((e) => e.event === 'hitl:requested');
    return [{ approvalId: req.approvalId }];
  })();

  // El humano llega tarde, ya con la acción cancelada por timeout.
  const ok = hitl.resolve(approvalId, true, 'perdón la tardanza, apruebo igual');
  assert.equal(ok, true, 'no debe devolver false como si el ID no existiera');
  assert.ok(audit.events.some((e) => e.event === 'hitl:late-decision' && e.approvalId === approvalId));
});

test('peek() marca alreadyResolved con el estado final tras un timeout', async () => {
  const bus = new EventBus('acme');
  const audit = makeAudit();
  const hitl = new HITLGate({ bus, audit, timeoutMs: 20 });
  const req = audit; // solo para capturar el approvalId más abajo

  await hitl.request({ tenantId: 'acme', agentId: 'finance.ar-chaser', action: {}, reason: 'x' });
  const { approvalId } = req.events.find((e) => e.event === 'hitl:requested');

  const p = hitl.peek(approvalId);
  assert.equal(p.alreadyResolved, true);
  assert.equal(p.status, 'timeout');
});

test('HitlNotifier.escalate manda SIEMPRE al fallback, no a la ruta original', async () => {
  const sent = { finance: [], ceo: [] };
  const notifier = new HitlNotifier({
    routes: { finance: { send: async (m) => { sent.finance.push(m); return { sent: true }; }, chatId: 'CFO' } },
    fallback: { send: async (m) => { sent.ceo.push(m); return { sent: true }; }, chatId: 'CEO' },
  });

  const r = await notifier.escalate({ approvalId: 'a1', tenantId: 'acme', agentId: 'finance.ar-chaser', action: { category: 'payment' }, reason: 'cobro' });
  assert.equal(r.sent, true);
  assert.equal(sent.finance.length, 0, 'no reintenta el mismo canal que ya ignoró el aviso');
  assert.equal(sent.ceo.length, 1);
  assert.match(sent.ceo[0].text, /SIN RESPUESTA/);
});

test('HitlNotifier.escalate sin fallback configurado no rompe', async () => {
  const notifier = new HitlNotifier({ routes: {}, fallback: null });
  const r = await notifier.escalate({ approvalId: 'a1', tenantId: 'acme' });
  assert.equal(r.sent, false);
});

test('integración: TenantManager engancha timeout/escalado desde su config', async () => {
  const TenantManager = require('../src/core/TenantManager');
  const firstNotices = [];
  const escalations = [];
  const hitlNotifier = new HitlNotifier({
    // Ruta propia para 'sales' distinta del fallback: así el 1er aviso
    // (notify, al pedir la aprobación) no se confunde con el escalado
    // (que va SIEMPRE al fallback) en las aserciones de abajo.
    routes: { sales: { send: async (m) => { firstNotices.push(m); return { sent: true }; }, chatId: 'SALES' } },
    fallback: { send: async (m) => { escalations.push(m); return { sent: true }; }, chatId: 'CEO' },
  });
  const tenants = new TenantManager({ hitlNotifier, hitlTimeoutMs: 200, hitlEscalateAfterMs: 20 });
  const space = await tenants.provision({ tenantId: 'acme', plan: 'pro', departments: [] });

  const pending = space.hitl.request({ tenantId: 'acme', agentId: 'sales.negotiator', action: { category: 'contract' }, reason: 'firma' });
  await wait(60);
  assert.equal(escalations.length, 1, 'el escalado configurado a nivel de tenant debe disparar el aviso');

  const [appr] = space.hitl.listPending('acme');
  space.hitl.resolve(appr.approvalId, true);
  await pending;
});
