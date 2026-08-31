'use strict';

/**
 * Los cinco especialistas nuevos de Ventas.
 *
 * Cada uno tiene un fallo caro distinto, y es lo que se prueba aquí:
 *   - Propuesta  → un total mal calculado o un precio inventado.
 *   - Seguimiento→ insistir de más y quemar el contacto (y el dominio).
 *   - Agenda     → duplicar reuniones al reintentar.
 *   - CRM        → "funcionar" y dejar los datos peor que estaban.
 *   - Churn      → dar por sano a un cliente del que no se sabe nada.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../src/platform/priceCatalog');
const policy = require('../src/platform/followUpPolicy');
const crmMerge = require('../src/platform/crmMerge');
const churn = require('../src/platform/churnScore');
const { crossesRedLine } = require('../src/guardrails/RedLines');

const ProposalGeneratorAgent = require('../src/agents/sales/ProposalGeneratorAgent');
const MeetingBookerAgent = require('../src/agents/sales/MeetingBookerAgent');
const CRMSyncAgent = require('../src/agents/sales/CRMSyncAgent');
const ChurnPredictorAgent = require('../src/agents/sales/ChurnPredictorAgent');
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
  tenantId: 'bezhas', department: 'sales',
  model: new ModelGateway({ providers: {} }),
  guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
  hitl: new HITLGate({}),
  bus: new EventBus('bezhas'),
  tools: {},
  ...extra,
});

const CATALOGO = [
  { sku: 'ESCROW', name: 'QualityEscrow', unitPriceCents: 49900, unit: 'mes', recurring: true, vatPct: 21 },
  { sku: 'FORM', name: 'Formación', unitPriceCents: 120000, unit: 'sesión', recurring: false, vatPct: 0 },
];

// ══ 1. Propuesta: el código calcula, el modelo redacta ═══════════════════

test('el IVA se aplica por línea, no sobre el total (tipos mixtos)', () => {
  const q = pricing.quote({ items: [{ sku: 'ESCROW', qty: 12 }, { sku: 'FORM', qty: 1 }], catalog: CATALOGO, discountPct: 10 });
  assert.equal(q.subtotalCents, 49900 * 12 + 120000);
  assert.equal(q.discountCents, Math.round(q.subtotalCents * 0.10));
  // Solo el escrow lleva IVA; la formación va al 0 %.
  assert.equal(q.vatCents, Math.round(49900 * 12 * 0.9 * 0.21));
  assert.equal(q.totalCents, q.taxedBaseCents + q.vatCents);
});

test('un SKU que no está en el catálogo aborta: nunca se inventa un precio', () => {
  assert.throws(
    () => pricing.quote({ items: [{ sku: 'NO-EXISTE', qty: 1 }], catalog: CATALOGO }),
    (e) => e.code === 'unknown_sku',
  );
});

test('rechaza cantidades y descuentos imposibles', () => {
  assert.throws(() => pricing.quote({ items: [{ sku: 'FORM', qty: 0 }], catalog: CATALOGO }), /cantidad inválida/);
  assert.throws(() => pricing.quote({ items: [{ sku: 'FORM', qty: 1.5 }], catalog: CATALOGO }), /cantidad inválida/);
  assert.throws(() => pricing.quote({ items: [{ sku: 'FORM', qty: 1 }], catalog: CATALOGO, discountPct: -5 }), /negativo/);
  assert.throws(() => pricing.quote({ items: [{ sku: 'FORM', qty: 1 }], catalog: CATALOGO, discountPct: 80 }), (e) => e.code === 'discount_too_high');
  assert.throws(() => pricing.quote({ items: [], catalog: CATALOGO }), (e) => e.code === 'no_items');
});

test('los importes se manejan en céntimos enteros (sin deriva de coma flotante)', () => {
  const cat = [{ sku: 'X', name: 'X', unitPriceCents: 10, unit: 'u', recurring: false, vatPct: 21 }];
  const q = pricing.quote({ items: [{ sku: 'X', qty: 3 }], catalog: cat });
  assert.equal(q.subtotalCents, 30);
  assert.ok(Number.isInteger(q.totalCents), 'el total debe ser un entero de céntimos');
});

test('un descuento por encima del umbral cruza línea roja (lo decide el guardrail)', () => {
  assert.equal(pricing.quote({ items: [{ sku: 'FORM', qty: 1 }], catalog: CATALOGO, discountPct: 10 }).requiresApproval, false);
  assert.equal(pricing.quote({ items: [{ sku: 'FORM', qty: 1 }], catalog: CATALOGO, discountPct: 30 }).requiresApproval, true);

  assert.equal(crossesRedLine({ category: 'outbound', discountPct: 10 }), null);
  assert.equal(crossesRedLine({ category: 'outbound', discountPct: 30 })?.id, 'pricing_concession');
});

test('sin catálogo cargado el agente se niega a generar', async () => {
  const agent = new ProposalGeneratorAgent(ctx({ store: memoryStore() }));
  const out = await agent.run({ payload: { lead: { company: 'X' }, items: [{ sku: 'ESCROW', qty: 1 }] } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /catálogo/i);
  assert.equal(out.draft, null);
});

test('un SKU desconocido devuelve bloqueo con la lista de SKUs válidos', async () => {
  const store = memoryStore({ 'bezhas:sales:price_catalog': CATALOGO });
  const agent = new ProposalGeneratorAgent(ctx({ store }));
  const out = await agent.run({ payload: { lead: { company: 'X' }, items: [{ sku: 'INVENTADO', qty: 1 }] } });
  assert.equal(out.status, 'blocked');
  assert.equal(out.code, 'unknown_sku');
  assert.deepEqual(out.availableSkus, ['ESCROW', 'FORM']);
});

test('el modelo recibe los importes ya calculados, no los calcula él', async () => {
  const prompts = [];
  // `ModelGateway.complete` recibe { system, messages }, no un `prompt` suelto.
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'Propuesta redactada.' }; } };
  const store = memoryStore({ 'bezhas:sales:price_catalog': CATALOGO });
  const agent = new ProposalGeneratorAgent(ctx({ store, model }));

  const out = await agent.run({ payload: { lead: { company: 'Naviera' }, items: [{ sku: 'FORM', qty: 2 }] } });

  assert.equal(out.status, 'ok');
  assert.equal(out.quote.totalCents, 120000 * 2);  // IVA 0 % en formación
  assert.match(prompts[0], /TOTAL: 2\.400,00 €/, 'el total va en el prompt ya resuelto');
  assert.match(prompts[0], /cópialos tal cual/i);
});

test('formatCents escribe importes en formato español', () => {
  assert.equal(pricing.formatCents(123450), '1.234,50 €');
  assert.equal(pricing.formatCents(0), '0,00 €');
  assert.equal(pricing.formatCents(99), '0,99 €');
  assert.equal(pricing.formatCents(100000000), '1.000.000,00 €');
});

// ══ 2. Seguimiento: cuándo callarse ══════════════════════════════════════

const DIA = policy.DAY_MS;

test('la secuencia no arranca sin un primer envío previo', () => {
  const d = policy.decide({ attempts: 0, lastSentAt: null });
  assert.equal(d.send, false);
  assert.match(d.reason, /sin contacto previo/);
});

test('respeta el espaciado creciente 3-7-14 días', () => {
  const t0 = 1_000_000_000_000;
  let s = policy.start({ leadKey: 'a', now: t0 });

  assert.equal(policy.decide(s, { now: t0 + 2 * DIA, respectWindow: false }).send, false, 'a los 2 días aún no');
  assert.equal(policy.decide(s, { now: t0 + 3 * DIA, respectWindow: false }).send, true, 'a los 3 sí');

  s = policy.recordSent(s, { now: t0 + 3 * DIA });
  assert.equal(policy.decide(s, { now: t0 + 9 * DIA, respectWindow: false }).send, false, 'el 2º espera 7 días');
  assert.equal(policy.decide(s, { now: t0 + 10 * DIA, respectWindow: false }).send, true);
});

test('se agota tras los intentos previstos y no reanuda nunca', () => {
  let s = policy.start({ leadKey: 'a', now: 0 });
  for (let i = 0; i < policy.DEFAULT_STEPS_DAYS.length; i++) s = policy.recordSent(s, { now: i * 100 * DIA });

  assert.equal(s.stoppedReason, 'exhausted');
  const d = policy.decide(s, { now: 9999 * DIA, respectWindow: false });
  assert.equal(d.send, false);
  assert.match(d.reason, /exhausted/);
});

test('una parada es definitiva y la primera razón manda', () => {
  const s = policy.stop(policy.start({ leadKey: 'a', now: 0 }), 'replied');
  assert.equal(policy.decide(s, { now: 99 * DIA, respectWindow: false }).send, false);
  // Un evento posterior no reescribe el motivo original.
  assert.equal(policy.stop(s, 'bounced').stoppedReason, 'replied');
  assert.throws(() => policy.stop(s, 'motivo_inventado'), /desconocido/);
});

test('no escribe de madrugada ni en fin de semana', () => {
  const t0 = 0;
  const s = policy.start({ leadKey: 'a', now: t0 });
  const ya = t0 + 3 * DIA;

  assert.equal(policy.decide(s, { now: ya, hourOfDay: 3, dayOfWeek: 2 }).send, false, 'las 3 de la mañana no');
  assert.equal(policy.decide(s, { now: ya, hourOfDay: 22, dayOfWeek: 2 }).send, false, 'las 22h tampoco');
  assert.equal(policy.decide(s, { now: ya, hourOfDay: 10, dayOfWeek: 6 }).send, false, 'sábado no');
  assert.equal(policy.decide(s, { now: ya, hourOfDay: 10, dayOfWeek: 0 }).send, false, 'domingo no');
  assert.equal(policy.decide(s, { now: ya, hourOfDay: 10, dayOfWeek: 2 }).send, true, 'martes a las 10 sí');
});

// ══ 3. Agenda: no duplicar ═══════════════════════════════════════════════

function calendarFalso({ slots = ['10:00', '11:00'], onSchedule = null } = {}) {
  const reservas = [];
  return {
    reservas,
    connector: {
      name: 'calendar',
      execute: async (method, args) => {
        if (method === 'getAvailability') return { slots };
        if (method === 'scheduleMeeting') {
          reservas.push(args);
          return onSchedule ? onSchedule(args) : { id: `evt_${reservas.length}`, url: 'https://cal/x', ...args };
        }
        throw new Error(`método inesperado ${method}`);
      },
    },
  };
}

test('reintentar no crea una segunda reunión con el mismo prospecto', async () => {
  const cal = calendarFalso();
  const store = memoryStore();
  const agent = new MeetingBookerAgent(ctx({ store, tools: { calendar: cal.connector } }));
  const task = { payload: { lead: { company: 'Naviera', email: 'a@naviera.com' }, date: '2026-08-10' } };

  const first = await agent.run(task);
  assert.equal(first.status, 'ok');
  assert.equal(first.alreadyBooked, false);

  const second = await agent.run(task);
  assert.equal(second.alreadyBooked, true, 'el reintento debe devolver la existente');
  assert.equal(cal.reservas.length, 1, 'solo puede haberse reservado una vez');
});

test('sin huecos libres NO se inventa una hora', async () => {
  const cal = calendarFalso({ slots: [] });
  const agent = new MeetingBookerAgent(ctx({ store: memoryStore(), tools: { calendar: cal.connector } }));
  const out = await agent.run({ payload: { lead: { company: 'X', email: 'x@x.com' } } });

  assert.equal(out.status, 'no_availability');
  assert.equal(out.meeting, null);
  assert.equal(cal.reservas.length, 0);
});

test('sin conector de calendario lo dice en vez de fallar de forma opaca', async () => {
  const out = await new MeetingBookerAgent(ctx({ store: memoryStore() })).run({ payload: { lead: { email: 'a@b.com' } } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /calendario/);
});

// ══ 4. CRM: no dejar los datos peor ══════════════════════════════════════

test('nunca vacía un campo que ya tenía dato', () => {
  const r = crmMerge.merge({ phone: '600111222', role: 'CTO' }, { phone: null, role: '' });
  assert.deepEqual(r.patch, {});
  assert.equal(r.skipped.length, 2);
  assert.match(r.skipped[0].reason, /no se vacía/);
});

test('no pisa lo que escribió una persona, pero sí rellena lo vacío', () => {
  const actual = { contactName: 'Ana Ruiz', phone: null };
  const r = crmMerge.merge(actual, { contactName: 'A. Ruiz', phone: '600111222' });

  assert.equal(r.patch.contactName, undefined, 'el nombre puesto a mano se respeta');
  assert.equal(r.patch.phone, '600111222', 'el hueco vacío sí se rellena');
  assert.ok(r.skipped.some((s) => s.field === 'contactName'));
});

test('con fromHuman sí se permite corregir un campo humano', () => {
  const r = crmMerge.merge({ contactName: 'Ana Ruiz' }, { contactName: 'Ana Ruíz' }, { trustIncoming: true });
  assert.equal(r.patch.contactName, 'Ana Ruíz');
});

test('la etapa del funnel no retrocede sola', () => {
  assert.deepEqual(crmMerge.merge({ stage: 'propuesta' }, { stage: 'nuevo' }).patch, {});
  assert.equal(crmMerge.merge({ stage: 'nuevo' }, { stage: 'propuesta' }).patch.stage, 'propuesta');
  assert.equal(crmMerge.merge({ stage: 'propuesta' }, { stage: 'nuevo' }, { trustIncoming: true }).patch.stage, 'nuevo');
  assert.match(crmMerge.merge({ stage: 'nuevo' }, { stage: 'inventada' }).skipped[0].reason, /desconocida/);
});

test('un valor idéntico no genera escritura', () => {
  assert.deepEqual(crmMerge.merge({ fitScore: 80 }, { fitScore: 80 }).changed, []);
});

test('si no se puede leer el CRM, no se escribe a ciegas', async () => {
  const crm = { name: 'crm', execute: async (m) => { if (m === 'listLeads') throw new Error('502'); return {}; } };
  const out = await new CRMSyncAgent(ctx({ tools: { crm } })).run({ payload: { lead: { companyName: 'X', phone: '600' } } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /no se escribe sin saber qué hay/);
});

test('dryRun calcula el parche sin escribir nada', async () => {
  let escrituras = 0;
  const crm = {
    name: 'crm',
    execute: async (m) => {
      if (m === 'listLeads') return [{ companyName: 'Naviera', phone: null }];
      escrituras++; return { ok: true };
    },
  };
  const out = await new CRMSyncAgent(ctx({ tools: { crm } }))
    .run({ payload: { lead: { companyName: 'Naviera', phone: '600111222' }, dryRun: true } });

  assert.equal(out.applied, false);
  assert.deepEqual(out.changed, ['phone']);
  assert.equal(escrituras, 0);
});

// ══ 5. Churn: no dar por sano a un desconocido ═══════════════════════════

test('sin señales suficientes devuelve null, NO cero', () => {
  const r = churn.evaluate({ churnIntent: false });
  assert.equal(r.score, null);
  assert.equal(r.level, null);
  assert.match(r.note, /insuficientes/);
});

test('decir que se quiere ir es la señal más fuerte', () => {
  const r = churn.evaluate({ churnIntent: true, csatResponses: 3, detractorResponses: 0 });
  assert.ok(r.score >= churn.WEIGHTS.churnIntent);
  assert.equal(r.factors[0].id, 'churn_intent');
});

test('el silencio se mide contra el ritmo del propio cliente', () => {
  // 60 días sin hablar es normal si escribe cada 30; grave si escribe cada 7.
  const tranquilo = churn.evaluate({ daysSinceLastActivity: 60, expectedActivityDays: 30, unpaidInvoices: 0 });
  const alarmante = churn.evaluate({ daysSinceLastActivity: 60, expectedActivityDays: 7, unpaidInvoices: 0 });
  assert.ok(alarmante.score > tranquilo.score);
  assert.ok(!tranquilo.factors.some((f) => f.id === 'inactivity'));
});

test('el informe explica siempre QUÉ factores pesaron', () => {
  const r = churn.evaluate({ churnIntent: true, csatResponses: 4, detractorResponses: 4, ticketsTotal: 12, escalations: 8, unpaidInvoices: 2 });
  assert.equal(r.level, 'alto');
  assert.ok(r.factors.length >= 3);
  for (const f of r.factors) {
    assert.ok(f.detail && f.detail.length > 10, 'cada factor debe explicarse en texto');
    assert.ok(f.points > 0);
  }
  assert.ok(r.factors[0].points >= r.factors[1].points, 'ordenados por peso');
});

test('el score se acota a 0-100 aunque se acumulen todas las señales', () => {
  const r = churn.evaluate({
    churnIntent: true, csatResponses: 10, detractorResponses: 10,
    ticketsTotal: 50, escalations: 50, daysSinceLastActivity: 999,
    expectedActivityDays: 1, unpaidInvoices: 99,
  });
  assert.ok(r.score <= 100 && r.score >= 0);
  assert.equal(r.level, 'alto');
});

test('el agente no inventa recomendación cuando no hay datos', async () => {
  let llamadas = 0;
  const model = { complete: async () => { llamadas++; return { text: 'x' }; } };
  const out = await new ChurnPredictorAgent(ctx({ model })).run({ payload: { customerId: 'c1', signals: { churnIntent: false } } });

  assert.equal(out.status, 'insufficient_data');
  assert.equal(out.score, null);
  assert.equal(out.recommendation, null);
  assert.equal(llamadas, 0, 'sin datos no se gasta modelo');
});

test('riesgo alto emite aviso; riesgo bajo no', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('sales:churn_risk', (e) => avisos.push(e));
  const model = { complete: async () => ({ text: 'Llamar al responsable esta semana.' }) };

  const alto = { churnIntent: true, csatResponses: 3, detractorResponses: 3, ticketsTotal: 15, escalations: 10, unpaidInvoices: 2 };
  await new ChurnPredictorAgent(ctx({ bus, model })).run({ payload: { customerId: 'malo', signals: alto } });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].level, 'alto');
  assert.ok(avisos[0].factors.length, 'el aviso lleva los motivos, no solo el número');

  const bajo = { churnIntent: false, csatResponses: 5, detractorResponses: 0, unpaidInvoices: 0 };
  await new ChurnPredictorAgent(ctx({ bus, model })).run({ payload: { customerId: 'bueno', signals: bajo } });
  assert.equal(avisos.length, 1, 'una cuenta sana no debe avisar');
});
