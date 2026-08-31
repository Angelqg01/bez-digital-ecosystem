'use strict';

/**
 * KnowledgeBase — índice invertido para la ruta por términos.
 *
 * El API es idéntico con o sin índice. Estos tests fijan dos cosas que se
 * romperían en silencio si alguien tocara el índice: (1) los mismos resultados
 * que el escaneo lineal en el umbral, y (2) invalidación tras ingest para no
 * servir postings obsoletos.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const KnowledgeBase = require('../src/platform/KnowledgeBase');
const N = KnowledgeBase.INVERTED_INDEX_MIN;

async function llenar(kb, n, vocab) {
  for (let i = 0; i < n; i++) {
    const t1 = vocab[i % vocab.length];
    const t2 = vocab[(i * 3) % vocab.length];
    await kb.ingest({ id: `a${i}`, title: t1, body: `${t2} texto de relleno`, tags: [] });
  }
}

test('por debajo del umbral usa escaneo lineal (no construye el índice)', async () => {
  const kb = new KnowledgeBase({ tenantId: 't' });
  await llenar(kb, 10, ['factura', 'pago', 'reembolso']);

  await kb.search('factura');
  assert.equal(kb._invIndex, null, 'no debe construir el índice si no hace falta');
});

test('en el umbral construye el índice y sirve el resultado por él', async () => {
  const kb = new KnowledgeBase({ tenantId: 't' });
  await llenar(kb, N, ['factura', 'pago', 'reembolso', 'contrato']);

  const r = await kb.search('factura pago', { k: 3 });
  assert.ok(kb._invIndex instanceof Map, 'debe construirse');
  assert.ok(r.length > 0);
  assert.ok(r.every((x) => x.score >= 1));
});

test('mismo top-k que el escaneo lineal (equivalencia funcional)', async () => {
  // Fuerzo ambos caminos comparando sobre el mismo corpus, saltando el umbral
  // por debajo/por encima manipulando la constante en runtime.
  const vocab = ['factura', 'pago', 'reembolso', 'contrato', 'cliente'];
  const kbLineal = new KnowledgeBase({ tenantId: 'l' });
  const kbIndex  = new KnowledgeBase({ tenantId: 'i' });
  await llenar(kbLineal, 50, vocab);
  await llenar(kbIndex, 50, vocab);

  // Forzar índice en kbIndex bajando su umbral local.
  Object.defineProperty(kbIndex.constructor, 'INVERTED_INDEX_MIN', { value: 10, configurable: true });
  const rIdx = await kbIndex.search('factura contrato', { k: 5 });
  Object.defineProperty(kbIndex.constructor, 'INVERTED_INDEX_MIN', { value: N, configurable: true });

  const rLin = await kbLineal.search('factura contrato', { k: 5 });
  // Con empates de score, la elección concreta entre docs de score idéntico
  // varía por orden de iteración; lo que importa es la distribución de scores.
  assert.deepEqual(rIdx.map((x) => x.score), rLin.map((x) => x.score), 'mismo top-k por score');
  assert.equal(rIdx.length, rLin.length);
});

test('ingest posterior invalida el índice y el siguiente search lo reconstruye', async () => {
  const kb = new KnowledgeBase({ tenantId: 't' });
  await llenar(kb, N, ['factura', 'pago']);
  await kb.search('factura');            // construye
  assert.ok(kb._invIndex);

  await kb.ingest({ id: 'nuevo', title: 'tema-unico-xyz', body: 'palabra-clave-rara', tags: [] });
  assert.equal(kb._invIndex, null, 'ingest invalida');

  const r = await kb.search('palabra-clave-rara', { k: 3 });
  assert.equal(r[0]?.id, 'nuevo', 'el índice reconstruido incluye el artículo nuevo');
});

test('consulta sin coincidencias devuelve []', async () => {
  const kb = new KnowledgeBase({ tenantId: 't' });
  await llenar(kb, N, ['factura', 'pago']);
  const r = await kb.search('kryptonita-inexistente-999');
  assert.deepEqual(r, []);
});
