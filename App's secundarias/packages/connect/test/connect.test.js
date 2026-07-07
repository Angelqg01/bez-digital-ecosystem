// Unit tests — no network. We inject a fake fetch and assert that the SDK builds
// the exact URLs, headers, and bodies the real gateway/cargolink routes expect.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BeZhasConnect, BeZhasApiError, webhooks } from '../src/index.js';

/** Records the last call and returns a canned JSON response. */
function fakeFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responder ? responder(url, init) : {};
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: r.statusText || 'OK',
      text: async () => JSON.stringify(r.body ?? { success: true }),
    };
  };
  fn.calls = calls;
  return fn;
}

test('pay.buy posts to gateway with x-api-key and json body', async () => {
  const fetch = fakeFetch(() => ({ body: { success: true, paymentId: 7, checkoutUrl: 'https://pay/x' } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk_test', baseUrl: 'https://api.example', fetch });

  const out = await bezhas.pay.buy({ amountUSD: 49.9, paymentMethod: 'card', email: 'a@b.com' });

  assert.equal(out.paymentId, 7);
  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/gateway/v1/payments/buy');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers['x-api-key'], 'sk_test');
  assert.equal(init.headers['Content-Type'], 'application/json');
  // undefined optional fields are dropped by JSON.stringify — we don't send empty keys.
  assert.deepEqual(JSON.parse(init.body), {
    amountUSD: 49.9, paymentMethod: 'card', email: 'a@b.com',
  });
});

test('pay.buy rejects an unknown payment method before any network call', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ apiKey: 'sk', fetch });
  assert.throws(() => bezhas.pay.buy({ amountUSD: 10, paymentMethod: 'paypal' }), /paymentMethod must be/);
  assert.equal(fetch.calls.length, 0);
});

test('pay.buy sends the Idempotency-Key header (retry-safe) and validates its shape', async () => {
  const fetch = fakeFetch(() => ({ body: { success: true, paymentId: 7 } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', fetch });

  await bezhas.pay.buy({ amountUSD: 10, paymentMethod: 'bank', idempotencyKey: 'order-2026-0001' });
  assert.equal(fetch.calls[0].init.headers['Idempotency-Key'], 'order-2026-0001');
  // The key travels as a header, never in the body.
  assert.equal(JSON.parse(fetch.calls[0].init.body).idempotencyKey, undefined);

  assert.throws(() => bezhas.pay.buy({ amountUSD: 10, paymentMethod: 'bank', idempotencyKey: 'x!' }), /idempotencyKey/);
  assert.equal(fetch.calls.length, 1);
});

test('pay.history builds the address path + limit query', async () => {
  const fetch = fakeFetch(() => ({ body: { success: true, payments: [] } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });
  await bezhas.pay.history('0xabc', { limit: 5 });
  assert.equal(fetch.calls[0].url, 'https://api.example/api/gateway/v1/payments/history/0xabc?limit=5');
});

test('cargolink uses the role key as the Authorization bearer', async () => {
  const fetch = fakeFetch(() => ({ body: { success: true } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });
  await bezhas.cargolink.syncOrders('pos_rolekey_123');
  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/cargolink/v1/pos/sync');
  assert.equal(init.headers['Authorization'], 'Bearer pos_rolekey_123');
});

test('withRoleKey binds a default key for subsequent calls', async () => {
  const fetch = fakeFetch(() => ({ body: { success: true } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });
  const pos = bezhas.cargolink.withRoleKey('pos_default');
  await pos.getPosLink();
  assert.equal(fetch.calls[0].init.headers['Authorization'], 'Bearer pos_default');
});

test('non-2xx responses throw a BeZhasApiError carrying status + body', async () => {
  const fetch = fakeFetch(() => ({ status: 403, statusText: 'Forbidden', body: { error: 'Insufficient scope' } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', fetch });
  await assert.rejects(
    () => bezhas.pay.price(),
    (err) => {
      assert.ok(err instanceof BeZhasApiError);
      assert.equal(err.status, 403);
      assert.equal(err.body.error, 'Insufficient scope');
      return true;
    },
  );
});

test('webhook verify matches the backend HMAC scheme and is tamper-evident', () => {
  const secret = 's3cr3t';
  const raw = JSON.stringify({ event: 'ON_TRANSACTION_CREATED', bUid: 'B-123', status: 'delivered' });
  const sig = webhooks.sign(raw, secret);
  assert.equal(webhooks.verify(raw, sig, secret), true);
  assert.equal(webhooks.verify(raw + ' ', sig, secret), false);
  assert.equal(webhooks.verify(raw, sig, 'wrong'), false);
  assert.deepEqual(webhooks.verifyAndParse(raw, sig, secret).bUid, 'B-123');
});

test('webhook verify accepts the real `sha256=` prefixed header sent by the fan-out', () => {
  const secret = 's3cr3t';
  const raw = JSON.stringify({ event: 'ON_TRANSACTION_VALIDATED', bUid: 'B-9' });
  const wire = webhooks.sign(raw, secret, true);       // sha256=<hex>, exactly as fanoutWebhooks sends
  assert.ok(wire.startsWith('sha256='));
  assert.equal(webhooks.verify(raw, wire, secret), true);
  // a bare-hex bank-style signature still verifies
  assert.equal(webhooks.verify(raw, webhooks.sign(raw, secret), secret), true);
});
