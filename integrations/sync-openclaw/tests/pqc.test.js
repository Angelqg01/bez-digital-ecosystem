/**
 * tests/pqc.test.js
 * Suite de tests para PQCManager (Dilithium3 / ML-DSA-65) y la integración
 * con TokenManager (esquema híbrido ECDSA + PQC).
 *
 * Sin dependencias externas de test framework — usa assert nativo de Node.
 */

'use strict';

const assert = require('assert');
const pqc    = require('../lib/PQCManager');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJwt(payload = {}) {
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify({
    sub: 'user-123',
    roles: ['manager'],
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  })).toString('base64url');
  const sig     = Buffer.from('fake-ecdsa-signature').toString('base64url');
  return `${header}.${body}.${sig}`;
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

// ─── Suite 1: PQCManager básico ──────────────────────────────────────────────

console.log('\n[PQCManager] Inicialización y par de claves');

test('init() con seed hex determinista genera claves consistentes', () => {
  pqc.clear();
  const seed = 'a'.repeat(64);
  pqc.init(seed);
  const pub1 = pqc.getPublicKeyHex();

  pqc.clear();
  pqc.init(seed);
  const pub2 = pqc.getPublicKeyHex();

  assert.strictEqual(pub1, pub2, 'Misma seed debe generar misma clave pública');
});

test('init() sin seed genera claves aleatorias (no repetibles)', () => {
  pqc.clear();
  pqc.init();
  const pub1 = pqc.getPublicKeyHex();

  pqc.clear();
  pqc.init();
  const pub2 = pqc.getPublicKeyHex();

  assert.notStrictEqual(pub1, pub2, 'Sin seed las claves deben ser distintas');
});

test('getPublicKeyHex() devuelve string hex no vacío', () => {
  pqc.clear();
  pqc.init('b'.repeat(64));
  const pub = pqc.getPublicKeyHex();
  assert.ok(pub.length > 64, 'Clave pública debe tener longitud significativa');
  assert.ok(/^[0-9a-f]+$/i.test(pub), 'Debe ser hex válido');
});

test('getStatus() refleja estado inicializado', () => {
  const status = pqc.getStatus();
  assert.strictEqual(status.initialized, true);
  assert.strictEqual(status.algorithm, 'ML-DSA-65 (Dilithium3)');
  assert.strictEqual(status.standard, 'NIST FIPS 204');
  assert.ok(status.publicKey.endsWith('…'));
});

test('clear() deja el módulo sin inicializar', () => {
  pqc.clear();
  const status = pqc.getStatus();
  assert.strictEqual(status.initialized, false);
  assert.strictEqual(status.publicKey, null);
});

// ─── Suite 2: sign / verify ──────────────────────────────────────────────────

console.log('\n[PQCManager] Firma y verificación de mensajes');

test('sign() + verify() — mensaje string simple', () => {
  pqc.clear();
  pqc.init('c'.repeat(64));
  const msg = 'bezhas-pqc-test-payload';
  const sig = pqc.sign(msg);
  const pub = pqc.getPublicKeyHex();

  const result = pqc.verify(msg, sig, pub);
  assert.strictEqual(result.valid, true, 'Firma propia debe ser válida');
});

test('verify() falla con mensaje alterado', () => {
  pqc.clear();
  pqc.init('d'.repeat(64));
  const msg = 'mensaje-original';
  const sig = pqc.sign(msg);
  const pub = pqc.getPublicKeyHex();

  const result = pqc.verify('mensaje-ALTERADO', sig, pub);
  assert.strictEqual(result.valid, false, 'Mensaje alterado debe fallar verificación');
});

test('verify() falla con firma corrupta', () => {
  pqc.clear();
  pqc.init('e'.repeat(64));
  const msg    = 'payload-valido';
  const pub    = pqc.getPublicKeyHex();
  const badSig = Buffer.from('firma-basura-123').toString('base64url');

  const result = pqc.verify(msg, badSig, pub);
  assert.strictEqual(result.valid, false, 'Firma corrupta debe fallar');
});

