export const STRIPE_PAYMENT_LINKS = {
  subscriptions: {
    starter: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
    pro: 'https://buy.stripe.com/aFa3cvb6E0hUafI82vew808',
    enterprise: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
  },
  tokenPurchase: 'https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806',
  vip: 'https://buy.stripe.com/3cIdR9a2A3u673waaDew804',
  vipPlus: 'https://buy.stripe.com/bJe3cveiQ1lY3Rkgz1ew805',
} as const;

export const BANK_TRANSFER_DETAILS = {
  beneficiaryAlias: 'bez.digital',
  accountHolder: 'bez.digital',
  iban: 'ES77 1465 0100 91 1766376210',
  bic: 'INGDESMMXXX',
  bank: 'ING',
  paymentRail: 'SEPA',
  currency: 'EUR',
} as const;

export function buildBankTransferInstructions(reference: string) {
  return {
    ...BANK_TRANSFER_DETAILS,
    reference,
    concept: reference,
    swift: BANK_TRANSFER_DETAILS.bic,
    beneficiary: BANK_TRANSFER_DETAILS.beneficiaryAlias,
  };
}
