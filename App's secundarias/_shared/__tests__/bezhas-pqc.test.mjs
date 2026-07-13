/**
 * bezhas-pqc.test.mjs — Tests de bezhas-pqc.js (diseño out-of-band)
 *
 * Diseño: la firma PQC viaja fuera del JWT (no dentro del payload).
 * La función verifyTokenPqc(token, sig, pub) verifica Dilithium3 sobre el JWT completo.
 *
 * ESM puro — Node 18+ (usa atob/btoa nativos)
 */

import assert from 'assert';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

// Import del módulo bajo test
const { verifyTokenPqc, getSessionPqcStatus, makeAuthHeaders, makeWsUrl,
        getTokenPqcStatus, parsePqcClaim } = await import('../bezhas-pqc.js');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEED_AB = new Uint8Array(32).fill(0xab);
const KEYS_AB = ml_dsa65.keygen(SEED_AB);

function b64url(bytes) {
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Simula lo que hace el servidor: firma el JWT completo con Dilithium3 */
function serverSign(jwt, sk = KEYS_AB.secretKey, pk = KEYS_AB.publicKey) {
  const msg = new TextEncoder().encode(jwt);
  const sig = ml_dsa65.sign(msg, sk);
  return { sig: b64url(sig), pub: Buffer.from(pk).toString('hex') };
}

function makeJwt(payload = {}) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify({
    sub: 'user-1', userId: 7, role: 'user',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  })).toString('base64url');
  return `${h}.${b}.ecdsa-sig-placeholder`;
}

// ─── Test runner ─────────────────────────────────────────────────────────────

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

// ─── Suite 1: verifyTokenPqc ─────────────────────────────────────────────────

console.log('\n[bezhas-pqc] verifyTokenPqc — básico');

reg('verifica firma válida', async () => {
  const jwt = makeJwt();
  const { sig, pub } = serverSign(jwt);
  const r = await verifyTokenPqc(jwt, sig, pub);
  assert.strictEqual(r.verified, true);
  assert.strictEqual(r.alg,      'ML-DSA-65');
  assert.strictEqual(r.reason,   undefined);
});

reg('rechaza firma corrupta', async () => {
  const jwt = makeJwt();
  const { pub } = serverSign(jwt);
  const r = await verifyTokenPqc(jwt, b64url(new Uint8Array(32)), pub);
  assert.strictEqual(r.verified, false);
});

reg('rechaza sig=null', async () => {
  const r = await verifyTokenPqc(makeJwt(), null, 'pub');
  assert.strictEqual(r.verified, false);
  assert.strictEqual(r.reason,   'no-sig');
});

reg('rechaza pub=null', async () => {
  const jwt = makeJwt();
  const { sig } = serverSign(jwt);
  const r = await verifyTokenPqc(jwt, sig, null);
  assert.strictEqual(r.verified, false);
  assert.strictEqual(r.reason,   'no-pub');
});

reg('rechaza token=null', async () => {
  const r = await verifyTokenPqc(null, 'sig', 'pub');
  assert.strictEqual(r.verified, false);
  assert.strictEqual(r.reason,   'no-token');
});

reg('rechaza token modificado post-firma', async () => {
  const jwt = makeJwt({ role: 'user' });
  const { sig, pub } = serverSign(jwt);
  const modified = jwt.slice(0, -5) + 'XXXXX';
  const r = await verifyTokenPqc(modified, sig, pub);
  assert.strictEqual(r.verified, false);
});

reg('verifica con par de claves alternativo', async () => {
  const SEED_CD = new Uint8Array(32).fill(0xcd);
  const KEYS_CD = ml_dsa65.keygen(SEED_CD);
  const jwt     = makeJwt({ role: 'admin' });
  const { sig, pub } = serverSign(jwt, KEYS_CD.secretKey, KEYS_CD.publicKey);
  const r = await verifyTokenPqc(jwt, sig, pub);
  assert.strictEqual(r.verified, true);
});

// ─── Suite 2: getSessionPqcStatus ────────────────────────────────────────────

console.log('\n[bezhas-pqc] getSessionPqcStatus');

reg('sin sesión → classical', async () => {
  const s = await getSessionPqcStatus(null);
  assert.strictEqual(s.hasPqc,   false);
  assert.strictEqual(s.verified, false);
  assert.strictEqual(s.level,    'classical');
});

