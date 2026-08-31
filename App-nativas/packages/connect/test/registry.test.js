// Registry coverage — the manifest must list the whole SubApp ecosystem.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGISTRY, listCapabilities, getSubAppDescriptor } from '../src/registry.js';

// Las 13 SubApps del ecosistema (subdominios *.bez.digital) + subscription (infra).
const ECOSYSTEM = [
  'hub', 'wallet', 'gas', 'edge', 'vision', 'capital', 'prestige',
  'cargolink', 'pay', 'purescan', 'sphere', 'energy', 'genesis',
];

test('the registry covers all 13 ecosystem SubApps plus the subscription surface', () => {
  for (const name of ECOSYSTEM) {
    assert.ok(REGISTRY[name], `missing SubApp descriptor: ${name}`);
    assert.ok(REGISTRY[name].label, `missing label: ${name}`);
    assert.doesNotThrow(() => getSubAppDescriptor(name));
  }
  assert.ok(REGISTRY.subscription, 'missing infra descriptor: subscription');
});

test('every declared action is well-formed (method + path)', () => {
  for (const [name, d] of Object.entries(REGISTRY)) {
    for (const [action, a] of Object.entries(d.actions)) {
      assert.match(a.method, /^(GET|POST|PUT|DELETE)$/, `${name}.${action} method`);
      assert.ok(a.path.startsWith('/'), `${name}.${action} path must start with /`);
    }
  }
});

test('listCapabilities marks externally-hosted SubApps and stays serializable', () => {
  const caps = listCapabilities();
  const byName = Object.fromEntries(caps.map((c) => [c.subapp, c]));
  assert.equal(byName.vision.external, 'https://vision.bez.digital');
  assert.equal(byName.pay.external, undefined);
  assert.ok(byName.capital.actions.length >= 10, 'capital exposes the DeFi surface');
  assert.doesNotThrow(() => JSON.stringify(caps));
});
