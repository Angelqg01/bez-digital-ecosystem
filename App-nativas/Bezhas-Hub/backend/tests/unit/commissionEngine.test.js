/**
 * Unit tests del motor de comisiones jerárquicas. Sin base de datos — los
 * modelos se inyectan como mocks (DI), mismo patrón que tenancy.test.js.
 */
const { createCommissionEngine } = require('../../services/commissionEngine.service');
const { getHierarchyConfig, PLATFORM_FEE_BPS, MAX_TOTAL_BURDEN_BPS } = require('../../config/plans');

function buildModels(overrides = {}) {
  return {
    HierarchyLink: {
      findParentOf: jest.fn().mockResolvedValue(null),
      findLink: jest.fn().mockResolvedValue(null),
      countChildren: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(async (d) => ({ id: 'link-1', parent_org_id: d.parentOrgId, child_org_id: d.childOrgId, commission_rate_bps: d.commissionRateBps })),
      listChildren: jest.fn().mockResolvedValue([]),
      listDescendants: jest.fn().mockResolvedValue([]),
      revoke: jest.fn(),
      ...overrides.HierarchyLink,
    },
    ValidationEvent: {
      create: jest.fn().mockImplementation(async (d) => ({ event: { id: 'evt-1', ...d }, duplicate: false })),
      aggregateBySubjects: jest.fn().mockResolvedValue([]),
      ...overrides.ValidationEvent,
    },
    CommissionLedger: {
      create: jest.fn().mockImplementation(async (d) => ({ id: `ledger-${d.beneficiaryOrgId}-${d.level}`, ...d })),
      listByBeneficiary: jest.fn().mockResolvedValue([]),
      summaryByBeneficiary: jest.fn().mockResolvedValue([]),
      settle: jest.fn(),
      ...overrides.CommissionLedger,
    },
    OrgPolicy: {
      listApplicableTo: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      listByOwner: jest.fn().mockResolvedValue([]),
      revoke: jest.fn(),
      ...overrides.OrgPolicy,
    },
    TreasuryTransfer: {
      create: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      settle: jest.fn(),
      listForOrg: jest.fn().mockResolvedValue([]),
      ...overrides.TreasuryTransfer,
    },
    Organization: {
      findById: jest.fn(),
      ...overrides.Organization,
    },
    getHierarchyConfig,
  };
}

describe('getHierarchyConfig — deriva del plan', () => {
  test('starter/creator_pro no habilitan jerarquía', () => {
    expect(getHierarchyConfig('starter')).toBeNull();
    expect(getHierarchyConfig('creator_pro')).toBeNull();
  });
  test('business: 5 sub-empresas, 10% (1000 bps), 1 nivel de cascada', () => {
    const c = getHierarchyConfig('business');
    expect(c).toMatchObject({ maxSubOrgs: 5, commissionRateBps: 1000, cascadeDepth: 1, treasuryTransfers: true, policyEngine: true });
  });
  test('enterprise_vip: 50 sub-empresas, 20% (2000 bps), 3 niveles, reventa white-label', () => {
    const c = getHierarchyConfig('enterprise_vip');
    expect(c).toMatchObject({ maxSubOrgs: 50, commissionRateBps: 2000, cascadeDepth: 3, whiteLabelResale: true });
  });
});

describe('linkSubordinate', () => {
  test('rechaza auto-vínculo', async () => {
    const engine = createCommissionEngine(buildModels());
    await expect(engine.linkSubordinate({ parentOrgId: 'a', childOrgId: 'a' })).rejects.toMatchObject({ code: 'SELF_LINK' });
  });

  test('rechaza si el plan del padre no incluye jerarquía', async () => {
    const models = buildModels({ Organization: { findById: jest.fn().mockResolvedValue({ id: 'p1', plan: 'starter' }) } });
    const engine = createCommissionEngine(models);
    await expect(engine.linkSubordinate({ parentOrgId: 'p1', childOrgId: 'c1' })).rejects.toMatchObject({ code: 'PLAN_NO_HIERARCHY' });
  });

  test('rechaza si el subordinado ya tiene padre', async () => {
    const models = buildModels({
      Organization: { findById: jest.fn().mockResolvedValue({ id: 'p1', plan: 'business' }) },
      HierarchyLink: { findParentOf: jest.fn().mockResolvedValue({ parent_org_id: 'other' }) },
    });
    const engine = createCommissionEngine(models);
    await expect(engine.linkSubordinate({ parentOrgId: 'p1', childOrgId: 'c1' })).rejects.toMatchObject({ code: 'ALREADY_LINKED' });
  });

  test('rechaza al alcanzar el límite de sub-empresas del plan', async () => {
    const models = buildModels({
      Organization: { findById: jest.fn().mockResolvedValue({ id: 'p1', plan: 'business' }) },
      HierarchyLink: { findParentOf: jest.fn().mockResolvedValue(null), countChildren: jest.fn().mockResolvedValue(5) },
    });
    const engine = createCommissionEngine(models);
    await expect(engine.linkSubordinate({ parentOrgId: 'p1', childOrgId: 'c1' })).rejects.toMatchObject({ code: 'MAX_SUBORGS' });
  });

  test('crea el vínculo con la tasa de comisión capturada del plan del padre', async () => {
    const models = buildModels({ Organization: { findById: jest.fn().mockResolvedValue({ id: 'p1', plan: 'enterprise_vip' }) } });
    const engine = createCommissionEngine(models);
    const link = await engine.linkSubordinate({ parentOrgId: 'p1', childOrgId: 'c1', relationshipType: 'naviera' });
    expect(link.commission_rate_bps).toBe(2000);
    expect(models.HierarchyLink.create).toHaveBeenCalledWith(expect.objectContaining({ parentOrgId: 'p1', childOrgId: 'c1', commissionRateBps: 2000 }));
  });
});

