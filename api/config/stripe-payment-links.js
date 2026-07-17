/**
 * BeZhas Stripe Payment Links catalog.
 *
 * Payment Links are owned/configured in Stripe. The BeZhas gateway returns the
 * correct link while payment state and BEZ delivery stay in BeZhas Pay.
 */

const STRIPE_PAYMENT_LINKS = Object.freeze({
    // Los ids coinciden con los plan_id de config/plans.js y con el
    // metadata.plan_id de cada Payment Link / producto en Stripe.
    plans: Object.freeze({
        enterprise_vip: Object.freeze({
            id: 'enterprise_vip',
            label: 'BeZhas Enterprise VIP',
            stripeProductId: 'prod_UOSJJi93dIuZ7q',
            monthly: Object.freeze({
                url: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
                priceId: 'price_1TPfPMFomr6oeXVgjrKzeAmm',
            }),
            annual: Object.freeze({
                url: 'https://buy.stripe.com/fZufZhgqY8Oq73w2Ibew80c',
                priceId: 'price_1TtuECFomr6oeXVgMGz8gK9v',
            }),
            url: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
        }),
        business: Object.freeze({
            id: 'business',
            label: 'BeZhas Business',
            stripeProductId: 'prod_UOSDVEzpPuxHux',
            monthly: Object.freeze({
                url: 'https://buy.stripe.com/aFa3cvb6E0hUafI82vew808',
                priceId: 'price_1TPfJUFomr6oeXVgMfB321Hf',
            }),
            annual: Object.freeze({
                url: 'https://buy.stripe.com/8x228r8YwfcO87A4Qjew80b',
                priceId: 'price_1TtuE9Fomr6oeXVguKlDbScU',
            }),
            url: 'https://buy.stripe.com/aFa3cvb6E0hUafI82vew808',
        }),
        creator_pro: Object.freeze({
            id: 'creator_pro',
            label: 'BeZhas Creator Pro',
            stripeProductId: 'prod_UOS89liy2MjObG',
            monthly: Object.freeze({
                url: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
                priceId: 'price_1TPfDyFomr6oeXVgBxoyUJwn',
            }),
            annual: Object.freeze({
                url: 'https://buy.stripe.com/6oU9ATa2A6Gi0F83Mfew80a',
                priceId: 'price_1TtuE7Fomr6oeXVgHjQ5AkXT',
            }),
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
        // be_vip (plink_1S1nB3…) desactivado en Stripe 2026-07-16:
        // redirigía al WordPress muerto (bezhas.com/wp-login.php).
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
    enterprise_vip: STRIPE_PAYMENT_LINKS.plans.enterprise_vip,
    business: STRIPE_PAYMENT_LINKS.plans.business,
    creator_pro: STRIPE_PAYMENT_LINKS.plans.creator_pro,
    // Aliases legacy (los links antiguos apuntaban a estos precios):
    enterprise: STRIPE_PAYMENT_LINKS.plans.enterprise_vip,
    pro: STRIPE_PAYMENT_LINKS.plans.business,
    starter: STRIPE_PAYMENT_LINKS.plans.creator_pro,
    token_purchase: STRIPE_PAYMENT_LINKS.bezCoin.directPurchase,
    bez_coin_direct_purchase: STRIPE_PAYMENT_LINKS.bezCoin.directPurchase,
    direct_purchase: STRIPE_PAYMENT_LINKS.bezCoin.directPurchase,
    be_vip_plus: STRIPE_PAYMENT_LINKS.hubSubscriptions.beVipPlus,
    founding_partner: STRIPE_PAYMENT_LINKS.investors.foundingPartner,
    architect: STRIPE_PAYMENT_LINKS.investors.architect,
    social_visionary: STRIPE_PAYMENT_LINKS.investors.socialVisionary,
    digital_pioneer: STRIPE_PAYMENT_LINKS.investors.digitalPioneer,
});

/**
 * @param {string} key — alias del link (plan id, legacy alias o use-case BEZ)
 * @param {{annual?: boolean}} [opts] — annual: true devuelve la variante anual
 *   si el link la tiene (los planes de suscripción); si no, la mensual/base.
 */
function getStripePaymentLink(key = 'token_purchase', { annual = false } = {}) {
    const link = STRIPE_LINK_ALIASES[key] || STRIPE_PAYMENT_LINKS.bezCoin.directPurchase;
    if (annual && link.annual) {
        return { ...link, url: link.annual.url, priceId: link.annual.priceId, billing: 'annual' };
    }
    if (link.monthly) {
        return { ...link, url: link.monthly.url, priceId: link.monthly.priceId, billing: 'monthly' };
    }
    return link;
}

module.exports = {
    STRIPE_PAYMENT_LINKS,
    STRIPE_LINK_ALIASES,
    getStripePaymentLink,
};
