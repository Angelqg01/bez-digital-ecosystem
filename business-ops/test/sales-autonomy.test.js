'use strict';

/**
 * SalesAutonomy — el "autonomy dial" del Escuadrón de Ventas.
 *
 * Lo crítico a probar no es que cambie overrides (eso ya lo cubre
 * test/policies.test.js): es que NUNCA consigue tocar una línea roja
 * (cold_outbound sigue pidiendo aprobación en full_auto) y que distingue
 * lectura de escritura dentro de la misma categoría (calendar/crm) gracias
 * al override específico por método.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const SalesAutonomy = require('../src/platform/SalesAutonomy');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const AuditLog = require('../src/guardrails/AuditLog');

function memoryStore(initial = {}) {
  const facts = new Map(Object.entries(initial));
  const k = (t, key) => `${t}:${key}`;
  return {
    getFact: async ({ tenantId, key }) => facts.get(k(tenantId, key)) ?? null,
    setFact: async ({ tenantId, key, value }) => { facts.set(k(tenantId, key), value); },
  };
}

test('sin hydrate()/set(), no toca los overrides del guardrails', () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  new SalesAutonomy({ tenantId: 'acme', guardrails });
  assert.deepEqual(guardrails.getOverrides(), {});
});

test('hydrate() sin store aplica el nivel por defecto (assist)', async () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  const autonomy = new SalesAutonomy({ tenantId: 'acme', guardrails });
  await autonomy.hydrate();

  assert.equal(autonomy.level, 'assist');
  assert.equal(guardrails.getOverrides().outbound, 'always_approve');
  assert.equal(guardrails.getOverrides()['calendar:scheduleMeeting'], undefined, 'assist no gatea agendar');
});

test('assist: un envío cálido pide aprobación, pero agendar y sincronizar CRM no', async () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  await new SalesAutonomy({ tenantId: 'acme', guardrails }).hydrate();

  const outbound = guardrails.evaluate({ agentId: 'sales.outreach', action: { category: 'outbound', cold: false } });
  assert.equal(outbound.requiresApproval, true);
  assert.match(outbound.reason, /outbound/);

  const book = guardrails.evaluate({ agentId: 'sales.meeting-booker', action: { category: 'calendar', method: 'scheduleMeeting' } });
  assert.equal(book.allowed, true);

  const crmWrite = guardrails.evaluate({ agentId: 'sales.crm-sync', action: { category: 'crm', method: 'upsertLead' } });
  assert.equal(crmWrite.allowed, true);
});

test('manual: TODO pide aprobación (envío cálido, agendar, escribir en CRM)', () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  const autonomy = new SalesAutonomy({ tenantId: 'acme', guardrails });
  autonomy.set('manual');

  assert.equal(guardrails.evaluate({ action: { category: 'outbound', cold: false } }).requiresApproval, true);
  assert.equal(guardrails.evaluate({ action: { category: 'calendar', method: 'scheduleMeeting' } }).requiresApproval, true);
  assert.equal(guardrails.evaluate({ action: { category: 'crm', method: 'upsertLead' } }).requiresApproval, true);
});

test('manual: gatear "calendar:scheduleMeeting" no gatea "calendar:getAvailability" (lectura vs escritura)', () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  new SalesAutonomy({ tenantId: 'acme', guardrails }).set('manual');

  const read = guardrails.evaluate({ action: { category: 'calendar', method: 'getAvailability' } });
  assert.equal(read.allowed, true, 'consultar disponibilidad es de lectura: no debería bloquearse por el dial');

  const write = guardrails.evaluate({ action: { category: 'calendar', method: 'scheduleMeeting' } });
  assert.equal(write.requiresApproval, true);
});

test('full_auto: nada de lo discrecional pide aprobación', () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  new SalesAutonomy({ tenantId: 'acme', guardrails }).set('full_auto');

  assert.equal(guardrails.evaluate({ action: { category: 'outbound', cold: false } }).allowed, true);
  assert.equal(guardrails.evaluate({ action: { category: 'calendar', method: 'scheduleMeeting' } }).allowed, true);
  assert.equal(guardrails.evaluate({ action: { category: 'crm', method: 'upsertLead' } }).allowed, true);
});

test('full_auto NUNCA toca las líneas rojas: el frío sigue pidiendo aprobación', () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  new SalesAutonomy({ tenantId: 'acme', guardrails }).set('full_auto');

  const cold = guardrails.evaluate({ action: { category: 'outbound', cold: true } });
  assert.equal(cold.requiresApproval, true);
  assert.match(cold.reason, /Línea roja/);

  const payment = guardrails.evaluate({ action: { category: 'payment', method: 'send' } });
  assert.equal(payment.requiresApproval, true);

  const discount = guardrails.evaluate({ action: { category: 'outbound', cold: false, discountPct: 30 } });
  assert.equal(discount.requiresApproval, true, 'un descuento fuerte sigue exigiendo aprobación aunque sea full_auto');
});

test('nivel inválido lanza y no cambia nada', () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  const autonomy = new SalesAutonomy({ tenantId: 'acme', guardrails });
  autonomy.set('assist');
  assert.throws(() => autonomy.set('yolo'), /nivel de autonomía inválido/);
  assert.equal(autonomy.level, 'assist');
});

test('describe() explicita que las líneas rojas no dependen del nivel', () => {
  const guardrails = new PolicyEngine({ tenantId: 'acme' });
  const autonomy = new SalesAutonomy({ tenantId: 'acme', guardrails });
  const d = autonomy.set('full_auto');
  assert.equal(d.level, 'full_auto');
  assert.equal(d.redLinesUnaffected, true);
});

test('set() audita el cambio con el actor (vía PolicyEngine)', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const guardrails = new PolicyEngine({ tenantId: 'acme', audit });
  new SalesAutonomy({ tenantId: 'acme', guardrails }).set('manual', 'admin');

  const sets = audit.query({ event: 'policy:override_set' });
  assert.ok(sets.length >= 3, 'debe auditar cada override que aplica el nivel manual');
  assert.ok(sets.every((s) => s.actor === 'admin'));
});

test('persistencia: un nuevo tenant "reiniciado" recupera el nivel guardado y lo reaplica', async () => {
  const store = memoryStore();

  const g1 = new PolicyEngine({ tenantId: 'acme' });
  await new SalesAutonomy({ tenantId: 'acme', guardrails: g1, store }).hydrate(); // assist por defecto
  const a1 = new SalesAutonomy({ tenantId: 'acme', guardrails: g1, store });
  await a1.hydrate();
  a1.set('manual');

  // "Reinicio": guardrails nuevo (vacío) + instancia nueva, mismo store.
  const g2 = new PolicyEngine({ tenantId: 'acme' });
  const a2 = new SalesAutonomy({ tenantId: 'acme', guardrails: g2, store });
  const level = await a2.hydrate();

  assert.equal(level, 'manual');
  assert.equal(g2.getOverrides().outbound, 'always_approve');
  assert.equal(g2.getOverrides()['calendar:scheduleMeeting'], 'always_approve');
});

test('hydrate() no genera ruido de auditoría si el nivel ya estaba aplicado', () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const guardrails = new PolicyEngine({ tenantId: 'acme', audit });
  const autonomy = new SalesAutonomy({ tenantId: 'acme', guardrails });
  autonomy.set('manual', 'admin');

  const before = audit.query({ event: 'policy:override_set' }).length;
  autonomy._apply(null); // re-aplicar el mismo nivel (equivalente a un 2º hydrate)
  const after = audit.query({ event: 'policy:override_set' }).length;
  assert.equal(after, before, 'no debe reescribir overrides que ya tienen el valor correcto');
});
