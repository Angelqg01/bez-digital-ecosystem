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
            stripeProductId: 'prod_VKsLKhIhLm5EUQ',
            monthly: Object.freeze({
                url: 'https://buy.stripe.com/bJe3cucmrgGIfJOdag0kE0e',
                priceId: 'price_1UKCb3B0WAywWIe1nqFOnq9B',
            }),
            annual: Object.freeze({
                url: 'https://buy.stripe.com/9B628qgCHgGI69e0nu0kE0f',
                priceId: 'price_1UKCb4B0WAywWIe1s3Ww5l5Y',
            }),
            url: 'https://buy.stripe.com/bJe3cucmrgGIfJOdag0kE0e',
        }),
        business: Object.freeze({
            id: 'business',
            label: 'BeZhas Business',
            stripeProductId: 'prod_VKsLDGwu6UStUp',
            monthly: Object.freeze({
                url: 'https://buy.stripe.com/aFaeVcaej1LO2X2b280kE0c',
                priceId: 'price_1UKCb2B0WAywWIe13zUvmLVW',
            }),
            annual: Object.freeze({
                url: 'https://buy.stripe.com/8x200i5Y39eg0OU4DK0kE0d',
                priceId: 'price_1UKCb3B0WAywWIe1ui9JDcpS',
            }),
            url: 'https://buy.stripe.com/aFaeVcaej1LO2X2b280kE0c',
        }),
        creator_pro: Object.freeze({
            id: 'creator_pro',
            label: 'BeZhas Creator Pro',
            stripeProductId: 'prod_VKsLNgEN40KOPw',
            monthly: Object.freeze({
                url: 'https://buy.stripe.com/5kQ6oG7272PSeFKeek0kE0a',
                priceId: 'price_1UKCb1B0WAywWIe16OzcNOlB',
            }),
            annual: Object.freeze({
                url: 'https://buy.stripe.com/fZucN486b8accxCgms0kE0b',
                priceId: 'price_1UKCb1B0WAywWIe1f2OgfR6U',
            }),
            url: 'https://buy.stripe.com/5kQ6oG7272PSeFKeek0kE0a',
        }),
    }),
    bezCoin: Object.freeze({
        directPurchase: Object.freeze({
            id: 'bez_coin_direct_purchase',
            label: 'Obtén BEZ-Coin',
            url: 'https://buy.stripe.com/5kQ6oG5Y3duw0OU8U00kE0g',
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
