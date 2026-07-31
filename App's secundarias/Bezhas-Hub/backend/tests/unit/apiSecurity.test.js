/**
 * Núcleo de seguridad de la API: scopes, firma HMAC anti-replay e idempotencia.
 * Sin BD ni red — Express simulado y almacenes inyectados.
 */
const { createApiSecurity, signRequest } = require('../../middleware/apiSecurity');

function mockRes() {
  return {
    statusCode: 200, body: null, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    set(k, v) { this.headers[k] = v; return this; },
  };
}
function mockReq(over = {}) {
  const headers = over.headers || {};
  return {
    method: over.method || 'POST',
    url: over.url || '/api/gateway/v1/wallet/transfer',
    originalUrl: over.originalUrl || over.url || '/api/gateway/v1/wallet/transfer',
    body: over.body !== undefined ? over.body : { amount: 10 },
    rawBody: over.rawBody,
    apiKeyRecord: over.apiKeyRecord,
    apiKeyId: over.apiKeyId || 'key-1',
    tenant: over.tenant,
    get: (h) => headers[h] ?? headers[h.toLowerCase()] ?? null,
  };
}
const run = (mw, req, res) => new Promise((resolve) => {
  let called = false;
  const out = mw(req, res, () => { called = true; resolve({ called }); });
  if (out && typeof out.then === 'function') out.then(() => resolve({ called }));
  else if (!called) resolve({ called });
});

