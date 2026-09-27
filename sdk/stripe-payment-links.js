/**
 * BeZhas Stripe Payment Links catalog.
 *
 * These links are used by the BeZhas-owned gateway for fiat checkout while the
 * BEZ delivery logic remains inside BeZhas Pay.
 */

const STRIPE_PAYMENT_LINKS = Object.freeze({
    plans: Object.freeze({
        enterprise: Object.freeze({
            id: 'enterprise',
            label: 'BeZhas Enterprise',
            url: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
        }),
        pro: Object.freeze({
            id: 'pro',
            label: 'BeZhas Pro',
            url: 'https://buy.stripe.com/aFa3cvb6E0hUafI82vew808',
        }),
        starter: Object.freeze({
            id: 'starter',
            label: 'BeZhas Starter',
            url: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
        }),
    }),
    bezCoin: Object.freeze({
        directPurchase: Object.freeze({
            id: 'bez_coin_direct_purchase',
            label: 'Obtén BEZ-Coin',
            url: 'https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806',
        }),
    }),
    hubSubscriptions: Object.freeze({
        beVipPlus: Object.freeze({
            id: 'be_vip_plus',
            label: 'Be-VIP y niveles de suscriptor más',
            url: 'https://buy.stripe.com/bJe3cveiQ1lY3Rkgz1ew805',
        }),
        beVip: Object.freeze({
            id: 'be_vip',
            label: 'Be-VIP',
            url: 'https://buy.stripe.com/3cIdR9a2A3u673waaDew804',
        }),
    }),
    investors: Object.freeze({
        foundingPartner: Object.freeze({
            id: 'founding_partner',
            label: 'Socio fundador (5000 EUR+)',
            url: 'https://book.stripe.com/bJefZh3Ec7Km1JcaaDew803',
        }),
        architect: Object.freeze({
            id: 'architect',
            label: 'Arquitecto',
            url: 'https://book.stripe.com/cNi9ATfmU9Su4VociLew802',
        }),
        socialVisionary: Object.freeze({
            id: 'social_visionary',
            label: 'Visionario Social',
            url: 'https://book.stripe.com/cNibJ1fmUc0C4VobeHew801',
        }),
        digitalPioneer: Object.freeze({
            id: 'digital_pioneer',
            label: 'Pionero Digital',
            url: 'https://book.stripe.com/eVqdR9eiQc0CdrU4Qjew800',
        }),
    }),
});

const STRIPE_LINK_ALIASES = Object.freeze({
    enterprise: STRIPE_PAYMENT_LINKS.plans.enterprise,
    pro: STRIPE_PAYMENT_LINKS.plans.pro,
    starter: STRIPE_PAYMENT_LINKS.plans.starter,
    token_purchase: STRIPE_PAYMENT_LINKS.bezCoin.directPurchase,
    bez_coin_direct_purchase: STRIPE_PAYMENT_LINKS.bezCoin.directPurchase,
    direct_purchase: STRIPE_PAYMENT_LINKS.bezCoin.directPurchase,
    be_vip_plus: STRIPE_PAYMENT_LINKS.hubSubscriptions.beVipPlus,
    be_vip: STRIPE_PAYMENT_LINKS.hubSubscriptions.beVip,
    founding_partner: STRIPE_PAYMENT_LINKS.investors.foundingPartner,
    architect: STRIPE_PAYMENT_LINKS.investors.architect,
    social_visionary: STRIPE_PAYMENT_LINKS.investors.socialVisionary,
    digital_pioneer: STRIPE_PAYMENT_LINKS.investors.digitalPioneer,
});

function getStripePaymentLink(key = 'token_purchase') {
    return STRIPE_LINK_ALIASES[key] || STRIPE_PAYMENT_LINKS.bezCoin.directPurchase;
}

module.exports = {
    STRIPE_PAYMENT_LINKS,
    STRIPE_LINK_ALIASES,
    getStripePaymentLink,
};
