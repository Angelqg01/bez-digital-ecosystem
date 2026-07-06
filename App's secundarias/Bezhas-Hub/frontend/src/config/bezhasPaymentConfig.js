export const STRIPE_PAYMENT_LINKS = {
  subscriptions: {
    starter: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
    pro: 'https://buy.stripe.com/aFa3cvb6E0hUafI82vew808',
    enterprise: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
  },
  tokenPurchase: 'https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806',
  vip: 'https://buy.stripe.com/3cIdR9a2A3u673waaDew804',
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

// Normaliza los IDs de plan (esquema definitivo y esquema legacy de /be-vip) a
// su enlace Stripe. Así /pay (ids: starter, creator_pro, business, enterprise_vip)
// y /be-vip (ids: starter, creator, business, enterprise) enrutan correctamente.
const PLAN_ID_TO_STRIPE = {
  starter: STRIPE_PAYMENT_LINKS.subscriptions.starter,
  creator: STRIPE_PAYMENT_LINKS.subscriptions.pro,
  creator_pro: STRIPE_PAYMENT_LINKS.subscriptions.pro,
  pro: STRIPE_PAYMENT_LINKS.subscriptions.pro,
  business: STRIPE_PAYMENT_LINKS.vipPlus,
  enterprise: STRIPE_PAYMENT_LINKS.subscriptions.enterprise,
  enterprise_vip: STRIPE_PAYMENT_LINKS.subscriptions.enterprise,
};

export function getStripePaymentLink(useCase = 'tokenPurchase') {
  const key = String(useCase || '').toLowerCase();
  if (PLAN_ID_TO_STRIPE[key]) return PLAN_ID_TO_STRIPE[key];
  if (key === 'vip') return STRIPE_PAYMENT_LINKS.vip;
  if (key === 'vipplus') return STRIPE_PAYMENT_LINKS.vipPlus;
  return STRIPE_PAYMENT_LINKS.tokenPurchase;
}

export function getVipStripeLink(tierId) {
  const tier = String(tierId || '').toLowerCase();
  return PLAN_ID_TO_STRIPE[tier] || STRIPE_PAYMENT_LINKS.vip;
}
