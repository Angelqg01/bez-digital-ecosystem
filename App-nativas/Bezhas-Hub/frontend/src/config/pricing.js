// pricing.js — modelo de precios del ecosistema BeZhas (single source of truth).
//
// Modelo estilo ERP (SAP/Odoo): un plan base + módulos (SubApps) que el cliente
// ACTIVA pagando un extra en su suscripción. El precio total = base + add-ons
// activos, con descuento por bundle (más módulos → menor precio unitario) y
// opción anual (2 meses gratis).
//
// Usado por PricingPlans.jsx + SubAppActivation.jsx (calculador). Cambiar precios
// aquí los propaga a toda la landing.

// Planes base — DERIVADOS de la fuente única config/plans.js (los 4 niveles
// definitivos del PDF). No se duplican precios: aquí sólo se añade el dato
// propio del calculador de módulos (`includedAddons` = SubApps incluidas sin
// coste). Cambiar un precio en plans.js se propaga aquí automáticamente.
import { PLANS as DEFINITIVE_PLANS } from './plans';

const INCLUDED_ADDONS = { starter: 1, creator_pro: 1, business: 3, enterprise_vip: Infinity };

/** @type {Array<{id,name,price,tagline,includes,includedAddons,recommended}>} */
export const BASE_PLANS = DEFINITIVE_PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  price: p.priceEUR,                 // €/mes (sin IVA), fuente única
  apiCalls: p.aiActions == null ? 'Ilimitado' : `${p.aiActions.toLocaleString()} acciones IA / mes`,
  partners: p.id === 'enterprise_vip' ? '50 sub-empresas' : 'Ilimitados',
  tagline: p.valueLine,
  includes: p.features.slice(0, 5),
  includedAddons: INCLUDED_ADDONS[p.id] ?? 1,
  recommended: !!p.recommended,
}));

/**
 * SubApps activables como módulos. `price` = EUR/mes por módulo.
 * `core: true` = incluida siempre (no cuenta como add-on de pago).
 */
export const SUBAPP_ADDONS = [
  { id: 'hub',        name: 'BeZhas Hub',        price: 0,   core: true,  desc: 'Panel central, identidad y cuenta. Incluido siempre.' },
  { id: 'wallet',     name: 'BeZhas Wallet',     price: 0,   core: true,  desc: 'Custodia y envío de BEZ. Incluido siempre.' },
  { id: 'pay',        name: 'BeZhas Pay',        price: 49,  desc: 'Pagos y cobros fiat/cripto, on-ramp, liquidación.' },
  { id: 'cargolink',  name: 'BZ CargoLink',      price: 89,  desc: 'Logística: B-UID, POS bridge, IoT, aduanas.' },
  { id: 'capital',    name: 'BZ Capital (DeFi)', price: 79,  desc: 'Tesorería: staking, farming, liquidez.' },
  { id: 'energy',     name: 'BeZhas Energy',     price: 129, desc: 'VPP, mercado OMIE, gestión de activos energéticos.' },
  { id: 'purescan',   name: 'BZ PureScan',       price: 59,  desc: 'Auditoría, compliance y verificación de socios.' },
  { id: 'prestige',   name: 'BZ Prestige',       price: 39,  desc: 'Club B2B, networking y directorio verificado.' },
  { id: 'vision',     name: 'BeZhas Vision',     price: 99,  desc: 'Trazabilidad por visión artificial + IA.' },
  { id: 'genesis',    name: 'BZ Genesis',        price: 149, desc: 'Gestión empresarial integral, ERP-bridge.' },
  { id: 'gas',        name: 'Gas Tank',          price: 29,  desc: 'Gestión de gas/fees on-chain para tu operación.' },
  { id: 'sphere',     name: 'BZ Sphere',         price: 49,  desc: 'Espacio colaborativo y datos compartidos.' },
];

/** Descuento por bundle según nº de add-ons de pago activos. */
export const BUNDLE_DISCOUNTS = [
  { min: 5, rate: 0.25, label: '5+ módulos · −25%' },
  { min: 3, rate: 0.15, label: '3+ módulos · −15%' },
  { min: 0, rate: 0,    label: '' },
];

/** Facturación anual: 2 meses gratis (≈ −16,7%). */
export const ANNUAL_FREE_MONTHS = 2;

/**
 * Calcula el coste de una configuración.
 * @param {object} cfg
 * @param {string} cfg.planId            id de BASE_PLANS
 * @param {string[]} cfg.activeAddons    ids de SUBAPP_ADDONS activados (de pago)
 * @param {boolean} [cfg.annual=false]   facturación anual
 * @returns {{
 *   basePrice:number, addonsList:Array, includedCount:number, paidAddons:Array,
 *   addonsSubtotal:number, discountRate:number, discountLabel:string,
 *   discountAmount:number, monthly:number, annual:number, annualSavings:number,
 *   custom:boolean
 * }}
 */
export function calculatePricing({ planId, activeAddons = [], annual = false }) {
  const plan = BASE_PLANS.find((p) => p.id === planId) || BASE_PLANS[0];
  const custom = plan.price === null;

  // Add-ons de pago seleccionados (los core no cuentan).
  const paidAddons = SUBAPP_ADDONS.filter(
    (a) => !a.core && activeAddons.includes(a.id),
  );

  // El plan incluye N add-ons sin coste: se descuentan los más caros primero.
  const sortedByPrice = [...paidAddons].sort((a, b) => b.price - a.price);
  const includedCount = Math.min(plan.includedAddons, sortedByPrice.length);
  const freeIds = new Set(sortedByPrice.slice(0, includedCount).map((a) => a.id));
  const billable = paidAddons.filter((a) => !freeIds.has(a.id));

  const addonsSubtotal = billable.reduce((sum, a) => sum + a.price, 0);

  // Descuento por bundle sobre el nº TOTAL de módulos de pago activados.
  const tier = BUNDLE_DISCOUNTS.find((d) => paidAddons.length >= d.min);
  const discountRate = tier.rate;
  const discountAmount = Math.round(addonsSubtotal * discountRate);

  const basePrice = custom ? 0 : plan.price;
  const monthly = custom ? 0 : basePrice + addonsSubtotal - discountAmount;
  const annualTotal = monthly * (12 - ANNUAL_FREE_MONTHS);
  const annualSavings = monthly * ANNUAL_FREE_MONTHS;

  return {
    basePrice,
    includedCount,
    paidAddons,
    billableAddons: billable,
    addonsSubtotal,
    discountRate,
    discountLabel: tier.label,
    discountAmount,
    monthly,
    annual: annual ? annualTotal : monthly * 12,
    annualSavings,
    custom,
  };
}
