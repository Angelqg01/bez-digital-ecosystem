/**
 * api/__tests__/pqc.test.js
 * Tests para apiPQC.js — singleton PQC del servidor API.
 * Sin dependencias de BD ni servidor: prueba el módulo de forma aislada.
 */

'use strict';

const assert = require('assert');

// Forzar re-require limpio entre bloques sin seed
function freshPQC() {
  delete require.cache[require.resolve('../lib/apiPQC')];
  return require('../lib/apiPQC');
}

function makeJwt(payload = {}) {
  const h = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
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
  const pqc = freshPQC();
  const info = pqc.getInfo();
  assert.strictEqual(info.algorithm, 'ML-DSA-65');
  assert.strictEqual(info.standard,  'NIST FIPS 204 (ML-DSA)');
  assert.ok(info.publicKey.length > 64, 'publicKey debe tener longitud significativa');
  assert.ok(info.initAt, 'initAt debe estar presente');
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

test('seed inválida (long < 64) lanza error descriptivo', () => {
  process.env.BEZHAS_PQC_SEED = 'abc';
  assert.throws(() => freshPQC().getInfo(), /32 bytes/);
  delete process.env.BEZHAS_PQC_SEED;
});

// ─── Suite 2: signJwt ─────────────────────────────────────────────────────────

console.log('\n[apiPQC] signJwt');

test('signJwt() añade claim pqc al payload', () => {
  const pqc    = freshPQC();
  const jwt    = makeJwt();
  const signed = pqc.signJwt(jwt);
  const parts  = signed.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  assert.ok(payload.pqc,                       'Debe existir claim pqc');
  assert.strictEqual(payload.pqc.alg, 'ML-DSA-65');
  assert.ok(payload.pqc.sig,                   'Debe tener firma');
  assert.ok(payload.pqc.pub,                   'Debe tener clave pública');
});

test('signJwt() preserva la 3ª parte (firma ECDSA) intacta', () => {
  const pqc    = freshPQC();
  const jwt    = makeJwt();
  const signed = pqc.signJwt(jwt);
  assert.strictEqual(jwt.split('.')[2], signed.split('.')[2]);
});

test('signJwt() con JWT malformado lanza error', () => {
  const pqc = freshPQC();
  assert.throws(() => pqc.signJwt('no-dots-here'), /malformado/);
});

test('signJwt() preserva todos los claims originales', () => {
  const pqc     = freshPQC();
  const payload = { sub: 'u-999', userId: 99, role: 'admin', bezhas_id: 'BEZ-TEST', exp: 9999999999 };
  const signed  = pqc.signJwt(makeJwt(payload));
  const decoded = JSON.parse(Buffer.from(signed.split('.')[1], 'base64url').toString());

  assert.strictEqual(decoded.userId,    99);
  assert.strictEqual(decoded.role,      'admin');
  assert.strictEqual(decoded.bezhas_id, 'BEZ-TEST');
});

// ─── Suite 3: verifyJwt ──────────────────────────────────────────────────────

console.log('\n[apiPQC] verifyJwt');

test('verifyJwt() valida JWT auto-firmado', () => {
  const pqc    = freshPQC();
  const signed = pqc.signJwt(makeJwt());
  const result = pqc.verifyJwt(signed);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.alg,   'ML-DSA-65');
});

test('verifyJwt() rechaza JWT sin claim pqc', () => {
  const pqc    = freshPQC();
  const result = pqc.verifyJwt(makeJwt());
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('PQC'));
});

test('verifyJwt() rechaza JWT con payload alterado post-firma', () => {
  const pqc    = freshPQC();
  const signed = pqc.signJwt(makeJwt());
  const parts  = signed.split('.');

  // Cambiar el rol de 'user' a 'admin' en el payload
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  p.role       = 'admin';
  const tampered = `${parts[0]}.${Buffer.from(JSON.stringify(p)).toString('base64url')}.${parts[2]}`;

  const result = pqc.verifyJwt(tampered);
  assert.strictEqual(result.valid, false, 'Payload alterado debe fallar verificación PQC');
});

