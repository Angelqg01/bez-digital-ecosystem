/**
 * api/__tests__/pqc.test.js
 * Tests para apiPQC.js — singleton PQC del servidor API (out-of-band).
 * Sin dependencias de BD ni servidor: prueba el módulo de forma aislada.
 */

'use strict';

const assert = require('assert');

function freshPQC() {
  // Bajo jest, require.cache es emulado y borrar entradas no resetea el módulo:
  // usar isolateModules para obtener un singleton limpio en ambos entornos.
  if (typeof jest !== 'undefined') {
    let mod;
    jest.isolateModules(() => { mod = require('../lib/apiPQC'); });
    return mod;
  }
  delete require.cache[require.resolve('../lib/apiPQC')];
  return require('../lib/apiPQC');
}

// Token JWT estándar (sin modificar) para simular lo que jwt.sign() produce
function makeJwt(payload = {}) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify({
    sub: 'user-1', userId: 42, role: 'user',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  })).toString('base64url');
  return `${h}.${b}.ecdsa-sig-placeholder`;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── Suite 1: Inicialización ──────────────────────────────────────────────────

console.log('\n[apiPQC] Inicialización');

test('getInfo() devuelve campos requeridos', () => {
  const pqc  = freshPQC();
  const info = pqc.getInfo();
  assert.strictEqual(info.algorithm, 'ML-DSA-65');
  assert.strictEqual(info.standard,  'NIST FIPS 204 (ML-DSA)');
  assert.ok(info.publicKey.length > 64, 'publicKey debe tener longitud significativa');
  assert.ok(info.initAt, 'initAt debe estar presente');
  assert.strictEqual(info.transport, 'out-of-band');
});

test('getInfo().persistent = false sin BEZHAS_PQC_SEED', () => {
  delete process.env.BEZHAS_PQC_SEED;
  const pqc = freshPQC();
  assert.strictEqual(pqc.getInfo().persistent, false);
});

test('getInfo().persistent = true con BEZHAS_PQC_SEED', () => {
  process.env.BEZHAS_PQC_SEED = 'a'.repeat(64);
  const pqc = freshPQC();
  assert.strictEqual(pqc.getInfo().persistent, true);
  delete process.env.BEZHAS_PQC_SEED;
});

test('seed determinista produce misma clave pública', () => {
  process.env.BEZHAS_PQC_SEED = 'f'.repeat(64);
  const pub1 = freshPQC().getPublicKeyHex();
  const pub2 = freshPQC().getPublicKeyHex();
  assert.strictEqual(pub1, pub2, 'Misma seed → misma clave pública');
  delete process.env.BEZHAS_PQC_SEED;
});

test('seed inválida (len < 64) lanza error descriptivo', () => {
  process.env.BEZHAS_PQC_SEED = 'abc';
  assert.throws(() => freshPQC().getInfo(), /32 bytes/);
  delete process.env.BEZHAS_PQC_SEED;
});

// ─── Suite 2: signToken ───────────────────────────────────────────────────────

console.log('\n[apiPQC] signToken');

test('signToken() devuelve { sig, pub }', () => {
  const pqc    = freshPQC();
  const jwt    = makeJwt();
  const result = pqc.signToken(jwt);

  assert.ok(result.sig, 'Debe tener campo sig');
  assert.ok(result.pub, 'Debe tener campo pub');
  assert.ok(result.sig.length > 100, 'Firma Dilithium3 debe ser larga');
  assert.ok(result.pub.length > 64,  'Clave pública debe ser larga');
});

test('signToken() NO modifica el JWT original', () => {
  const pqc = freshPQC();
  const jwt = makeJwt();
  pqc.signToken(jwt);
  // El JWT permanece idéntico — signToken es puro
  assert.strictEqual(jwt, makeJwt(JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString())));
});

test('signToken() con string vacío lanza error', () => {
  const pqc = freshPQC();
  assert.throws(() => pqc.signToken(''), /token debe ser/);
  assert.throws(() => pqc.signToken(null), /token debe ser/);
});

test('signToken() distintos tokens producen distintas firmas', () => {
  const pqc  = freshPQC();
  const r1   = pqc.signToken(makeJwt({ userId: 1 }));
  const r2   = pqc.signToken(makeJwt({ userId: 2 }));
  assert.notStrictEqual(r1.sig, r2.sig, 'Tokens distintos → firmas distintas');
  assert.strictEqual(r1.pub, r2.pub, 'Misma instancia → misma clave pública');
});

// ─── Suite 3: verifyToken ─────────────────────────────────────────────────────

console.log('\n[apiPQC] verifyToken');

test('verifyToken() válida JWT auto-firmado', () => {
  const pqc   = freshPQC();
  const jwt   = makeJwt();
  const { sig, pub } = pqc.signToken(jwt);
  const result = pqc.verifyToken(jwt, sig, pub);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.alg,   'ML-DSA-65');
});

test('verifyToken() falla sin sig', () => {
  const pqc    = freshPQC();
  const jwt    = makeJwt();
  const { pub } = pqc.signToken(jwt);
  const result  = pqc.verifyToken(jwt, null, pub);
  assert.strictEqual(result.valid,  false);
  assert.strictEqual(result.reason, 'no-pqc-sig');
});

