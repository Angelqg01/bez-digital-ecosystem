#!/usr/bin/env node
'use strict';

/**
 * verify-signing-interop.js — proves the Edge Gateway signer and the BACKEND
 * verifier agree byte-for-byte across the two separate packages. If their
 * canonicalization ever drifts, every signed telemetry payload would be rejected
 * in production — this catches that in CI.
 *
 *   edge-gateway/src/security/signer.js   (signs)
 *   api/services/telemetrySecurity.js     (verifies)
 *
 * Exit 0 on success, 1 on failure.
 */

const path = require('path');
const { generateKeyPair, createSoftwareSigner } = require('../src/security/signer');

let backend;
try {
  backend = require(path.resolve(__dirname, '../../api/services/telemetrySecurity'));
} catch (err) {
  console.error('❌ cannot load backend telemetrySecurity:', err.message);
  process.exit(1);
}

const log = (...a) => console.log('[interop]', ...a);

// 1) Provision a key on both sides.
const { privateKeyPem } = generateKeyPair();
const signer = createSoftwareSigner({ keyId: 'edge-key-1', privateKeyPem });
backend.registerKey('edge-key-1', signer.publicKeyPem);

// 2) Edge signs a realistic payload (note: keys in scrambled insertion order).
const payload = {
  seq: 4096,
  metrics: { voltage_v: 231.4, output_kw: 18.42, grid_frequency: 50.01 },
  type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'SunSpec/Modbus-TCP',
  ts: '2026-06-27T10:15:00.000Z',
};
payload.keyId = signer.keyId;
payload.sig = signer.sign(payload);

// 3) Backend verifies.
const good = backend.verifyPayload(payload);
log('signed canonical message accepted by backend:', good.valid, `(${good.reason})`);

// 4) Tamper → backend must reject.
const tampered = { ...payload, metrics: { ...payload.metrics, output_kw: 999 } };
const bad = backend.verifyPayload(tampered);
log('tampered payload accepted by backend:', bad.valid, `(expected false)`);

// 5) Canonical strings must be identical across packages.
const edgeCanon = require('../src/security/signer').stableStringify;
const sameCanon = edgeCanon({ b: 1, a: { d: 4, c: 3 } }) === backend.stableStringify({ a: { c: 3, d: 4 }, b: 1 });
log('canonicalization identical across packages:', sameCanon);

if (good.valid && !bad.valid && sameCanon) {
  console.log('\n✅ PASS — Edge signature verifies on the backend; tamper rejected; canonicalization matches');
  process.exit(0);
}
console.error('\n❌ FAIL — Edge/backend signing interop mismatch');
process.exit(1);
