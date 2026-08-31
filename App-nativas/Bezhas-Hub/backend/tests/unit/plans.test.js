/**
 * Unit tests de los planes definitivos y la calculadora de suscripción.
 * Verifica las métricas del PDF: precios, −20% en $BEZ, IVA 21%, anual.
 */
const {
  PLANS, calculateSubscription, getPlan, getHierarchyConfig,
  BEZ_DISCOUNT_RATE, IVA_RATE, STAKING_APY_MAX, HOLDING_COMMISSION,
} = require('../../config/plans');

describe('PLANS — catálogo definitivo (4 niveles)', () => {
  test('hay exactamente 4 planes con los ids definitivos', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['starter', 'creator_pro', 'business', 'enterprise_vip']);
  });
  test('precios EUR/mes según el PDF', () => {
    expect(getPlan('starter').priceEUR).toBe(0);
    expect(getPlan('creator_pro').priceEUR).toBe(99);
    expect(getPlan('business').priceEUR).toBe(499);
    expect(getPlan('enterprise_vip').priceEUR).toBe(2499);
  });
  test('gas subsidy por tier (0/25/50/100)', () => {
    expect(PLANS.map((p) => p.gasSubsidy)).toEqual([0, 25, 50, 100]);
  });
  test('acciones IA: enterprise ilimitado (null)', () => {
    expect(getPlan('enterprise_vip').aiActions).toBeNull();
    expect(getPlan('business').aiActions).toBe(15000);
  });
  test('constantes globales del PDF', () => {
    expect(BEZ_DISCOUNT_RATE).toBe(0.20);
    expect(IVA_RATE).toBe(0.21);
    expect(STAKING_APY_MAX).toBe(31.25);
    expect(HOLDING_COMMISSION).toBe(20);
    expect(getPlan('enterprise_vip').partnerCommission).toBe(20);
  });
});

describe('getHierarchyConfig — jerarquía de organizaciones por plan', () => {
  test('starter y creator_pro no la incluyen (null)', () => {
    expect(getHierarchyConfig('starter')).toBeNull();
    expect(getHierarchyConfig('creator_pro')).toBeNull();
  });
  test('business: 5 sub-empresas, 10%, 1 nivel de cascada', () => {
    expect(getHierarchyConfig('business')).toEqual({
      maxSubOrgs: 5, commissionRateBps: 1000, cascadeDepth: 1,
      treasuryTransfers: true, policyEngine: true, dataAggregation: true, whiteLabelResale: false,
    });
  });
  test('enterprise_vip: 50 sub-empresas, 20%, 3 niveles, reventa white-label', () => {
    expect(getHierarchyConfig('enterprise_vip')).toEqual({
      maxSubOrgs: 50, commissionRateBps: 2000, cascadeDepth: 3,
      treasuryTransfers: true, policyEngine: true, dataAggregation: true, whiteLabelResale: true,
    });
  });
});

describe('calculateSubscription — cálculos definitivos', () => {
  test('Business en FIAT: subtotal 499, IVA 104.79, total 603.79', () => {
    const q = calculateSubscription({ planId: 'business' });
    expect(q.base).toBe(499);
    expect(q.bezDiscount).toBe(0);
    expect(q.subtotal).toBe(499);
    expect(q.iva).toBe(104.79);
    expect(q.total).toBe(603.79);
  });

  test('Business pagando en $BEZ aplica −20% (subtotal 399.20)', () => {
    const q = calculateSubscription({ planId: 'business', payWithBez: true });
    expect(q.bezDiscountRate).toBe(0.20);
    expect(q.bezDiscount).toBe(99.8);
    expect(q.subtotal).toBe(399.2);
    expect(q.total).toBe(round2(399.2 * 1.21));
  });

  test('Creator Pro anual: base 990 (2 meses gratis)', () => {
    const q = calculateSubscription({ planId: 'creator_pro', annual: true });
    expect(q.base).toBe(990);
    expect(q.annual).toBe(true);
  });

  test('Enterprise VIP en $BEZ: −20% sobre 2499 → 1999.20', () => {
    const q = calculateSubscription({ planId: 'enterprise_vip', payWithBez: true });
    expect(q.subtotal).toBe(1999.2);
  });

  test('Starter (gratis) → todo a 0', () => {
    const q = calculateSubscription({ planId: 'starter' });
    expect(q.subtotal).toBe(0);
    expect(q.total).toBe(0);
  });

  test('plan desconocido lanza UNKNOWN_PLAN', () => {
    expect(() => calculateSubscription({ planId: 'nope' })).toThrow(/Unknown planId/);
  });
});

function round2(n) { return Math.round(n * 100) / 100; }
