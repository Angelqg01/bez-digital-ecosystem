'use strict';

/**
 * Operaciones: reposición de stock, SLA y comunicación con proveedores.
 *
 * Fallos caros que se blindan aquí:
 *   - **Reposición de stock**: dejar que el modelo "proponga cantidades"
 *     leyendo una tabla — pedir de menos rompe stock, pedir de más
 *     inmoviliza caja. Mismo patrón que el IVA de las propuestas.
 *   - **SLA**: contar un caso todavía abierto y a tiempo como "cumplido"
 *     infla la tasa de cumplimiento con casos que ni han tenido ocasión de
 *     fallar.
 *   - **Comunicación con proveedores**: reenviar el mismo seguimiento dos
 *     veces por un reintento de la tarea.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const reorder = require('../src/platform/inventoryReorder');
const sla = require('../src/platform/slaBreach');
const InventoryAgent = require('../src/agents/operations/InventoryAgent');
const SLAMonitorAgent = require('../src/agents/operations/SLAMonitorAgent');
const VendorCommsAgent = require('../src/agents/operations/VendorCommsAgent');
const ModelGateway = require('../src/cognition/ModelGateway');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const HITLGate = require('../src/core/HITLGate');
const EventBus = require('../src/core/EventBus');

function memoryStore(initial = {}) {
  const facts = new Map(Object.entries(initial));
  const k = (t, key) => `${t}:${key}`;
  return {
    getFact: async ({ tenantId, key }) => facts.get(k(tenantId, key)),
    setFact: async ({ tenantId, key, value }) => { facts.set(k(tenantId, key), value); },
    _facts: facts,
  };
}

const ctx = (extra = {}) => ({
  tenantId: 'bezhas', department: 'operations',
  model: new ModelGateway({ providers: {} }),
  guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
  hitl: new HITLGate({}),
  bus: new EventBus('bezhas'),
  tools: {},
  ...extra,
});

// ══ Reposición de stock: fórmula, no impresión del modelo ════════════════

test('punto de pedido = consumo diario × plazo de entrega + stock de seguridad', () => {
  const r = reorder.evaluate({ sku: 'A', currentStock: 50, avgDailyUsage: 10, leadTimeDays: 7, safetyStock: 20 });
  assert.equal(r.reorderPoint, 90);
  assert.equal(r.needsReorder, true);
});

test('con maxLevel definido, repone hasta ese nivel objetivo', () => {
  const r = reorder.evaluate({ sku: 'A', currentStock: 50, avgDailyUsage: 10, leadTimeDays: 7, maxLevel: 200 });
  assert.equal(r.suggestedQty, 150);
});

test('sin maxLevel ni reorderQty, NO se inventa una cantidad', () => {
  const r = reorder.evaluate({ sku: 'B', currentStock: 5, avgDailyUsage: 10, leadTimeDays: 7 });
  assert.equal(r.needsReorder, true);
  assert.equal(r.suggestedQty, null);
  assert.match(r.reason, /no se inventa/);
});

test('detecta cuándo se agotará ANTES de que llegue un pedido hecho hoy', () => {
  const urgente = reorder.evaluate({ sku: 'A', currentStock: 5, avgDailyUsage: 10, leadTimeDays: 7 });
  const noUrgente = reorder.evaluate({ sku: 'B', currentStock: 90, avgDailyUsage: 10, leadTimeDays: 7 });
  assert.equal(urgente.willStockOutBeforeRestock, true);
  assert.equal(noUrgente.willStockOutBeforeRestock, false);
});

test('con stock de sobra, no necesita reposición', () => {
  const r = reorder.evaluate({ sku: 'C', currentStock: 1000, avgDailyUsage: 10, leadTimeDays: 7 });
  assert.equal(r.needsReorder, false);
  assert.equal(r.suggestedQty, null);
});

test('sin datos suficientes, no opina', () => {
  const r = reorder.evaluate({ sku: 'D' });
  assert.equal(r.needsReorder, null);
  assert.match(r.reason, /insuficientes/);
});

test('evaluateAll ordena por urgencia: primero los que se agotan antes del reabastecimiento', () => {
  const { needsReorder, critical, missingPolicy } = reorder.evaluateAll([
    // Necesita reponer (por debajo del punto de pedido con colchón de seguridad)
    // pero al ritmo actual le quedan más días de stock que el propio plazo de
    // entrega: no es crítico, solo "conviene pedir ya".
    { sku: 'lento', currentStock: 85, avgDailyUsage: 10, leadTimeDays: 7, safetyStock: 20, maxLevel: 200 },
    // Se agota antes de que llegue un pedido hecho hoy: crítico de verdad.
    { sku: 'urgente', currentStock: 2, avgDailyUsage: 10, leadTimeDays: 7, maxLevel: 200 },
    // Igual de holgado que "lento", pero sin política de reposición definida.
    { sku: 'sin-politica', currentStock: 85, avgDailyUsage: 10, leadTimeDays: 7, safetyStock: 20 },
  ]);
  assert.equal(needsReorder[0].sku, 'urgente', 'lo crítico va primero, sea cual sea el orden de entrada');
  assert.deepEqual(critical.map((r) => r.sku), ['urgente'], 'solo lo que se agota antes del reabastecimiento es crítico');
  assert.deepEqual(missingPolicy.map((r) => r.sku), ['sin-politica']);
});

test('InventoryAgent emite aviso crítico solo para lo urgente de verdad', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('operations:stock_critical', (e) => avisos.push(e));
  const agent = new InventoryAgent(ctx({ bus }));

  const out = await agent.run({
    payload: {
      stock: [
        { sku: 'ok', currentStock: 500, avgDailyUsage: 10, leadTimeDays: 7 },
        { sku: 'critico', currentStock: 2, avgDailyUsage: 10, leadTimeDays: 7, maxLevel: 200 },
      ],
    },
  });

  assert.equal(out.status, 'ok');
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].skus[0].sku, 'critico');
});

test('sin datos de stock, el agente lo dice en vez de fallar de forma opaca', async () => {
  const out = await new InventoryAgent(ctx()).run({ payload: {} });
  assert.equal(out.status, 'blocked');
});

// ══ SLA: no confundir "todavía a tiempo" con "cumplido" ══════════════════

const T0 = 1_800_000_000_000;
const HORA = 3_600_000;

test('un caso completado dentro de plazo es compliant', () => {
  const r = sla.evaluateCase({ id: 'c1', type: 'response', openedAt: T0 - 3 * HORA, slaMinutes: 240, completedAt: T0 - HORA }, T0);
  assert.equal(r.status, 'compliant');
});

test('un caso completado fuera de plazo es breached, con minutos de retraso', () => {
  const r = sla.evaluateCase({ id: 'c2', type: 'response', openedAt: T0 - 5 * HORA, slaMinutes: 240, completedAt: T0 - 0.5 * HORA }, T0);
  assert.equal(r.status, 'breached');
  assert.equal(r.minutesLate, 30);
});

test('un caso abierto y dentro de plazo NO cuenta como cumplido', () => {
  const r = sla.evaluateCase({ id: 'c3', type: 'resolution', openedAt: T0 - HORA, slaMinutes: 240 }, T0);
  assert.notEqual(r.status, 'compliant');
  assert.equal(r.status, 'on_track');
});

test('un caso abierto cerca del límite pasa a at_risk', () => {
  const r = sla.evaluateCase({ id: 'c4', type: 'resolution', openedAt: T0 - 3.9 * HORA, slaMinutes: 240 }, T0);
  assert.equal(r.status, 'at_risk');
});

test('un caso abierto que ya pasó su plazo es breached aunque no se haya cerrado', () => {
  const r = sla.evaluateCase({ id: 'c5', type: 'resolution', openedAt: T0 - 10 * HORA, slaMinutes: 240 }, T0);
  assert.equal(r.status, 'breached');
  assert.ok(r.minutesLate > 0);
});

test('la tasa de cumplimiento solo cuenta casos que ya tuvieron ocasión de fallar', () => {
  const r = sla.evaluateAll([
    { id: 'a', type: 'response', openedAt: T0 - 3 * HORA, slaMinutes: 240, completedAt: T0 - HORA },   // compliant
    { id: 'b', type: 'response', openedAt: T0 - 5 * HORA, slaMinutes: 240, completedAt: T0 - 0.5 * HORA }, // breached
    { id: 'c', type: 'resolution', openedAt: T0 - HORA, slaMinutes: 240 },   // on_track: no cuenta
    { id: 'd', type: 'resolution', openedAt: T0 - 3.9 * HORA, slaMinutes: 240 },   // at_risk: no cuenta
  ], { now: T0 });
  assert.equal(r.complianceRate, 0.5, '1 de 2 decididos, no 1 de 4');
});

test('sin ningún caso decidido, la tasa es null, no 0% ni 100%', () => {
  const r = sla.evaluateAll([{ id: 'a', type: 'response', openedAt: T0 - HORA, slaMinutes: 240 }], { now: T0 });
  assert.equal(r.complianceRate, null);
});

test('SLAMonitorAgent avisa solo de lo que necesita acción, no de lo que va bien', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('operations:sla_breached', (e) => avisos.push({ type: 'breached', e }));
  bus.on('operations:sla_at_risk', (e) => avisos.push({ type: 'at_risk', e }));
  const agent = new SLAMonitorAgent(ctx({ bus }));

  const out = await agent.run({
    payload: {
      now: T0,
      cases: [
        { id: 'bien', type: 'response', openedAt: T0 - HORA, slaMinutes: 240 },
        { id: 'mal', type: 'resolution', openedAt: T0 - 10 * HORA, slaMinutes: 240 },
      ],
    },
  });

  assert.equal(out.status, 'ok');
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].type, 'breached');
  assert.equal(avisos[0].e.caseId, 'mal');
});

test('sin casos, el agente lo dice', async () => {
  const out = await new SLAMonitorAgent(ctx()).run({ payload: {} });
  assert.equal(out.status, 'blocked');
});

// ══ VendorCommsAgent: idempotencia y guardrail de outbound ═══════════════

test('sin email del proveedor, no se redacta ni se envía', async () => {
  const out = await new VendorCommsAgent(ctx()).run({ payload: { vendor: { name: 'Acme' } } });
  assert.equal(out.status, 'blocked');
});

test('envía a través de la línea roja outbound (categoría correcta)', async () => {
  const capturado = [];
  const hitl = { request: async (req) => { capturado.push(req); return { approved: true }; } };
  const email = { name: 'email', execute: async () => ({ sent: true }) };
  const agent = new VendorCommsAgent(ctx({ hitl, tools: { email } }));

  await agent.run({ payload: { vendor: { name: 'Acme', email: 'compras@acme.com' }, purpose: 'quote_request', cold: true } });

  assert.equal(capturado.length, 1);
  assert.equal(capturado[0].action.category, 'outbound');
  assert.equal(capturado[0].action.cold, true);
});

test('un seguimiento con la misma referencia no se reenvía el mismo día (idempotente)', async () => {
  const store = memoryStore();
  let enviosReales = 0;
  const email = { name: 'email', execute: async () => { enviosReales++; return { sent: true }; } };
  const agent = new VendorCommsAgent(ctx({ store, tools: { email } }));
  const payload = { vendor: { name: 'Acme', email: 'compras@acme.com' }, purpose: 'delay_followup', referenceId: 'PO-123', now: Date.now() };

  const r1 = await agent.run({ payload });
  assert.equal(r1.status, 'ok');
  const r2 = await agent.run({ payload });
  assert.equal(r2.status, 'skipped');
  assert.equal(enviosReales, 1, 'solo debe haber salido un correo real');
});

test('sin referenceId, no hay deduplicación (cada llamada es independiente)', async () => {
  const store = memoryStore();
  let envios = 0;
  const email = { name: 'email', execute: async () => { envios++; return { sent: true }; } };
  const agent = new VendorCommsAgent(ctx({ store, tools: { email } }));

  await agent.run({ payload: { vendor: { name: 'Acme', email: 'compras@acme.com' }, purpose: 'quote_request' } });
  await agent.run({ payload: { vendor: { name: 'Acme', email: 'compras@acme.com' }, purpose: 'quote_request' } });

  assert.equal(envios, 2);
});

test('referencias distintas del mismo proveedor no se bloquean entre sí', async () => {
  const store = memoryStore();
  let envios = 0;
  const email = { name: 'email', execute: async () => { envios++; return { sent: true }; } };
  const agent = new VendorCommsAgent(ctx({ store, tools: { email } }));

  await agent.run({ payload: { vendor: { name: 'Acme', email: 'compras@acme.com' }, purpose: 'delay_followup', referenceId: 'PO-1' } });
  await agent.run({ payload: { vendor: { name: 'Acme', email: 'compras@acme.com' }, purpose: 'delay_followup', referenceId: 'PO-2' } });

  assert.equal(envios, 2);
});
