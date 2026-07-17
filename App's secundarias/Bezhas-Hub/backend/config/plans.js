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

module.exports = {
  PLANS,
  IVA_RATE,
  BEZ_DISCOUNT_RATE,
  ANNUAL_FREE_MONTHS,
  STAKING_APY_MAX,
  HOLDING_COMMISSION,
  SEED_CREDIT_USD,
  ADMIN_SAVINGS_PCT,
  calculateSubscription,
  getPlan,
};
