/**
 * @jest-environment node
 */
import { BANK_TRANSFER_DETAILS } from '@/lib/bank-transfer-details';
import { STRIPE_PAYMENT_LINKS } from '@/lib/stripe-payment-links';

/**
 * Estos dos módulos son datos, no lógica, y precisamente por eso nadie los revisa:
 * son constantes a las que va el dinero de los clientes. Una errata en un enlace de
 * Stripe cobra el plan equivocado y un dígito cambiado en el IBAN manda una
 * transferencia SEPA a ninguna parte. Aquí se comprueba lo que un humano no ve de un
 * vistazo.
 */

describe('enlaces de pago de Stripe', () => {
    const entradas = Object.entries(STRIPE_PAYMENT_LINKS);

    it('cubre los planes y productos esperados', () => {
        expect(Object.keys(STRIPE_PAYMENT_LINKS).sort()).toEqual([
            'architect',
            'beVip',
            'beVipPlus',
            'digitalPioneer',
            'enterprise',
            'foundingPartner',
            'pro',
            'socialVisionary',
            'starter',
            'tokenPurchase',
        ]);
    });

    it.each(entradas)('%s apunta a un dominio de Stripe por HTTPS', (_nombre, url) => {
        const { protocol, hostname } = new URL(url);

        expect(protocol).toBe('https:');
        expect(['buy.stripe.com', 'book.stripe.com']).toContain(hostname);
    });

    it.each(entradas)('%s lleva un identificador de enlace, no sólo el dominio', (_nombre, url) => {
        expect(new URL(url).pathname).toMatch(/^\/[A-Za-z0-9]{10,}$/);
    });

    it('no repite ningún enlace entre dos productos', () => {
        // Duplicar un enlace es el fallo silencioso típico del copiar-pegar: el cliente
        // paga el plan de al lado y el importe cuadra igual.
        const urls = entradas.map(([, url]) => url);

        expect(new Set(urls).size).toBe(urls.length);
    });
});

describe('datos de transferencia bancaria', () => {
    const { iban, bic, currency, paymentRail, beneficiaryAlias } = BANK_TRANSFER_DETAILS;

    it('mantiene la cuenta de BeZhas registrada en CLAUDE.md', () => {
        expect(iban).toBe('ES77 1465 0100 91 1766376210');
    });

    it('el IBAN pasa la validación mod-97 de la ISO 13616', () => {
        // Una errata de un solo dígito rompe este resto: es la red de seguridad que
        // ninguna revisión visual da.
        const compacto = iban.replace(/\s+/g, '').toUpperCase();
        const reordenado = compacto.slice(4) + compacto.slice(0, 4);
        const numerico = reordenado.replace(/[A-Z]/g, (l) => String(l.charCodeAt(0) - 55));

        const resto = [...numerico].reduce((acc, digito) => (acc * 10 + Number(digito)) % 97, 0);

        expect(resto).toBe(1);
    });

    it('el IBAN es español y tiene la longitud de 24 caracteres de España', () => {
        const compacto = iban.replace(/\s+/g, '');

        expect(compacto.startsWith('ES')).toBe(true);
        expect(compacto).toHaveLength(24);
    });

    it('el BIC tiene forma de SWIFT y es de ING España', () => {
        expect(bic).toMatch(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/);
        expect(bic.slice(4, 6)).toBe('ES');
    });

    it('la vía y la divisa son coherentes: SEPA sólo mueve euros', () => {
        expect(paymentRail).toBe('SEPA');
        expect(currency).toBe('EUR');
    });

    it('el alias del beneficiario es el dominio de la empresa', () => {
        expect(beneficiaryAlias).toBe('bez.digital');
    });
});
