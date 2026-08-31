'use strict';

/**
 * Vertical de Ventas end-to-end (campaña AEGIS-Growth, CRM propio Twenty).
 *
 * Verifica el flujo soberano completo sin levantar contenedores:
 *   1. LeadScorer puntúa un puerto de alto tráfico >80 → alta automática en el CRM.
 *   2. LeadScorer puntúa un negocio irrelevante <80 → NO crea lead en el CRM.
 *   3. OutreachAgent redacta en frío → línea roja cold_outbound → espera HITL → se envía al aprobar.
 *   4. OutreachAgent rechazado en HITL → el email NUNCA se envía.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const HITLGate = require('../src/core/HITLGate');
const AuditLog = require('../src/guardrails/AuditLog');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const LeadScorerAgent = require('../src/agents/sales/LeadScorerAgent');
const OutreachAgent = require('../src/agents/sales/OutreachAgent');
const TwentyCRM = require('../src/connectors/TwentyCRM');
const EmailConnector = require('../src/connectors/EmailConnector');

/** ModelGateway falso que devuelve un texto fijo (controla el score). */
function fakeModel(text) {
  return { async complete() { return { text, usage: {}, model: 'fake' }; } };
}

/** Espera a que se vacíe la cola de microtareas (think() resuelve antes del act()). */
async function waitForPending(hitl, tenantId, tries = 20) {
  for (let i = 0; i < tries; i++) {
    if (hitl.listPending(tenantId).length) return hitl.listPending(tenantId);
    await new Promise((r) => setImmediate(r));
  }
  return hitl.listPending(tenantId);
}

function setup(modelText) {
  const tenantId = 'aegis';
  const bus = new EventBus(tenantId);
  const guardrails = new PolicyEngine({ tenantId, plan: 'pro' });
  const hitl = new HITLGate({ bus, audit: new AuditLog({ tenantId }) });
  const crm = new TwentyCRM({ tenantId });           // simulado (sin TWENTY_API_URL)
  const email = new EmailConnector({ tenantId });    // simulado (sin SMTP_HOST)
  const ctx = { tenantId, model: fakeModel(modelText), guardrails, hitl, bus, tools: { crm, email } };
  return { ctx, crm, email, hitl, bus };
}

test('lead de alto fit (>80): se da de alta automáticamente en el CRM', async () => {
  const { ctx, crm } = setup('92 — Autoridad portuaria de alto tráfico, encaje total con tokenización logística.');
  const agent = new LeadScorerAgent(ctx);
  const res = await agent.run({ payload: { lead: { company: 'Puerto de Algeciras', contact: 'Director', role: 'Dirección' } } });

  assert.equal(res.score, 92);
  assert.ok(res.crm, 'debe haber creado el lead en el CRM');
  assert.equal((await crm.listLeads()).length, 1);
});

test('lead irrelevante (<80): NO crea lead en el CRM', async () => {
  const { ctx, crm } = setup('25 — Negocio local sin relación logística ni aduanera.');
  const agent = new LeadScorerAgent(ctx);
  const res = await agent.run({ payload: { lead: { company: 'Panadería Paco' } } });

  assert.equal(res.score, 25);
  assert.equal(res.crm, undefined);
  assert.equal((await crm.listLeads()).length, 0);
});

test('outreach en frío: espera aprobación humana y se envía al APROBAR', async () => {
  const { ctx, email, hitl } = setup('Asunto: Trazabilidad aduanera para el Puerto de Cádiz\n\nEstimado director...');
  const agent = new OutreachAgent(ctx);
  let sentArgs = null;
  email.send = async (a) => { sentArgs = a; return { sent: true, simulated: true }; };

  const pending = agent.run({ payload: { lead: { company: 'Puerto de Cádiz', email: 'dir@puertocadiz.es' } } });
  const inbox = await waitForPending(hitl, 'aegis');
  assert.equal(inbox.length, 1, 'el envío en frío debe quedar pendiente de aprobación');
  assert.equal(sentArgs, null, 'no se envía antes de aprobar');

  hitl.resolve(inbox[0].approvalId, true, 'aprobado');
  const res = await pending;
  assert.equal(res.send.sent, true);
  assert.ok(sentArgs && sentArgs.to === 'dir@puertocadiz.es', 'tras aprobar se envía al destinatario');
});

test('outreach en frío: si se RECHAZA, el email nunca se envía', async () => {
  const { ctx, email, hitl } = setup('Asunto: Propuesta\n\nCuerpo...');
  const agent = new OutreachAgent(ctx);
  let sent = false;
  email.send = async () => { sent = true; return { sent: true }; };

  const pending = agent.run({ payload: { lead: { company: 'Puerto X', email: 'x@x.es' } } });
  const [appr] = await waitForPending(hitl, 'aegis');
  hitl.resolve(appr.approvalId, false, 'todavía no');
  const res = await pending;

  assert.equal(res.send.status, 'rejected');
  assert.equal(sent, false, 'el email NUNCA se envió');
});
