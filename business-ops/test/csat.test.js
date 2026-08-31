'use strict';

/**
 * CSAT — la única métrica de Soporte que viene del cliente y no de nosotros.
 *
 * Lo que se blinda aquí:
 *   1. El token no se puede falsificar ni reutilizar para otro ticket (si no,
 *      cualquiera puntúa cualquier ticket de cualquier tenant).
 *   2. Un mismo ticket no se vota dos veces (un cliente enfadado en bucle
 *      torcería la métrica del tenant entero).
 *   3. "Sin datos" nunca se reporta como 0 % — confundirlos dispara alertas
 *      falsas el primer día de vida de un tenant.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const csat = require('../src/platform/csat');
const { issueToken, verifyToken, validateResponse, recordResponse, markIssued, report, CsatError } = csat;

const SECRET = 'secreto-de-pruebas';

function memoryStore() {
  const facts = new Map();
  const k = (t, key) => `${t}:${key}`;
  return {
    getFact: async ({ tenantId, key }) => facts.get(k(tenantId, key)),
    setFact: async ({ tenantId, key, value }) => { facts.set(k(tenantId, key), value); },
  };
}

// ── Token ────────────────────────────────────────────────────────────────

test('un token recién emitido se verifica y devuelve tenant y ticket', () => {
  const t = issueToken({ tenantId: 'acme', taskId: 't_123', secret: SECRET, now: 1000 });
  const out = verifyToken(t, { secret: SECRET, now: 2000 });
  assert.deepEqual(out, { tenantId: 'acme', taskId: 't_123', issuedAt: 1000 });
});

test('cambiar el taskId del token lo invalida (no se puede votar otro ticket)', () => {
  const t = issueToken({ tenantId: 'acme', taskId: 't_123', secret: SECRET, now: 1000 });
  const [tenantId, , issuedAt, firma] = t.split('.');
  const forjado = [tenantId, 't_OTRO', issuedAt, firma].join('.');
  assert.throws(() => verifyToken(forjado, { secret: SECRET, now: 2000 }), (e) => e.code === 'bad_signature');
});

test('cambiar el tenant del token lo invalida (no se cruzan tenants)', () => {
  const t = issueToken({ tenantId: 'acme', taskId: 't_1', secret: SECRET, now: 1000 });
  const [, taskId, issuedAt, firma] = t.split('.');
  const forjado = ['otro-tenant', taskId, issuedAt, firma].join('.');
  assert.throws(() => verifyToken(forjado, { secret: SECRET, now: 2000 }), (e) => e.code === 'bad_signature');
});

test('un token firmado con otro secreto no vale', () => {
  const t = issueToken({ tenantId: 'acme', taskId: 't_1', secret: 'otro', now: 1000 });
  assert.throws(() => verifyToken(t, { secret: SECRET, now: 2000 }), (e) => e.code === 'bad_signature');
});

test('el token caduca (una encuesta de hace meses no mide nada)', () => {
  const t = issueToken({ tenantId: 'acme', taskId: 't_1', secret: SECRET, now: 0 });
  assert.ok(verifyToken(t, { secret: SECRET, now: csat.DEFAULT_TTL_MS - 1 }), 'dentro del plazo debe valer');
  assert.throws(
    () => verifyToken(t, { secret: SECRET, now: csat.DEFAULT_TTL_MS + 1 }),
    (e) => e.code === 'expired' && e.status === 410,
  );
});

test('tokens malformados o vacíos no revientan: error controlado', () => {
  for (const bad of [undefined, '', 'basura', 'a.b.c', 'a.b.c.d.e', 'a.b.c.zz']) {
    assert.throws(() => verifyToken(bad, { secret: SECRET }), CsatError, `no controló ${JSON.stringify(bad)}`);
  }
});

test('sin CSAT_SECRET configurado no se emite ni se verifica (503, no 500 opaco)', () => {
  assert.throws(() => issueToken({ tenantId: 'a', taskId: 'b', secret: '' }), (e) => e.status === 503);
  assert.throws(() => verifyToken('x.y.z.w', { secret: '' }), (e) => e.status === 503);
});

test('un id con puntos se rechaza al emitir (rompería el parseo del token)', () => {
  assert.throws(() => issueToken({ tenantId: 'a.b', taskId: 't', secret: SECRET }), (e) => e.code === 'bad_id');
  assert.throws(() => issueToken({ tenantId: 'a', taskId: 't.1', secret: SECRET }), (e) => e.code === 'bad_id');
});

// ── Respuesta ────────────────────────────────────────────────────────────

test('solo acepta enteros de 1 a 5', () => {
  for (const r of [1, 2, 3, 4, 5]) assert.equal(validateResponse({ rating: r }).rating, r);
  for (const bad of [0, 6, -1, 2.5, 'cinco', null, undefined, NaN]) {
    assert.throws(() => validateResponse({ rating: bad }), (e) => e.code === 'bad_rating', `aceptó ${bad}`);
  }
});

test('el comentario se sanea: sin saltos de línea y acotado', () => {
  const r = validateResponse({ rating: 4, comment: 'bien\r\nBcc: x@y.com' });
  assert.equal(r.comment, 'bien Bcc: x@y.com');
  assert.equal(validateResponse({ rating: 4, comment: 'z'.repeat(9999) }).comment.length, csat.MAX_COMMENT);
  assert.equal(validateResponse({ rating: 4, comment: '   ' }).comment, null, 'un comentario en blanco es null');
});

test('el mismo ticket no se puede votar dos veces', async () => {
  const store = memoryStore();
  await recordResponse({ store, tenantId: 'acme', taskId: 't_1', rating: 5 });
  await assert.rejects(
    () => recordResponse({ store, tenantId: 'acme', taskId: 't_1', rating: 1 }),
    (e) => e.status === 409 && e.code === 'already_answered',
  );
  const r = await report({ store, tenantId: 'acme' });
  assert.equal(r.responses, 1, 'el segundo voto no debe haber entrado');
});

test('tickets distintos sí acumulan', async () => {
  const store = memoryStore();
  await recordResponse({ store, tenantId: 'acme', taskId: 't_1', rating: 5 });
  await recordResponse({ store, tenantId: 'acme', taskId: 't_2', rating: 4 });
  assert.equal((await report({ store, tenantId: 'acme' })).responses, 2);
});

test('el CSAT de un tenant no contamina al de otro', async () => {
  const store = memoryStore();
  await recordResponse({ store, tenantId: 'a', taskId: 't_1', rating: 5 });
  await recordResponse({ store, tenantId: 'b', taskId: 't_1', rating: 1 });
  assert.equal((await report({ store, tenantId: 'a' })).avgRating, 5);
  assert.equal((await report({ store, tenantId: 'b' })).avgRating, 1);
});

// ── Informe ──────────────────────────────────────────────────────────────

test('sin respuestas devuelve null, NO 0 (sin datos ≠ satisfacción nula)', async () => {
  const r = await report({ store: memoryStore(), tenantId: 'nuevo' });
  assert.equal(r.responses, 0);
  assert.equal(r.csat, null, 'un tenant recién creado no tiene 0% de CSAT, no tiene dato');
  assert.equal(r.avgRating, null);
  assert.equal(r.responseRate, null);
});

test('CSAT es top-2-box (4 y 5), no la media disfrazada', async () => {
  const store = memoryStore();
  // 3,3,3,4 → media 3.25, pero solo 1 de 4 está satisfecho → CSAT 25%.
  for (const [i, rating] of [3, 3, 3, 4].entries()) {
    await recordResponse({ store, tenantId: 'acme', taskId: `t_${i}`, rating });
  }
  const r = await report({ store, tenantId: 'acme' });
  assert.equal(r.csat, 0.25, 'los 3 no cuentan como satisfechos');
  assert.equal(r.avgRating, 3.25);
});

test('tasa de respuesta: respuestas sobre encuestas enviadas', async () => {
  const store = memoryStore();
  for (let i = 0; i < 4; i++) await markIssued({ store, tenantId: 'acme' });
  await recordResponse({ store, tenantId: 'acme', taskId: 't_1', rating: 5 });

  const r = await report({ store, tenantId: 'acme' });
  assert.equal(r.surveysIssued, 4);
  assert.equal(r.responses, 1);
  assert.equal(r.responseRate, 0.25);
});

test('el informe separa detractores y guarda los comentarios recientes', async () => {
  const store = memoryStore();
  await recordResponse({ store, tenantId: 'acme', taskId: 't_1', rating: 1, comment: 'no resolvió nada' });
  await recordResponse({ store, tenantId: 'acme', taskId: 't_2', rating: 2 });
  await recordResponse({ store, tenantId: 'acme', taskId: 't_3', rating: 5, comment: 'perfecto' });

  const r = await report({ store, tenantId: 'acme' });
  assert.equal(r.detractors, 2);
  assert.deepEqual(r.distribution, { 1: 1, 2: 1, 3: 0, 4: 0, 5: 1 });
  assert.equal(r.recentComments.length, 2, 'solo las que traen comentario');
  assert.equal(r.recentComments[0].comment, 'no resolvió nada');
});

test('markIssued sin store no rompe (modo sin persistencia)', async () => {
  assert.deepEqual(await markIssued({ store: null, tenantId: 'x' }), { issued: 0 });
});
