'use strict';

/**
 * Los dos especialistas que faltaban en Marketing.
 *
 * Fallos caros que se blindan aquí:
 *   - **Publicación programada**: que salga un post aprobado hace días en
 *     mitad de un incidente. Le ha pasado a marcas grandes, y en BeZhas un
 *     mensaje entusiasta durante un exploit sería exactamente eso.
 *   - **Análisis de campaña**: declarar ganador a partir de ruido y cambiar
 *     la campaña por una diferencia que no existía.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const queue = require('../src/platform/socialQueue');
const ab = require('../src/platform/abTest');
const SocialSchedulerAgent = require('../src/agents/marketing/SocialSchedulerAgent');
const CampaignAnalystAgent = require('../src/agents/marketing/CampaignAnalystAgent');
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
  };
}

const HORA = 3_600_000;
const T0 = 1_800_000_000_000;

/**
 * Gate HITL que decide sin humano.
 *
 * Publicar cruza la línea roja `public_communication`, así que un `HITLGate`
 * real deja el test colgado esperando a una persona — que es exactamente lo
 * que debe hacer en producción. Aquí se automatiza la decisión para poder
 * probar la lógica del programador; que la línea roja se cruza de verdad se
 * comprueba aparte, en su propio test.
 */
function gateAuto(approved = true) {
  const solicitudes = [];
  return {
    solicitudes,
    request: async (req) => { solicitudes.push(req); return { approved, note: approved ? 'ok' : 'no' }; },
  };
}

const ctx = (extra = {}) => ({
  tenantId: 'bezhas', department: 'marketing',
  model: new ModelGateway({ providers: {} }),
  guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
  hitl: gateAuto(true),
  bus: new EventBus('bezhas'),
  tools: {},
  ...extra,
});

/** Conector social falso que registra lo publicado. */
function socialFalso() {
  const publicados = [];
  return {
    publicados,
    connector: { name: 'social', execute: async (m, args) => { publicados.push({ m, args }); return { ok: true, id: 'p1' }; } },
  };
}

// ══ Cola: la aprobación caduca ═══════════════════════════════════════════

test('un post sin aprobar no se publica aunque le toque la hora', () => {
  const p = { ...queue.validate({ network: 'linkedin', body: 'hola', scheduledFor: T0 }) };
  const v = queue.canPublish(p, { now: T0 + HORA });
  assert.equal(v.publish, false);
  assert.equal(v.code, 'not_approved');
});

test('aprobado y en hora: se publica', () => {
  const p = { ...queue.validate({ network: 'x', body: 'hola', scheduledFor: T0 }), state: 'approved', approvedAt: T0 - HORA };
  assert.equal(queue.canPublish(p, { now: T0 }).publish, true);
});

test('una aprobación de hace más de 48 h caduca y NO publica', () => {
  const p = {
    ...queue.validate({ network: 'x', body: 'lanzamiento', scheduledFor: T0 }),
    state: 'approved',
    approvedAt: T0 - 72 * HORA,          // se aprobó tres días antes
  };
  const v = queue.canPublish(p, { now: T0 });
  assert.equal(v.publish, false);
  assert.equal(v.code, 'approval_stale');
  assert.match(v.reason, /contexto actual/);
});

test('justo dentro del plazo sí publica (el umbral no es aproximado)', () => {
  const base = queue.validate({ network: 'x', body: 'a', scheduledFor: T0 });
  const dentro = { ...base, state: 'approved', approvedAt: T0 - (queue.APPROVAL_TTL_MS - 1000) };
  const fuera = { ...base, state: 'approved', approvedAt: T0 - (queue.APPROVAL_TTL_MS + 1000) };
  assert.equal(queue.canPublish(dentro, { now: T0 }).publish, true);
  assert.equal(queue.canPublish(fuera, { now: T0 }).code, 'approval_stale');
});

test('el freno de mano bloquea aunque todo lo demás esté correcto', () => {
  const p = { ...queue.validate({ network: 'x', body: 'a', scheduledFor: T0 }), state: 'approved', approvedAt: T0 };
  const v = queue.canPublish(p, { now: T0, hold: true });
  assert.equal(v.publish, false);
  assert.equal(v.code, 'on_hold');
});