reg('sesión sin firma PQC → classical', async () => {
  const s = await getSessionPqcStatus({ token: makeJwt() });
  assert.strictEqual(s.hasPqc,   false);
  assert.strictEqual(s.level,    'classical');
});

reg('sesión con firma válida → quantum-safe', async () => {
  const token = makeJwt({ userId: 99 });
  const { sig, pub } = serverSign(token);
  const s = await getSessionPqcStatus({ token, pqcSig: sig, pqcPub: pub });
  assert.strictEqual(s.hasPqc,   true);
  assert.strictEqual(s.verified, true);
  assert.strictEqual(s.level,    'quantum-safe');
});

reg('sesión con firma inválida → invalid', async () => {
  const token = makeJwt();
  const { pub } = serverSign(token);
  const s = await getSessionPqcStatus({ token, pqcSig: b64url(new Uint8Array(32)), pqcPub: pub });
  assert.strictEqual(s.hasPqc,   true);
  assert.strictEqual(s.verified, false);
  assert.strictEqual(s.level,    'invalid');
  assert.ok(s.reason,           'Debe incluir razón del fallo');
});

reg('normaliza { pqc: { sig, pub } } y { pqcSig, pqcPub }', async () => {
  const token = makeJwt();
  const { sig, pub } = serverSign(token);
  const s1 = await getSessionPqcStatus({ token, pqcSig: sig, pqcPub: pub });
  const s2 = await getSessionPqcStatus({ token, pqc: { sig, pub, alg: 'ML-DSA-65' } });
  assert.strictEqual(s1.verified, true);
  assert.strictEqual(s2.verified, true);
  assert.strictEqual(s1.level,    s2.level);
});

reg('exp del JWT está presente en el status', async () => {
  const expTs = Math.floor(Date.now() / 1000) + 7200;
  const token = makeJwt({ exp: expTs });
  const s = await getSessionPqcStatus({ token });
  assert.strictEqual(s.exp, expTs);
});

// ─── Suite 3: makeAuthHeaders / makeWsUrl ────────────────────────────────────

console.log('\n[bezhas-pqc] makeAuthHeaders / makeWsUrl');

reg('makeAuthHeaders sin PQC incluye solo Authorization', () => {
  const h = makeAuthHeaders('my-jwt', null, null);
  assert.strictEqual(h.Authorization, 'Bearer my-jwt');
  assert.ok(!h['X-PQC-Signature']);
  assert.ok(!h['X-PQC-Pubkey']);
});

reg('makeAuthHeaders con PQC incluye headers X-PQC-*', () => {
  const h = makeAuthHeaders('my-jwt', 'mySig', 'myPub');
  assert.strictEqual(h['Authorization'],    'Bearer my-jwt');
  assert.strictEqual(h['X-PQC-Signature'], 'mySig');
  assert.strictEqual(h['X-PQC-Pubkey'],    'myPub');
});

reg('makeWsUrl sin PQC solo incluye token', () => {
  const url = makeWsUrl('wss://api.bez.digital/agent-runtime', 'tok', null, null);
  assert.ok(url.includes('token=tok'));
  assert.ok(!url.includes('pqcSig'));
  assert.ok(!url.includes('pqcPub'));
});

reg('makeWsUrl con PQC incluye los tres params', () => {
  const url = makeWsUrl('wss://api.bez.digital/agent-runtime', 'tok', 'sig1', 'pub1');
  assert.ok(url.includes('token=tok'));
  assert.ok(url.includes('pqcSig=sig1'));
  assert.ok(url.includes('pqcPub=pub1'));
});

// ─── Suite 4: legacy shims ────────────────────────────────────────────────────

console.log('\n[bezhas-pqc] Legacy shims (compatibilidad v1.0.0)');

reg('parsePqcClaim con JWT sin claim pqc → present=false', () => {
  const r = parsePqcClaim(makeJwt());
  assert.strictEqual(r.present, false);
});

reg('getTokenPqcStatus llama a getSessionPqcStatus → classical sin PQC', async () => {
  const s = await getTokenPqcStatus(makeJwt());
  assert.strictEqual(s.level, 'classical');
});

// ─── Ejecutar ─────────────────────────────────────────────────────────────────

await runAll();
