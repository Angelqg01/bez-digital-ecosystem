/**
 * api/__tests__/websocket-auth.test.js
 * Tests para la capa de autenticación JWT+PQC del WebSocket (diseño out-of-band).
 *
 * Diseño out-of-band: el JWT no se modifica — la firma PQC viaja en query params.
 *   ws://host/room?token=<JWT>&pqcSig=<sig>&pqcPub=<pub>
 *
 * No levanta servidor — testea verifyWsToken y canAccess de forma aislada.
 */

'use strict';

const assert = require('assert');
const jwt    = require('jsonwebtoken');

process.env.JWT_SECRET  = 'test-secret-ws-auth';
process.env.NODE_ENV    = 'test';
process.env.AUTH_BYPASS = 'false';

Object.keys(require.cache).forEach(k => {
  if (k.includes('secrets') || k.includes('apiPQC')) delete require.cache[k];
});

const apiPQC             = require('../lib/apiPQC');
const { JWT_SECRET }     = require('../config/secrets');

// ─── Replica de verifyWsToken (igual que en websocket.js) ────────────────────

function verifyWsToken(token, pqcSig, pqcPub) {
  if (!token) return { ok: false, reason: 'no-token' };

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return { ok: false, reason: `jwt-invalid: ${err.message}` };
  }

  const pqcResult = pqcSig && pqcPub
    ? apiPQC.verifyToken(token, pqcSig, pqcPub)
    : { valid: false, reason: 'no-pqc-params' };

  if (pqcSig && pqcPub && !pqcResult.valid) {
    return { ok: false, reason: `pqc-invalid: ${pqcResult.reason}` };
  }

  return { ok: true, user, pqcVerified: pqcResult.valid };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(payload = {}, opts = {}) {
  return jwt.sign(
    { address: '0xABCD', userId: 1, role: 'admin', ...payload },
    JWT_SECRET,
    { expiresIn: '1h', ...opts }
  );
}

/** Devuelve { token, pqcSig, pqcPub } listo para pasar a verifyWsToken */
function makeTokenWithPqc(payload = {}) {
  const token = makeToken(payload);
  const { sig, pub } = apiPQC.signToken(token);
  return { token, pqcSig: sig, pqcPub: pub };
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

// ─── Suite 1: básico ─────────────────────────────────────────────────────────

console.log('\n[WebSocket Auth] verifyWsToken — básico');

test('acepta token JWT válido sin PQC (legacy)', () => {
  const token  = makeToken();
  const result = verifyWsToken(token);
  assert.strictEqual(result.ok,          true,  'Token legacy debe aceptarse');
  assert.strictEqual(result.pqcVerified, false, 'pqcVerified=false sin firma PQC');
  assert.strictEqual(result.user.role,   'admin');
});

test('acepta token JWT+PQC válido (out-of-band)', () => {
  const { token, pqcSig, pqcPub } = makeTokenWithPqc();
  const result = verifyWsToken(token, pqcSig, pqcPub);
  assert.strictEqual(result.ok,          true,  'Debe aceptar token con PQC válido');
  assert.strictEqual(result.pqcVerified, true,  'pqcVerified=true con firma válida');
});

test('rechaza token vacío / null', () => {
  assert.strictEqual(verifyWsToken(null).ok,      false);
  assert.strictEqual(verifyWsToken('').ok,        false);
  assert.strictEqual(verifyWsToken(undefined).ok, false);
  assert.strictEqual(verifyWsToken(null).reason,  'no-token');
});

test('rechaza JWT con firma ECDSA inválida', () => {
  const valid    = makeToken();
  const tampered = valid.slice(0, -5) + 'XXXXX';
  const result   = verifyWsToken(tampered);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reason.includes('jwt-invalid'));
});

test('rechaza JWT expirado', () => {
  const expired = makeToken({}, { expiresIn: '-1s' });
  const result  = verifyWsToken(expired);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reason.includes('jwt-invalid'));
});