test('un post ya publicado nunca se republica', () => {
  const p = { ...queue.validate({ network: 'x', body: 'a', scheduledFor: T0 }), state: 'published', approvedAt: T0 };
  assert.equal(queue.canPublish(p, { now: T0 + HORA }).code, 'already_published');
});

test('antes de su hora no se adelanta', () => {
  const p = { ...queue.validate({ network: 'x', body: 'a', scheduledFor: T0 + 10 * HORA }), state: 'approved', approvedAt: T0 };
  assert.equal(queue.canPublish(p, { now: T0 }).code, 'not_due');
});

test('validate rechaza lo que no se puede programar', () => {
  assert.throws(() => queue.validate({ body: 'a', scheduledFor: T0 }), /network requerido/);
  assert.throws(() => queue.validate({ network: 'x', scheduledFor: T0 }), /body requerido/);
  assert.throws(() => queue.validate({ network: 'x', body: 'a', scheduledFor: 'mañana' }), /timestamp/);
});

test('aprobar deja sello de tiempo; no se puede aprobar lo ya publicado', async () => {
  const store = memoryStore();
  const p = await queue.enqueue({ store, tenantId: 't', post: { network: 'x', body: 'a', scheduledFor: T0 } });
  const ap = await queue.approve({ store, tenantId: 't', id: p.id, now: T0 });
  assert.equal(ap.state, 'approved');
  assert.equal(ap.approvedAt, T0);

  await queue.update({ store, tenantId: 't', id: p.id, patch: { state: 'published' } });
  await assert.rejects(() => queue.approve({ store, tenantId: 't', id: p.id }), (e) => e.code === 'already_published');
});

// ══ Agente programador ═══════════════════════════════════════════════════

