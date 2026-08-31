'use strict';

/**
 * Test del agregado del panel: tras procesar un ticket de Soporte, buildDashboard
 * reúne plan, consumo, factura, KPIs, aprobaciones y últimas tareas.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildDashboard } = require('../src/platform/dashboard');
const TenantManager = require('../src/core/TenantManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const CostTracker = require('../src/platform/CostTracker');
const UsageMeter = require('../src/platform/UsageMeter');
const SupportMetrics = require('../src/platform/SupportMetrics');
const Billing = require('../src/platform/Billing');
const PLANS = require('../config/plans.json');

test('buildDashboard agrega el estado del tenant tras un ticket', async () => {
  const costTracker = new CostTracker();
  const usageMeter = new UsageMeter();
  const supportMetrics = new SupportMetrics();
  const billing = new Billing({ plans: PLANS });

  const modelGateway = new ModelGateway({
    providers: {}, // simulado
    onUsage: (u) => { costTracker.record(u); if (u.meta?.tenantId) usageMeter.record(u.meta.tenantId); },
  });

  const tenants = new TenantManager({ modelGateway, usageMeter, metrics: supportMetrics, plans: PLANS });
  await tenants.provision({ tenantId: 'acme', plan: 'pro', departments: ['support'], tools: {} });
  await billing.subscribe('acme', 'pro');

  await tenants.handleAndWait('acme', { text: 'la app no funciona y es urgente', channel: 'web', customerId: 'c1' }, { timeoutMs: 5000 });

  const d = buildDashboard({ tenants, usageMeter, costTracker, supportMetrics, billing, plans: PLANS }, 'acme');

  assert.equal(d.plan, 'pro');
  assert.ok(d.agentCalls.used >= 1, 'registró llamadas al modelo');
  assert.ok(d.cost.calls >= 1);
  assert.equal(d.invoice.plan, 'pro');
  assert.equal(d.support.handled, 1);
  assert.equal(d.support.escalated, 1);
  assert.ok(Array.isArray(d.approvals));
  assert.ok(d.tasks.length >= 1);
  assert.equal(d.tasks[0].department, 'support');
});

test('buildDashboard devuelve null si el tenant no existe', () => {
  const tenants = new TenantManager({ modelGateway: new ModelGateway({ providers: {} }), plans: PLANS });
  const d = buildDashboard({ tenants, usageMeter: new UsageMeter(), costTracker: new CostTracker(), supportMetrics: new SupportMetrics(), billing: new Billing({ plans: PLANS }), plans: PLANS }, 'nope');
  assert.equal(d, null);
});