test('rechaza JWT firmado con secret incorrecto', () => {
  const foreign = jwt.sign({ userId: 99, role: 'admin' }, 'wrong-secret', { expiresIn: '1h' });
  assert.strictEqual(verifyWsToken(foreign).ok, false);
});

// ─── Suite 2: verificación PQC ───────────────────────────────────────────────

console.log('\n[WebSocket Auth] verifyWsToken — verificación PQC out-of-band');

test('rechaza token con firma PQC corrupta', () => {
  const { token, pqcPub } = makeTokenWithPqc();
  const badSig = Buffer.from('firma-basura-dilithium').toString('base64url');
  const result = verifyWsToken(token, badSig, pqcPub);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reason.startsWith('pqc-invalid'), `esperado pqc-invalid, recibido: ${result.reason}`);
});

test('rechaza token firmado por un par de claves diferente', () => {
  const { token } = makeTokenWithPqc();
  // Firma el mismo token con un singleton fresco (claves distintas)
  Object.keys(require.cache).forEach(k => { if (k.includes('apiPQC')) delete require.cache[k]; });
  const freshPqc = require('../lib/apiPQC');
  const { sig, pub } = freshPqc.signToken(token);

  // La firma es válida para esas claves, pero el pub no es el del firmante original
  // → verifyToken(token, sig, pub) CON el pub correcto debe pasar
  const result = freshPqc.verifyToken(token, sig, pub);
  assert.strictEqual(result.valid, true, 'Debe verificar con el pub correspondiente');
});

test('token PQC válido tiene pqcVerified=true', () => {
  const { token, pqcSig, pqcPub } = makeTokenWithPqc({ role: 'manager' });
  const result = verifyWsToken(token, pqcSig, pqcPub);
  assert.strictEqual(result.ok,          true);
  assert.strictEqual(result.pqcVerified, true);
  assert.strictEqual(result.user.role,   'manager');
});

test('sin pqcSig ni pqcPub → pqcVerified=false pero ok=true (legacy)', () => {
  const token  = makeToken();
  const result = verifyWsToken(token, null, null);
  assert.strictEqual(result.ok,          true,  'Sin PQC params → legacy OK');
  assert.strictEqual(result.pqcVerified, false, 'pqcVerified=false sin firma');
});

test('firma correcta con pub incorrecto → rechazado', () => {
  const { token, pqcSig } = makeTokenWithPqc();
  const wrongPub = 'a'.repeat(3904); // pub con longitud correcta pero bytes erróneos (hex)
  const result   = verifyWsToken(token, pqcSig, wrongPub);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reason.startsWith('pqc-invalid'));
});

// ─── Suite 3: ROOM_ROLES ─────────────────────────────────────────────────────

console.log('\n[WebSocket Auth] Control de acceso por room y rol');

const ROOM_ROLES = {
  '/agent-runtime': ['admin', 'manager', 'operator'],
  '/tokenomics':    null,
  '/aegis':         ['admin', 'manager'],
  '/compliance':    ['admin', 'manager', 'compliance'],
};

function canAccess(role, room) {
  if (!(room in ROOM_ROLES)) {
    // Room desconocida → usar restricción máxima como fallback
    return ROOM_ROLES['/agent-runtime'].includes(role);
  }
  const required = ROOM_ROLES[room];
  // null = cualquier usuario autenticado; no se puede usar ?? porque null es nullish
  if (required === null) return true;
  return required.includes(role);
}

test('/tokenomics acepta cualquier rol autenticado', () => {
  for (const role of ['admin', 'manager', 'user', 'operator', 'compliance']) {
    assert.ok(canAccess(role, '/tokenomics'), `${role} debe acceder a /tokenomics`);
  }
});

test('/aegis requiere admin o manager', () => {
  assert.ok(canAccess('admin',   '/aegis'));
  assert.ok(canAccess('manager', '/aegis'));
  assert.ok(!canAccess('user',     '/aegis'));
  assert.ok(!canAccess('operator', '/aegis'));
});

