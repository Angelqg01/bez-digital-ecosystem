import { describe, expect, test } from 'vitest';
import { apiError, authErrorMessage, checkoutNotice, classifyLink, formatPrice, isSafeInternalPath, isStripeCheckoutUrl, TRUSTED_HOSTS } from './chatActions';

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

describe('checkoutNotice (vuelta desde Stripe)', () => {
    test('sin retorno de pago no hay mensaje', () => {
        expect(checkoutNotice('')).toBeNull();
        expect(checkoutNotice('?foo=bar')).toBeNull();
        expect(checkoutNotice('?checkout=otra-cosa')).toBeNull();
    });
    test('plan: avisa de que se activa al confirmarlo Stripe', () => {
        expect(checkoutNotice('?checkout=success&kind=plan&session_id=cs_x')).toMatch(/plan se activará/);
    });
    test('BEZ: avisa de que la entrega espera a que el banco confirme el cobro', () => {
        expect(checkoutNotice('?checkout=success&kind=bez')).toMatch(/cuando el banco confirme/);
    });
    test('cancelado: no se ha cobrado nada', () => {
        expect(checkoutNotice('?checkout=cancelled&kind=plan')).toMatch(/No se ha cobrado nada/);
    });
    test('nunca pinta contenido de la URL (sólo textos fijos)', () => {
        const t = checkoutNotice('?checkout=success&kind=<script>alert(1)</script>');
        expect(t).not.toMatch(/script|alert/);
    });
});

describe('authErrorMessage', () => {
    const err = (error) => ({ response: { data: { error } } });
    test('traduce los errores de acceso conocidos', () => {
        expect(authErrorMessage(err('Invalid credentials'), 'x')).toBe('Email o contraseña incorrectos.');
        expect(authErrorMessage(err('Email or wallet already registered'), 'x')).toMatch(/ya tiene una cuenta/);
        expect(authErrorMessage({ response: { data: { errors: [{ msg: 'Password must be at least 8 chars' }] } } }, 'x')).toMatch(/al menos 8/);
    });
    test('lo desconocido se deja tal cual y sin respuesta usa el texto de reserva', () => {
        expect(authErrorMessage(err('Código inválido o caducado'), 'x')).toBe('Código inválido o caducado');
        expect(authErrorMessage(new Error('Network Error'), 'No se pudo')).toBe('No se pudo');
    });
});
