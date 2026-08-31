'use strict';

/**
 * LinkedInConnector — publicar en el feed de un miembro.
 *
 * Lo que más se puede romper aquí sin ruido es (1) publicar sin haber pasado
 * por HITL — cubierto en el test de integración con SocialAgent — y (2) mandar
 * un payload malformado que LinkedIn acepta con 200 pero no se ve en el feed;
 * de ahí que se compruebe la forma exacta del cuerpo, no solo el status.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const LinkedInConnector = require('../src/connectors/LinkedInConnector');
const { categoryForToolCall, hasSideEffect } = require('../src/cognition/toolCatalog');

function makeFetch(handlers) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const [pattern, handler] of handlers) {
      if (url.includes(pattern)) return handler({ url, opts });
    }
    throw new Error(`fetch mock sin handler para ${url}`);
  };
  return { fn, calls };
}

// ── Modo simulado ─────────────────────────────────────────────────────────────

test('sin token no toca la red y responde con simulated:true', async () => {
  const { fn, calls } = makeFetch([]);
  const c = new LinkedInConnector({ tenantId: 't', config: { fetch: fn } });

  assert.equal(c.simulated, true);
  const r = await c.execute('share', { text: 'hola' });

  assert.equal(r.simulated, true);
  assert.match(r.id, /^urn:li:share:sim_/);
  assert.match(r.url, /linkedin\.com\/feed\/update\//);
  assert.equal(calls.length, 0, 'no debe intentar red sin token');
});

// ── Validación ───────────────────────────────────────────────────────────────

test('rechaza texto vacío antes de tocar red', async () => {
  const c = new LinkedInConnector({ tenantId: 't', config: { accessToken: 'x', fetch: async () => { throw new Error('no debía llamar'); } } });
  await assert.rejects(() => c.share({}), /text requerido/);
});

test('rechaza texto por encima del máximo de LinkedIn (3000)', async () => {
  const c = new LinkedInConnector({ tenantId: 't', config: { accessToken: 'x', memberUrn: 'urn:li:person:X', fetch: async () => { throw new Error('no debía llamar'); } } });
  const largo = 'a'.repeat(LinkedInConnector.MAX_POST_CHARS + 1);
  await assert.rejects(() => c.share({ text: largo }), /máximo/);
});

test('rechaza visibility inválida', async () => {
  const c = new LinkedInConnector({ tenantId: 't', config: { accessToken: 'x', memberUrn: 'urn:li:person:X', fetch: async () => { throw new Error('no debía llamar'); } } });
  await assert.rejects(() => c.share({ text: 'ok', visibility: 'FRIENDS' }), /visibility inválida/);
});

// ── Camino real (con fetch inyectado) ────────────────────────────────────────

test('share monta el cuerpo que LinkedIn espera y devuelve id + url del post', async () => {
  const { fn, calls } = makeFetch([
    ['/rest/posts', () => ({
      ok: true, status: 201,
      headers: { get: (h) => h.toLowerCase() === 'x-restli-id' ? 'urn:li:share:7000000000' : null },
      text: async () => '',
    })],
  ]);
  const c = new LinkedInConnector({
    tenantId: 't',
    config: { accessToken: 'tok', memberUrn: 'urn:li:person:ABC', fetch: fn },
  });

  const r = await c.share({ text: 'lanzamiento BEZ-Coin' });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rest\/posts$/);
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer tok');
  assert.equal(calls[0].opts.headers['LinkedIn-Version'], '202409');
  assert.equal(calls[0].opts.headers['X-Restli-Protocol-Version'], '2.0.0');

  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.author, 'urn:li:person:ABC');
  assert.equal(body.commentary, 'lanzamiento BEZ-Coin');
  assert.equal(body.visibility, 'PUBLIC');
  assert.equal(body.lifecycleState, 'PUBLISHED');
  assert.equal(body.distribution.feedDistribution, 'MAIN_FEED');
  assert.ok(!body.content, 'sin articleUrl no debe llevar content');

  assert.equal(r.id, 'urn:li:share:7000000000');
  assert.match(r.url, /urn%3Ali%3Ashare%3A7000000000/);
});

test('con articleUrl adjunta el enlace como article', async () => {
  const { fn, calls } = makeFetch([
    ['/rest/posts', () => ({ ok: true, status: 201, headers: { get: () => 'urn:li:share:1' }, text: async () => '' })],
  ]);
  const c = new LinkedInConnector({ tenantId: 't', config: { accessToken: 'tok', memberUrn: 'urn:li:person:X', fetch: fn } });

  await c.share({ text: 'mira esto', articleUrl: 'https://bezhas.io/post' });
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.content.article.source, 'https://bezhas.io/post');
});

test('si no hay memberUrn, lo resuelve por OIDC antes de publicar', async () => {
  const { fn, calls } = makeFetch([
    ['/v2/userinfo', () => ({ ok: true, status: 200, json: async () => ({ sub: 'RESOLVED', name: 'Yo' }) })],
    ['/rest/posts',  () => ({ ok: true, status: 201, headers: { get: () => 'urn:li:share:2' }, text: async () => '' })],
  ]);
  const c = new LinkedInConnector({ tenantId: 't', config: { accessToken: 'tok', fetch: fn } });

  const r = await c.share({ text: 'hola' });

  assert.equal(calls[0].url, `${'https://api.linkedin.com'}/v2/userinfo`);
  const body = JSON.parse(calls[1].opts.body);
  assert.equal(body.author, 'urn:li:person:RESOLVED');
  assert.equal(r.author, 'urn:li:person:RESOLVED');
});

test('un error HTTP de LinkedIn se propaga con status y trozo del detalle', async () => {
  const { fn } = makeFetch([
    ['/rest/posts', () => ({ ok: false, status: 401, headers: { get: () => null }, text: async () => '{"message":"invalid token"}' })],
  ]);
  const c = new LinkedInConnector({ tenantId: 't', config: { accessToken: 'malo', memberUrn: 'urn:li:person:X', fetch: fn } });
  await assert.rejects(() => c.share({ text: 'hola' }), /HTTP 401/);
});

// ── Wiring con el catálogo / guardrails ──────────────────────────────────────

test('el catálogo marca share como con-efecto (no reintentable) y me como lectura', () => {
  assert.equal(hasSideEffect('linkedin', 'share'), true, 'publicar dos veces = duplicar en el feed');
  assert.equal(hasSideEffect('linkedin', 'me'), false);
});

test('categoryForToolCall enruta share por public_post → RedLine → HITL', () => {
  const share = categoryForToolCall('linkedin', 'share');
  assert.equal(share.category, 'public_post');
  assert.equal(share.audience, 'public');

  const me = categoryForToolCall('linkedin', 'me');
  assert.equal(me.category, 'external_read');
});
