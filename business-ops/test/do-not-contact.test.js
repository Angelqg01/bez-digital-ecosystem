'use strict';

/**
 * DoNotContactList — lista dinámica de "no contactar" a nivel de empresa/deal,
 * y su enganche en OutreachAgent/FollowUpAgent: el fallo caro aquí no es que
 * la lista funcione en aislado, es que un lead en la lista NUNCA llegue a
 * gastar una llamada al modelo ni un envío, y que quede auditado.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const DoNotContactList = require('../src/platform/DoNotContactList');
const OutreachAgent = require('../src/agents/sales/OutreachAgent');
const FollowUpAgent = require('../src/agents/sales/FollowUpAgent');
const ModelGateway = require('../src/cognition/ModelGateway');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const AuditLog = require('../src/guardrails/AuditLog');
const HITLGate = require('../src/core/HITLGate');
const EventBus = require('../src/core/EventBus');
const policy = require('../src/platform/followUpPolicy');

function memoryStore(initial = {}) {
  const facts = new Map(Object.entries(initial));
  const k = (t, key) => `${t}:${key}`;
  return {
    getFact: async ({ tenantId, key }) => facts.get(k(tenantId, key)) ?? null,
    setFact: async ({ tenantId, key, value }) => { facts.set(k(tenantId, key), value); },
  };
}

test('add() exige empresa o dominio', () => {
  const dnc = new DoNotContactList({ tenantId: 'acme' });
  assert.throws(() => dnc.add({}), /company o domain requerido/);
});

test('isListed: por nombre de empresa (substring, igual que BusinessProfile.isExcluded)', () => {
  const dnc = new DoNotContactList({ tenantId: 'acme' });
  dnc.add({ company: 'globex', reason: 'pidió que no le escriban más' });
  assert.ok(dnc.isListed({ company: 'Globex Corporation' }));
  assert.equal(dnc.isListed({ company: 'Initech' }), null);
});

test('isListed: por dominio de email (coincidencia exacta)', () => {
  const dnc = new DoNotContactList({ tenantId: 'acme' });
  dnc.add({ domain: 'globex.com' });
  assert.ok(dnc.isListed({ email: 'compras@globex.com' }));
  assert.equal(dnc.isListed({ email: 'compras@notglobex.com' }), null, 'no debe hacer match parcial de dominio');
});

test('remove() por key, list() y persistencia entre instancias (mismo store)', async () => {
  const store = memoryStore();
  const before = new DoNotContactList({ tenantId: 'acme', store });
  const entry = before.add({ company: 'Globex', reason: 'x' });
  assert.equal(before.list().length, 1);

  const after = new DoNotContactList({ tenantId: 'acme', store });
  await after.hydrate();
  assert.equal(after.list().length, 1);
  assert.equal(after.list()[0].company, 'Globex');

  const removed = after.remove(entry.key);
  assert.equal(removed, true);
  assert.equal(after.list().length, 0);
  assert.equal(after.remove('no-existe'), false);
});

function outreachCtx({ doNotContact = null, business = null, audit = null } = {}) {
  const store = memoryStore();
  return {
    tenantId: 'acme', department: 'sales',
    model: new ModelGateway({ providers: {} }), // modo simulado: no debe ni llegar a llamarse
    guardrails: new PolicyEngine({ tenantId: 'acme', audit }),
    hitl: new HITLGate({}),
    bus: new EventBus('acme'),
    tools: {},
    doNotContact,
    business,
    store,
  };
}

test('OutreachAgent: un lead en la lista de no-contactar se bloquea SIN llamar al modelo', async () => {
  const dnc = new DoNotContactList({ tenantId: 'acme' });
  dnc.add({ company: 'globex', reason: 'baja explícita' });

  const ctx = outreachCtx({ doNotContact: dnc });
  let modelCalled = false;
  ctx.model.complete = async () => { modelCalled = true; return { text: '', usage: {} }; };
  const agent = new OutreachAgent(ctx);

  const result = await agent.run({ type: 'sales:hunt', payload: { lead: { company: 'Globex Corp', email: 'c@globex.com' } } });
  assert.equal(result.status, 'blocked');
  assert.match(result.reason, /no-contactar/);
  assert.match(result.reason, /baja explícita/);
  assert.equal(modelCalled, false, 'no debe gastar una llamada al modelo en un lead vetado');
});

test('OutreachAgent: el bloqueo por DNC queda auditado en el guardrails', async () => {
  const audit = new AuditLog({ tenantId: 'acme' });
  const dnc = new DoNotContactList({ tenantId: 'acme' });
  dnc.add({ company: 'globex' });

  const ctx = outreachCtx({ doNotContact: dnc, audit });
  const agent = new OutreachAgent(ctx);
  await agent.run({ type: 'sales:hunt', payload: { lead: { company: 'Globex Corp' } } });

  const decisions = audit.query({ event: 'policy:decision' });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].decision, 'blocked');
  assert.equal(decisions[0].rule, 'excluded_account');
});

test('OutreachAgent: un lead que NO está en la lista sigue su curso normal', async () => {
  const dnc = new DoNotContactList({ tenantId: 'acme' });
  dnc.add({ company: 'globex' });

  const ctx = outreachCtx({ doNotContact: dnc });
  // 'sales:inbound' → cold:false → no cruza la línea roja cold_outbound, así
  // que no hace falta un humano decidiendo en el test (bastante con un email fake).
  ctx.tools.email = { execute: async () => ({ sent: true }) };
  const agent = new OutreachAgent(ctx);
  const result = await agent.run({ type: 'sales:inbound', payload: { lead: { company: 'Initech', email: 'c@initech.com' } } });

  assert.notEqual(result.status, 'blocked');
  assert.equal(result.send.sent, true);
});

test('FollowUpAgent: deja de insistir si el lead entra en DNC a mitad de secuencia', async () => {
  const store = memoryStore();
  const dnc = new DoNotContactList({ tenantId: 'acme' });
  dnc.add({ domain: 'globex.com' });

  const lead = { company: 'Globex', email: 'c@globex.com' };
  const leadKey = lead.email.toLowerCase();
  // Secuencia ya abierta (como si el primer contacto hubiera salido antes de la baja).
  await policy.saveOne({ store, tenantId: 'acme', leadKey, state: policy.start({ leadKey }) });

  const ctx = {
    tenantId: 'acme', department: 'sales',
    model: new ModelGateway({ providers: {} }),
    guardrails: new PolicyEngine({ tenantId: 'acme' }),
    hitl: new HITLGate({}),
    bus: new EventBus('acme'),
    tools: {},
    doNotContact: dnc,
    store,
  };
  const agent = new FollowUpAgent(ctx);
  const result = await agent.run({ type: 'sales:followup', payload: { lead } });

  assert.equal(result.status, 'blocked');
  assert.match(result.reason, /no-contactar/);
});
