'use strict';

/**
 * Los 4 departamentos añadidos para BeZhas (Blockchain Ops, Legal, Tesorería y
 * Fundraising) no tenían ni un test: eran el único bloque del repo sin red de
 * seguridad. Aquí se congela su contrato de comportamiento.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const HITLGate = require('../src/core/HITLGate');
const AuditLog = require('../src/guardrails/AuditLog');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const { buildDepartments, DEPARTMENT_REGISTRY } = require('../src/agents');

/** Modelo simulado determinista: devuelve el texto que se le indique. */
function fakeModel(text = 'respuesta del modelo') {
  return { complete: async () => ({ text }), completeWithTools: async () => ({ text, toolCalls: [] }) };
}

/** Conector bezhas-core falso: datos reales o simulados según se pida. */
function fakeCore({ simulated = false, treasuryUsd = 100000, status = 'healthy' } = {}) {
  return {
    name: 'bezhas-core',
    async execute(method) {
      const base = { simulated };
      if (method === 'chainOverview') return { ...base, chainId: 2708, status };
      if (method === 'validatorStats') return { ...base, activeValidators: 12 };
      if (method === 'treasuryStats') return { ...base, balanceUsd: treasuryUsd, balanceBez: '1000' };
      if (method === 'gasStatus') return { ...base, gasPriceGwei: 30 };
      return base;
    },
  };
}

function ctx({ tools = {}, model = fakeModel(), bus = new EventBus('acme') } = {}) {
  const audit = new AuditLog({ tenantId: 'acme' });
  return {
    tenantId: 'acme', model, bus, memory: null,
    guardrails: new PolicyEngine({ tenantId: 'acme' }),
    hitl: new HITLGate({ bus, audit, tenantId: 'acme' }),
    tools,
  };
}

function agentOf(department, agentId, c) {
  const [dept] = buildDepartments({ ...c, enabled: [department] });
  return dept.specialists.get(agentId);
}

// ── Registro ────────────────────────────────────────────────────────────────

test('los 4 departamentos nuevos están registrados y se construyen', () => {
  for (const d of ['blockchain', 'legal', 'treasury', 'fundraising']) {
    assert.ok(DEPARTMENT_REGISTRY[d], `${d} debe estar en el registro`);
  }
  const built = buildDepartments({ ...ctx(), enabled: ['blockchain', 'legal', 'treasury', 'fundraising'] });
  assert.equal(built.length, 4);
  assert.deepEqual(built.map((d) => d.department).sort(), ['blockchain', 'fundraising', 'legal', 'treasury']);
});

// ── Blockchain Ops ──────────────────────────────────────────────────────────

test('OnChainMonitor: con el stack caído lo reporta como anomalía (no finge normalidad)', async () => {
  const bus = new EventBus('acme');
  const eventos = [];
  bus.on('blockchain:anomaly_detected', (e) => eventos.push(e));

  const a = agentOf('blockchain', 'blockchain.onchain-monitor',
    ctx({ tools: { 'bezhas-core': fakeCore({ simulated: true }) }, bus }));
  const r = await a.run({ payload: {} });

  assert.equal(r.anomalyDetected, true);
  assert.match(r.alerts.join(' '), /no respondió/);
  assert.equal(eventos.length, 1, 'debe emitir la alerta al bus para que llegue a un humano');
});

test('OnChainMonitor: con el stack sano y todo en rango no inventa alertas', async () => {
  const a = agentOf('blockchain', 'blockchain.onchain-monitor',
    ctx({ tools: { 'bezhas-core': fakeCore({ simulated: false, status: 'healthy' }) } }));
  const r = await a.run({ payload: {} });

  assert.equal(r.anomalyDetected, false);
  assert.deepEqual(r.alerts, []);
  assert.equal(r.snapshot.validators.activeValidators, 12);
});

test('ComplianceCheck: solo informa del riesgo, nunca aprueba ni bloquea', async () => {
  const a = agentOf('blockchain', 'blockchain.compliance-check', ctx());
  const r = await a.run({ payload: { amountUsd: 20000, walletAddress: '0xabc', customerEmail: 'a@b.com', country: 'España' } });

  assert.equal(r.riskLevel, 'medio');
  assert.equal(r.requiresEnhancedReview, true);
  assert.ok(r.narrative, 'debe explicar el riesgo en lenguaje natural');
  assert.equal(r.status, 'ok');
  assert.ok(!('approved' in r) && !('blocked' in r), 'no decide: solo informa');
});

// ── Legal ───────────────────────────────────────────────────────────────────

test('ContractReview: revisar no dispara firma; pedir firmar sí pasa por HITL', async () => {
  const sinFirma = agentOf('legal', 'legal.contract-review', ctx());
  const r1 = await sinFirma.run({ payload: { text: 'Analiza esta cláusula de terminación.' } });
  assert.equal(r1.signatureRequested, false);
  assert.equal(r1.signature, null);

  const c = ctx();
  const conFirma = agentOf('legal', 'legal.contract-review', c);
  const p = conFirma.run({ payload: { text: 'Revisa la cláusula antes de firmarla.' } });

  await new Promise((r) => setImmediate(r));
  const pend = c.hitl.listPending('acme');
  assert.equal(pend.length, 1, 'firmar debe quedar bloqueado esperando a un humano');
  assert.equal(pend[0].action.category, 'signature');

  c.hitl.resolve(pend[0].approvalId, false, 'no firmamos');
  const r2 = await p;
  assert.equal(r2.signatureRequested, true);
  assert.equal(r2.signature.status, 'rejected');
});

