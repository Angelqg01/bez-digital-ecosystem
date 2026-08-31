'use strict';

/**
 * Los dos especialistas que faltaban en Finanzas.
 *
 * Fallos caros que se blindan aquí:
 *   - **Categorización de gastos**: inventar una categoría que no existe en
 *     la contabilidad real, o tratar un acierto de suerte como una certeza —
 *     ambas cosas desalinean el IVA deducible en la declaración.
 *   - **Conciliación bancaria**: casar un movimiento con la factura equivocada
 *     deja dos rastros falsos a la vez (una "cobrada" que no lo está, y una
 *     de verdad cobrada que Collections sigue reclamando).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const expenseCategories = require('../src/platform/expenseCategories');
const reconciliation = require('../src/platform/reconciliation');
const pricing = require('../src/platform/priceCatalog');
const ExpenseCategorizerAgent = require('../src/agents/finance/ExpenseCategorizerAgent');
const ReconciliationAgent = require('../src/agents/finance/ReconciliationAgent');
const InvoiceAgent = require('../src/agents/finance/InvoiceAgent');
const FinanceManager = require('../src/agents/finance/FinanceManager');
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
  tenantId: 'bezhas', department: 'finance',
  model: new ModelGateway({ providers: {} }),
  bus: new EventBus('bezhas'),
  ...extra,
});

const CAT_SAAS = { id: 'cat_saas', name: 'Software y SaaS', vatDeductible: true, keywords: ['saas', 'suscripcion', 'software'], vendors: ['aws', 'vercel'] };
const CAT_COMIDA = { id: 'cat_comida', name: 'Dietas y representación', vatDeductible: false, keywords: ['comida', 'restaurante', 'cena'], vendors: [] };

// ══ Categorización: no inventar categoría, no fingir certeza ═════════════

test('proveedor exacto conocido clasifica con confianza', () => {
  const r = expenseCategories.classify([CAT_SAAS, CAT_COMIDA], { vendor: 'AWS', description: 'factura mensual' });
  assert.equal(r.needsReview, false);
  assert.equal(r.category.id, 'cat_saas');
  assert.ok(r.confidence >= expenseCategories.MIN_CONFIDENCE);
});

test('sin proveedor conocido, las palabras clave solas NUNCA bastan (diseño conservador)', () => {
  // Documentado a propósito: el concepto de un extracto bancario es poco
  // fiable; sin proveedor, ni con muchas coincidencias de palabras se cruza
  // el umbral. Evita que "restaurante" en el concepto categorice solo con
  // certeza cuando podría ser cualquier cosa.
  const r = expenseCategories.classify([CAT_COMIDA], { vendor: '', description: 'comida restaurante cena' });
  assert.equal(r.needsReview, true);
  assert.ok(r.confidence < expenseCategories.MIN_CONFIDENCE);
});

test('sin plan contable cargado, no hay categoría que asignar', () => {
  const r = expenseCategories.classify([], { vendor: 'AWS', description: 'x' });
  assert.equal(r.needsReview, true);
  assert.equal(r.category, null);
  assert.match(r.reason, /sin plan contable/);
});

test('nada encaja: se marca para revisión, nunca se inventa la más parecida', () => {
  const r = expenseCategories.classify([CAT_SAAS], { vendor: 'Iberia', description: 'billete de avion' });
  assert.equal(r.needsReview, true);
  assert.equal(r.category, null);
});

test('categorizar es idempotente: un reintento no recategoriza sola', async () => {
  const store = memoryStore();
  const r1 = await expenseCategories.recordDecision({ store, tenantId: 't', transactionId: 'txn1', categoryId: 'cat_saas', confidence: 0.9, source: 'auto' });
  assert.equal(r1.recorded, true);
  const r2 = await expenseCategories.recordDecision({ store, tenantId: 't', transactionId: 'txn1', categoryId: 'cat_comida', confidence: 0.9, source: 'auto' });
  assert.equal(r2.recorded, false, 'un segundo intento automático no debe pisar la decisión');
});

test('un humano SÍ puede corregir una categorización ya registrada', async () => {
  const store = memoryStore();
  await expenseCategories.recordDecision({ store, tenantId: 't', transactionId: 'txn1', categoryId: 'cat_saas', confidence: 0.9, source: 'auto' });
  const r = await expenseCategories.recordDecision({ store, tenantId: 't', transactionId: 'txn1', categoryId: 'cat_comida', confidence: 1, source: 'human' });
  assert.equal(r.recorded, true);
});

test('rechaza categorías sin nombre', () => {
  assert.throws(() => expenseCategories.validateCategory({}), /name requerido/);
});

// ══ Agente categorizador ══════════════════════════════════════════════════

test('el agente exige transactionId (para no recategorizar en cada reintento)', async () => {
  const out = await new ExpenseCategorizerAgent(ctx()).run({ payload: { vendor: 'AWS', description: 'x' } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /transactionId/);
});

test('sin plan contable el agente se niega a categorizar', async () => {
  const out = await new ExpenseCategorizerAgent(ctx({ store: memoryStore() }))
    .run({ payload: { transactionId: 't1', vendor: 'AWS', description: 'x' } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /plan contable/);
});

test('con confianza suficiente, categoriza sola y lo persiste', async () => {
  const store = memoryStore({ 'bezhas:finance:expense_categories': [CAT_SAAS] });
  const out = await new ExpenseCategorizerAgent(ctx({ store }))
    .run({ payload: { transactionId: 't1', vendor: 'AWS', description: 'factura' } });

  assert.equal(out.needsReview, false);
  assert.equal(out.category.id, 'cat_saas');
  assert.equal(out.recorded, true);
});

test('sin confianza, avisa y NO categoriza — con sugerencia del modelo pero sin aplicarla', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('finance:expense_needs_review', (e) => avisos.push(e));
  const model = { complete: async () => ({ text: 'Podría ser cat_saas por el concepto, pero no estoy seguro.' }) };
  const store = memoryStore({ 'bezhas:finance:expense_categories': [CAT_SAAS] });

  const out = await new ExpenseCategorizerAgent(ctx({ store, bus, model }))
    .run({ payload: { transactionId: 't2', vendor: '', description: 'cargo sin identificar' } });

  assert.equal(out.needsReview, true);
  assert.equal(out.category, null);
  assert.ok(out.modelSuggestion);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].transactionId, 't2');

  const decisiones = store._facts.get('bezhas:finance:expense_decisions');
  assert.equal(decisiones, undefined, 'la sugerencia del modelo no debe auto-aplicarse');
});

test('un fallo del modelo en el caso dudoso no rompe el flujo de revisión', async () => {
  const model = { complete: async () => { throw new Error('caído'); } };
  const store = memoryStore({ 'bezhas:finance:expense_categories': [CAT_SAAS] });
  const out = await new ExpenseCategorizerAgent(ctx({ store, model }))
    .run({ payload: { transactionId: 't3', vendor: '', description: 'raro' } });
  assert.equal(out.status, 'ok');
  assert.equal(out.needsReview, true);
  assert.equal(out.modelSuggestion, null);
});

// ══ Conciliación: no adivinar entre iguales, no inventar tipo de cambio ══

test('importe exacto único concilia', () => {
  const r = reconciliation.match(
    [{ id: 't1', amountCents: 100000, currency: 'EUR', date: '2026-07-01' }],
    [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-05' }],
  );
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].invoiceId, 'i1');
  assert.equal(r.matched[0].exact, true);
});

test('dos facturas casan igual de bien: ninguna se marca, se declara ambigüedad', () => {
  const r = reconciliation.match(
    [{ id: 't1', amountCents: 50000, currency: 'EUR', date: '2026-07-01' }],
    [
      { id: 'i1', amountCents: 50000, currency: 'EUR', dueDate: '2026-07-02' },
      { id: 'i2', amountCents: 50000, currency: 'EUR', dueDate: '2026-07-03' },
    ],
  );
  assert.equal(r.matched.length, 0);
  assert.equal(r.ambiguous.length, 1);
  assert.equal(r.ambiguous[0].type, 'exact');
  assert.deepEqual(r.ambiguous[0].candidates.sort(), ['i1', 'i2']);
});

test('un pago menor que la factura es parcial, nunca "saldada"', () => {
  const r = reconciliation.match(
    [{ id: 't1', amountCents: 30000, currency: 'EUR', date: '2026-07-01' }],
    [{ id: 'i1', amountCents: 60000, currency: 'EUR', dueDate: '2026-07-02' }],
  );
  assert.equal(r.matched.length, 0);
  assert.equal(r.partial.length, 1);
  assert.equal(r.partial[0].paidCents, 30000);
  assert.equal(r.partial[0].dueCents, 60000);
});

test('varias candidatas para un pago parcial también se declaran ambiguas (no se pierden en silencio)', () => {
  // Bug real encontrado y corregido: antes, más de una candidata parcial
  // caía como "sin conciliar" sin decir que había opciones.
  const r = reconciliation.match(
    [{ id: 't1', amountCents: 30000, currency: 'EUR', date: '2026-07-01' }],
    [
      { id: 'i1', amountCents: 60000, currency: 'EUR', dueDate: '2026-07-02' },
      { id: 'i2', amountCents: 70000, currency: 'EUR', dueDate: '2026-07-03' },
    ],
  );
  assert.equal(r.partial.length, 0);
  assert.equal(r.ambiguous.length, 1);
  assert.equal(r.ambiguous[0].type, 'partial');
  assert.equal(r.unmatchedTransactions.length, 0, 'no debe aparecer como simplemente sin conciliar');
});

test('monedas distintas nunca se cruzan (sin inventar tipo de cambio)', () => {
  const r = reconciliation.match(
    [{ id: 't1', amountCents: 100000, currency: 'USD', date: '2026-07-01' }],
    [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-02' }],
  );
  assert.equal(r.matched.length, 0);
  assert.deepEqual(r.unmatchedTransactions, ['t1']);
});

test('fuera de la ventana de fechas no concilia', () => {
  const r = reconciliation.match(
    [{ id: 't1', amountCents: 100000, currency: 'EUR', date: '2026-01-01' }],
    [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' }],
    { windowDays: 45 },
  );
  assert.equal(r.matched.length, 0);
  assert.deepEqual(r.unmatchedTransactions, ['t1']);
});

test('una factura conciliada no puede volver a casar con otro movimiento', () => {
  const r = reconciliation.match(
    [
      { id: 't1', amountCents: 100000, currency: 'EUR', date: '2026-07-01' },
      { id: 't2', amountCents: 100000, currency: 'EUR', date: '2026-07-02' },
    ],
    [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' }],
  );
  assert.equal(r.matched.length, 1, 'solo el primero (por importe desc.) se la queda');
});

test('tolerancia de céntimos absorbe comisiones bancarias pero no más', () => {
  const dentro = reconciliation.match(
    [{ id: 't1', amountCents: 99970, currency: 'EUR', date: '2026-07-01' }],
    [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' }],
    { toleranceCents: 50 },
  );
  assert.equal(dentro.matched.length, 1);

  const fuera = reconciliation.match(
    [{ id: 't1', amountCents: 99000, currency: 'EUR', date: '2026-07-01' }],
    [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' }],
    { toleranceCents: 50 },
  );
  assert.equal(fuera.matched.length, 0);
  assert.equal(fuera.partial.length, 1, 'fuera de tolerancia pero por debajo cae en parcial');
});

// ══ Agente de conciliación ═══════════════════════════════════════════════

test('el agente exige transactions e invoices', async () => {
  const out = await new ReconciliationAgent(ctx()).run({ payload: {} });
  assert.equal(out.status, 'blocked');
});

test('concilia, persiste el estado y avisa de lo ambiguo', async () => {
  const store = memoryStore();
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('finance:reconciliation_ambiguous', (e) => avisos.push(e));

  const out = await new ReconciliationAgent(ctx({ store, bus })).run({
    payload: {
      transactions: [
        { id: 't1', amountCents: 100000, currency: 'EUR', date: '2026-07-01' },
        { id: 't2', amountCents: 50000, currency: 'EUR', date: '2026-07-02' },
      ],
      invoices: [
        { id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' },
        { id: 'i2', amountCents: 50000, currency: 'EUR', dueDate: '2026-07-02' },
        { id: 'i3', amountCents: 50000, currency: 'EUR', dueDate: '2026-07-03' },
      ],
    },
  });

  assert.equal(out.matched.length, 1);
  assert.equal(out.ambiguous.length, 1);
  assert.equal(avisos.length, 1);

  const estado = store._facts.get('bezhas:finance:reconciliation_state');
  assert.ok(estado.invoiceIds.includes('i1'));
});

test('idempotente entre corridas: re-conciliar el mismo extracto no duplica ni reprocesa', async () => {
  const store = memoryStore();
  const agent = new ReconciliationAgent(ctx({ store }));
  const payload = {
    transactions: [{ id: 't1', amountCents: 100000, currency: 'EUR', date: '2026-07-01' }],
    invoices: [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' }],
  };

  const r1 = await agent.run({ payload });
  assert.equal(r1.matched.length, 1);

  const r2 = await agent.run({ payload });
  assert.equal(r2.matched.length, 0, 'la segunda corrida no debe volver a emparejar lo ya resuelto');
  assert.deepEqual(r2.unmatchedTransactions, [], 't1 ya no está en el pool, ni matched ni unmatched');
});

test('un pago parcial no retira la factura: sigue disponible para completarla', async () => {
  const store = memoryStore();
  const agent = new ReconciliationAgent(ctx({ store }));

  await agent.run({
    payload: {
      transactions: [{ id: 't1', amountCents: 30000, currency: 'EUR', date: '2026-07-01' }],
      invoices: [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' }],
    },
  });

  const r2 = await agent.run({
    payload: {
      transactions: [{ id: 't2', amountCents: 70000, currency: 'EUR', date: '2026-07-02' }],
      invoices: [{ id: 'i1', amountCents: 100000, currency: 'EUR', dueDate: '2026-07-01' }],
    },
  });

  assert.equal(r2.partial.length, 1, 'i1 seguía disponible tras el primer pago parcial');
});

// ══ InvoiceAgent: el mismo bug de matemática financiera que ya se corrigió ═
// en ProposalGeneratorAgent, pero aquí el resultado acaba en un documento
// fiscal real archivado. Y estaba, además, INALCANZABLE: el enrutador de
// FinanceManager mandaba 'finance:invoice' a InvoiceBot, así que ninguna
// tarea real llegaba nunca a este agente.

const CATALOGO = [
  { sku: 'ESCROW', name: 'QualityEscrow', unitPriceCents: 49900, unit: 'mes', recurring: true, vatPct: 21 },
  { sku: 'FORM', name: 'Formación', unitPriceCents: 120000, unit: 'sesión', recurring: false, vatPct: 0 },
];

function memoryStoreCatalog(catalog) {
  return memoryStore({ 'bezhas:sales:price_catalog': catalog });
}

test('sin catálogo cargado, no se emite factura (nunca se inventa un importe)', async () => {
  const agent = new InvoiceAgent(ctx({ store: memoryStore() }));
  const out = await agent.run({ payload: { client: 'Naviera', items: [{ sku: 'ESCROW', qty: 1 }] } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /catálogo/i);
  assert.equal(out.draft, null);
});

test('un SKU fuera de catálogo bloquea con la lista de SKUs válidos', async () => {
  const agent = new InvoiceAgent(ctx({ store: memoryStoreCatalog(CATALOGO) }));
  const out = await agent.run({ payload: { client: 'X', items: [{ sku: 'NOPE', qty: 1 }] } });
  assert.equal(out.status, 'blocked');
  assert.deepEqual(out.availableSkus, ['ESCROW', 'FORM']);
});

test('el IVA se calcula por línea (tipos mixtos) y el modelo recibe los importes ya resueltos', async () => {
  const prompts = [];
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'Factura redactada.' }; } };
  const agent = new InvoiceAgent(ctx({ store: memoryStoreCatalog(CATALOGO), model }));

  const out = await agent.run({ payload: { client: 'Naviera Atlántica', items: [{ sku: 'ESCROW', qty: 12 }, { sku: 'FORM', qty: 1 }] } });

  assert.equal(out.status, 'ok');
  // Solo el escrow lleva IVA (21%); la formación va al 0%.
  const ivaEsperado = Math.round(49900 * 12 * 0.21);
  assert.equal(out.quote.vatCents, ivaEsperado);
  assert.equal(out.quote.totalCents, 49900 * 12 + 120000 + ivaEsperado);
  assert.match(prompts[0], /cópialos tal cual/i);
  assert.match(prompts[0], new RegExp(pricing.formatCents(out.quote.totalCents).replace(/[.,€]/g, '\\$&')));
});

test('InvoiceAgent ahora tiene una ruta real en FinanceManager (antes era inalcanzable)', async () => {
  const fm = new FinanceManager({
    tenantId: 'bezhas', department: 'finance',
    model: new ModelGateway({ providers: {} }),
    guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
    hitl: new HITLGate({}),
    bus: new EventBus('bezhas'),
    store: memoryStoreCatalog(CATALOGO),
    tools: {},
  });

  const out = await fm.run({ type: 'finance:invoice-draft', payload: { client: 'X', items: [{ sku: 'FORM', qty: 1 }] } });
  assert.equal(out.results[0].step, 'finance.invoice', 'debe llegar al agente real, no quedarse en el manager por defecto');
  assert.equal(out.results[0].out.status, 'ok');
});

test('finance:invoice sigue yendo a InvoiceBot (no se rompió la ruta existente)', async () => {
  const fm = new FinanceManager({
    tenantId: 'bezhas', department: 'finance',
    model: new ModelGateway({ providers: {} }),
    guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
    hitl: new HITLGate({}),
    bus: new EventBus('bezhas'),
    tools: {},
  });
  const out = await fm.run({ type: 'finance:invoice', payload: { client: 'Globex', amount: 500 } });
  assert.equal(out.results[0].step, 'finance.invoice-bot');
});
