// plans.js — FUENTE ÚNICA Y DEFINITIVA de planes de suscripción (backend).
//
// Espejo de frontend/src/config/plans.js. Basado en los PDFs definitivos
// ("BeZ-Planes suscripción definitivos" + "Middleware de Confianza Híbrido").
// 4 niveles. Precios EUR/mes (sin IVA). −20% pagando con $BEZ. IVA 21%.

const IVA_RATE = 0.21;
const BEZ_DISCOUNT_RATE = 0.20;       // −20% pagando con $BEZ nativo
const ANNUAL_FREE_MONTHS = 2;         // facturación anual: 2 meses gratis
const STAKING_APY_MAX = 31.25;        // % APY máx. staking corporativo $BEZ
const HOLDING_COMMISSION = 20;        // % comisiones de sub-empresas (Enterprise)
const PLATFORM_FEE_BPS = 250;         // 2.5% — comisión plataforma BeZhas (no negociable)
const MAX_TOTAL_BURDEN_BPS = 2500;    // 25% máx. total (plataforma + cascada combinada)
const SEED_CREDIT_USD = 0.0075;       // precio crédito fase semilla
const ADMIN_SAVINGS_PCT = 85;         // % ahorro conciliación/auditoría

const PLANS = [
  {
    id: 'starter', name: 'Starter', profile: 'Autónomos / Startups',
    priceEUR: 0, priceIVA: 0, yearlyEUR: 0, bezPerMonth: 0,
    aiActions: 150, gasSubsidy: 0, apy: 12.5, roiPercent: null,
    recommended: false, badge: null, valueLine: 'Reducción de barrera de entrada Web3',
    // Pago por uso: 15 días gratis, después consumo real API-SDK +25% margen.
    billingModel: 'payg', trialDays: 15,
    // Tokenización de activos: disponible como extra medido (sin cuota incluida).
    tokenizationEnabled: true, tokenizationIncluded: 0,
    tokenizationOverageEUR: 2.50, tokenizationAuto: false,
    stripe: {
      productId: 'prod_UtiGhSbf1HDIIi',
      meteredPriceId: 'price_1TtuplFomr6oeXVgt8XVUQDW',
      meterEventName: 'bezhas_api_credits',
    },
  },
  {
    id: 'creator_pro', name: 'Creator Pro', profile: 'Pymes / Creadores',
    priceEUR: 99, priceIVA: 119.79, yearlyEUR: 990, bezPerMonth: 200,
    aiActions: 1500, gasSubsidy: 25, apy: 18.75, roiPercent: 343,
    recommended: true, badge: 'POPULAR', valueLine: '+343% ahorro en gestión manual',
    tokenizationEnabled: true, tokenizationIncluded: 25,
    tokenizationOverageEUR: 1.90, tokenizationAuto: false,
    stripe: {
      productId: 'prod_UOS89liy2MjObG',
      monthlyPriceId: 'price_1TPfDyFomr6oeXVgBxoyUJwn',
      annualPriceId: 'price_1TtuE7Fomr6oeXVgHjQ5AkXT',
      monthlyLink: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
      annualLink: 'https://buy.stripe.com/6oU9ATa2A6Gi0F83Mfew80a',
    },
  },
  {
    id: 'business', name: 'Business', profile: 'Empresas en Crecimiento',
    priceEUR: 499, priceIVA: 603.79, yearlyEUR: 4990, bezPerMonth: 1000,
    aiActions: 15000, gasSubsidy: 50, apy: 25, roiPercent: 654,
    recommended: false, badge: null, valueLine: '+654% eficiencia operativa',
    // Jerarquía de organizaciones (padre → subordinados): habilitada desde Business,
    // con alcance limitado. Enterprise VIP la desbloquea a escala de holding.
    hierarchyEnabled: true, subCompanies: 5, partnerCommission: 10,
    commissionCascadeDepth: 1, treasuryTransfers: true, policyEngine: true,
    dataAggregation: true, whiteLabelResale: false,
    // Tokenización automática por reglas: se activa desde Business.
    tokenizationEnabled: true, tokenizationIncluded: 250,
    tokenizationOverageEUR: 1.20, tokenizationAuto: true,
    stripe: {
      productId: 'prod_UOSDVEzpPuxHux',
      monthlyPriceId: 'price_1TPfJUFomr6oeXVgMfB321Hf',
      annualPriceId: 'price_1TtuE9Fomr6oeXVguKlDbScU',
      monthlyLink: 'https://buy.stripe.com/aFa3cvb6E0hUafI82vew808',
      annualLink: 'https://buy.stripe.com/8x228r8YwfcO87A4Qjew80b',
    },
  },
  {
    id: 'enterprise_vip', name: 'Enterprise VIP', profile: 'Holdings / Instituciones',
    priceEUR: 2499, priceIVA: 3023.79, yearlyEUR: 24990, bezPerMonth: 5000,
    aiActions: null, gasSubsidy: 100, apy: 31.25, roiPercent: 909,
    recommended: false, badge: 'WHITE LABEL', valueLine: '+909% optimización global',
    partnerCommission: HOLDING_COMMISSION, subCompanies: 50,
    hierarchyEnabled: true, commissionCascadeDepth: 3, treasuryTransfers: true,
    policyEngine: true, dataAggregation: true, whiteLabelResale: true,
    tokenizationEnabled: true, tokenizationIncluded: null, // ilimitado
    tokenizationOverageEUR: 0, tokenizationAuto: true,
    stripe: {
      productId: 'prod_UOSJJi93dIuZ7q',
      monthlyPriceId: 'price_1TPfPMFomr6oeXVgjrKzeAmm',
      annualPriceId: 'price_1TtuECFomr6oeXVgMGz8gK9v',
      monthlyLink: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
      annualLink: 'https://buy.stripe.com/fZufZhgqY8Oq73w2Ibew80c',
    },
  },
];

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Cálculo definitivo del coste de una suscripción.
 * @param {{planId:string, payWithBez?:boolean, annual?:boolean}} cfg
 */
