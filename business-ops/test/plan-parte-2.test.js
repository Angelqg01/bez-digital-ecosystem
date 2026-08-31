'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const HITLGate = require('../src/core/HITLGate');
const AuditLog = require('../src/guardrails/AuditLog');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const ModelGateway = require('../src/cognition/ModelGateway');
const MemoryManager = require('../src/cognition/MemoryManager');

const VectorDB = require('../src/connectors/VectorDB');
const StripeConnector = require('../src/connectors/StripeConnector');
const SystemMonitor = require('../src/connectors/SystemMonitor');
const CalendarConnector = require('../src/connectors/CalendarConnector');
const EmailConnector = require('../src/connectors/EmailConnector');

const TicketTriageAgent = require('../src/agents/support/TicketTriageAgent');
const SupportChatAgent = require('../src/agents/support/SupportChatAgent');
const InvoiceBot = require('../src/agents/finance/InvoiceBot');
const OpsMonitorAgent = require('../src/agents/operations/OpsMonitorAgent');
const ExecutiveReporterAgent = require('../src/agents/operations/ExecutiveReporterAgent');
const RecruiterScreenAgent = require('../src/agents/hr/RecruiterScreenAgent');
const OnboardingAssistant = require('../src/agents/hr/OnboardingAssistant');

function fakeModel(text) {
  return { async complete() { return { text, usage: {}, model: 'fake' }; } };
}

function setupContext(modelText = 'respuesta simulada') {
  const tenantId = 'test-tenant';
  const bus = new EventBus(tenantId);
  const guardrails = new PolicyEngine({ tenantId, plan: 'enterprise' });
  const audit = new AuditLog({ tenantId });
  const hitl = new HITLGate({ bus, audit });
  const memory = new MemoryManager({ tenantId });
  const model = fakeModel(modelText);

  const tools = {
    vectordb: new VectorDB({ tenantId }),
    stripe: new StripeConnector({ tenantId }),
    sysmon: new SystemMonitor({ tenantId }),
    calendar: new CalendarConnector({ tenantId }),
    email: new EmailConnector({ tenantId }),
  };

  return {
    tenantId,
    model,
    memory,
    guardrails,
    hitl,
    bus,
    tools,
  };
}

// --- MÓDULO 1: SOPORTE ---
test('Módulo 1: VectorDB aísla por tenant', async () => {
  const db1 = new VectorDB({ tenantId: 'tenant-1' });
  const db2 = new VectorDB({ tenantId: 'tenant-2' });

  await db1.execute('upsert', { id: 'doc-1', title: 'Ayuda', body: 'Contenido del tenant 1' });
  await db2.execute('upsert', { id: 'doc-2', title: 'Ayuda', body: 'Contenido del tenant 2' });

  const search1 = await db1.execute('search', { query: 'Ayuda', k: 5 });
  const search2 = await db2.execute('search', { query: 'Ayuda', k: 5 });

  assert.equal(search1.length, 1);
  assert.equal(search1[0].id, 'doc-1');
  assert.equal(search2.length, 1);
  assert.equal(search2[0].id, 'doc-2');
});

test('Módulo 1: TicketTriageAgent realiza el triaje del ticket', async () => {
  const ctx = setupContext('Resumen breve de prueba');
  const agent = new TicketTriageAgent(ctx);

  const res = await agent.run({
    payload: { text: '¡La aplicación está caída y no funciona! Urgente.', channel: 'web' }
  });

  assert.equal(res.category, 'technical');
  assert.equal(res.priority, 'high');
  assert.equal(res.sentiment, 'negative');
  assert.equal(res.requiresEscalation, true);
  assert.ok(res.note);
});

test('Módulo 1: SupportChatAgent utiliza VectorDB y responde de forma empática', async () => {
  const ctx = setupContext('Respuesta empática basada en el artículo de ayuda.');
  const agent = new SupportChatAgent(ctx);

  await ctx.tools.vectordb.execute('upsert', {
    id: 'art-1',
    title: 'Configurar notificaciones',
    body: 'Para configurar notificaciones vaya a ajustes.'
  });

  const res = await agent.run({
    payload: { text: '¿Cómo configuro las notificaciones?', customerId: 'cust-123' }
  });

  assert.equal(res.grounded, true);
  assert.ok(res.reply);
  assert.equal(res.hits[0].id, 'art-1');
});

// --- MÓDULO 2: FINANZAS ---
test('Módulo 2: StripeConnector genera enlaces de pago y consulta facturas', async () => {
  const stripe = new StripeConnector({ tenantId: 'tenant-f' });

  const link = await stripe.execute('createPaymentLink', { amount: 150, customerId: 'cust-f' });
  assert.equal(link.amount, 150);
  assert.ok(link.url);

  const invoice = await stripe.execute('getInvoice', { invoiceId: 'inv-123' });
  assert.equal(invoice.invoiceId, 'inv-123');

  const sub = await stripe.execute('checkSubscription', { customerId: 'cust-f' });
  assert.equal(sub.status, 'active');
});