describe('requireScope — aplicación de permisos de la API key', () => {
  const sec = createApiSecurity({ legacyKeysAllowAll: false, logger: { warn() {} } });

  test('deja pasar si la clave tiene el scope exacto', async () => {
    const req = mockReq({ apiKeyRecord: { permissions: ['wallet:write'] } });
    const { called } = await run(sec.requireScope('wallet:write'), req, mockRes());
    expect(called).toBe(true);
  });

  test('bloquea con 403 si le falta el scope', async () => {
    const req = mockReq({ apiKeyRecord: { permissions: ['wallet:read'] } });
    const res = mockRes();
    const { called } = await run(sec.requireScope('wallet:write'), req, res);
    expect(called).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('SCOPE_DENIED');
  });

  test('NO hay herencia implícita: write no concede read', async () => {
    const req = mockReq({ apiKeyRecord: { permissions: ['wallet:write'] } });
    const res = mockRes();
    await run(sec.requireScope('wallet:read'), req, res);
    expect(res.statusCode).toBe(403);
  });

  test('comodín de recurso: wallet:* cubre wallet:write', async () => {
    const req = mockReq({ apiKeyRecord: { permissions: ['wallet:*'] } });
    const { called } = await run(sec.requireScope('wallet:write'), req, mockRes());
    expect(called).toBe(true);
  });

  test('comodín total * cubre cualquier scope', async () => {
    const req = mockReq({ apiKeyRecord: { permissions: ['*'] } });
    const { called } = await run(sec.requireScope('treasury:read'), req, mockRes());
    expect(called).toBe(true);
  });

  test('acepta permissions como string jsonb', async () => {
    const req = mockReq({ apiKeyRecord: { permissions: '["staking:read"]' } });
    const { called } = await run(sec.requireScope('staking:read'), req, mockRes());
    expect(called).toBe(true);
  });

  test('sin API key → 401', async () => {
    const res = mockRes();
    await run(sec.requireScope('wallet:read'), mockReq({ apiKeyRecord: undefined }), res);
    expect(res.statusCode).toBe(401);
  });

  test('modo estricto: clave sin scopes queda bloqueada', async () => {
    const res = mockRes();
    await run(sec.requireScope('wallet:read'), mockReq({ apiKeyRecord: { permissions: [] } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NO_SCOPES');
  });

  test('modo legado: clave antigua sin scopes sigue operando', async () => {
    const legacy = createApiSecurity({ legacyKeysAllowAll: true, logger: { warn() {} } });
    const req = mockReq({ apiKeyRecord: { permissions: [] } });
    const { called } = await run(legacy.requireScope('wallet:read'), req, mockRes());
    expect(called).toBe(true);
  });
});

describe('verifySignature — firma HMAC y anti-replay', () => {
  const SECRET = 'whsec_test_1234567890';
  let sec;
  beforeEach(() => { sec = createApiSecurity({ resolveSecret: null }); });

  function signedReq(over = {}) {
    const ts = over.ts ?? Math.floor(Date.now() / 1000);
    const nonce = over.nonce ?? 'nonce-' + Math.random().toString(36).slice(2);
    const body = over.body !== undefined ? over.body : { amount: 10 };
    const raw = JSON.stringify(body);
    const sig = over.sig ?? signRequest({
      secret: SECRET, timestamp: ts, nonce,
      method: 'POST', path: '/api/gateway/v1/wallet/transfer', body: raw,
    });
    return mockReq({
      body, rawBody: raw,
      apiKeyRecord: { signing_secret: SECRET },
      headers: { 'X-BeZhas-Timestamp': String(ts), 'X-BeZhas-Nonce': nonce, 'X-BeZhas-Signature': sig },
    });
  }

  test('acepta una petición correctamente firmada', async () => {
    const req = signedReq();
    const { called } = await run(sec.verifySignature(), req, mockRes());
    expect(called).toBe(true);
    expect(req.signatureVerified).toBe(true);
  });

  test('rechaza si faltan las cabeceras de firma', async () => {
    const res = mockRes();
    await run(sec.verifySignature(), mockReq({ apiKeyRecord: { signing_secret: SECRET } }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('SIGNATURE_REQUIRED');
  });

  test('rechaza una firma inválida', async () => {
    const res = mockRes();
    await run(sec.verifySignature(), signedReq({ sig: 'a'.repeat(64) }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('BAD_SIGNATURE');
  });

  test('rechaza una petición fuera de la ventana temporal', async () => {
    const res = mockRes();
    const old = Math.floor(Date.now() / 1000) - 4000;
    await run(sec.verifySignature({ maxSkewSec: 300 }), signedReq({ ts: old }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TIMESTAMP_SKEW');
  });

  test('detecta REPLAY: el mismo nonce no se acepta dos veces', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = 'nonce-fijo';
    const body = { amount: 10 };
    const raw = JSON.stringify(body);
    const sig = signRequest({ secret: SECRET, timestamp: ts, nonce, method: 'POST', path: '/api/gateway/v1/wallet/transfer', body: raw });
    const mk = () => mockReq({ body, rawBody: raw, apiKeyRecord: { signing_secret: SECRET },
      headers: { 'X-BeZhas-Timestamp': String(ts), 'X-BeZhas-Nonce': nonce, 'X-BeZhas-Signature': sig } });

    const first = await run(sec.verifySignature(), mk(), mockRes());
    expect(first.called).toBe(true);
    const res2 = mockRes();
    const second = await run(sec.verifySignature(), mk(), res2);
    expect(second.called).toBe(false);
    expect(res2.statusCode).toBe(409);
    expect(res2.body.code).toBe('REPLAY_DETECTED');
  });

  test('la firma cubre el cuerpo: alterarlo la invalida', async () => {
    const req = signedReq();
    req.rawBody = JSON.stringify({ amount: 999999 }); // manipulado tras firmar
    const res = mockRes();
    await run(sec.verifySignature(), req, res);
    expect(res.body.code).toBe('BAD_SIGNATURE');
  });

  test('sin secreto de firma configurado → 401', async () => {
    const req = signedReq();
    req.apiKeyRecord = {};
    const res = mockRes();
    await run(sec.verifySignature(), req, res);
    expect(res.body.code).toBe('NO_SIGNING_SECRET');
  });
});

describe('idempotency — reintentos seguros', () => {
  let sec;
  beforeEach(() => { sec = createApiSecurity(); });

  test('sin cabecera y no obligatoria, pasa de largo', async () => {
    const { called } = await run(sec.idempotency(), mockReq(), mockRes());
    expect(called).toBe(true);
  });

  test('si es obligatoria y falta la cabecera → 400', async () => {
    const res = mockRes();
    await run(sec.idempotency({ required: true }), mockReq(), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  test('repetir la misma clave devuelve la respuesta cacheada, no re-ejecuta', async () => {
    const mw = sec.idempotency();
    const headers = { 'Idempotency-Key': 'idem-1' };

    const res1 = mockRes();
    await run(mw, mockReq({ headers }), res1);
    res1.json({ bUid: 'B-abc', created: true });           // el handler responde
    await new Promise((r) => setTimeout(r, 10));

    const res2 = mockRes();
    const second = await run(mw, mockReq({ headers }), res2);
    expect(second.called).toBe(false);                      // no llega al handler
    expect(res2.body).toEqual({ bUid: 'B-abc', created: true });
    expect(res2.headers['Idempotent-Replay']).toBe('true');
  });

  test('misma clave con cuerpo distinto → 422', async () => {
    const mw = sec.idempotency();
    const headers = { 'Idempotency-Key': 'idem-2' };
    const res1 = mockRes();
    await run(mw, mockReq({ headers, body: { a: 1 } }), res1);
    res1.json({ ok: true });
    await new Promise((r) => setTimeout(r, 10));

    const res2 = mockRes();
    await run(mw, mockReq({ headers, body: { a: 2 } }), res2);
    expect(res2.statusCode).toBe(422);
    expect(res2.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  test('petición aún en vuelo → 409', async () => {
    const mw = sec.idempotency();
    const headers = { 'Idempotency-Key': 'idem-3' };
    await run(mw, mockReq({ headers }), mockRes());          // queda in_flight
    const res2 = mockRes();
    await run(mw, mockReq({ headers }), res2);
    expect(res2.statusCode).toBe(409);
    expect(res2.body.code).toBe('REQUEST_IN_FLIGHT');
  });

  test('un error no se cachea: el cliente puede reintentar', async () => {
    const mw = sec.idempotency();
    const headers = { 'Idempotency-Key': 'idem-4' };
    const res1 = mockRes();
    await run(mw, mockReq({ headers }), res1);
    res1.status(500).json({ error: 'boom' });
    await new Promise((r) => setTimeout(r, 10));

    const res2 = mockRes();
    const second = await run(mw, mockReq({ headers }), res2);
    expect(second.called).toBe(true);                        // vuelve a ejecutarse
  });

  test('la idempotencia está aislada por API key', async () => {
    const mw = sec.idempotency();
    const headers = { 'Idempotency-Key': 'compartida' };
    const r1 = mockRes();
    await run(mw, mockReq({ headers, apiKeyId: 'key-A' }), r1);
    r1.json({ owner: 'A' });
    await new Promise((r) => setTimeout(r, 10));

    const r2 = mockRes();
    const second = await run(mw, mockReq({ headers, apiKeyId: 'key-B' }), r2);
    expect(second.called).toBe(true);                        // otra clave, otro espacio
  });
});

describe('almacén en memoria — acotado y con TTL', () => {
  test('setNX sólo tiene éxito la primera vez', async () => {
    const { createMemoryStore } = require('../../middleware/apiSecurity');
    const s = createMemoryStore();
    expect(await s.setNX('k', 1, 1000)).toBe(true);
    expect(await s.setNX('k', 1, 1000)).toBe(false);
  });

  test('el valor caduca al vencer su TTL', async () => {
    const { createMemoryStore } = require('../../middleware/apiSecurity');
    const s = createMemoryStore();
    await s.set('k', 'v', 20);
    await new Promise((r) => setTimeout(r, 40));
    expect(await s.get('k')).toBeNull();
  });

  test('respeta el tamaño máximo (no crece sin límite)', async () => {
    const { createMemoryStore } = require('../../middleware/apiSecurity');
    const s = createMemoryStore({ max: 10 });
    for (let i = 0; i < 60; i++) await s.set('k' + i, i, 60000);
    expect(s.size).toBeLessThanOrEqual(11);
  });
});
