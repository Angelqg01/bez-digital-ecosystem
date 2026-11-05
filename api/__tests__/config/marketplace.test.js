const {
    normalizarListing, requisitosPendientes, declaraEscritura, tieneCategoriasEspeciales, ListingInvalido,
} = require('../../config/marketplace');

const OPENAPI = {
    openapi: '3.1.0',
    info: { title: 'Tarifas aduaneras', version: '1.0.0' },
    paths: { '/tariffs/{hs}': { get: { responses: { 200: { description: 'ok' } } } } },
};
const BASE = {
    slug: 'tarifas-aduana',
    title: 'Tarifas aduaneras',
    version: '1.0.0',
    upstream_url: 'https://api.proveedor.example/v1',
    openapi: OPENAPI,
    pricing: { model: 'per_call', amount_cents: 2, currency: 'eur' },
};

function errores(fn) {
    try {
        fn();
    } catch (e) {
        expect(e).toBeInstanceOf(ListingInvalido);
        return e.errores.join(' | ');
    }
    throw new Error('no lanzó');
}

describe('config/marketplace — normalizarListing', () => {
    it('acepta un listing de sólo lectura y rellena valores por defecto', () => {
        const out = normalizarListing(BASE);
        expect(out.slug).toBe('tarifas-aduana');
        expect(out.writes).toBe(false);
        expect(out.data_categories).toEqual([]);
        expect(out.pricing).toEqual({ model: 'per_call', amount_cents: 2, currency: 'eur' });
    });

    it.each([
        ['slug con mayúsculas', { slug: 'Tarifas' }, 'slug'],
        ['slug con guion final', { slug: 'tarifas-' }, 'slug'],
        ['OpenAPI 3.0', { openapi: { ...OPENAPI, openapi: '3.0.3' } }, '3.1'],
        ['OpenAPI sin rutas', { openapi: { ...OPENAPI, paths: {} } }, 'paths'],
        ['ruta con ..', { openapi: { ...OPENAPI, paths: { '/../admin': { get: {} } } } }, 'Ruta no válida'],
        ['importe 0', { pricing: { model: 'per_call', amount_cents: 0, currency: 'eur' } }, 'amount_cents'],
        ['importe decimal', { pricing: { model: 'per_call', amount_cents: 1.5, currency: 'eur' } }, 'amount_cents'],
        ['divisa no admitida', { pricing: { model: 'per_call', amount_cents: 5, currency: 'gbp' } }, 'currency'],
        ['suscripción sin intervalo', { pricing: { model: 'subscription', amount_cents: 900, currency: 'eur' } }, 'interval'],
        ['categoría libre', { data_categories: ['todo'] }, 'data_categories'],
    ])('rechaza %s', (_caso, cambio, mensaje) => {
        expect(errores(() => normalizarListing({ ...BASE, ...cambio }))).toContain(mensaje);
    });

    it('rechaza un OpenAPI con POST si writes=false', () => {
        const openapi = { ...OPENAPI, paths: { '/orders': { post: {} } } };
        expect(errores(() => normalizarListing({ ...BASE, openapi }))).toContain('writes=true');
        expect(normalizarListing({ ...BASE, openapi, writes: true }).writes).toBe(true);
    });

    it('en modo parcial no deja cambiar el slug ni exige el resto', () => {
        expect(normalizarListing({ title: 'Nuevo título' }, { parcial: true })).toEqual({ title: 'Nuevo título' });
        expect(errores(() => normalizarListing({ slug: 'otro' }, { parcial: true }))).toContain('slug');
    });

    it('deduplica y ordena las categorías', () => {
        expect(normalizarListing({ ...BASE, data_categories: ['contact', 'identifiers', 'contact'] }).data_categories)
            .toEqual(['contact', 'identifiers']);
    });
});

describe('config/marketplace — requisitos y utilidades', () => {
    const OK = { status: 'onboarding', kyb_status: 'verified', stripe_account_id: 'acct_1', dpa_signed_at: null };

    it('sin datos personales no exige DPA', () => {
        expect(requisitosPendientes(OK, { data_categories: [] })).toEqual([]);
    });

    it('con datos personales exige DPA', () => {
        expect(requisitosPendientes(OK, { data_categories: ['contact'] })).toEqual(['dpa_signed']);
    });

    it('lista todo lo que falta a un proveedor recién creado', () => {
        expect(requisitosPendientes({ status: 'onboarding', kyb_status: 'pending' }, { data_categories: [] }))
            .toEqual(['kyb_verified', 'stripe_connect_account']);
        expect(requisitosPendientes(null, {})).toEqual(['provider']);
    });

    it('detecta escritura y categorías del art. 9', () => {
        expect(declaraEscritura(OPENAPI)).toBe(false);
        expect(declaraEscritura({ ...OPENAPI, paths: { '/x': { delete: {} } } })).toBe(true);
        expect(tieneCategoriasEspeciales(['contact'])).toBe(false);
        expect(tieneCategoriasEspeciales(['health'])).toBe(true);
    });
});

describe('config/marketplace — listings con escritura (paso 6)', () => {
    it('un requestBody sin esquema JSON se rechaza', () => {
        const openapi = { ...OPENAPI, paths: { '/o': { post: { requestBody: { content: { 'text/plain': {} } } } } } };
        expect(errores(() => normalizarListing({ ...BASE, openapi, writes: true }))).toContain('application/json');
    });

    it('upstream_spki_pin: base64 de 44 caracteres o null', () => {
        const pin = Buffer.alloc(32, 7).toString('base64');
        expect(normalizarListing({ ...BASE, upstream_spki_pin: pin }).upstream_spki_pin).toBe(pin);
        expect(normalizarListing({ ...BASE, upstream_spki_pin: null }).upstream_spki_pin).toBeNull();
        expect(errores(() => normalizarListing({ ...BASE, upstream_spki_pin: 'abc' }))).toContain('upstream_spki_pin');
    });
});
