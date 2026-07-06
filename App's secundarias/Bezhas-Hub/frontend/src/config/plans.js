// plans.js — FUENTE ÚNICA Y DEFINITIVA de los planes de suscripción BeZhas.
//
// Basado en "BeZ-Planes suscripción definitivos" + "Middleware de Confianza
// Híbrido". Reemplaza cualquier otra tabla de precios (las antiguas de /pay,
// /be-vip y config/pricing tenían valores distintos → ESTO manda).
//
// 4 niveles. Precios en EUR/mes (sin IVA). Pago en FIAT (Stripe) o en $BEZ
// nativo con −20% de descuento. IVA 21%. Año = 10 meses (2 gratis ≈ −17%).

export const IVA_RATE = 0.21;               // IVA España
export const BEZ_DISCOUNT_RATE = 0.20;      // −20% pagando con $BEZ nativo
export const ANNUAL_FREE_MONTHS = 2;        // facturación anual: 2 meses gratis
export const STAKING_APY_MAX = 31.25;       // % APY máx. staking corporativo $BEZ
export const HOLDING_COMMISSION = 20;       // % comisiones de sub-empresas (Enterprise)
export const SEED_CREDIT_USD = 0.0075;      // precio crédito fase semilla
export const ADMIN_SAVINGS_PCT = 85;        // % ahorro conciliación/auditoría

/**
 * @typedef {Object} Plan
 * @property {string} id
 * @property {string} name
 * @property {string} profile        perfil objetivo
 * @property {number} priceEUR       €/mes sin IVA
 * @property {number} priceIVA       €/mes con IVA 21%
 * @property {number} yearlyEUR      €/año sin IVA (2 meses gratis)
 * @property {number} bezPerMonth    BEZ/mes de referencia (gas tank)
 * @property {number|null} aiActions acciones IA/mes (null = ilimitado)
 * @property {number} gasSubsidy     % de gas subvencionado
 * @property {number} apy            % APY staking efectivo del tier
 * @property {number|null} roiPercent ROI estimado (%)
 */

/** @type {Plan[]} */
export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    profile: 'Autónomos / Startups',
    icon: '🌱',
    color: '#64748B',
    priceEUR: 0,
    priceIVA: 0,
    yearlyEUR: 0,
    bezPerMonth: 0,
    aiActions: 150,
    gasSubsidy: 0,
    apy: 12.5,
    roiPercent: null,
    recommended: false,
    badge: null,
    valueLine: 'Reducción de barrera de entrada Web3',
    features: [
      'Acceso Core a la plataforma',
      'Dashboard de lectura',
      'DAO básica (participación en votaciones)',
      '150 acciones IA/mes',
      'Staking $BEZ 12,5% APY',
      'Wallet corporativa BeZhas',
    ],
  },
  {
    id: 'creator_pro',
    name: 'Creator Pro',
    profile: 'Pymes / Creadores',
    icon: '⚡',
    color: '#2563EB',
    priceEUR: 99,
    priceIVA: 119.79,
    yearlyEUR: 990,
    bezPerMonth: 200,
    aiActions: 1500,
    gasSubsidy: 25,
    apy: 18.75,
    roiPercent: 343,
    recommended: true,
    badge: 'POPULAR',
    valueLine: '+343% ahorro en gestión manual',
    features: [
      'Todo lo de Starter',
      '1.500 acciones IA/mes',
      'Smart Escrows (custodia automatizada)',
      'Subsidio 25% de gas',
      '×1.5 staking → 18,75% APY',
      'Quality Oracle Express (24h)',
      'Soporte prioritario',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    profile: 'Empresas en Crecimiento',
    icon: '🏢',
    color: '#7C3AED',
    priceEUR: 499,
    priceIVA: 603.79,
    yearlyEUR: 4990,
    bezPerMonth: 1000,
    aiActions: 15000,
    gasSubsidy: 50,
    apy: 25,
    roiPercent: 654,
    recommended: false,
    badge: null,
    valueLine: '+654% eficiencia operativa',
    features: [
      'Todo lo de Creator Pro',
      '15.000 acciones IA/mes',
      'Universal Bridge API (SAP · Odoo · Salesforce)',
      'Subsidio 50% de gas',
      'ERC-3643: dividendos automáticos',
      'DeFi Copilot (tesorería en tiempo real)',
      '×2.0 staking → 25% APY',
      'Soporte 24/7 dedicado',
    ],
  },
  {
    id: 'enterprise_vip',
    name: 'Enterprise VIP',
    profile: 'Holdings / Instituciones',
    icon: '🏛️',
    color: '#F59E0B',
    priceEUR: 2499,
    priceIVA: 3023.79,
    yearlyEUR: 24990,
    bezPerMonth: 5000,
    aiActions: null, // ilimitado
    gasSubsidy: 100,
    apy: 31.25,
    roiPercent: 909,
    recommended: false,
    badge: 'WHITE LABEL',
    partnerCommission: HOLDING_COMMISSION, // 20% comisiones de sub-empresas
    subCompanies: 50,
    valueLine: '+909% optimización global',
    features: [
      'Todo lo de Business',
      'Cómputo IA ilimitado',
      'Nodo MCP dedicado (privacidad máxima)',
      'Gas 100% gratis (Paymaster ERC-4337)',
      'Marca Blanca (White-Label SDK)',
      'Gestión de 50 sub-empresas',
      'API Institucional',
      'Gobernanza de Protocolo (voto DAO)',
      '20% de comisiones de tus sub-empresas',
      '×2.5 staking → 31,25% APY',
    ],
  },
];

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Cálculo definitivo del coste de una suscripción.
 * @param {{planId:string, payWithBez?:boolean, annual?:boolean}} cfg
 */
export function calcSubscription({ planId, payWithBez = false, annual = false }) {
  const plan = PLANS.find((p) => p.id === planId) || PLANS[0];
  const base = annual ? plan.yearlyEUR : plan.priceEUR;
  const bezDiscount = payWithBez ? round2(base * BEZ_DISCOUNT_RATE) : 0;
  const subtotal = round2(base - bezDiscount);
  const iva = round2(subtotal * IVA_RATE);
  return {
    planId: plan.id,
    name: plan.name,
    annual,
    payWithBez,
    base,
    bezDiscount,
    bezDiscountRate: payWithBez ? BEZ_DISCOUNT_RATE : 0,
    subtotal,
    iva,
    total: round2(subtotal + iva),
    currency: 'EUR',
    bezPerMonth: plan.bezPerMonth,
  };
}

export function getPlan(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

export default PLANS;
