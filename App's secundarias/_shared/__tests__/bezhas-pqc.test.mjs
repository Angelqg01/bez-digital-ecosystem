/**
 * __tests__/bezhas-pqc.test.mjs
 * Tests para bezhas-pqc.js (módulo ESM browser-safe).
 *
 * Ejecutar: node "_shared/__tests__/bezhas-pqc.test.mjs"
 */

import assert from 'node:assert';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';
import {
  decodeJwtPayload,
  parsePqcClaim,
  verifyPqcClaim,
  getTokenPqcStatus,
} from '../bezhas-pqc.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function b64url(data) {
  return Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function makeJwt(payload = {}) {
  const h = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
  const b = b64url(JSON.stringify({ sub: 'u1', userId: 1, role: 'user', exp: 9999999999, ...payload }));
  return `${h}.${b}.ecdsa-sig`;
}

function signJwtPqc(jwt, sk, pk) {
  const parts   = jwt.split('.');
  const message = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  const sig     = ml_dsa65.sign(message, sk);
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.pqc   = { alg: 'ML-DSA-65', sig: b64url(sig), pub: Buffer.from(pk).toString('hex') };
  return `${parts[0]}.${b64url(JSON.stringify(payload))}.${parts[2]}`;
}

const SEED = new Uint8Array(32).fill(0xab);
const { publicKey, secretKey } = ml_dsa65.keygen(SEED);

// ─── Runner ──────────────────────────────────────────────────────────────────

const tests = [];
const reg = (name, fn) => tests.push({ name, fn });

