'use strict';

/**
 * Tests de los escuadrones de Finanzas y Marketing: enrutado por tipo de tarea
 * y que las acciones de línea roja (cobrar, publicar) quedan pendientes de aprobación.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const FinanceManager = require('../src/agents/finance/FinanceManager');
const MarketingManager = require('../src/agents/marketing/MarketingManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const MemoryManager = require('../src/cognition/MemoryManager');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const EventBus = require('../src/core/EventBus');

function ctx() {
  const tenantId = 'acme';
  return {
    tenantId,
    model: new ModelGateway({ providers: {} }), // simulado
    memory: new MemoryManager({ tenantId }),
    guardrails: new PolicyEngine({ tenantId, plan: 'pro' }),
    bus: new EventBus(tenantId),
  };
}

// ── Finanzas ────────────────────────────────────────────────────

test('Finanzas: enruta cada tipo a su especialista', async () => {
  const m = new FinanceManager(ctx());
  assert.equal((await m.run({ type: 'finance:request', payload: { text: '¿qué IVA aplico a servicios?' } })).results[0].step, 'finance.advisor');
  assert.equal((await m.run({ type: 'finance:invoice', payload: { client: 'Globex', items: [{ c: 'Consultoría', amt: 1000 }] } })).results[0].step, 'finance.invoice-bot');
  assert.equal((await m.run({ type: 'finance:forecast', payload: { data: { ingresos: 10000, gastos: 7000 } } })).results[0].step, 'finance.forecast');
});

test('Finanzas: cobrar es línea roja → pendiente de aprobación', async () => {
  const out = await new FinanceManager(ctx()).run({
    type: 'finance:collect',
    payload: { invoice: 'F-2024-01', charge: true, amount: 500, customerId: 'c1' },
  });
  const r = out.results[0].out;
  assert.ok(r.reminder, 'redacta el recordatorio');
  assert.equal(r.charge.status, 'pending_approval', 'el cobro NO se ejecuta solo');
});

// ── Marketing ───────────────────────────────────────────────────

test('Marketing: enruta cada tipo a su especialista', async () => {
  const m = new MarketingManager(ctx());
  assert.equal((await m.run({ type: 'marketing:request', payload: { text: 'lanzamiento de producto' } })).results[0].step, 'marketing.content');
  assert.equal((await m.run({ type: 'marketing:copy', payload: { brief: 'anuncio de oferta' } })).results[0].step, 'marketing.copy');
  assert.equal((await m.run({ type: 'marketing:seo', payload: { text: 'blog sobre CRM' } })).results[0].step, 'marketing.seo');
});

test('Marketing: publicar es línea roja → pendiente de aprobación', async () => {
  const out = await new MarketingManager(ctx()).run({
    type: 'marketing:social',
    payload: { network: 'linkedin', text: 'nueva función', publish: true },
  });
  const r = out.results[0].out;
  assert.ok(r.draft, 'redacta el borrador');
  assert.equal(r.publish.status, 'pending_approval', 'publicar NO se hace solo');
});
