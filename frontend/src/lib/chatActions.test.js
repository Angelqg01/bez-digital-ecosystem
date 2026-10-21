import { describe, expect, test } from 'vitest';
import { apiError, classifyLink, formatPrice, isSafeInternalPath, isStripeCheckoutUrl, TRUSTED_HOSTS, upgradeOptions } from './chatActions';

describe('isSafeInternalPath', () => {
    test.each(['/rwa', '/vip', '/docs/guia-1', '/rwa?tab=tokenize', '/dashboard/farming', '/dashboard/wallet#gov'])('acepta %s', (p) => {
        expect(isSafeInternalPath(p)).toBe(true);
    });

    test.each([
        'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '', null, undefined, 42, {},
        '/rwa/../admin', '/%2fevil', '/%2Fevil.com', '/rwa%5cx', '/rwa%00', '/rwa%0d%0a', '/rwa\n', '/rwa x', `/${'a'.repeat(300)}`, 'rwa', '/<script>', '/rwa"onclick="x',
    ])('rechaza %j', (p) => {
        expect(isSafeInternalPath(p)).toBe(false);
    });
});

describe('classifyLink', () => {
    test('rutas internas', () => {
        expect(classifyLink('/vip')).toEqual({ type: 'internal', href: '/vip' });
    });

    test('dominios propios por https → externo de confianza', () => {
        for (const host of TRUSTED_HOSTS) expect(classifyLink(`https://${host}/rwa`).type).toBe('external');
    });

    test.each([
        'http://bezhas.com', 'https://bezhas.com.evil.com', 'https://evil.com/bezhas.com', 'https://user:pass@bezhas.com', 'https://bezhas.com:8443',
        'javascript:alert(1)', 'data:text/html,x', '//evil.com', 'ftp://bezhas.com', 'not a url', '', undefined, null, 5,
    ])('bloquea %j', (href) => {
        expect(classifyLink(href)).toEqual({ type: 'blocked' });
    });
});

describe('formatPrice', () => {
    test('gratis, de pago y sin precio', () => {
        expect(formatPrice({ priceMonthly: 0 })).toBe('Gratis');
        expect(formatPrice({ priceMonthly: 99, currency: 'EUR' })).toBe('99 EUR/mes');
        expect(formatPrice({ priceMonthly: 5 })).toBe('5/mes');
        expect(formatPrice({})).toBe('');
        expect(formatPrice({ priceMonthly: null })).toBe('');
    });
});

describe('apiError', () => {
    test('prioriza error, message y errors[0].msg del backend; si no, el texto por defecto', () => {
        expect(apiError({ response: { data: { error: 'a', message: 'b' } } }, 'x')).toBe('a');
        expect(apiError({ response: { data: { message: 'b' } } }, 'x')).toBe('b');
        expect(apiError({ response: { data: { errors: [{ msg: 'c' }] } } }, 'x')).toBe('c');
        expect(apiError({ response: { data: {} } }, 'x')).toBe('x');
        expect(apiError(new Error('boom'), 'x')).toBe('x');
        expect(apiError(null, 'x')).toBe('x');
    });
});

describe('isStripeCheckoutUrl / formatPrice anual', () => {
    test('solo hosts exactos de Stripe por https', () => {
        expect(isStripeCheckoutUrl('https://checkout.stripe.com/c/pay/x')).toBe(true);
        expect(isStripeCheckoutUrl('https://billing.stripe.com/p/session/x')).toBe(true);
        expect(isStripeCheckoutUrl('https://stripe.com/x')).toBe(false);
        expect(isStripeCheckoutUrl('https://checkout.stripe.com:444/x')).toBe(false);
    });
    test('precio anual', () => {
        expect(formatPrice({ priceMonthly: 99, priceYearly: 990, currency: 'EUR' }, 'yearly')).toBe('990 EUR/año');
        expect(formatPrice({ priceMonthly: 99, currency: 'EUR' }, 'yearly')).toBe('99 EUR/mes');
    });
});

describe('upgradeOptions', () => {
    const plans = [{ id: 'starter', priceMonthly: 0 }, { id: 'creator', priceMonthly: 99, purchasable: true }, { id: 'business', priceMonthly: 499, purchasable: true }];
    test('solo planes comprables con precio mayor que el actual', () => {
        expect(upgradeOptions(plans, 'creator').map((p) => p.id)).toEqual(['business']);
        expect(upgradeOptions(plans, 'starter').map((p) => p.id)).toEqual(['creator', 'business']);
        expect(upgradeOptions(plans, 'business')).toEqual([]);
        expect(upgradeOptions(undefined, 'x')).toEqual([]);
    });
});
