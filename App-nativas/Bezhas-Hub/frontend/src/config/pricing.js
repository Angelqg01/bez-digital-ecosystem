// pricing.js — modelo de precios del ecosistema BeZhas (single source of truth).
//
// Modelo estilo ERP (SAP/Odoo): un plan base + módulos (Apps Nativas) que el cliente
// ACTIVA pagando un extra en su suscripción. El precio total = base + add-ons
// activos, con descuento por bundle (más módulos → menor precio unitario) y
// opción anual (2 meses gratis).
//
// Usado por NativeAppActivation.jsx (calculador, en /be-vip y /landing-commercial). Cambiar precios
// aquí los propaga a toda la landing.

// Planes base — DERIVADOS de la fuente única config/plans.js (los 4 niveles
// definitivos del PDF). No se duplican precios: aquí sólo se añade el dato
// propio del calculador de módulos (`includedAddons` = Apps Nativas incluidas sin
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
 * PRECIO DE OPERANT — por qué es el único módulo con precio por plan.
 *
 * El resto de módulos tienen coste marginal ~cero: activarlos abre un endpoint.
 * OPERANT no: su precio incluye una cuota de tareas (300 / 2.000 / 9.000 según
 * el plan) y cada tarea consume tokens de Claude y cómputo real. Un precio
 * plano obligaba a elegir entre ahogar a Creator Pro o regalar Enterprise.
 *
 * Cada precio se fijó dentro de una ventana con dos bordes duros, calculados
 * sobre `api/config/operant-services.js`:
 *
 *   suelo = coste de servir la cuota entera (consumo 100%)
 *   techo = lo que costaría comprar esa misma cuota suelta, a pago por uso
 *
 *   plan            suelo      techo     precio   ahorro   margen 45% / 85% / 100%
 *   Creator Pro     36,14 €    45,11 €     39 €    −13,5%    58,3% / 21,2% /  7,3%
 *   Business       237,24 €   296,08 €    249 €    −15,9%    57,1% / 19,0% /  4,7%
 *   Enterprise    1.186,38 € 1.353,30 €  1.199 €    −11,4%    55,5% / 15,9% /  1,1%
 *
 * Por debajo del suelo la plataforma pierde con el cliente que más usa el
 * producto; por encima del techo al cliente le sale más barato no activarlo y
 * pagar por uso, con lo que el módulo no se vende. Los tres precios dejan
 * margen positivo INCLUSO si el cliente agota la cuota al 100%, que es el caso
 * que hunde a los productos de IA con precio plano.
 *
 * Si cambian las cuotas o los precios de Anthropic, recalcular: el suelo y el
 * techo se derivan de `worstCaseMonthlyCost()` y de `estimateTaskCost()`.
 */
export const OPERANT_PRICE = { starter: 0, creator_pro: 39, business: 249, enterprise_vip: 1199 };

/**
 * Apps Nativas activables como módulos.
 *
 * `price`       — EUR/mes. Número, o mapa `{ planId: EUR }` cuando lo que el
 *                 módulo entrega depende del plan (hoy solo OPERANT).
 * `core: true`  — incluida siempre; no cuenta como add-on de pago.
 * `alwaysBilled`— nunca se comp con los slots gratis del plan ni entra en el
 *                 descuento por bundle. Es para módulos con coste marginal
 *                 real: regalar OPERANT en un plan con 3 slots libres es
 *                 regalar hasta 1.186 €/mes de cómputo.
 */