test('publica lo que toca y marca como caducado lo que no', async () => {
  const social = socialFalso();
  const store = memoryStore();
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('marketing:approval_stale', (e) => avisos.push(e));

  const agent = new SocialSchedulerAgent(ctx({ store, bus, tools: { social: social.connector } }));

  await agent.run({ payload: { action: 'schedule', post: { id: 'ok', network: 'x', body: 'al día', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'schedule', post: { id: 'viejo', network: 'x', body: 'antiguo', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'ok', now: T0 - HORA } });
  await agent.run({ payload: { action: 'approve', id: 'viejo', now: T0 - 100 * HORA } });

  const out = await agent.run({ payload: { now: T0 } });

  assert.equal(out.published.length, 1, 'solo el que tiene aprobación fresca');
  assert.equal(out.published[0].id, 'ok');
  assert.ok(out.skipped.some((s) => s.id === 'viejo' && s.code === 'approval_stale'));
  assert.equal(social.publicados.length, 1, 'el caducado NO llegó al conector');
  assert.equal(avisos.length, 1, 'y se avisó para que alguien lo revise');
});

test('con el freno puesto no sale absolutamente nada', async () => {
  const social = socialFalso();
  const store = memoryStore();
  const agent = new SocialSchedulerAgent(ctx({ store, tools: { social: social.connector } }));

  await agent.run({ payload: { action: 'schedule', post: { id: 'a', network: 'x', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'a', now: T0 } });
  await agent.run({ payload: { action: 'hold', active: true, reason: 'incidente on-chain' } });

  const out = await agent.run({ payload: { now: T0 } });

  assert.equal(out.status, 'held');
  assert.equal(out.wouldHavePublished, 1, 'dice cuántos se quedaron dentro');
  assert.equal(social.publicados.length, 0);
  assert.match(out.reason, /incidente on-chain/);
});

test('quitar el freno reanuda la publicación', async () => {
  const social = socialFalso();
  const store = memoryStore();
  const agent = new SocialSchedulerAgent(ctx({ store, tools: { social: social.connector } }));

  await agent.run({ payload: { action: 'schedule', post: { id: 'a', network: 'x', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'a', now: T0 } });
  await agent.run({ payload: { action: 'hold', active: true, reason: 'incidente' } });
  await agent.run({ payload: { now: T0 } });
  await agent.run({ payload: { action: 'hold', active: false } });

  const out = await agent.run({ payload: { now: T0 } });
  assert.equal(out.published.length, 1);
});

test('reejecutar el ciclo no republica lo ya publicado', async () => {
  const social = socialFalso();
  const store = memoryStore();
  const agent = new SocialSchedulerAgent(ctx({ store, tools: { social: social.connector } }));

  await agent.run({ payload: { action: 'schedule', post: { id: 'a', network: 'x', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'a', now: T0 } });

  await agent.run({ payload: { now: T0 } });
  await agent.run({ payload: { now: T0 + HORA } });

  assert.equal(social.publicados.length, 1, 'un segundo ciclo no puede duplicar el post');
});

test('cancelar un post lo saca de la cola de publicación', async () => {
  const social = socialFalso();
  const store = memoryStore();
  const agent = new SocialSchedulerAgent(ctx({ store, tools: { social: social.connector } }));

  await agent.run({ payload: { action: 'schedule', post: { id: 'a', network: 'x', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'a', now: T0 } });
  await agent.run({ payload: { action: 'cancel', id: 'a' } });

  const out = await agent.run({ payload: { now: T0 } });
  assert.equal(out.published.length, 0);
  assert.equal(social.publicados.length, 0);
});

test('una red sin conector se salta con motivo claro, y NO tira el resto de la tanda', async () => {
  // Bug real: no hay conector genérico multi-red (solo LinkedIn tiene backend).
  // Antes de este fix, programar un post para una red sin conector lanzaba
  // una excepción no controlada que abortaba TODA la tanda, incluidos los
  // posts de LinkedIn que sí podían publicarse.
  const social = socialFalso();
  const store = memoryStore();
  const agent = new SocialSchedulerAgent(ctx({ store, tools: { linkedin: social.connector } }));   // sin 'social'

  await agent.run({ payload: { action: 'schedule', post: { id: 'sin-conector', network: 'x', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'schedule', post: { id: 'li', network: 'linkedin', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'sin-conector', now: T0 } });
  await agent.run({ payload: { action: 'approve', id: 'li', now: T0 } });

  const out = await agent.run({ payload: { now: T0 } });

  const fallido = out.skipped.find((s) => s.id === 'sin-conector');
  assert.equal(fallido?.code, 'no_connector');
  assert.match(fallido.reason, /sin conector configurado/);
  assert.equal(out.published.some((p) => p.id === 'li'), true, 'el post de LinkedIn debe publicarse igual');
});

test('cada publicación pasa por la línea roja de comunicación pública', async () => {
  const social = socialFalso();
  const store = memoryStore();
  const gate = gateAuto(true);
  const agent = new SocialSchedulerAgent(ctx({ store, hitl: gate, tools: { social: social.connector } }));

  await agent.run({ payload: { action: 'schedule', post: { id: 'a', network: 'x', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'a', now: T0 } });
  await agent.run({ payload: { now: T0 } });

  assert.equal(gate.solicitudes.length, 1, 'publicar SIEMPRE pide aprobación, aunque el post estuviera aprobado en la cola');
  assert.equal(gate.solicitudes[0].action.category, 'public_post');
  assert.match(gate.solicitudes[0].reason, /Línea roja/);
});

test('si el humano rechaza en el momento de publicar, no sale', async () => {
  const social = socialFalso();
  const store = memoryStore();
  const agent = new SocialSchedulerAgent(ctx({ store, hitl: gateAuto(false), tools: { social: social.connector } }));

  await agent.run({ payload: { action: 'schedule', post: { id: 'a', network: 'x', body: 'hola', scheduledFor: T0 } } });
  await agent.run({ payload: { action: 'approve', id: 'a', now: T0 } });
  const out = await agent.run({ payload: { now: T0 } });

  assert.equal(out.published.length, 0);
  assert.equal(social.publicados.length, 0);
  assert.ok(out.skipped.some((s) => s.code === 'rejected'));
});

// ══ Análisis de campaña: no declarar ganador con ruido ════════════════════

test('la normal acumulada coincide con la tabla', () => {
  assert.equal(ab.normalCdf(0).toFixed(4), '0.5000');
  assert.equal(ab.normalCdf(1.96).toFixed(4), '0.9750');
  assert.equal(ab.normalCdf(-1.645).toFixed(4), '0.0500');
});

test('25 impresiones NO dan un ganador (el error clásico)', () => {
  const r = ab.compare({ name: 'A', impressions: 25, conversions: 1 }, { name: 'B', impressions: 25, conversions: 2 });
  assert.equal(r.conclusive, false);
  assert.equal(r.winner, null);
  assert.match(r.verdict, /insuficiente/i);
  assert.equal(r.neededPerVariant, ab.MIN_SAMPLE);
});

test('una diferencia grande con muestra suficiente sí es concluyente', () => {
  const r = ab.compare({ name: 'A', impressions: 5000, conversions: 100 }, { name: 'B', impressions: 5000, conversions: 200 });
  assert.equal(r.conclusive, true);
  assert.equal(r.winner, 'B');
  assert.ok(r.pValue < 0.05);
  assert.equal(r.lift, 1);           // 2 % → 4 % es +100 %
});

test('una diferencia pequeña con muestra grande se declara NO concluyente', () => {
  const r = ab.compare({ name: 'A', impressions: 1000, conversions: 50 }, { name: 'B', impressions: 1000, conversions: 56 });
  assert.equal(r.conclusive, false);
  assert.ok(r.pValue > 0.05);
  assert.match(r.verdict, /Sin diferencia significativa/);
});

test('muchas impresiones pero casi ninguna conversión tampoco concluye', () => {
  const r = ab.compare({ name: 'A', impressions: 5000, conversions: 2 }, { name: 'B', impressions: 5000, conversions: 5 });
  assert.equal(r.conclusive, false);
  assert.match(r.verdict, /conversiones/);
});

test('dos variantes idénticas no inventan un ganador', () => {
  const r = ab.compare({ name: 'A', impressions: 1000, conversions: 100 }, { name: 'B', impressions: 1000, conversions: 100 });
  assert.equal(r.conclusive, false);
  assert.equal(r.winner, null);
});

test('el ranking de canales marca cuáles tienen datos fiables', () => {
  const r = ab.rankChannels([
    { name: 'linkedin', impressions: 5000, conversions: 250 },
    { name: 'email', impressions: 30, conversions: 6 },       // 20 %, pero 30 impresiones
  ]);
  assert.equal(r[0].name, 'email', 'ordena por tasa…');
  assert.equal(r[0].reliable, false, '…pero marca que no es fiable');
  assert.equal(r[1].reliable, true);
});

test('el analista no pide recomendación al modelo si no hay nada que decidir', async () => {
  let llamadas = 0;
  const model = { complete: async () => { llamadas++; return { text: 'cambia a B' }; } };
  const agent = new CampaignAnalystAgent(ctx({ model }));

  const out = await agent.run({
    payload: {
      campaign: 'lanzamiento',
      variants: [{ name: 'A', impressions: 30, conversions: 1 }, { name: 'B', impressions: 30, conversions: 3 }],
    },
  });

  assert.equal(out.conclusive, false);
  assert.equal(out.recommendation, null);
  assert.equal(llamadas, 0, 'sin datos no se gasta modelo en una recomendación falsa');
  assert.match(out.note, /ruido/);
});

test('con resultado concluyente sí redacta la acción, partiendo del veredicto', async () => {
  const prompts = [];
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'Pasar todo el presupuesto a B.' }; } };
  const agent = new CampaignAnalystAgent(ctx({ model }));

  const out = await agent.run({
    payload: {
      campaign: 'lanzamiento',
      variants: [{ name: 'A', impressions: 5000, conversions: 100 }, { name: 'B', impressions: 5000, conversions: 200 }],
    },
  });

  assert.equal(out.conclusive, true);
  assert.equal(out.test.winner, 'B');
  assert.ok(out.recommendation);
  assert.match(prompts[0], /Gana B/, 'el veredicto estadístico va en el prompt ya resuelto');
});

test('sin datos que analizar lo dice en vez de inventar', async () => {
  const out = await new CampaignAnalystAgent(ctx()).run({ payload: {} });
  assert.equal(out.status, 'blocked');
});
