'use strict';

/**
 * Pipeline de captación de leads: fuentes → scorer → matcher → outreach + aprendizaje.
 *
 * Las tres cosas que aquí se pueden romper y NO se ven en producción hasta que
 * es tarde:
 *   1. Un lead que no cierra el HITL aún gasta cuota como si se hubiera enviado
 *      (el tracker cuenta 'delivered'). Test: sin sent, se registra 'ignored'.
 *   2. La misma persona entra por dos fuentes y se le envía dos veces. Test: dedup.
 *   3. Los pesos aprendidos se aplican en medio de un run y cambian el resultado
 *      según orden de procesamiento. Test: se aplican solo entre runs.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const LeadFunnel = require('../src/platform/LeadFunnel');
const LeadOutcomeTracker = require('../src/platform/LeadOutcomeTracker');
const PitchMatcherAgent = require('../src/agents/sales/PitchMatcherAgent');
const { WebFormSource, OwnedListSource, PublicSearchSource, LinkedInInboundSource } = require('../src/platform/leadSources');

// ── Dobles ────────────────────────────────────────────────────────────────

/**
 * Doble de agente. Expone `run(task)` — el MISMO contrato que `BaseAgent`.
 * Importa: un doble con un método que el agente real no tiene (p.ej. `handle`)
 * deja pasar tests verdes mientras la integración real está rota.
 */
function fakeAgent({ id, run }) {
  return { id, run: async (task) => run(task) };
}

function memoryStore() {
  const facts = new Map();
  const key = (t, k) => `${t}:${k}`;
  return {
    getFact: async ({ tenantId, key: k }) => facts.get(key(tenantId, k)),
    setFact: async ({ tenantId, key: k, value }) => { facts.set(key(tenantId, k), value); },
    _facts: facts,
  };
}

function funnelStd({ tracker, sources = [], outreachSent = true } = {}) {
  const scorer = fakeAgent({ id: 'scorer', run: async (task) => ({
    score: task.payload.lead._score ?? 90,
    segment: task.payload.lead._segment || 'logistica',
    status: 'ok',
  }) });
  const matcher = fakeAgent({ id: 'matcher', run: async (task) => ({
    subApp: task.payload.lead._subApp || 'cargo-link',
    offer: 'ángulo (CargoLink)',
    status: 'ok',
  }) });
  const outreach = fakeAgent({ id: 'outreach', run: async (task) => ({
    send: { sent: outreachSent, status: outreachSent ? 'sent' : 'pending' },
    status: 'ok',
    lead: task.payload.lead,
  }) });
  return new LeadFunnel({
    tenantId: 't', tracker, sources,
    agents: { scorer, matcher, outreach },
  });
}

// ── Contrato del funnel ───────────────────────────────────────────────────

test('faltar cualquier agente falla al construir (fallo temprano, no en runtime)', () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  assert.throws(() => new LeadFunnel({ tenantId: 't', tracker: tr, agents: {} }), /scorer requerido/);
});

test('run() sin fuentes devuelve summary vacío sin fallar', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  const f = funnelStd({ tracker: tr, sources: [] });
  const r = await f.run({ sector: 'logistica' });
  assert.equal(r.summary.discovered, 0);
  assert.equal(r.summary.outreached, 0);
});

test('procesa cada lead: score → match → outreach → registra outcome', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  const src = new OwnedListSource({
    leads: [
      { company: 'AcmeLog', contact: 'Ana', email: 'ana@acmelog.com' },
      { company: 'BrixPort', contact: 'Bo',  email: 'bo@brixport.com' },
    ],
  });
  const f = funnelStd({ tracker: tr, sources: [src] });

  const r = await f.run({ sector: 'logistica' });
  assert.equal(r.summary.discovered, 2);
  assert.equal(r.summary.outreached, 2);
  assert.equal(tr.snapshot().recent, 2, 'ambos deben quedar registrados');
});