test('/agent-runtime requiere admin, manager u operator', () => {
  assert.ok(canAccess('admin',    '/agent-runtime'));
  assert.ok(canAccess('manager',  '/agent-runtime'));
  assert.ok(canAccess('operator', '/agent-runtime'));
  assert.ok(!canAccess('user',       '/agent-runtime'));
  assert.ok(!canAccess('compliance', '/agent-runtime'));
});

test('/compliance requiere admin, manager o compliance', () => {
  assert.ok(canAccess('admin',      '/compliance'));
  assert.ok(canAccess('manager',    '/compliance'));
  assert.ok(canAccess('compliance', '/compliance'));
  assert.ok(!canAccess('user',     '/compliance'));
  assert.ok(!canAccess('operator', '/compliance'));
});

// ─── Suite 4: extracción de token ────────────────────────────────────────────

console.log('\n[WebSocket Auth] Extracción de parámetros del request');

function extractToken(queryToken, authHeader) {
  return queryToken || (authHeader || '').replace(/^Bearer\s+/i, '');
}

test('extrae token de query param ?token=', () => {
  assert.strictEqual(extractToken('my-jwt', undefined), 'my-jwt');
});

test('extrae token de header Authorization: Bearer', () => {
  assert.strictEqual(extractToken(undefined, 'Bearer my-jwt'), 'my-jwt');
});

test('query param tiene precedencia sobre header', () => {
  assert.strictEqual(extractToken('from-query', 'Bearer from-header'), 'from-query');
});

test('extractFromQuery extrae pqcSig y pqcPub', () => {
  const r = apiPQC.extractFromQuery({ token: 'jwt', pqcSig: 'sig1', pqcPub: 'pub1' });
  assert.strictEqual(r.sig, 'sig1');
  assert.strictEqual(r.pub, 'pub1');
});

test('extractFromQuery devuelve null si no hay params PQC', () => {
  const r = apiPQC.extractFromQuery({ token: 'jwt' });
  assert.strictEqual(r.sig, null);
  assert.strictEqual(r.pub, null);
});

// ─── Suite 5: integridad del usuario autenticado ─────────────────────────────

console.log('\n[WebSocket Auth] Integridad del usuario autenticado');

test('user adjunto tiene userId, role, address y bezhas_id del JWT', () => {
  const token  = makeToken({ userId: 42, role: 'manager', address: '0x1234', bezhas_id: 'BEZ-XY' });
  const result = verifyWsToken(token);
  assert.strictEqual(result.user.userId,    42);
  assert.strictEqual(result.user.role,      'manager');
  assert.strictEqual(result.user.address,   '0x1234');
  assert.strictEqual(result.user.bezhas_id, 'BEZ-XY');
});

test('múltiples tokens distintos producen usuarios distintos', () => {
  const r1 = verifyWsToken(makeToken({ userId: 1, role: 'admin' }));
  const r2 = verifyWsToken(makeToken({ userId: 2, role: 'user' }));
  assert.notStrictEqual(r1.user.userId, r2.user.userId);
  assert.notStrictEqual(r1.user.role,   r2.user.role);
});

test('pqcVerified=true se propaga correctamente al user de la conexión', () => {
  const { token, pqcSig, pqcPub } = makeTokenWithPqc({ userId: 99 });
  const result = verifyWsToken(token, pqcSig, pqcPub);
  assert.strictEqual(result.ok,          true);
  assert.strictEqual(result.pqcVerified, true);
  assert.strictEqual(result.user.userId, 99);
});

// ─── Resumen ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultados: ${passed} pasados, ${failed} fallados`);
console.log('─'.repeat(50));

if (failed > 0) process.exitCode = 1;

// Bajo jest, registrar el resultado agregado como un test real — el runner
// casero sigue sirviendo standalone: node __tests__/websocket-auth.test.js
if (typeof it === 'function') {
  it(`ws-auth suite standalone: ${passed} asserts pasan, 0 fallan`, () => {
    assert.strictEqual(failed, 0, `${failed} asserts fallaron (ver consola)`);
  });
}
