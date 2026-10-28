import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBezPrice, parseOraclePrice, ORACLE_PATH } from './price.js';

const ok = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });

test('lee el precio de tokens.BEZ.priceUSD', () => {
  assert.equal(parseOraclePrice({ tokens: { BEZ: { priceUSD: 0.0075 } }, price: 1 }), 0.0075);
});

test('cae a price y a bezCoinPriceUSD, que el oráculo publica como claves planas', () => {
  assert.equal(parseOraclePrice({ price: 0.0075 }), 0.0075);
  assert.equal(parseOraclePrice({ bezCoinPriceUSD: '0.0075' }), 0.0075);
});

test('un precio ausente, cero, negativo o no numérico es null: no se inventa uno', () => {
  for (const body of [{}, null, { price: 0 }, { price: -1 }, { price: 'abc' }, { tokens: { BEZ: {} } }]) {
    assert.equal(parseOraclePrice(body), null);
  }
});

test('fetchBezPrice pide la ruta pública del oráculo, sin cabeceras de sesión', async () => {
  let url, init;
  const f = async (u, i) => { url = u; init = i; return { ok: true, json: async () => ({ price: 0.0075 }) }; };
  const r = await fetchBezPrice('http://localhost:3001', f);
  assert.equal(url, `http://localhost:3001${ORACLE_PATH}`);
  assert.equal(init.headers, undefined, 'no debe enviar Authorization');
  assert.equal(r.priceUSD, 0.0075);
});

test('marca como semilla el precio sin fecha de lectura o con source=seed', async () => {
  assert.equal((await fetchBezPrice('', ok({ price: 0.0075, updatedAt: null }))).seed, true);
  assert.equal((await fetchBezPrice('', ok({ price: 0.0075, source: 'seed', updatedAt: 'x' }))).seed, true);
  assert.equal((await fetchBezPrice('', ok({ price: 0.0075, source: 'bezhas-oracle', updatedAt: '2026-10-16T10:35:22Z' }))).seed, false);
});

test('error HTTP, red caída o cuerpo roto devuelven null', async () => {
  assert.equal(await fetchBezPrice('', ok({}, 500)), null);
  assert.equal(await fetchBezPrice('', async () => { throw new TypeError('fetch failed'); }), null);
  assert.equal(await fetchBezPrice('', async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } })), null);
  assert.equal(await fetchBezPrice('', ok({ price: 0 })), null);
});