test('un lead con score < umbral no se envía y no cuenta como delivered', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  const src = new OwnedListSource({ leads: [{ company: 'LowFit', _score: 30 }] });
  const f = funnelStd({ tracker: tr, sources: [src] });
  const r = await f.run({});
  assert.equal(r.summary.belowThreshold, 1);
  assert.equal(r.summary.outreached, 0);
  assert.equal(tr.snapshot().recent, 0, 'nada que registrar si ni siquiera se intentó');
});

test('HITL pendiente (no aprobado aún) NO se cuenta como delivered', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  const src = new OwnedListSource({ leads: [{ company: 'Pending' }] });
  const f = funnelStd({ tracker: tr, sources: [src], outreachSent: false });
  await f.run({});
  const rec = tr._recent[0];
  assert.equal(rec.outcome, 'ignored', 'sin aprobación humana no hubo entrega');
});

test('dedup por email/company: dos fuentes, mismo lead → una sola vez', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  const s1 = new OwnedListSource({ leads: [{ company: 'Dup', email: 'x@dup.com' }], name: 'listA' });
  const s2 = new OwnedListSource({ leads: [{ company: 'Dup', email: 'x@dup.com' }], name: 'listB' });
  const f = funnelStd({ tracker: tr, sources: [s1, s2] });
  const r = await f.run({});
  assert.equal(r.summary.discovered, 1, 'debe deduplicar');
  assert.equal(r.summary.outreached, 1);
});

test('respeta maxLeadsPerRun (protege cuota del tenant)', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  const many = Array.from({ length: 100 }, (_, i) => ({ company: `c${i}`, email: `c${i}@x.com` }));
  const f = funnelStd({ tracker: tr, sources: [new OwnedListSource({ leads: many })] });
  f.maxLeadsPerRun = 10;
  const r = await f.run({});
  assert.equal(r.summary.discovered, 10);
});

test('una fuente que lanza no rompe al resto', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  const rota = { name: 'rota', discover: async () => { throw new Error('boom'); } };
  const ok  = new OwnedListSource({ leads: [{ company: 'sobrevive' }] });
  const f = funnelStd({ tracker: tr, sources: [rota, ok] });
  const r = await f.run({});
  assert.equal(r.summary.discovered, 1);
});

// ── Aprendizaje ──────────────────────────────────────────────────────────

test('pesos aprendidos se aplican al SIGUIENTE run, no en medio del actual', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  // Simula un run previo con ganancias en (logistica, cargo-link).
  await tr.record({ leadKey: 'k1', source: 'listA', segment: 'logistica', subApp: 'cargo-link', outcome: 'closed_won' });
  await tr.record({ leadKey: 'k2', source: 'listA', segment: 'logistica', subApp: 'pure-scan', outcome: 'ignored' });

  const matcher  = { id: 'm', run: async () => ({ subApp: 'cargo-link', offer: 'x', status: 'ok' }) };
  const scorer   = { id: 's', run: async () => ({ score: 90, segment: 'logistica', status: 'ok' }) };
  const outreach = { id: 'o', run: async () => ({ send: { sent: true }, status: 'ok' }) };

  const f = new LeadFunnel({
    tenantId: 't', tracker: tr,
    agents: { scorer, matcher, outreach },
    sources: [new OwnedListSource({ leads: [{ company: 'x' }] })],
  });

  await f.run({});
  const weights = matcher.weights;
  assert.ok(weights instanceof Map && weights.size > 0, 'los pesos del run previo llegaron al matcher antes del run');
  // Ganó cargo-link → factor > 1; perdió pure-scan → factor < 1.
  assert.ok(weights.get('logistica:cargo-link') > weights.get('logistica:pure-scan'));
});

test('el ranking de fuentes ordena por rendimiento suavizado (Laplace)', () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  // Fuente A: 1 cierre de 1 → 100%. Fuente B: 0 cierres de 20 → 0%.
  tr._stats.set('A|s|x', { attempts: 1, wins: 1 });
  tr._stats.set('B|s|x', { attempts: 20, wins: 0 });
  const rank = tr.sourceRanking();
  assert.equal(rank[0].source, 'A');
  // Con Laplace, A no está en 100% (evita overconfidence con 1 muestra).
  assert.ok(rank[0].rate < 1);
});