test('verify() falla con clave pública incorrecta', () => {
  pqc.clear();
  pqc.init('f'.repeat(64));
  const msg = 'payload';
  const sig = pqc.sign(msg);

  // Generar otra clave pública diferente
  pqc.clear();
  pqc.init('1'.repeat(64));
  const wrongPub = pqc.getPublicKeyHex();

  const result = pqc.verify(msg, sig, wrongPub);
  assert.strictEqual(result.valid, false, 'Clave pública incorrecta debe fallar');
});

test('sign() devuelve base64url válido (sin +, /, =)', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const sig = pqc.sign('test');
  assert.ok(!/[+/=]/.test(sig), 'Firma debe ser base64url puro');
});

// ─── Suite 3: signJwt / verifyJwt ────────────────────────────────────────────

console.log('\n[PQCManager] JWT híbrido');

test('signJwt() produce un JWT con claim pqc', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const jwt    = makeJwt();
  const signed = pqc.signJwt(jwt);

  const parts   = signed.split('.');
  assert.strictEqual(parts.length, 3, 'JWT firmado debe tener 3 partes');

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  assert.ok(payload.pqc,              'Debe existir claim pqc');
  assert.strictEqual(payload.pqc.alg, 'ML-DSA-65');
  assert.ok(payload.pqc.sig,          'Debe existir firma PQC');
  assert.ok(payload.pqc.pub,          'Debe existir clave pública PQC');
});

test('signJwt() preserva la firma ECDSA original (3ª parte intacta)', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const jwt    = makeJwt();
  const signed = pqc.signJwt(jwt);

  const origSig   = jwt.split('.')[2];
  const signedSig = signed.split('.')[2];
  assert.strictEqual(origSig, signedSig, 'La firma ECDSA original debe quedar intacta');
});

test('verifyJwt() valida JWT firmado con signJwt()', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const jwt    = makeJwt();
  const signed = pqc.signJwt(jwt);

  const result = pqc.verifyJwt(signed);
  assert.strictEqual(result.valid, true,        'JWT auto-firmado debe ser válido');
  assert.strictEqual(result.alg,   'ML-DSA-65', 'Algoritmo debe ser ML-DSA-65');
});

test('verifyJwt() rechaza JWT sin claim pqc', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const jwt    = makeJwt();   // JWT sin claim pqc
  const result = pqc.verifyJwt(jwt);
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('PQC'), 'Debe indicar falta de claim PQC');
});

test('verifyJwt() rechaza JWT con payload alterado post-firma', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const jwt    = makeJwt();
  const signed = pqc.signJwt(jwt);

  // Alterar el payload manualmente (cambiar sub)
  const parts   = signed.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.sub   = 'attacker-999';
  const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${parts[2]}`;

  const result = pqc.verifyJwt(tampered);
  assert.strictEqual(result.valid, false, 'JWT con payload alterado debe fallar');
});

test('verifyJwt() rechaza algoritmo PQC desconocido', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const jwt    = makeJwt({ pqc: { alg: 'UNKNOWN-ALG', sig: 'x', pub: 'y' } });
  const result = pqc.verifyJwt(jwt);
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('desconocido'));
});

// ─── Suite 4: Seguridad — límites ────────────────────────────────────────────

console.log('\n[PQCManager] Seguridad y límites');

test('init() con seed corta lanza error', () => {
  pqc.clear();
  assert.throws(
    () => pqc.init('abc'),
    /seed debe ser hex de 32 bytes/,
    'Seed corta debe lanzar error descriptivo'
  );
});

test('sign() sin init() lanza error', () => {
  pqc.clear();
  assert.throws(
    () => pqc.sign('payload'),
    /no inicializado/,
    'Usar sign sin init debe lanzar error'
  );
});

test('signJwt() con JWT malformado lanza error', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  assert.throws(
    () => pqc.signJwt('no-es-un-jwt'),
    /malformado/,
    'JWT sin puntos debe lanzar error descriptivo'
  );
});

test('verify() con firma vacía devuelve { valid: false }', () => {
  pqc.clear();
  pqc.init('a'.repeat(64));
  const pub    = pqc.getPublicKeyHex();
  const result = pqc.verify('msg', '', pub);
  assert.strictEqual(result.valid, false);
});

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultados: ${passed} pasados, ${failed} fallados`);
console.log('─'.repeat(50));

if (failed > 0) {
  process.exitCode = 1;
}