function calculateSubscription({ planId, payWithBez = false, annual = false }) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) {
    const err = new Error(`Unknown planId: ${planId}`);
    err.code = 'UNKNOWN_PLAN';
    throw err;
  }
  const base = annual ? plan.yearlyEUR : plan.priceEUR;
  const bezDiscount = payWithBez ? round2(base * BEZ_DISCOUNT_RATE) : 0;
  const subtotal = round2(base - bezDiscount);
  const iva = round2(subtotal * IVA_RATE);
  return {
    planId: plan.id, name: plan.name, annual, payWithBez,
    base, bezDiscount, bezDiscountRate: payWithBez ? BEZ_DISCOUNT_RATE : 0,
    subtotal, iva, total: round2(subtotal + iva), currency: 'EUR',
    bezPerMonth: plan.bezPerMonth,
  };
}

function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

/**
 * Config de jerarquía derivada del plan (o null si el plan no la habilita).
 * Fuente única que consume commissionEngine — cambiar aquí basta para que
 * toda la plataforma (rutas, motor de comisiones, frontend) refleje el tier.
 */
function getHierarchyConfig(planId) {
  const plan = getPlan(planId);
  if (!plan || !plan.hierarchyEnabled) return null;
  return {
    maxSubOrgs: plan.subCompanies ?? 0,
    commissionRateBps: Math.round((plan.partnerCommission || 0) * 100),
    cascadeDepth: plan.commissionCascadeDepth || 1,
    treasuryTransfers: !!plan.treasuryTransfers,
    policyEngine: !!plan.policyEngine,
    dataAggregation: !!plan.dataAggregation,
    whiteLabelResale: !!plan.whiteLabelResale,
  };
}

/**
 * Derechos de tokenización de activos según el plan.
 * `included` = activos tokenizados incluidos al mes (null = ilimitado).
 * `overageEUR` = precio por activo adicional (pago por uso, el «extra»).
 * `auto` = si el motor de reglas puede tokenizar sin intervención humana.
 */
function getTokenizationConfig(planId) {
  const plan = getPlan(planId);
  if (!plan || !plan.tokenizationEnabled) return null;
  return {
    enabled: true,
    included: plan.tokenizationIncluded ?? 0,
    overageEUR: plan.tokenizationOverageEUR ?? 0,
    auto: !!plan.tokenizationAuto,
    unlimited: plan.tokenizationIncluded === null,
  };
}

module.exports = {
  PLANS,
  IVA_RATE,
  BEZ_DISCOUNT_RATE,
  ANNUAL_FREE_MONTHS,
  STAKING_APY_MAX,
  HOLDING_COMMISSION,
  PLATFORM_FEE_BPS,
  MAX_TOTAL_BURDEN_BPS,
  SEED_CREDIT_USD,
  ADMIN_SAVINGS_PCT,
  calculateSubscription,
  getPlan,
  getHierarchyConfig,
  getTokenizationConfig,
};