// ── Fuentes ──────────────────────────────────────────────────────────────

test('WebFormSource lee la cola y la vacía', async () => {
  const store = memoryStore();
  await store.setFact({ tenantId: 't', key: 'intake:queue', value: [
    { company: 'A', email: 'a@a.com' },
    { company: 'B', email: 'b@b.com' },
  ] });
  const src = new WebFormSource({ store, tenantId: 't' });

  const first = await src.discover({}, { limit: 1 });
  assert.equal(first.length, 1);
  assert.equal(first[0]._source, 'web-form');

  const remaining = await store.getFact({ tenantId: 't', key: 'intake:queue' });
  assert.equal(remaining.length, 1, 'lo consumido sale de la cola');
});

test('PublicSearchSource parsea JSON estructurado del MCP', () => {
  const out = PublicSearchSource.parse({ results: [
    { company: 'BrixPort', role: 'CTO', snippet: 'operador portuario' },
    { name: 'NoWay' },
  ] });
  assert.equal(out.length, 2);
  assert.equal(out[0].company, 'BrixPort');
  assert.equal(out[1].company, 'NoWay');
});

test('PublicSearchSource parsea texto plano línea a línea', () => {
  const out = PublicSearchSource.parse(
    '1. AcmeLog: operador aduanero de Valencia\nBrixPort — logística marítima\nsolo-un-nombre',
    { limit: 5 },
  );
  assert.equal(out.length, 3);
  assert.equal(out[0].company, 'AcmeLog');
  assert.equal(out[1].notes, 'logística marítima');
  assert.equal(out[2].company, 'solo-un-nombre');
});

test('PublicSearchSource: si el MCP falla, devuelve [] y no rompe el funnel', async () => {
  const mcp = { name: 'mock', execute: async () => { throw new Error('rate limit'); } };
  const src = new PublicSearchSource({ mcp });
  const r = await src.discover({}, { limit: 5 });
  assert.deepEqual(r, []);
});

test('LinkedInInboundSource solo devuelve los leads con utm_source=linkedin', async () => {
  const store = memoryStore();
  await store.setFact({ tenantId: 't', key: 'intake:queue', value: [
    { company: 'FromLI', email: 'a@a.com', utm_source: 'linkedin' },
    { company: 'FromGoogle', email: 'b@b.com', utm_source: 'google' },
  ] });
  const web = new WebFormSource({ store, tenantId: 't' });
  const li = new LinkedInInboundSource({ webFormSource: web });

  const mine = await li.discover({}, { limit: 10 });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].company, 'FromLI');
  assert.equal(mine[0]._source, 'linkedin-inbound');

  // Los de Google vuelven a la cola para que el web-form los sirva luego.
  const remaining = await store.getFact({ tenantId: 't', key: 'intake:queue' });
  assert.ok(remaining.some((r) => r.company === 'FromGoogle'));
});

// ── PitchMatcher (reglas puras, sin modelo) ──────────────────────────────

test('PitchMatcher.pick: segmento logística → CargoLink', () => {
  const m = new PitchMatcherAgent({ tenantId: 't', modelGateway: null, tools: {}, bus: null });
  const s = m.pick({ segment: 'logistica' });
  assert.equal(s.key, 'cargo-link');
});

test('PitchMatcher.pick: keywords del texto libre suman al matching', () => {
  const m = new PitchMatcherAgent({ tenantId: 't', modelGateway: null, tools: {}, bus: null });
  const s = m.pick({ segment: 'startup', notes: 'buscamos ronda SAFE seed' });
  assert.equal(s.key, 'fundraising');
});