async function runAll() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Resultados: ${passed} pasados, ${failed} fallados`);
  console.log('─'.repeat(50));
  if (failed > 0) process.exitCode = 1;
}

// ─── Suite 1: decodeJwtPayload ───────────────────────────────────────────────

console.log('\n[bezhas-pqc] decodeJwtPayload');

reg('decodifica payload estándar', () => {
  const p = decodeJwtPayload(makeJwt({ role: 'admin', bezhas_id: 'BEZ-TEST' }));
  assert.strictEqual(p.role,      'admin');
  assert.strictEqual(p.bezhas_id, 'BEZ-TEST');
});

reg('devuelve null con token malformado', () => {
  assert.strictEqual(decodeJwtPayload('no-dots'), null);
  assert.strictEqual(decodeJwtPayload(''),         null);
  assert.strictEqual(decodeJwtPayload(null),       null);
});

reg('decodifica token con claim pqc', () => {
  const p = decodeJwtPayload(signJwtPqc(makeJwt(), secretKey, publicKey));
  assert.ok(p.pqc);
  assert.strictEqual(p.pqc.alg, 'ML-DSA-65');
});

// ─── Suite 2: parsePqcClaim ──────────────────────────────────────────────────

console.log('\n[bezhas-pqc] parsePqcClaim');

reg('devuelve { present: false } sin claim pqc', () => {
  assert.strictEqual(parsePqcClaim(makeJwt()).present, false);
});

reg('devuelve metadatos truncados con claim pqc', () => {
  const r = parsePqcClaim(signJwtPqc(makeJwt(), secretKey, publicKey));
  assert.strictEqual(r.present, true);
  assert.strictEqual(r.alg,     'ML-DSA-65');
  assert.ok(r.sig.endsWith('…'));
  assert.ok(r.pub.endsWith('…'));
});

// ─── Suite 3: verifyPqcClaim ─────────────────────────────────────────────────

console.log('\n[bezhas-pqc] verifyPqcClaim');

reg('verifica JWT correctamente firmado', async () => {
  const r = await verifyPqcClaim(signJwtPqc(makeJwt(), secretKey, publicKey));
  assert.strictEqual(r.verified, true);
  assert.strictEqual(r.alg,      'ML-DSA-65');
});

reg('rechaza JWT sin claim pqc', async () => {
  const r = await verifyPqcClaim(makeJwt());
  assert.strictEqual(r.verified, false);
  assert.strictEqual(r.reason,   'no-claim');
});

reg('rechaza payload alterado post-firma (escalada de rol)', async () => {
  const signed = signJwtPqc(makeJwt({ role: 'user' }), secretKey, publicKey);
  const parts  = signed.split('.');
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  p.role       = 'admin';
  const tampered = `${parts[0]}.${b64url(JSON.stringify(p))}.${parts[2]}`;

  const r = await verifyPqcClaim(tampered);
  assert.strictEqual(r.verified, false);
});

reg('rechaza firma corrupta', async () => {
  const signed = signJwtPqc(makeJwt(), secretKey, publicKey);
  const parts  = signed.split('.');
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  p.pqc.sig    = b64url(Buffer.from('firma-basura'));
  const r      = await verifyPqcClaim(`${parts[0]}.${b64url(JSON.stringify(p))}.${parts[2]}`);
  assert.strictEqual(r.verified, false);
});

reg('rechaza algoritmo PQC desconocido', async () => {
  const signed = signJwtPqc(makeJwt(), secretKey, publicKey);
  const parts  = signed.split('.');
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  p.pqc.alg    = 'KYBER-768';
  const r      = await verifyPqcClaim(`${parts[0]}.${b64url(JSON.stringify(p))}.${parts[2]}`);
  assert.strictEqual(r.verified, false);
  assert.ok(r.reason.startsWith('alg-unknown'));
});

reg('rechaza claim sin campo sig', async () => {
  const signed = signJwtPqc(makeJwt(), secretKey, publicKey);
  const parts  = signed.split('.');
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  delete p.pqc.sig;
  const r      = await verifyPqcClaim(`${parts[0]}.${b64url(JSON.stringify(p))}.${parts[2]}`);
  assert.strictEqual(r.verified, false);
  assert.strictEqual(r.reason,   'claim-incomplete');
});

// ─── Suite 4: getTokenPqcStatus ──────────────────────────────────────────────

console.log('\n[bezhas-pqc] getTokenPqcStatus');

reg('token null → level classical', async () => {
  const s = await getTokenPqcStatus(null);
  assert.strictEqual(s.hasClaim, false);
  assert.strictEqual(s.level,    'classical');
});

reg('token sin claim → level classical, label menciona ECDSA', async () => {
  const s = await getTokenPqcStatus(makeJwt());
  assert.strictEqual(s.hasClaim, false);
  assert.strictEqual(s.level,    'classical');
  assert.ok(s.label.includes('ECDSA'));
});

reg('token PQC válido → quantum-safe, verified true', async () => {
  const s = await getTokenPqcStatus(signJwtPqc(makeJwt(), secretKey, publicKey));
  assert.strictEqual(s.hasClaim, true);
  assert.strictEqual(s.verified, true);
  assert.strictEqual(s.level,    'quantum-safe');
  assert.ok(s.label.includes('ML-DSA-65'));
  assert.ok(s.pubSnippet?.endsWith('…'));
});

reg('token PQC inválido → level invalid con reason', async () => {
  const signed = signJwtPqc(makeJwt(), secretKey, publicKey);
  const parts  = signed.split('.');
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  p.pqc.sig    = b64url(Buffer.from('bad'));
  const bad    = `${parts[0]}.${b64url(JSON.stringify(p))}.${parts[2]}`;

  const s = await getTokenPqcStatus(bad);
  assert.strictEqual(s.hasClaim, true);
  assert.strictEqual(s.verified, false);
  assert.strictEqual(s.level,    'invalid');
  assert.ok(s.reason);
});

reg('status incluye exp del JWT', async () => {
  const exp    = Math.floor(Date.now() / 1000) + 3600;
  const s      = await getTokenPqcStatus(signJwtPqc(makeJwt({ exp }), secretKey, publicKey));
  assert.strictEqual(s.exp, exp);
});

reg('tokens consecutivos son independientes', async () => {
  const t1 = signJwtPqc(makeJwt({ userId: 1 }), secretKey, publicKey);
  const t2 = signJwtPqc(makeJwt({ userId: 2 }), secretKey, publicKey);

  const s1 = await verifyPqcClaim(t1);
  const s2 = await verifyPqcClaim(t2);
  assert.strictEqual(s1.verified, true);
  assert.strictEqual(s2.verified, true);

  // Cruzar firmas: sig de t1 en t2 debe fallar
  const parts2 = t2.split('.');
  const p2     = JSON.parse(Buffer.from(parts2[1], 'base64url').toString());
  const p1     = JSON.parse(Buffer.from(t1.split('.')[1], 'base64url').toString());
  p2.pqc.sig   = p1.pqc.sig;
  const mixed  = `${parts2[0]}.${b64url(JSON.stringify(p2))}.${parts2[2]}`;

  const sx = await verifyPqcClaim(mixed);
  assert.strictEqual(sx.verified, false, 'Firma cruzada debe fallar');
});

// ─── Ejecutar ─────────────────────────────────────────────────────────────────

await runAll();