describe('recordValidation — cascada de comisión + platform fee', () => {
  test('padre directo (business, 10%) y abuelo (enterprise, 20% capturado → 10% al decaer) cobran sobre el mismo evento', async () => {
    const parentOf = { c1: { parent_org_id: 'b1', commission_rate_bps: 1000 }, b1: { parent_org_id: 'a1', commission_rate_bps: 2000 } };
    const orgs = { b1: { id: 'b1', plan: 'business' }, a1: { id: 'a1', plan: 'enterprise_vip' } };

    const models = buildModels({
      HierarchyLink: { findParentOf: jest.fn().mockImplementation(async (id) => parentOf[id] || null) },
      Organization: { findById: jest.fn().mockImplementation(async (id) => orgs[id] || null) },
    });
    const engine = createCommissionEngine(models);

    const { ledgerEntries, platformFee, totalBurdenBps, duplicate } = await engine.recordValidation({
      subjectOrgId: 'c1', txType: 'payment', txRef: 'tx-1', txAmount: 1000, txCurrency: 'EUR',
    });

    expect(duplicate).toBe(false);
    expect(ledgerEntries).toHaveLength(2);
    const byBeneficiary = Object.fromEntries(ledgerEntries.map((e) => [e.beneficiaryOrgId, e]));
    expect(byBeneficiary['b1']).toMatchObject({ level: 1, rateBpsApplied: 1000, amount: 100 });
    expect(byBeneficiary['a1']).toMatchObject({ level: 2, rateBpsApplied: 500, amount: 50 });
    // Cascada 1500 bps + plataforma 250 bps = 1750 bps total (bajo el techo, sin recorte)
    expect(totalBurdenBps).toBe(PLATFORM_FEE_BPS + 1500);
  });

  test('BeZhas SIEMPRE cobra platform fee aunque no haya cascada', async () => {
    const models = buildModels();
    const engine = createCommissionEngine(models);
    const { platformFee, totalBurdenBps } = await engine.recordValidation({
      subjectOrgId: 'c1', txRef: 'tx-solo', txAmount: 2000, txCurrency: 'BEZ',
    });
    expect(platformFee).toMatchObject({ rateBps: PLATFORM_FEE_BPS, currency: 'BEZ' });
    expect(platformFee.amount).toBe(2000 * PLATFORM_FEE_BPS / 10000);
    expect(totalBurdenBps).toBe(PLATFORM_FEE_BPS);
  });

  test('cascada Enterprise VIP 3 niveles se recorta para no exceder MAX_TOTAL_BURDEN_BPS', async () => {
    // Cadena pura Enterprise: C → B → A → Z (3 ancestros, todos enterprise_vip, baseRate 2000)
    // Raw: 2000 + 1000 + 500 = 3500 bps → excede MAX_CASCADE_BPS (2250), se pro-ratea
    const parentOf = {
      c1: { parent_org_id: 'b1', commission_rate_bps: 2000 },
      b1: { parent_org_id: 'a1', commission_rate_bps: 2000 },
      a1: { parent_org_id: 'z1', commission_rate_bps: 2000 },
    };
    const orgs = {
      b1: { id: 'b1', plan: 'enterprise_vip' },
      a1: { id: 'a1', plan: 'enterprise_vip' },
      z1: { id: 'z1', plan: 'enterprise_vip' },
    };
    const models = buildModels({
      HierarchyLink: { findParentOf: jest.fn().mockImplementation(async (id) => parentOf[id] || null) },
      Organization: { findById: jest.fn().mockImplementation(async (id) => orgs[id] || null) },
    });
    const engine = createCommissionEngine(models);

    const { ledgerEntries, platformFee, totalBurdenBps } = await engine.recordValidation({
      subjectOrgId: 'c1', txRef: 'tx-cap', txAmount: 10000, txCurrency: 'EUR',
    });

    expect(ledgerEntries).toHaveLength(3);
    const cascadeBps = ledgerEntries.reduce((s, e) => s + e.rateBpsApplied, 0);
    const maxCascade = MAX_TOTAL_BURDEN_BPS - PLATFORM_FEE_BPS;
    expect(cascadeBps).toBeLessThanOrEqual(maxCascade);
    expect(totalBurdenBps).toBeLessThanOrEqual(MAX_TOTAL_BURDEN_BPS);
    expect(platformFee.rateBps).toBe(PLATFORM_FEE_BPS);
    // Nivel 1 cobra más que nivel 2, que cobra más que nivel 3 (pro-rateo proporcional)
    expect(ledgerEntries[0].rateBpsApplied).toBeGreaterThan(ledgerEntries[1].rateBpsApplied);
    expect(ledgerEntries[1].rateBpsApplied).toBeGreaterThan(ledgerEntries[2].rateBpsApplied);
  });

  test('evento duplicado (mismo txRef) no genera comisión de nuevo', async () => {
    const models = buildModels({
      ValidationEvent: { create: jest.fn().mockResolvedValue({ event: { id: 'evt-1' }, duplicate: true }) },
    });
    const engine = createCommissionEngine(models);
    const { ledgerEntries, platformFee, duplicate } = await engine.recordValidation({ subjectOrgId: 'c1', txRef: 'tx-1', txAmount: 500, txCurrency: 'EUR' });
    expect(duplicate).toBe(true);
    expect(ledgerEntries).toHaveLength(0);
    expect(platformFee).toBeNull();
    expect(models.CommissionLedger.create).not.toHaveBeenCalled();
  });

  test('ancestro cuyo plan no incluye jerarquía no cobra comisión (se salta, no rompe la cadena)', async () => {
    const parentOf = { c1: { parent_org_id: 'b1', commission_rate_bps: 1000 } };
    const orgs = { b1: { id: 'b1', plan: 'starter' } };
    const models = buildModels({
      HierarchyLink: { findParentOf: jest.fn().mockImplementation(async (id) => parentOf[id] || null) },
      Organization: { findById: jest.fn().mockImplementation(async (id) => orgs[id] || null) },
    });
    const engine = createCommissionEngine(models);
    const { ledgerEntries, platformFee } = await engine.recordValidation({ subjectOrgId: 'c1', txRef: 'tx-2', txAmount: 1000, txCurrency: 'EUR' });
    expect(ledgerEntries).toHaveLength(0);
    expect(platformFee.rateBps).toBe(PLATFORM_FEE_BPS);
  });

  test('política de límite de gasto de un ancestro bloquea la validación', async () => {
    const models = buildModels({
      OrgPolicy: { listApplicableTo: jest.fn().mockResolvedValue([{ policy_type: 'spend_limit', config: { maxAmount: 100, currency: 'EUR' } }]) },
    });
    const engine = createCommissionEngine(models);
    await expect(engine.recordValidation({ subjectOrgId: 'c1', txRef: 'tx-3', txAmount: 500, txCurrency: 'EUR' }))
      .rejects.toMatchObject({ code: 'POLICY_SPEND_LIMIT' });
  });

  test('PLATFORM_FEE_BPS y MAX_TOTAL_BURDEN_BPS son inyectables para tests', async () => {
    const models = buildModels();
    const engine = createCommissionEngine({ ...models, PLATFORM_FEE_BPS: 500, MAX_TOTAL_BURDEN_BPS: 1000 });
    expect(engine.PLATFORM_FEE_BPS).toBe(500);
    expect(engine.MAX_CASCADE_BPS).toBe(500); // 1000 - 500
    expect(engine.MAX_TOTAL_BURDEN_BPS).toBe(1000);
  });
});

describe('requestTransfer — tesorería interna', () => {
  test('rechaza si las organizaciones no están vinculadas', async () => {
    const engine = createCommissionEngine(buildModels());
    await expect(engine.requestTransfer({ fromOrgId: 'x', toOrgId: 'y', direction: 'advance', currency: 'EUR', amount: 100 }))
      .rejects.toMatchObject({ code: 'NOT_LINKED' });
  });

  test('crea la transferencia cuando hay vínculo y el plan del padre la incluye', async () => {
    const models = buildModels({
      HierarchyLink: { findLink: jest.fn().mockResolvedValue({ parent_org_id: 'p1', child_org_id: 'c1' }) },
      Organization: { findById: jest.fn().mockResolvedValue({ id: 'p1', plan: 'business' }) },
    });
    const engine = createCommissionEngine(models);
    await engine.requestTransfer({ fromOrgId: 'p1', toOrgId: 'c1', direction: 'advance', currency: 'BEZ', amount: 250, requestedBy: 'u1' });
    expect(models.TreasuryTransfer.create).toHaveBeenCalledWith(expect.objectContaining({ fromOrgId: 'p1', toOrgId: 'c1', amount: 250 }));
  });
});