test('PitchMatcher.pick: pesos aprendidos cambian el ganador entre candidatos parejos', () => {
  const m = new PitchMatcherAgent({ tenantId: 't', modelGateway: null, tools: {}, bus: null });
  // Sin pesos, logistica → cargo-link.
  assert.equal(m.pick({ segment: 'logistica' }).key, 'cargo-link');

  // Reforzamos pure-scan y penalizamos cargo-link en ese segmento.
  m.weights = new Map([
    ['logistica:cargo-link', 0.3],
    ['logistica:pure-scan', 4],
  ]);
  // Nota: con solo el segmento logística, pure-scan no es candidato base.
  // Con texto que active ambos, el peso decide.
  const pick = m.pick({ segment: 'logistica', notes: 'kyc aml aduanas' });
  assert.equal(pick.key, 'pure-scan', 'pesos aprendidos deben invertir la elección cuando hay dos candidatos');
});

test('PitchMatcher.pick: sin señal cae a bez-coin (fallback genérico)', () => {
  const m = new PitchMatcherAgent({ tenantId: 't', modelGateway: null, tools: {}, bus: null });
  assert.equal(m.pick({}).key, 'bez-coin');
});

// ── OutcomeTracker: persistencia y validación ────────────────────────────

test('OutcomeTracker rechaza outcomes desconocidos (evita ensuciar el corpus)', async () => {
  const tr = new LeadOutcomeTracker({ tenantId: 't' });
  await assert.rejects(() => tr.record({ leadKey: 'k', source: 's', segment: 'x', subApp: 'y', outcome: 'inventado' }), /outcome inválido/);
});

// ── Contrato con los agentes REALES ──────────────────────────────────────
// Los dobles de arriba son cómodos, pero si el funnel invocara un método que
// BaseAgent no implementa (pasó: llamaba `handle()` en vez de `run()`), los
// tests con dobles seguirían verdes y la integración estaría rota. Este test
// usa las clases reales en modo simulado para fijar el contrato.

test('el funnel habla el contrato real de BaseAgent (run), no uno inventado', async () => {
  const ModelGateway = require('../src/cognition/ModelGateway');
  const PolicyEngine = require('../src/guardrails/PolicyEngine');
  const HITLGate = require('../src/core/HITLGate');
  const EventBus = require('../src/core/EventBus');
  const BusinessProfile = require('../src/platform/BusinessProfile');
  const LeadScorerAgent = require('../src/agents/sales/LeadScorerAgent');
  const OutreachAgent = require('../src/agents/sales/OutreachAgent');

  const ctx = {
    tenantId: 'bezhas', department: 'sales',
    model: new ModelGateway({ providers: {} }),      // simulado, sin credenciales
    guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
    bus: new EventBus('bezhas'),
    business: BusinessProfile.fromFile('bezhas'),
    hitl: new HITLGate({}),
    tools: {},
  };

  const funnel = new LeadFunnel({
    tenantId: 'bezhas',
    tracker: new LeadOutcomeTracker({ tenantId: 'bezhas' }),
    agents: {
      scorer:   new LeadScorerAgent(ctx),
      matcher:  new PitchMatcherAgent(ctx),
      outreach: new OutreachAgent(ctx),
    },
    sources: [new OwnedListSource({ leads: [{ company: 'Naviera Test', role: 'Dir. Operaciones' }] })],
    minScoreToOutreach: 0,   // que llegue hasta el final sea cual sea el score simulado
  });

  const r = await funnel.run({ sector: 'logistica' });

  assert.equal(r.summary.discovered, 1);
  assert.equal(r.summary.failed, 0, `no debe fallar; error: ${r.processed[0]?.error || ''}`);
  assert.ok(r.processed[0].subApp, 'el matcher real debe devolver una SubApp');
});

test('OutcomeTracker persiste y se rehidrata idéntico', async () => {
  const store = memoryStore();
  const tr1 = new LeadOutcomeTracker({ tenantId: 't', store });
  await tr1.record({ leadKey: 'k1', source: 's', segment: 'x', subApp: 'y', outcome: 'closed_won' });
  await tr1.record({ leadKey: 'k2', source: 's', segment: 'x', subApp: 'y', outcome: 'ignored' });

  const tr2 = new LeadOutcomeTracker({ tenantId: 't', store });
  await tr2.hydrate();
  assert.deepEqual(tr2.snapshot().sources, tr1.snapshot().sources);
});
