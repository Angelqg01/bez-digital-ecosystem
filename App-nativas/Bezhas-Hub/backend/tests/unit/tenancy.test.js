/**
 * Unit tests del cimiento multi-tenant: middleware de tenancy + jerarquía de
 * roles. Sin base de datos — los modelos se inyectan como mocks (DI).
 */
const { createTenancy, ROLE_LEVEL } = require('../../middleware/tenancy');
const Membership = require('../../models/pg/Membership');

// Helpers de Express simulado
function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
function mockReq(over = {}) {
  const headers = over.headers || {};
  return {
    header: (h) => headers[h] || headers[h.toLowerCase()] || null,
    query: over.query || {},
    params: over.params || {},
    user: over.user,
    walletAddress: over.walletAddress,
    apiKeyRecord: over.apiKeyRecord,
  };
}

describe('Membership.roleSatisfies — jerarquía de roles', () => {
  test('owner satisface cualquier rol mínimo', () => {
    for (const r of Object.keys(ROLE_LEVEL)) {
      expect(Membership.roleSatisfies('owner', r)).toBe(true);
    }
  });
  test('operator NO satisface org_admin', () => {
    expect(Membership.roleSatisfies('operator', 'org_admin')).toBe(false);
  });
  test('site_manager satisface operator y auditor', () => {
    expect(Membership.roleSatisfies('site_manager', 'operator')).toBe(true);
    expect(Membership.roleSatisfies('site_manager', 'auditor')).toBe(true);
  });
  test('rol desconocido no satisface nada por encima de 0', () => {
    expect(Membership.roleSatisfies('ghost', 'auditor')).toBe(false);
  });
});

describe('tenancy() — resolución del tenant', () => {
  function build(membershipResult, siteBelongs = true) {
    const Membership = { findForActorInOrg: jest.fn().mockResolvedValue(membershipResult) };
    const Site = { belongsToOrg: jest.fn().mockResolvedValue(siteBelongs) };
    return { ...createTenancy({ Membership, Site }), Membership, Site };
  }

  test('scope desde API key → org_admin a nivel org', async () => {
    const { tenancy } = build(null);
    const req = mockReq({ apiKeyRecord: { org_id: 'org-1' } });
    const res = mockRes();
    let called = false;
    await tenancy({ required: true })(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.tenant).toMatchObject({ orgId: 'org-1', role: 'org_admin', source: 'api_key' });
  });

  test('API key con site → rol site_manager', async () => {
    const { tenancy } = build(null);
    const req = mockReq({ apiKeyRecord: { org_id: 'org-1', site_id: 'site-9' } });
    const res = mockRes();
    await tenancy()(req, res, () => {});
    expect(req.tenant).toMatchObject({ orgId: 'org-1', siteId: 'site-9', role: 'site_manager' });
  });

  test('humano miembro → tenant con su rol', async () => {
    const { tenancy, Membership } = build({ role: 'site_manager', site_id: null });
    const req = mockReq({ headers: { 'X-Org-Id': 'org-1' }, user: { id: 'u1' } });
    const res = mockRes();
    let called = false;
    await tenancy({ required: true })(req, res, () => { called = true; });
    expect(Membership.findForActorInOrg).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'u1', wallet: null });
    expect(called).toBe(true);
    expect(req.tenant).toMatchObject({ orgId: 'org-1', role: 'site_manager', source: 'membership' });
  });

  test('no miembro + required → 403', async () => {
    const { tenancy } = build(null);
    const req = mockReq({ headers: { 'X-Org-Id': 'org-1' }, user: { id: 'u1' } });
    const res = mockRes();
    let called = false;
    await tenancy({ required: true })(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('NOT_MEMBER');
  });

  test('actor limitado a una sede no puede pedir otra sede → 403 SITE_SCOPE', async () => {
    const { tenancy } = build({ role: 'operator', site_id: 'site-A' });
    const req = mockReq({ headers: { 'X-Org-Id': 'org-1', 'X-Site-Id': 'site-B' }, user: { id: 'u1' } });
    const res = mockRes();
    await tenancy({ required: true })(req, res, () => {});
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('SITE_SCOPE');
  });

  test('sin org y no required → pasa con tenant null', async () => {
    const { tenancy } = build(null);
    const req = mockReq({});
    const res = mockRes();
    let called = false;
    await tenancy()(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.tenant).toBeNull();
  });
});

describe('requireRole() — guardia de rol', () => {
  const { requireRole } = createTenancy({ Membership: {}, Site: {} });

  test('deja pasar si el rol alcanza el mínimo', () => {
    const req = { tenant: { role: 'org_admin' } };
    const res = mockRes();
    let called = false;
    requireRole('site_manager')(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  test('bloquea con 403 si el rol es insuficiente', () => {
    const req = { tenant: { role: 'operator' } };
    const res = mockRes();
    let called = false;
    requireRole('org_admin')(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ROLE_TOO_LOW');
  });

  test('401 si no hay tenant', () => {
    const req = { tenant: null };
    const res = mockRes();
    requireRole('auditor')(req, res, () => {});
    expect(res.statusCode).toBe(401);
  });
});
