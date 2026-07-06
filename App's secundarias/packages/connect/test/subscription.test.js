// Tests for the subscription / entitlements layer — the bridge that gates the
// SDK to the SubApps a subscription actually activated. No network.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BeZhasConnect,
  Entitlements,
  BeZhasEntitlementError,
  CORE_SUBAPPS,
} from '../src/index.js';

function fakeFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = responder ? responder(url, init) : {};
    const status = r.status ?? 200;
    return { ok: status >= 200 && status < 300, status, statusText: 'OK', text: async () => JSON.stringify(r.body ?? {}) };
  };
  fn.calls = calls;
  return fn;
}

test('Entitlements always include the core SubApps', () => {
  const ent = new Entitlements([]);
  for (const core of CORE_SUBAPPS) assert.ok(ent.allows(core), `core ${core} must be allowed`);
});

test('Entitlements.fromPlan grants core + chosen add-ons', () => {
  const ent = Entitlements.fromPlan('business', ['pay', 'energy']);
  assert.ok(ent.allows('pay'));
  assert.ok(ent.allows('energy'));
  assert.ok(ent.allows('hub')); // core
  assert.ok(!ent.allows('genesis')); // not chosen
});

test('Entitlements.fromApi accepts subapps | active | addons keys', () => {
  assert.ok(Entitlements.fromApi({ subapps: ['pay'] }).allows('pay'));
  assert.ok(Entitlements.fromApi({ active: ['energy'] }).allows('energy'));
  assert.ok(Entitlements.fromApi({ addons: ['capital'] }).allows('capital'));
});

test('without entitlements, service() does NOT gate (backwards compatible)', async () => {
  const fetch = fakeFetch(() => ({ body: { assets: [] } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });
  await bezhas.service('energy').call('assets'); // no throw
  assert.equal(fetch.calls.length, 1);
});

test('with entitlements, an un-activated SubApp throws BEFORE any network call', async () => {
  const fetch = fakeFetch();
  const bezhas = new BeZhasConnect({
    apiKey: 'sk', baseUrl: 'https://api.example', fetch,
    entitlements: ['pay'], // energy NOT activated
  });
  assert.throws(
    () => bezhas.service('energy').call('assets'),
    (e) => e instanceof BeZhasEntitlementError && e.code === 'ENTITLEMENT_REQUIRED' && e.subapp === 'energy',
  );
  assert.equal(fetch.calls.length, 0);
});

test('with entitlements, an activated SubApp passes through', async () => {
  const fetch = fakeFetch(() => ({ body: { assets: [1] } }));
  const bezhas = new BeZhasConnect({
    apiKey: 'sk', baseUrl: 'https://api.example', fetch, entitlements: ['energy'],
  });
  const out = await bezhas.service('energy').call('assets');
  assert.deepEqual(out, { assets: [1] });
  assert.equal(fetch.calls.length, 1);
});

test('core SubApps are always callable even if not listed', async () => {
  const fetch = fakeFetch(() => ({ body: {} }));
  const bezhas = new BeZhasConnect({
    apiKey: 'sk', baseUrl: 'https://api.example', fetch, entitlements: ['pay'],
  });
  // wallet is core → allowed despite not being in the entitlements array.
  assert.ok(bezhas.getEntitlements().allows('wallet'));
});

test('subscription SubApp is never gated (can always read your plan)', async () => {
  const fetch = fakeFetch(() => ({ body: { plan: 'business', subapps: ['pay'] } }));
  const bezhas = new BeZhasConnect({
    apiKey: 'sk', baseUrl: 'https://api.example', fetch, entitlements: ['pay'],
  });
  // subscription not in entitlements, but it's infra → allowed.
  const out = await bezhas.service('subscription').call('get');
  assert.equal(out.plan, 'business');
});

test('setEntitlements(null) disables gating again', async () => {
  const fetch = fakeFetch(() => ({ body: {} }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch, entitlements: ['pay'] });
  assert.throws(() => bezhas.service('energy').call('assets'), BeZhasEntitlementError);
  bezhas.setEntitlements(null);
  await bezhas.service('energy').call('assets'); // no throw now
});

test('subscription.sync() pulls entitlements and applies them to the client', async () => {
  const fetch = fakeFetch((url) => {
    if (String(url).includes('/subscription')) return { body: { plan: 'business', subapps: ['pay', 'cargolink'] } };
    return { body: {} };
  });
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });
  const ent = await bezhas.subscription.sync();
  assert.ok(ent.allows('pay'));
  assert.ok(ent.allows('cargolink'));
  // Now gating is active: energy (not in the synced set) is blocked.
  assert.throws(() => bezhas.service('energy').call('assets'), BeZhasEntitlementError);
});

test('subscription.activate posts the subapp id', async () => {
  const fetch = fakeFetch(() => ({ body: { ok: true } }));
  const bezhas = new BeZhasConnect({ apiKey: 'sk', baseUrl: 'https://api.example', fetch });
  await bezhas.subscription.activate('energy');
  const { url, init } = fetch.calls[0];
  assert.equal(url, 'https://api.example/api/gateway/v1/subscription/activate');
  assert.equal(init.method, 'POST');
  assert.deepEqual(JSON.parse(init.body), { subapp: 'energy' });
});

test('subscription appears in capabilities discovery', () => {
  const bezhas = new BeZhasConnect({ apiKey: 'sk', fetch: fakeFetch() });
  const caps = bezhas.capabilities();
  const sub = caps.find((c) => c.subapp === 'subscription');
  assert.ok(sub, 'subscription must be discoverable');
  assert.ok(sub.actions.some((a) => a.action === 'activate'));
});
