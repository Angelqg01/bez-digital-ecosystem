// Unit tests for the generic ServiceModule + Capability Registry — no network.
// Same injected-fetch harness as connect.test.js: we assert the registry-driven
// invocation builds the exact URL/method/headers/body the real backend expects.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BeZhasConnect, listCapabilities, REGISTRY } from '../src/index.js';

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

test('service().call routes a GET action to the registry path with x-api-key', async () => {
  const fetch = fakeFetch(() => ({ body: { assets: [] } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk_test', baseUrl: 'https://api.example', fetch });

  const out = await bezhas.service('energy').call('assets');

  assert.deepEqual(out, { assets: [] });
  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/energy/assets');
  assert.equal(init.method, 'GET');
  assert.equal(init.headers['x-api-key'], 'sk_test');
});

test('GET params land in the query string, not the body', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });

  await bezhas.service('energy').call('price', { zone: 'ES' });

  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/energy/price?zone=ES');
  assert.equal(init.body, undefined);
});

test('POST params land in a JSON body', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });

  await bezhas.service('pay').call('buy', { amountUSD: 10, paymentMethod: 'card' });

  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/gateway/v1/payments/buy');
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), { amountUSD: 10, paymentMethod: 'card' });
});

test('path params are substituted and consumed (not duplicated into query)', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });

  await bezhas.service('pay').call('history', { address: '0xABC', limit: 5 });

  const { url } = fetch.calls[0];
  // address is in the path; limit remains as a query param.
  assert.equal(url, 'https://api.example/api/gateway/v1/payments/history/0xABC?limit=5');
});

test('roleKey-auth SubApp sends the role key as the bearer, no x-api-key needed', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ baseUrl: 'https://api.example', fetch });

  await bezhas.service('cargolink', { roleKey: 'pos_key_123' }).call('getTx', { bUid: 'B-9' });

  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/cargolink/v1/tx/B-9');
  assert.equal(init.headers['Authorization'], 'Bearer pos_key_123');
});

test('per-call roleKey overrides the bound key', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ baseUrl: 'https://api.example', fetch });

  await bezhas.service('cargolink', { roleKey: 'bound' }).call('syncOrders', { roleKey: 'override' });

  assert.equal(fetch.calls[0].init.headers['Authorization'], 'Bearer override');
});

test('public action sends neither api key nor bearer', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });

  await bezhas.service('cargolink').call('health');

  const { init } = fetch.calls[0];
  // cargolink is roleKey-auth; health overrides to public → no bearer.
  assert.equal(init.headers['Authorization'], undefined);
});

test('missing required param throws before any network call', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });

  assert.throws(
    () => bezhas.service('pay').call('buy', { amountUSD: 10 }), // no paymentMethod
    /requires param "paymentMethod"/,
  );
  assert.equal(fetch.calls.length, 0);
});

test('unknown SubApp throws and lists the registered ones', async () => {
  const bezhas = new BeZhasConnect({ apiKey: 'sk', fetch: fakeFetch() });
  assert.throws(() => bezhas.service('nope'), /Unknown BeZhas SubApp "nope"/);
});

test('unknown action throws and lists the available ones', async () => {
  const bezhas = new BeZhasConnect({ apiKey: 'sk', fetch: fakeFetch() });
  assert.throws(
    () => bezhas.service('pay').call('teleport'),
    /Unknown action "teleport" on SubApp "pay"/,
  );
});

test('capabilities() exposes every registered SubApp + action, no secrets', () => {
  const caps = listCapabilities();
  const names = caps.map((c) => c.subapp);
  assert.ok(names.includes('pay'));
  assert.ok(names.includes('cargolink'));
  assert.ok(names.includes('energy'));

  const pay = caps.find((c) => c.subapp === 'pay');
  const buy = pay.actions.find((a) => a.action === 'buy');
  assert.equal(buy.method, 'POST');
  assert.equal(buy.path, '/api/gateway/v1/payments/buy');
  assert.deepEqual(buy.required, ['amountUSD', 'paymentMethod']);

  // Registry is the single source of truth shared with the typed Pay module.
  assert.equal(REGISTRY.pay.actions.buy.path, '/payments/buy');
});
