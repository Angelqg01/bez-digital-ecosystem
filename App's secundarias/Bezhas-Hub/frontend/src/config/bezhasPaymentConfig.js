// bezhasPaymentConfig.js — enlaces Stripe reales (cuenta BeZhas, livemode).
//
// Sincronizado 2026-07-16 con el catálogo de Stripe y con
// backend/config/plans.js (fuente canónica). Cada Payment Link de plan lleva
// en Stripe metadata { plan_id, billing } y redirige tras el pago a
// hub.bez.digital/onboarding. El webhook del gateway provisiona el plan
// usando client_reference_id como identificador de la app/organización:
// SIEMPRE abrir los links de plan vía buildStripeCheckoutUrl() para
// adjuntarlo — sin él, la compra requiere reconciliación manual.

export const STRIPE_PAYMENT_LINKS = {
  subscriptions: {
    creator_pro: {
      monthly: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
      annual: 'https://buy.stripe.com/6oU9ATa2A6Gi0F83Mfew80a',
    },
    business: {
      monthly: 'https://buy.stripe.com/aFa3cvb6E0hUafI82vew808',
      annual: 'https://buy.stripe.com/8x228r8YwfcO87A4Qjew80b',
    },
    enterprise_vip: {
      monthly: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
      annual: 'https://buy.stripe.com/fZufZhgqY8Oq73w2Ibew80c',
    },
  },
  tokenPurchase: 'https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806',
  // vip (buy.stripe.com/3cIdR9…804) desactivado en Stripe: redirigía al
  // WordPress muerto. vipPlus sigue activo.
  vipPlus: 'https://buy.stripe.com/bJe3cveiQ1lY3Rkgz1ew805',
};

export const BANK_TRANSFER_DETAILS = {
  beneficiaryAlias: 'bez.digital',
  accountHolder: 'bez.digital',
  iban: 'ES77 1465 0100 91 1766376210',
  bic: 'INGDESMMXXX',
  bank: 'ING',
  paymentRail: 'SEPA',
  currency: 'EUR',
};

export function buildBankTransferInstructions(reference) {
  return {
    ...BANK_TRANSFER_DETAILS,
    reference,
    concept: reference,
    swift: BANK_TRANSFER_DETAILS.bic,
    beneficiary: BANK_TRANSFER_DETAILS.beneficiaryAlias,
  };
}

// Normaliza IDs de plan (esquema definitivo + legacy de /be-vip) al plan
// canónico. `starter` es gratis: NO tiene checkout Stripe (devuelve null).
const PLAN_ALIASES = {
  creator: 'creator_pro',
  creator_pro: 'creator_pro',
  pro: 'business', // el antiguo "Pro" (499€) es el Business actual
  business: 'business',
  enterprise: 'enterprise_vip',
  enterprise_vip: 'enterprise_vip',
};

/** Devuelve el id del org/app activo para atribuir la compra (o null). */
function activeClientReferenceId() {
  try {
    return localStorage.getItem('bezhas-org-id') || null;
  } catch {
    return null;
  }
}

/**
 * URL de checkout Stripe para un plan de pago.
 * @param {string} planId — id de plan (definitivo o legacy)
 * @param {{annual?:boolean, clientReferenceId?:string|null}} [opts]
 * @returns {string|null} null si el plan no tiene checkout (starter/desconocido)
 */
export function buildStripeCheckoutUrl(planId, { annual = false, clientReferenceId } = {}) {
  const canonical = PLAN_ALIASES[String(planId || '').toLowerCase()];
  const link = canonical && STRIPE_PAYMENT_LINKS.subscriptions[canonical];
  if (!link) return null;
  const url = new URL(annual ? link.annual : link.monthly);
  const ref = clientReferenceId !== undefined ? clientReferenceId : activeClientReferenceId();
  if (ref) url.searchParams.set('client_reference_id', ref);
  return url.toString();
}

/** Compat: mismo contrato que antes pero con el mapeo corregido. */
export function getStripePaymentLink(useCase = 'tokenPurchase') {
  const key = String(useCase || '').toLowerCase();
  const planUrl = buildStripeCheckoutUrl(key);
  if (planUrl) return planUrl;
  if (key === 'vipplus' || key === 'vip') return STRIPE_PAYMENT_LINKS.vipPlus;
  return STRIPE_PAYMENT_LINKS.tokenPurchase;
}

export function getVipStripeLink(tierId) {
  return buildStripeCheckoutUrl(tierId) || STRIPE_PAYMENT_LINKS.vipPlus;
}