test('verifyJwt() rechaza firma corrupta', () => {
  const pqc    = freshPQC();
  const signed = pqc.signJwt(makeJwt());
  const parts  = signed.split('.');
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  p.pqc.sig    = Buffer.from('firma-falsa').toString('base64url');
  const bad    = `${parts[0]}.${Buffer.from(JSON.stringify(p)).toString('base64url')}.${parts[2]}`;

  const result = pqc.verifyJwt(bad);
  assert.strictEqual(result.valid, false);
});

test('verifyJwt() rechaza algoritmo PQC desconocido', () => {
  const pqc    = freshPQC();
  const signed = pqc.signJwt(makeJwt());
  const parts  = signed.split('.');
  const p      = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

  p.pqc.alg = 'FUTURE-ALG-999';
  const bad  = `${parts[0]}.${Buffer.from(JSON.stringify(p)).toString('base64url')}.${parts[2]}`;

  const result = pqc.verifyJwt(bad);
  assert.strictEqual(result.valid, false);
  assert.ok(result.reason.includes('desconocido'));
});

test('verifyJwt() verifica con clave pública embebida — no depende del singleton', () => {
  // Firmado con seed A
  process.env.BEZHAS_PQC_SEED = '1'.repeat(64);
  const pqcA  = freshPQC();
  const signed = pqcA.signJwt(makeJwt());

  // Verificado con seed B (clave distinta) — debe usar la pub embebida en el token
  process.env.BEZHAS_PQC_SEED = '2'.repeat(64);
  const pqcB  = freshPQC();
  const result = pqcB.verifyJwt(signed);

  assert.strictEqual(result.valid, true, 'Debe verificar con la pub embebida, no la del singleton');
  delete process.env.BEZHAS_PQC_SEED;
});

// ─── Suite 4: Integración con flujo completo ─────────────────────────────────

console.log('\n[apiPQC] Flujo completo sign → verify');

test('sign/verify round-trip con payload real de usuario', () => {
  const pqc   = freshPQC();
  const userPayload = {
    address:    '0x1234567890abcdef1234567890abcdef12345678',
    userId:     7,
    role:       'manager',
    bezhas_id:  'BEZ-ABCD-1234',
    exp:        Math.floor(Date.now() / 1000) + 86400,
  };
  const signed = pqc.signJwt(makeJwt(userPayload));
  const result = pqc.verifyJwt(signed);

  assert.strictEqual(result.valid, true);

  // Confirmar que los datos del usuario siguen intactos
  const decoded = JSON.parse(Buffer.from(signed.split('.')[1], 'base64url').toString());
  assert.strictEqual(decoded.userId,    7);
  assert.strictEqual(decoded.role,      'manager');
  assert.strictEqual(decoded.bezhas_id, 'BEZ-ABCD-1234');
});

test('tokens consecutivos son independientes', () => {
  const pqc  = freshPQC();
  const t1   = pqc.signJwt(makeJwt({ userId: 1 }));
  const t2   = pqc.signJwt(makeJwt({ userId: 2 }));

  assert.strictEqual(pqc.verifyJwt(t1).valid, true);
  assert.strictEqual(pqc.verifyJwt(t2).valid, true);

  // Mezclar firmas: sig de t1 en t2 debe fallar
  const p1 = JSON.parse(Buffer.from(t1.split('.')[1], 'base64url').toString());
  const p2 = JSON.parse(Buffer.from(t2.split('.')[1], 'base64url').toString());
  p2.pqc.sig = p1.pqc.sig;
  const mixed = `${t2.split('.')[0]}.${Buffer.from(JSON.stringify(p2)).toString('base64url')}.${t2.split('.')[2]}`;

  assert.strictEqual(pqc.verifyJwt(mixed).valid, false, 'Firma de otro token debe fallar');
});

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultados: ${passed} pasados, ${failed} fallados`);
console.log('─'.repeat(50));

if (failed > 0) process.exitCode = 1;
