/**
 * plans.js — Fuente única de planes de suscripción del gateway.
 *
 * Espejo EXACTO de Bezhas-Hub/backend/config/plans.js (la fuente canónica,
 * basada en los PDFs definitivos "BeZ-Planes suscripción definitivos").
 * Si cambian los precios, cambiar AMBOS archivos — o mejor: extraer a un
 * paquete compartido cuando exista el Payments Core unificado.
 *
 * 4 niveles. Precios EUR/mes (sin IVA). −20% pagando con $BEZ. IVA 21%.
 */

const IVA_RATE = 0.21;
const BEZ_DISCOUNT_RATE = 0.20;       // −20% pagando con $BEZ nativo
const ANNUAL_FREE_MONTHS = 2;         // facturación anual: 2 meses gratis

const PLANS = [
    {
        id: 'starter', name: 'Starter', profile: 'Autónomos / Startups',
        priceEUR: 0, priceIVA: 0, yearlyEUR: 0, bezPerMonth: 0,
        aiActions: 150, gasSubsidy: 0, apy: 12.5,
        // Pago por uso: 15 días gratis y después consumo real de llamadas
        // API-SDK (coste Claude + cómputo BeZhas) +25%. Ver usage-pricing.js.
        billingModel: 'payg', trialDays: 15,
        stripe: {
            productId: 'prod_VKsL9hS91fpZbz',
            meteredPriceId: 'price_1UKCb5B0WAywWIe1TacUWmsQ',
            meterId: 'mtr_61VTaYMrfSkMuaoJH41B0WAywWIe13xY',
            meterEventName: 'bezhas_api_credits',
        },
    },
    {
        id: 'creator_pro', name: 'Creator Pro', profile: 'Pymes / Creadores',
        priceEUR: 99, priceIVA: 119.79, yearlyEUR: 990, bezPerMonth: 200,
        aiActions: 1500, gasSubsidy: 25, apy: 18.75,
        stripe: {
            productId: 'prod_VKsLNgEN40KOPw',
            monthlyPriceId: 'price_1UKCb1B0WAywWIe16OzcNOlB',
            annualPriceId: 'price_1UKCb1B0WAywWIe1f2OgfR6U',
        },
    },
    {
        id: 'business', name: 'Business', profile: 'Empresas en Crecimiento',
        priceEUR: 499, priceIVA: 603.79, yearlyEUR: 4990, bezPerMonth: 1000,
        aiActions: 15000, gasSubsidy: 50, apy: 25,
        stripe: {
            productId: 'prod_VKsLDGwu6UStUp',
            monthlyPriceId: 'price_1UKCb2B0WAywWIe13zUvmLVW',
            annualPriceId: 'price_1UKCb3B0WAywWIe1ui9JDcpS',
        },
    },
    {
        id: 'enterprise_vip', name: 'Enterprise VIP', profile: 'Holdings / Instituciones',
        priceEUR: 2499, priceIVA: 3023.79, yearlyEUR: 24990, bezPerMonth: 5000,
        aiActions: null, gasSubsidy: 100, apy: 31.25,
        stripe: {
            productId: 'prod_VKsLKhIhLm5EUQ',
            monthlyPriceId: 'price_1UKCb3B0WAywWIe1nqFOnq9B',
            annualPriceId: 'price_1UKCb4B0WAywWIe1s3Ww5l5Y',
        },
    },
];

// SubApps incluidas en toda suscripción (nunca gateadas por entitlement).
// Espejo de @bezhas/connect CORE_SUBAPPS.
const CORE_SUBAPPS = ['hub', 'wallet'];

// SubApps activables como add-on de la suscripción (entitlements).
const ACTIVATABLE_SUBAPPS = [
    'pay', 'cargolink', 'energy', 'capital', 'prestige', 'purescan',
    'sphere', 'genesis', 'vision', 'gas', 'edge',
    // OPERANT — gestión empresarial autónoma (agentes IA por departamento).
    // Lo que desbloquea cada plan vive en config/operant-services.js.
    'operant',
];

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Cálculo definitivo del coste de una suscripción (idéntico al del Hub).
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
    CORE_SUBAPPS,
    ACTIVATABLE_SUBAPPS,
    calculateSubscription,
    getPlan,
};