test('RegulatoryAdvisor: responde dudas normativas sin cruzar líneas rojas', async () => {
  const a = agentOf('legal', 'legal.regulatory-advisor', ctx({ model: fakeModel('El RGPD exige base legal.') }));
  const r = await a.run({ payload: { text: '¿Necesitamos consentimiento para la geolocalización?' } });
  assert.match(r.answer, /RGPD/);
  assert.equal(r.status, 'ok');
});

// ── Tesorería ───────────────────────────────────────────────────────────────

test('TreasuryRunway: runway bajo con dato REAL dispara alerta crítica', async () => {
  const bus = new EventBus('acme');
  const eventos = [];
  bus.on('treasury:runway_critical', (e) => eventos.push(e));

  const a = agentOf('treasury', 'treasury.runway',
    ctx({ tools: { 'bezhas-core': fakeCore({ simulated: false, treasuryUsd: 4000 }) }, bus }));
  const r = await a.run({ payload: { monthlyBurnUsd: 5000 } });

  assert.equal(r.runwayMonths, 0.8);
  assert.equal(r.critical, true);
  assert.equal(eventos.length, 1, 'debe avisar al bus');
});

test('TreasuryRunway: runway bajo con dato SIMULADO no alarma (dato no fiable)', async () => {
  const bus = new EventBus('acme');
  const eventos = [];
  bus.on('treasury:runway_critical', (e) => eventos.push(e));

  const a = agentOf('treasury', 'treasury.runway',
    ctx({ tools: { 'bezhas-core': fakeCore({ simulated: true, treasuryUsd: 0 }) }, bus }));
  const r = await a.run({ payload: { monthlyBurnUsd: 5000 } });

  assert.equal(r.critical, false, 'no se alarma a un CFO con un dato inventado');
  assert.equal(eventos.length, 0);
});

test('Tokenomics: informa del estado del token sin dar asesoría de inversión', async () => {
  const a = agentOf('treasury', 'treasury.tokenomics',
    ctx({ tools: { 'bezhas-core': fakeCore({ simulated: false }) } }));
  const r = await a.run({ payload: {} });
  assert.ok(r.seedPriceUsd > 0);
  assert.ok(r.report);
  assert.equal(r.status, 'ok');
});

// ── Fundraising ─────────────────────────────────────────────────────────────

test('InvestorScorer: puntúa 0-100 y respeta las cuentas vetadas', async () => {
  const a = agentOf('fundraising', 'fundraising.investor-scorer', ctx({ model: fakeModel('85 — encaja con la tesis') }));
  const r = await a.run({ payload: { lead: { company: 'Seaya Ventures', role: 'Partner' } } });
  assert.equal(r.score, 85);

  const business = { isExcluded: () => true };
  const vetado = agentOf('fundraising', 'fundraising.investor-scorer', { ...ctx(), business });
  const r2 = await vetado.run({ payload: { lead: { company: 'Vetada SL' } } });
  assert.equal(r2.score, 0);
  assert.match(r2.rationale, /excluida/i);
});

test('InvestorOutreach: el contacto en frío a un fondo pasa por HITL como en ventas', async () => {
  const c = ctx({ model: fakeModel('Asunto: Infraestructura de validación\n\nHola...') });
  const enviados = [];
  c.tools.email = { name: 'email', execute: async (m, args) => { enviados.push(args); return { sent: true }; } };

  const a = agentOf('fundraising', 'fundraising.investor-outreach', c);
  const p = a.run({ type: 'fundraising:outreach', payload: { lead: { company: 'Kibo Ventures', email: 'x@kibo.vc' } } });

  await new Promise((r) => setImmediate(r));
  const pend = c.hitl.listPending('acme');
  assert.equal(pend.length, 1, 'el contacto en frío no se envía solo');
  assert.equal(pend[0].action.cold, true);
  assert.equal(enviados.length, 0, 'nada enviado antes del sí humano');

  c.hitl.resolve(pend[0].approvalId, true);
  const r = await p;
  assert.equal(r.send.sent, true);
  assert.equal(enviados.length, 1, 'tras aprobar, se envía una sola vez');
  assert.equal(enviados[0].to, 'x@kibo.vc');
});

test('InvestorOutreach: sin email no intenta enviar (no rompe la tarea)', async () => {
  const a = agentOf('fundraising', 'fundraising.investor-outreach', ctx());
  const r = await a.run({ type: 'fundraising:inbound', payload: { lead: { company: 'Fondo sin email' } } });
  assert.equal(r.send.skipped, true);
  assert.equal(r.status, 'ok');
});
