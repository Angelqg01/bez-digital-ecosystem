'use strict';

/**
 * Tests for telemetry signing (src/security/signer.js). Runnable offline:
 *     node __tests__/signer.test.js
 */

const assert = require('assert');
const { generateKeyPair, createSoftwareSigner, verify, stableStringify } = require('../src/security/signer');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`); }

console.log('signer.js');

const { privateKeyPem, publicKeyPem } = generateKeyPair();
const signer = createSoftwareSigner({ keyId: 'edge-key-1', privateKeyPem });

const basePayload = () => ({
  type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'SunSpec/Modbus-TCP',
  metrics: { output_kw: 18.42, voltage_v: 231.4, grid_frequency: 50.01 },
  ts: '2026-06-27T10:15:00.000Z', seq: 42,
});

test('stableStringify is order-independent', () => {
  assert.strictEqual(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
  assert.strictEqual(stableStringify({ a: { y: 1, x: 2 } }), '{"a":{"x":2,"y":1}}');
});

test('sign → verify roundtrip succeeds', () => {
  const p = basePayload();
  p.keyId = signer.keyId;
  p.sig = signer.sign(p);
  assert.strictEqual(verify(p, publicKeyPem), true);
});

test('tampered metric fails verification', () => {
  const p = basePayload();
  p.keyId = signer.keyId;
  p.sig = signer.sign(p);
  p.metrics.output_kw = 999; // spoof generation upward
  assert.strictEqual(verify(p, publicKeyPem), false);
});

test('swapped keyId fails verification', () => {
  const p = basePayload();
  p.keyId = signer.keyId;
  p.sig = signer.sign(p);
  p.keyId = 'attacker-key';
  assert.strictEqual(verify(p, publicKeyPem), false);
});

test('wrong public key fails verification', () => {
  const other = generateKeyPair();
  const p = basePayload();
  p.keyId = signer.keyId;
  p.sig = signer.sign(p);
  assert.strictEqual(verify(p, other.publicKeyPem), false);
});

test('missing signature fails verification', () => {
  assert.strictEqual(verify(basePayload(), publicKeyPem), false);
});

test('canonical message is insertion-order independent (sig of p1 verifies p2)', () => {
  // ECDSA signatures are non-deterministic (random k), so the BYTES differ each
  // time — what must be stable is the canonical message. A signature made over
  // p1 must therefore verify p2 when they canonicalize identically.
  const p1 = { seq: 1, type: 'SOLAR', metrics: { a: 1, b: 2 }, ts: 't', name: 'x', status: 'ONLINE', protocol: 'p', keyId: signer.keyId };
  const p2 = { protocol: 'p', status: 'ONLINE', name: 'x', ts: 't', metrics: { b: 2, a: 1 }, type: 'SOLAR', seq: 1, keyId: signer.keyId };
  const sig = signer.sign(p1);
  assert.strictEqual(verify({ ...p2, sig }, publicKeyPem), true);
});

console.log(`\n${passed} passed`);
