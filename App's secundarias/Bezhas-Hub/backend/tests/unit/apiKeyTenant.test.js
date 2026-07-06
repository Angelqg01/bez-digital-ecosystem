/**
 * Unit tests del flujo máquina-a-máquina: hashing de claves, middleware de
 * autenticación por API key con scope org/sede, y medidor de uso. Sin DB (DI).
 */
const ApiKey = require('../../models/pg/ApiKey');
const { createApiKeyTenant, createApiUsageMeter } = require('../../middleware/apiKeyTenant');

function mockRes() {
  const handlers = {};
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    on(ev, fn) { handlers[ev] = fn; },
    emit(ev) { handlers[ev] && handlers[ev](); },
  };
}
function mockReq(over = {}) {
  const headers = over.headers || {};
  return {
    header: (h) => headers[h] || headers[h.toLowerCase()] || null,
    method: over.method || 'GET',
    originalUrl: over.originalUrl || '/api/x',
    ip: over.ip || '127.0.0.1',
    apiKeyId: over.apiKeyId,
    apiKeyRecord: over.apiKeyRecord,
    tenant: over.tenant,
    user: over.user,
  };
}

describe('ApiKey — crypto puro', () => {
  test('hashKey es estable y verifyKey casa', () => {
    const k = 'bzh_test_general_abc123';
    const h = ApiKey.hashKey(k);
    expect(h).toHaveLength(64); // sha256 hex
    expect(ApiKey.verifyKey(h, k)).toBe(true);
    expect(ApiKey.verifyKey(h, 'otra')).toBe(false);
  });
  test('generateKey respeta entorno y sector', () => {
    expect(ApiKey.generateKey('u1', 'logistics', 'production')).toMatch(/^bzh_live_logistics_/);
    expect(ApiKey.generateKey('u1', 'energy')).toMatch(/^bzh_test_energy_/);
  });
});

describe('apiKeyTenant — auth + binding org/sede', () => {
  function build(record) {
    const ApiKeyMock = {
      hashKey: ApiKey.hashKey,
      findActiveByHash: jest.fn().mockResolvedValue(record),
    };
    return { ...createApiKeyTenant({ ApiKey: ApiKeyMock }), ApiKeyMock };
  }

  test('sin clave y required → 401', async () => {
    const { apiKeyTenant } = build(null);
    const req = mockReq();
    const res = mockRes();
    let called = false;
    await apiKeyTenant()(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('NO_API_KEY');
  });

  test('clave inválida → 403', async () => {
    const { apiKeyTenant } = build(null);
    const req = mockReq({ headers: { 'X-API-Key': 'bzh_test_x_nope' } });
    const res = mockRes();
    await apiKeyTenant()(req, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('BAD_API_KEY');
  });

  test('clave activa → fija req.apiKeyRecord con org/site y continúa', async () => {
    const record = { id: 'k1', org_id: 'org-1', site_id: 'site-9', environment: 'production', rate_limit: { x: 1 } };
    const { apiKeyTenant } = build(record);
    const req = mockReq({ headers: { 'X-API-Key': 'bzh_live_general_abc' } });
    const res = mockRes();
    let called = false;
    await apiKeyTenant()(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.apiKeyRecord).toBe(record);
    expect(req.apiKeyId).toBe('k1');
    expect(req.apiTier).toBe('pro');
  });

  test('clave expirada → 403', async () => {
    const record = { id: 'k1', org_id: 'org-1', expires_at: new Date(Date.now() - 1000).toISOString() };
    const { apiKeyTenant } = build(record);
    const req = mockReq({ headers: { 'X-API-Key': 'bzh_test_x_old' } });
    const res = mockRes();
    await apiKeyTenant()(req, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('EXPIRED_API_KEY');
  });

  test('required:false sin clave → continúa', async () => {
    const { apiKeyTenant } = build(null);
    const req = mockReq();
    const res = mockRes();
    let called = false;
    await apiKeyTenant({ required: false })(req, res, () => { called = true; });
    expect(called).toBe(true);
  });
});

describe('apiUsageMeter — medición por sede', () => {
  test('registra un log con org/site al finalizar la respuesta', async () => {
    const ApiLogMock = { create: jest.fn().mockResolvedValue({}) };
    const meter = createApiUsageMeter({ ApiLog: ApiLogMock });
    const req = mockReq({ apiKeyId: 'k1', tenant: { orgId: 'org-1', siteId: 'site-9' }, originalUrl: '/api/logistics?x=1' });
    const res = mockRes();
    let called = false;
    meter(req, res, () => { called = true; });
    expect(called).toBe(true);
    res.emit('finish');
    expect(ApiLogMock.create).toHaveBeenCalledTimes(1);
    const arg = ApiLogMock.create.mock.calls[0][0];
    expect(arg).toMatchObject({ apiKeyId: 'k1', orgId: 'org-1', siteId: 'site-9' });
    expect(arg.request.endpoint).toBe('/api/logistics');
  });

  test('no registra nada si no hay scope', () => {
    const ApiLogMock = { create: jest.fn() };
    const meter = createApiUsageMeter({ ApiLog: ApiLogMock });
    const req = mockReq();
    const res = mockRes();
    meter(req, res, () => {});
    res.emit('finish');
    expect(ApiLogMock.create).not.toHaveBeenCalled();
  });
});