test('Módulo 2: InvoiceBot reacciona a sales:deal_won', async () => {
  const ctx = setupContext();
  const bot = new InvoiceBot(ctx);

  let emailArgs = null;
  ctx.tools.email.execute = async (method, args) => {
    if (method === 'send') emailArgs = args;
    return { sent: true };
  };

  const invoiceSentEvents = [];
  ctx.bus.on('finance:invoice_sent', (e) => invoiceSentEvents.push(e));

  ctx.bus.emit('sales:deal_won', {
    client: 'Empresa Ganada SL',
    amount: 1200,
    email: 'contacto@empresaganada.com'
  });

  await new Promise(r => setTimeout(r, 50));

  assert.equal(invoiceSentEvents.length, 1);
  assert.equal(invoiceSentEvents[0].client, 'Empresa Ganada SL');
  assert.equal(invoiceSentEvents[0].amount, 1200);
  assert.ok(emailArgs);
  assert.equal(emailArgs.to, 'contacto@empresaganada.com');
  assert.match(emailArgs.body, /1200 EUR/);
});

test('Módulo 2: Guardrail FINANCE_DISBURSEMENT requiere aprobación', async () => {
  const ctx = setupContext();
  const verdict = ctx.guardrails.evaluate({
    agentId: 'finance.advisor',
    action: {
      category: 'finance_disbursement',
      method: 'FINANCE_DISBURSEMENT',
      amount: 10000
    }
  });

  assert.equal(verdict.allowed, false);
  assert.equal(verdict.requiresApproval, true);
});

// --- MÓDULO 3: OPERACIONES ---
test('Módulo 3: SystemMonitor reporta métricas de RAM y disco', async () => {
  const monitor = new SystemMonitor({ tenantId: 'tenant-o' });
  const metrics = await monitor.execute('getSystemMetrics');

  assert.ok(metrics.ramUsagePct >= 0 && metrics.ramUsagePct <= 100);
  assert.ok(metrics.diskUsagePct >= 0 && metrics.diskUsagePct <= 100);
  assert.ok(metrics.ollamaLatencyMs > 0);
});

test('Módulo 3: OpsMonitorAgent detecta anomalías en almacenamiento', async () => {
  const ctx = setupContext();
  const agent = new OpsMonitorAgent(ctx);

  ctx.tools.sysmon.execute = async () => ({
    diskUsagePct: 90,
    ramUsagePct: 40,
    ollamaLatencyMs: 100
  });

  const anomalies = [];
  ctx.bus.on('operations:anomaly_detected', (e) => anomalies.push(e));

  const res = await agent.run({});
  assert.equal(res.anomalyDetected, true);
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].alerts[0], 'Almacenamiento crítico: 90% en uso.');
});

test('Módulo 3: ExecutiveReporterAgent genera un reporte consolidado', async () => {
  const ctx = setupContext('Reporte estructurado consolidado exitosamente.');
  const agent = new ExecutiveReporterAgent(ctx);

  const res = await agent.run({
    payload: {
      salesKpis: { qualifiedLeads: 12, dealsWon: 4, conversionPct: 33 },
      supportKpis: { totalTickets: 80, resolutionPct: 75, escalatedTickets: 20 },
      financeKpis: { revenue: 50000, expenses: 20000, cashflowForecast: 'Muy positivo' }
    }
  });

  assert.ok(res.report);
  assert.equal(res.status, 'ok');
});

// --- MÓDULO 4: RECURSOS HUMANOS ---
test('Módulo 4: CalendarConnector lee disponibilidad y agenda eventos', async () => {
  const cal = new CalendarConnector({ tenantId: 'tenant-h' });

  const availability = await cal.execute('getAvailability', { date: '2026-07-01' });
  assert.equal(availability.date, '2026-07-01');
  assert.ok(availability.slots.length > 0);

  const meeting = await cal.execute('scheduleMeeting', {
    title: 'Entrevista de Trabajo',
    date: '2026-07-01',
    slot: '11:30',
    attendees: ['candidato@test.com']
  });

  assert.equal(meeting.date, '2026-07-01');
  assert.equal(meeting.slot, '11:30');
  assert.ok(meeting.url);
});

test('Módulo 4: RecruiterScreenAgent realiza criba de CV y respeta guardrails', async () => {
  const ctx = setupContext('Candidato con perfil apto.');
  const agent = new RecruiterScreenAgent(ctx);

  const pending = agent.run({
    payload: {
      candidate: { name: 'Marta Gómez', resumeText: 'Ingeniera de Software con 6 años de experiencia en Node.js y Python.' },
      jobProfile: 'Senior Backend Developer',
      decision: 'hire'
    }
  });

  let approvals = ctx.hitl.listPending('test-tenant');
  for (let i = 0; i < 10 && approvals.length === 0; i++) {
    await new Promise(r => setImmediate(r));
    approvals = ctx.hitl.listPending('test-tenant');
  }

  assert.equal(approvals.length, 1);
  ctx.hitl.resolve(approvals[0].approvalId, false, 'Rechazado por el test');

  const res = await pending;

  assert.ok(res.evaluation);
  assert.equal(res.decision.status, 'rejected');
  assert.match(res.decision.reason, /Rechazado por el test/);
});

test('Módulo 4: OnboardingAssistant busca guías y responde', async () => {
  const ctx = setupContext('Instrucciones detalladas de onboarding.');
  const agent = new OnboardingAssistant(ctx);

  await ctx.tools.vectordb.execute('upsert', {
    id: 'guide-1',
    title: 'Guía de estilo y accesos',
    body: 'El repositorio principal de código se encuentra en GitHub. Los accesos se solicitan vía IT.'
  });

  const res = await agent.run({
    payload: { text: '¿Cómo accedo al repositorio principal de código?' }
  });

  assert.equal(res.docsMatched.includes('Guía de estilo y accesos'), true);
  assert.ok(res.reply);
});