test('verifyToken() falla sin pub', () => {
  const pqc    = freshPQC();
  const jwt    = makeJwt();
  const { sig } = pqc.signToken(jwt);
  const result  = pqc.verifyToken(jwt, sig, null);
  assert.strictEqual(result.valid,  false);
  assert.strictEqual(result.reason, 'no-pqc-pub');
});

test('verifyToken() falla con firma corrupta', () => {
  const pqc   = freshPQC();
  const jwt   = makeJwt();
  const { pub } = pqc.signToken(jwt);
  const result  = pqc.verifyToken(jwt, Buffer.from('firma-basura').toString('base64url'), pub);
  assert.strictEqual(result.valid, false);
});

test('verifyToken() falla si el token fue modificado post-firma', () => {
  const pqc   = freshPQC();
  const jwt   = makeJwt({ role: 'user' });
  const { sig, pub } = pqc.signToken(jwt);

  // Alterar el JWT (cambiar un byte al final del payload)
  const parts = jwt.split('.');
  const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  p.role  = 'admin';
  const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(p)).toString('base64url')}.${parts[2]}`;

  const result = pqc.verifyToken(tampered, sig, pub);
  assert.strictEqual(result.valid, false, 'Token modificado debe fallar PQC');
});

test('verifyToken() verifica con pub embebida — no depende del singleton', () => {
  // Firma con seed A
  process.env.BEZHAS_PQC_SEED = '1'.repeat(64);
  const pqcA = freshPQC();
  const jwt  = makeJwt();
  const { sig, pub } = pqcA.signToken(jwt);

  // Verifica con singleton de seed B — usa la pub pasada como parámetro
  process.env.BEZHAS_PQC_SEED = '2'.repeat(64);
  const pqcB  = freshPQC();
  const result = pqcB.verifyToken(jwt, sig, pub);
  assert.strictEqual(result.valid, true, 'Debe verificar con pub pasada, no la del singleton');
  delete process.env.BEZHAS_PQC_SEED;
});

// ─── Suite 4: helpers extractFrom* ───────────────────────────────────────────

console.log('\n[apiPQC] Helpers de extracción');

test('extractFromHeaders extrae sig y pub correctamente', () => {
  const pqc = freshPQC();
  const h = { 'x-pqc-signature': 'mySig', 'x-pqc-pubkey': 'myPub', authorization: 'Bearer tok' };
  const r = pqc.extractFromHeaders(h);
  assert.strictEqual(r.sig, 'mySig');
  assert.strictEqual(r.pub, 'myPub');
});

test('extractFromHeaders devuelve null si faltan headers', () => {
  const pqc = freshPQC();
  const r = pqc.extractFromHeaders({ authorization: 'Bearer tok' });
  assert.strictEqual(r.sig, null);
  assert.strictEqual(r.pub, null);
});

test('extractFromQuery extrae pqcSig y pqcPub', () => {
  const pqc = freshPQC();
  const r = pqc.extractFromQuery({ token: 'jwt', pqcSig: 'mySig', pqcPub: 'myPub' });
  assert.strictEqual(r.sig, 'mySig');
  assert.strictEqual(r.pub, 'myPub');
});

test('extractFromQuery devuelve null si faltan params', () => {
  const pqc = freshPQC();
  const r = pqc.extractFromQuery({ token: 'jwt' });
  assert.strictEqual(r.sig, null);
  assert.strictEqual(r.pub, null);
});

// ─── Suite 5: flujo completo round-trip ─────────────────────────────────────

console.log('\n[apiPQC] Flujo completo sign → verify');

test('round-trip con payload real de usuario', () => {
  const pqc = freshPQC();
  const jwt = makeJwt({
    address:   '0x1234567890abcdef1234567890abcdef12345678',
    userId:    7,
    role:      'manager',
    bezhas_id: 'BEZ-ABCD-1234',
  });
  const { sig, pub } = pqc.signToken(jwt);
  const result = pqc.verifyToken(jwt, sig, pub);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.alg,   'ML-DSA-65');
});

test('tokens consecutivos son independientes', () => {
  const pqc  = freshPQC();
  const jwt1 = makeJwt({ userId: 1 });
  const jwt2 = makeJwt({ userId: 2 });
  const r1   = pqc.signToken(jwt1);
  const r2   = pqc.signToken(jwt2);

  assert.strictEqual(pqc.verifyToken(jwt1, r1.sig, r1.pub).valid, true);
  assert.strictEqual(pqc.verifyToken(jwt2, r2.sig, r2.pub).valid, true);

  // Firma de jwt1 no verifica jwt2
  assert.strictEqual(pqc.verifyToken(jwt2, r1.sig, r1.pub).valid, false);
  // Firma de jwt2 no verifica jwt1
  assert.strictEqual(pqc.verifyToken(jwt1, r2.sig, r2.pub).valid, false);
});

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultados: ${passed} pasados, ${failed} fallados`);
console.log('─'.repeat(50));

if (failed > 0) process.exitCode = 1;

// Bajo jest (testMatch incluye este archivo), registrar el resultado agregado
// como un test real — el runner casero de arriba sigue sirviendo standalone:
//   node __tests__/pqc.test.js
if (typeof it === 'function') {
  it(`apiPQC suite standalone: ${passed} asserts pasan, 0 fallan`, () => {
    assert.strictEqual(failed, 0, `${failed} asserts fallaron (ver consola)`);
  });
}
