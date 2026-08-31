// plans.js — FUENTE ÚNICA Y DEFINITIVA de los planes de suscripción BeZhas.
//
// Basado en "BeZ-Planes suscripción definitivos" + "Middleware de Confianza
// Híbrido". Reemplaza cualquier otra tabla de precios (las antiguas de /pay,
// /be-vip y config/pricing tenían valores distintos → ESTO manda).
//
// 4 niveles. Precios en EUR/mes (sin IVA). Pago en FIAT (Stripe) o en $BEZ
// nativo con −20% de descuento. IVA 21%. Año = 10 meses (2 gratis ≈ −17%).
//
// Lo que cada plan desbloquea en OPERANT (departamentos, cuota de tareas,
// autonomía, anclaje) vive en `config/operant-native-app.js` — aquí solo aparecen
// las líneas de `features` que lo resumen para la tarjeta del plan.

export const IVA_RATE = 0.21;               // IVA España
export const BEZ_DISCOUNT_RATE = 0.20;      // −20% pagando con $BEZ nativo
export const ANNUAL_FREE_MONTHS = 2;        // facturación anual: 2 meses gratis
export const STAKING_APY_MAX = 31.25;       // % APY máx. staking corporativo $BEZ
export const HOLDING_COMMISSION = 20;       // % comisiones de sub-empresas (Enterprise)
export const PLATFORM_FEE_BPS = 250;        // 2.5% — comisión plataforma BeZhas (no negociable)
export const MAX_TOTAL_BURDEN_BPS = 2500;   // 25% máx. total (plataforma + cascada combinada)
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
 * @property {string} laborMultiplier factor de multiplicación de eficiencia/automatización mostrado en la tarjeta (ej. '6x')
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
    badge: '15 DÍAS GRATIS',
    laborMultiplier: '4x',
    valueLine: 'Prueba gratis 15 días, luego solo pagas lo que usas',
    // Pago por uso: tras el trial, cada llamada API-SDK se factura a coste
    // real (Claude + cómputo BeZhas) +25%. 1 crédito = 0,001 €.
    billingModel: 'payg',
    trialDays: 15,
    features: [
      '15 días de prueba gratis',
      'Después, pago por uso real de API-SDK (coste +25%)',
      'OPERANT: agentes IA de Ventas y Soporte · pago por uso desde 0,13 €/tarea',
      'Auditoría de agentes encadenada por hash',
      'Acceso Core a la plataforma',
      'DAO básica (participación en votaciones)',
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
    laborMultiplier: '6x',
    valueLine: '+343% ahorro en gestión manual',
    features: [
      'Todo lo de Starter',
      '1.500 acciones IA/mes',
      'OPERANT (+39 €/mes): 4 departamentos de agentes IA · 300 tareas/mes',
      'Autonomía asistida: los agentes envían lo de riesgo bajo',
      'Auditoría de agentes anclada en L2 cada semana',
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
    laborMultiplier: '10x',
    valueLine: '+654% eficiencia operativa',
    hierarchyEnabled: true,
    subCompanies: 5,
    partnerCommission: 10,
    commissionCascadeDepth: 1,
    treasuryTransfers: true,
    policyEngine: true,
    dataAggregation: true,
    whiteLabelResale: false,
    features: [
      'Todo lo de Creator Pro',
      '15.000 acciones IA/mes',
      'OPERANT (+249 €/mes): 8 departamentos de agentes IA · 2.000 tareas/mes',
      'Autonomía plena salvo línea roja (activos, datos personales, legal)',
      'Auditoría anclada a diario + aprobaciones firmadas on-chain',
      'Pago a proveedores en $BEZ y certificados NFT de entregables',
      'Universal Bridge API (SAP · Odoo · Salesforce)',
      'Subsidio 50% de gas',
      'ERC-3643: dividendos automáticos',
      'DeFi Copilot (tesorería en tiempo real)',
      '×2.0 staking → 25% APY',
      'Soporte 24/7 dedicado',
      'Jerarquía de organizaciones: hasta 5 sub-empresas',
      '10% de comisión por validación de transacciones de tus sub-empresas',
      'Tesorería interna + motor de políticas de gasto',
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
    hierarchyEnabled: true,
    commissionCascadeDepth: 3,
    treasuryTransfers: true,
    policyEngine: true,
    dataAggregation: true,
    whiteLabelResale: true,
    laborMultiplier: '15x',
    valueLine: '+909% optimización global',
    features: [
      'Todo lo de Business',
      'Cómputo IA ilimitado',
      'OPERANT (+1.199 €/mes): los 10 departamentos · 9.000 tareas/mes',
      'Políticas de los agentes gobernadas por votación en BeZhasDAO',
      'Auditoría anclada en continuo + Edge Node dedicado para OPERANT',
      'Nodo MCP dedicado (privacidad máxima)',
      'Gas 100% gratis (Paymaster ERC-4337)',
      'Marca Blanca (White-Label SDK)',
      'Gestión de 50 sub-empresas',
      'API Institucional',
      'Gobernanza de Protocolo (voto DAO)',
      '20% de comisiones de tus sub-empresas',
      'Comisión en cascada hasta 3 niveles (sub-empresas de tus sub-empresas)',
      'Reventa white-label de acceso API a tu red',
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

/** Config de jerarquía derivada del plan (o null si el plan no la habilita). */
export function getHierarchyConfig(planId) {
  const plan = getPlan(planId);
  if (!plan || !plan.hierarchyEnabled) return null;
  return {
    maxSubOrgs: plan.subCompanies ?? 0,
    commissionRatePercent: plan.partnerCommission || 0,
    cascadeDepth: plan.commissionCascadeDepth || 1,
    treasuryTransfers: !!plan.treasuryTransfers,
    policyEngine: !!plan.policyEngine,
    dataAggregation: !!plan.dataAggregation,
    whiteLabelResale: !!plan.whiteLabelResale,
  };
}

export default PLANS;
