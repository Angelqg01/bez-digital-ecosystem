/**
 * CORS — quién puede llamar a la API desde un navegador.
 *
 * Regresión que cubre este archivo: la allowlist era una enumeración a mano
 * (4 dominios de producción, 5 puertos locales) que no incluía NINGUNA SubApp.
 * Su login moría en el preflight sin dejar rastro en el servidor: desde el
 * navegador sólo se veía "Failed to fetch".
 */
const { isAllowedOrigin, makeCorsOriginFn, parseExtraOrigins } = require('../../config/cors');

const PROD = { isProduction: true };
const DEV = { isProduction: false };

describe('isAllowedOrigin — producción', () => {
    it('acepta el dominio raíz y cualquier subdominio de bez.digital', () => {
        // Las 13 SubApps se despliegan en subdominios; enumerarlas a mano era
        // justo lo que hacía que una app nueva naciese sin poder autenticar.
        for (const host of ['bez.digital', 'app.bez.digital', 'sphere.bez.digital',
            'purescan.bez.digital', 'energy.bez.digital', 'cargolink.bez.digital',
            'edge-node.bez.digital', 'a.b.bez.digital']) {
            expect(isAllowedOrigin(`https://${host}`, PROD)).toBe(true);
        }
    });

    it('rechaza dominios que sólo se parecen', () => {
        for (const origin of [
            'https://bez.digital.evil.com',   // sufijo falso
            'https://notbez.digital',         // prefijo pegado
            'https://bez-digital.com',
            'https://bez.digital.co',
            'http://bez.digital',             // sin TLS
            'https://BEZ.DIGITAL',            // el patrón es en minúsculas
        ]) {
            expect(isAllowedOrigin(origin, PROD)).toBe(false);
        }
    });

    it('NO acepta orígenes locales en producción', () => {
        // Si los aceptara, una página servida en el localhost de la víctima
        // podría hablar con la API real usando sus credenciales.
        expect(isAllowedOrigin('http://localhost:3020', PROD)).toBe(false);
        expect(isAllowedOrigin('http://127.0.0.1:5173', PROD)).toBe(false);
    });
});

describe('isAllowedOrigin — desarrollo', () => {
    it('acepta cualquier puerto local, que es como arrancan las SubApps', () => {
        for (const origin of ['http://localhost:3004', 'http://localhost:3010',
            'http://localhost:3016', 'http://localhost:3020', 'http://localhost:5173',
            'http://127.0.0.1:3011', 'http://localhost']) {
            expect(isAllowedOrigin(origin, DEV)).toBe(true);
        }
    });

    it('no confunde un host que empieza por localhost', () => {
        expect(isAllowedOrigin('http://localhost.evil.com', DEV)).toBe(false);
        expect(isAllowedOrigin('http://notlocalhost:3000', DEV)).toBe(false);
    });

    it('sigue aceptando los dominios de producción', () => {
        expect(isAllowedOrigin('https://sphere.bez.digital', DEV)).toBe(true);
    });
});

describe('CORS_EXTRA_ORIGINS', () => {
    it('permite añadir un origen sin tocar código', () => {
        const opts = { isProduction: true, extraOrigins: parseExtraOrigins('https://partner.example.com') };
        expect(isAllowedOrigin('https://partner.example.com', opts)).toBe(true);
        expect(isAllowedOrigin('https://otro.example.com', opts)).toBe(false);
    });

    it('tolera espacios y entradas vacías en la lista', () => {
        expect(parseExtraOrigins(' https://a.com , ,https://b.com ,'))
            .toEqual(['https://a.com', 'https://b.com']);
        expect(parseExtraOrigins('')).toEqual([]);
        expect(parseExtraOrigins(undefined)).toEqual([]);
    });

    it('exige coincidencia exacta, no por prefijo', () => {
        const opts = { isProduction: true, extraOrigins: ['https://partner.example.com'] };
        expect(isAllowedOrigin('https://partner.example.com.evil.net', opts)).toBe(false);
    });
});

describe('entradas degeneradas', () => {
    it('rechaza lo que no sea una cadena', () => {
        for (const v of [null, undefined, '', 0, {}, []]) {
            expect(isAllowedOrigin(v, DEV)).toBe(false);
        }
    });
});

describe('makeCorsOriginFn', () => {
    it('deja pasar peticiones sin Origin (curl, health checks, SSR)', () => {
        const cb = jest.fn();
        makeCorsOriginFn(PROD)(undefined, cb);
        expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('deja pasar un origen permitido', () => {
        const cb = jest.fn();
        makeCorsOriginFn(PROD)('https://pay.bez.digital', cb);
        expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('pasa un Error para un origen no permitido', () => {
        const cb = jest.fn();
        makeCorsOriginFn(PROD)('https://evil.example.com', cb);
        const [err, allowed] = cb.mock.calls[0];
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toContain('evil.example.com');
        expect(allowed).toBeUndefined();
    });
});