export const NATIVE_APP_ADDONS = [
  { id: 'hub',        name: 'BeZhas Hub',        price: 0,   core: true,  desc: 'Panel central, identidad y cuenta. Incluido siempre.' },
  { id: 'wallet',     name: 'BeZhas Wallet',     price: 0,   core: true,  desc: 'Custodia y envío de BEZ. Incluido siempre.' },
  { id: 'pay',        name: 'BeZhas Pay',        price: 49,  desc: 'Pagos y cobros fiat/cripto, on-ramp, liquidación.' },
  { id: 'cargolink',  name: 'BZ CargoLink',      price: 89,  desc: 'Logística: B-UID, POS bridge, IoT, aduanas.' },
  { id: 'capital',    name: 'BZ Capital (DeFi)', price: 79,  desc: 'Tesorería: staking, farming, liquidez.' },
  { id: 'energy',     name: 'BeZhas Energy',     price: 129, desc: 'VPP, mercado OMIE, gestión de activos energéticos.' },
  { id: 'purescan',   name: 'BZ PureScan',       price: 59,  desc: 'Auditoría, compliance y verificación de socios.' },
  { id: 'prestige',   name: 'BZ Prestige',       price: 39,  desc: 'Club B2B, networking y directorio verificado.' },
  { id: 'vision',     name: 'BeZhas Vision',     price: 99,  desc: 'Trazabilidad por visión artificial + IA.' },
  // La descripción de Genesis decía "Gestión empresarial integral, ERP-bridge",
  // que no es lo que hace la app: `App-nativas/BZ Genesis/` es el Bio-Agent —
  // ensayos clínicos, cadena de frío IoT y negociación de bio-activos. Esa línea
  // errónea hacía que Genesis pareciera solaparse con OPERANT cuando no tienen
  // nada que ver. Corregida contra la app y el resto de fuentes del repo.
  { id: 'genesis',    name: 'BZ Genesis',        price: 149, desc: 'Bio-Agent: ensayos clínicos, cadena de frío IoT y bio-activos.' },
  // OPERANT es el único módulo con coste marginal grande: su precio incluye la
  // cuota de tareas del plan, y servirla cuesta dinero de verdad. Por eso el
  // precio va POR PLAN (la cuota va por plan) y lleva `alwaysBilled`. Ver la
  // nota de PRECIO DE OPERANT más abajo.
  { id: 'operant',    name: 'OPERANT',           price: OPERANT_PRICE, alwaysBilled: true,
    desc: '10 departamentos de agentes IA con auditoría anclada en L2.' },
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
 * @param {string[]} cfg.activeAddons    ids de NATIVE_APP_ADDONS activados (de pago)
 * @param {boolean} [cfg.annual=false]   facturación anual
 * @returns {{
 *   basePrice:number, addonsList:Array, includedCount:number, paidAddons:Array,
 *   addonsSubtotal:number, discountRate:number, discountLabel:string,
 *   discountAmount:number, monthly:number, annual:number, annualSavings:number,
 *   custom:boolean
 * }}
 */
/**
 * Precio de un módulo para un plan concreto. La mayoría cuesta lo mismo en
 * todos; los que entregan capacidad distinta según el plan declaran un mapa.
 */
export function addonPrice(addon, planId) {
  if (typeof addon.price === 'number') return addon.price;
  return addon.price[planId] ?? 0;
}

export function calculatePricing({ planId, activeAddons = [], annual = false }) {
  const plan = BASE_PLANS.find((p) => p.id === planId) || BASE_PLANS[0];
  const custom = plan.price === null;

  // Add-ons de pago seleccionados (los core no cuentan), ya con su precio
  // resuelto para ESTE plan.
  const paidAddons = NATIVE_APP_ADDONS
    .filter((a) => !a.core && activeAddons.includes(a.id))
    .map((a) => ({ ...a, price: addonPrice(a, plan.id) }));

  // `alwaysBilled` se aparta antes de repartir slots gratis y antes del
  // descuento por bundle: son módulos con coste marginal real, y comparlos
  // significa servir cómputo a pérdida. Sí cuentan para el TRAMO de descuento
  // (el cliente los ha activado), solo que el descuento no cae sobre ellos.
  const comisionables = paidAddons.filter((a) => !a.alwaysBilled);
  const fijos = paidAddons.filter((a) => a.alwaysBilled);

  // El plan incluye N add-ons sin coste: se descuentan los más caros primero.
  const sortedByPrice = [...comisionables].sort((a, b) => b.price - a.price);
  const includedCount = Math.min(plan.includedAddons, sortedByPrice.length);
  const freeIds = new Set(sortedByPrice.slice(0, includedCount).map((a) => a.id));
  const billable = [...comisionables.filter((a) => !freeIds.has(a.id)), ...fijos];

  const descontable = billable
    .filter((a) => !a.alwaysBilled)
    .reduce((sum, a) => sum + a.price, 0);
  const fijoSubtotal = fijos.reduce((sum, a) => sum + a.price, 0);
  const addonsSubtotal = descontable + fijoSubtotal;

  // Descuento por bundle sobre el nº TOTAL de módulos de pago activados.
  const tier = BUNDLE_DISCOUNTS.find((d) => paidAddons.length >= d.min);
  const discountRate = tier.rate;
  const discountAmount = Math.round(descontable * discountRate);

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
    alwaysBilledAddons: fijos,
    discountableSubtotal: descontable,
    discountRate,
    discountLabel: tier.label,
    discountAmount,
    monthly,
    annual: annual ? annualTotal : monthly * 12,
    annualSavings,
    custom,
  };
}
