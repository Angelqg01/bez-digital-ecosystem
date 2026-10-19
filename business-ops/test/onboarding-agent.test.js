'use strict';

/**
 * Alta de perfil, plan y newsletter por chat/Telegram/correo.
 * Lo importante: nada se suscribe ni se crea sin que la persona lo confirme, y si el correo
 * de confirmación no sale, no se le dice que sí.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const OnboardingAgent = require('../src/agents/support/OnboardingAgent');
const SupportManager = require('../src/agents/support/SupportManager');
const KnowledgeBase = require('../src/platform/KnowledgeBase');
const ModelGateway = require('../src/cognition/ModelGateway');
const MemoryManager = require('../src/cognition/MemoryManager');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const EventBus = require('../src/core/EventBus');
const Orchestrator = require('../src/core/Orchestrator');
const BaseChannelRef = require('../src/channels/BaseChannel');

const { detectarIntencion, idioma } = OnboardingAgent;

test('detección: alta, plan, newsletter (alta y baja) y lo que no es asunto del agente', () => {
  assert.equal(detectarIntencion('Quiero crear una cuenta'), 'alta');
  assert.equal(detectarIntencion('¿cómo consigo mi BeZhas ID?'), 'alta');
  assert.equal(detectarIntencion('I want to sign up'), 'alta');
  assert.equal(detectarIntencion('Quiero contratar un plan'), 'plan');
  assert.equal(detectarIntencion('quiero la newsletter'), 'newsletter_alta');
  assert.equal(detectarIntencion('Quiero darme de baja de la newsletter'), 'newsletter_baja');
  assert.equal(detectarIntencion('mi factura no llega'), null);
  assert.equal(detectarIntencion('¿cuánto cuesta el gas?'), null);
});

test('idioma: español por defecto, inglés cuando domina', () => {
  assert.equal(idioma('hola, quiero una cuenta'), 'es');
  assert.equal(idioma('hello, I want to create my account please'), 'en');
});

function agente({ fetchRespuesta, emailEnviado = true } = {}) {
  const llamadasFetch = []; const correos = [];
  const a = new OnboardingAgent({
    tenantId: 't', signupUrl: 'https://www.bezhas.com/register', apiUrl: 'https://api.test', internalKey: 'k-interna',
    fetch: async (url, opts) => { llamadasFetch.push({ url, opts }); return fetchRespuesta ? fetchRespuesta() : { ok: true, json: async () => ({ status: 'pending', confirmUrl: 'https://api.test/api/newsletter/confirm/abc', unsubscribeUrl: 'https://api.test/api/newsletter/unsubscribe/def' }) }; },
    tools: { email: { execute: async (_m, args) => { correos.push(args); return emailEnviado ? { sent: true } : { sent: false, reason: 'smtp caído' }; } } },
  });
  return { a, llamadasFetch, correos };
}

test('alta: contesta con el enlace de registro y no toca ninguna cuenta', async () => {
  const { a, llamadasFetch } = agente();
  const r = await a.run({ payload: { text: 'Quiero crear mi perfil en BeZhas', customerId: 'tg:1', channel: 'telegram' } });
  assert.equal(r.handled, true);
  assert.match(r.reply, /https:\/\/www\.bezhas\.com\/register/);
  assert.match(r.reply, /nunca te la pediremos/);
  assert.equal(llamadasFetch.length, 0);
});

test('newsletter sin correo: lo pide y no llama a la API', async () => {
  const { a, llamadasFetch } = agente();
  const r = await a.run({ payload: { text: 'quiero la newsletter', customerId: 'tg:1', channel: 'telegram' } });
  assert.match(r.reply, /Escríbeme el correo/);
  assert.equal(llamadasFetch.length, 0);
});

test('newsletter con correo: registra pendiente en la API y manda el correo de confirmación; no dice «suscrito»', async () => {
  const { a, llamadasFetch, correos } = agente();
  const r = await a.run({ payload: { text: 'newsletter Ana@Acme.com', customerId: 'tg:1', channel: 'telegram' } });
  assert.equal(llamadasFetch[0].url, 'https://api.test/api/newsletter/request');
  assert.equal(llamadasFetch[0].opts.headers['x-api-key'], 'k-interna');
  assert.equal(JSON.parse(llamadasFetch[0].opts.body).email, 'ana@acme.com');
  assert.equal(JSON.parse(llamadasFetch[0].opts.body).source, 'telegram');
  assert.equal(correos[0].to, 'ana@acme.com');
  assert.match(correos[0].body, /confirm\/abc/);
  assert.equal(correos[0].headers['Auto-Submitted'], 'auto-generated');
  assert.match(r.reply, /No quedarás suscrito hasta que pulses/);
  assert.equal(r.escalate, false);
});

test('por correo, sin escribir dirección en el cuerpo: se usa el remitente', async () => {
  const { a, correos } = agente();
  await a.run({ payload: { text: 'Quiero recibir la newsletter', customerId: 'email:luis@x.com', channel: 'email', meta: { from: 'Luis <luis@x.com>' } } });
  assert.equal(correos[0].to, 'luis@x.com');
});

test('si el correo de confirmación no sale, no se afirma que se envió y se escala', async () => {
  const { a } = agente({ emailEnviado: false });
  const r = await a.run({ payload: { text: 'newsletter ana@acme.com', customerId: 'tg:1', channel: 'telegram' } });
  assert.equal(r.escalate, true);
  assert.doesNotMatch(r.reply, /he enviado un correo/);
});

test('API caída: escala y no inventa éxito', async () => {
  const { a, correos } = agente({ fetchRespuesta: () => ({ ok: false, status: 503 }) });
  const r = await a.run({ payload: { text: 'newsletter ana@acme.com', customerId: 'tg:1', channel: 'telegram' } });
  assert.equal(r.escalate, true);
  assert.equal(correos.length, 0);
});

test('ya suscrita / confirmación reciente: no se manda otro correo', async () => {
  for (const status of ['already_confirmed', 'pending_recent']) {
    const { a, correos } = agente({ fetchRespuesta: () => ({ ok: true, json: async () => ({ status }) }) });
    const r = await a.run({ payload: { text: 'newsletter ana@acme.com', customerId: `tg:${status}`, channel: 'telegram' } });
    assert.equal(correos.length, 0);
    assert.equal(r.escalate, false);
  }
});

test('límite por persona: a la 4.ª petición en una hora no se vuelve a llamar a la API', async () => {
  const { a, llamadasFetch } = agente();
  for (let i = 0; i < 4; i++) await a.run({ payload: { text: `newsletter a${i}@acme.com`, customerId: 'tg:spam', channel: 'telegram' } });
  assert.equal(llamadasFetch.length, 3);
});

test('baja de la newsletter: se explica y se escala a una persona', async () => {
  const { a } = agente();
  const r = await a.run({ payload: { text: 'quiero darme de baja de la newsletter', customerId: 'tg:1', channel: 'telegram' } });
  assert.equal(r.escalate, true);
});

test('SupportManager: el alta se resuelve sin modelo y no escala; «plan» añade el enlace a la respuesta de la KB', async () => {
  const tenantId = 'acme';
  const knowledgeBase = new KnowledgeBase({ tenantId });
  await knowledgeBase.ingest({ title: 'Planes', body: 'El plan Creator Pro incluye operaciones preparadas con aprobación.', tags: ['planes'] });
  const manager = new SupportManager({
    tenantId, model: new ModelGateway({ providers: {} }), memory: new MemoryManager({ tenantId }),
    guardrails: new PolicyEngine({ tenantId, plan: 'pro' }), knowledgeBase, bus: new EventBus(tenantId),
    onboarding: { signupUrl: 'https://www.bezhas.com/register' },
  });
  const alta = await manager.run({ type: 'support:ticket', payload: { text: 'Quiero crear una cuenta', customerId: 'c1' } });
  assert.equal(alta.resolution.escalate, false);
  assert.match(alta.resolution.reply, /bezhas\.com\/register/);

  const plan = await manager.run({ type: 'support:ticket', payload: { text: '¿Qué incluye el plan Creator Pro?', customerId: 'c2' } });
  assert.match(plan.resolution.reply, /bezhas\.com\/register/);
  assert.match(plan.resolution.reply, /yo no cobro ni suscribo/);
});

test('enrutado: newsletter, alta y planes van a Soporte (no a Ventas)', async () => {
  const clasificar = (text) => Orchestrator.prototype._classify.call({ _learnedRoutes: [] }, { text });
  for (const text of ['quiero la newsletter', 'Quiero crear mi cuenta', 'quiero contratar un plan']) {
    assert.equal((await clasificar(text)).department, 'support', text);
  }
});

test('modelo caído: el cliente nunca recibe el texto simulado (lleva trozos del prompt interno)', async () => {
  const tenantId = 'acme';
  const knowledgeBase = new KnowledgeBase({ tenantId });
  await knowledgeBase.ingest({ title: 'Reembolsos', body: 'Los reembolsos se tramitan en 14 días desde facturación.', tags: ['facturación'] });
  const manager = new SupportManager({
    tenantId, model: new ModelGateway({ providers: {} }), memory: new MemoryManager({ tenantId }),
    guardrails: new PolicyEngine({ tenantId, plan: 'pro' }), knowledgeBase, bus: new EventBus(tenantId),
  });

  const conKb = await manager.run({ type: 'support:ticket', payload: { text: '¿Cómo funcionan los reembolsos?', customerId: 'c1' } });
  assert.doesNotMatch(conKb.resolution.reply, /SIMULADO|CONSULTA:|CONOCIMIENTO DISPONIBLE/);
  assert.match(conKb.resolution.reply, /Reembolsos/);

  const sinKb = await manager.run({ type: 'support:ticket', payload: { text: 'pregunta sin nada en la base zzzqq', customerId: 'c2' } });
  assert.doesNotMatch(sinKb.resolution.reply, /SIMULADO|CONSULTA:/);
  assert.match(sinKb.resolution.reply, /persona del equipo/);
  assert.equal(sinKb.resolution.escalate, true);
});

test('BaseChannel: un texto simulado se sustituye por un mensaje honesto en cualquier canal', () => {
  assert.doesNotMatch(BaseChannelRef.sinSimulado('[SIMULADO · tier=mid] Responde a la consulta'), /SIMULADO/);
  assert.equal(BaseChannelRef.sinSimulado('Hola'), 'Hola');
});
