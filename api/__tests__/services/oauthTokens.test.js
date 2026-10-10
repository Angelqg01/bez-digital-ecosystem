const crypto = require('crypto');

/**
 * La carga de claves ocurre al requerir el módulo, así que cada caso lo
 * requiere de nuevo en aislamiento con el entorno que quiere probar.
 */
const ENV_KEYS = ['NODE_ENV', 'JEST_WORKER_ID', 'OAUTH_JWT_PRIVATE_KEY', 'OAUTH_JWT_PUBLIC_KEY'];

function cargarCon(env) {
    const antes = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) {
        if (k in env) {
            if (env[k] === undefined) delete process.env[k];
            else process.env[k] = env[k];
        }
    }
    try {
        let mod;
        jest.isolateModules(() => { mod = require('../../services/oauthTokens'); });
        return mod;
    } finally {
        for (const [k, v] of Object.entries(antes)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }
}

const b64 = (pem) => Buffer.from(pem).toString('base64');
function parEC(curva = 'prime256v1') {
    return crypto.generateKeyPairSync('ec', {
        namedCurve: curva,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
}

describe('oauthTokens — gestión de claves', () => {
    beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterAll(() => console.warn.mockRestore());

    it('en producción real (fuera de jest) sin claves no arranca', () => {
        // Un par efímero en producción invalidaría todas las sesiones OAuth en
        // cada reinicio de Cloud Run: mejor no arrancar que fingir que funciona.
        expect(() => cargarCon({
            NODE_ENV: 'production', JEST_WORKER_ID: undefined,
            OAUTH_JWT_PRIVATE_KEY: undefined, OAUTH_JWT_PUBLIC_KEY: undefined,
        })).toThrow(/obligatorias en producción/);
    });

    it('fuera de producción sin claves usa un par efímero', () => {
        const mod = cargarCon({
            NODE_ENV: 'development', OAUTH_JWT_PRIVATE_KEY: undefined, OAUTH_JWT_PUBLIC_KEY: undefined,
        });
        expect(mod._esEfimera).toBe(true);
    });

    it('acepta el par en base64 y firma/verifica', () => {
        const { privateKey, publicKey } = parEC();
        const mod = cargarCon({
            NODE_ENV: 'production', JEST_WORKER_ID: undefined,
            OAUTH_JWT_PRIVATE_KEY: b64(privateKey), OAUTH_JWT_PUBLIC_KEY: b64(publicKey),
        });
        expect(mod._esEfimera).toBe(false);
        const { token } = mod.emitirAccessToken({ appId: 'app-1', clientId: 'bzc_x', scope: ['token'] });
        expect(mod.verificarAccessToken(token).sub).toBe('app-1');
    });

    it('rechaza una pública que no es pareja de la privada', () => {
        // Síntoma sin esta comprobación: «invalid token» en todos los clientes
        // y ninguna pista de que la causa es un secreto cruzado.
        const a = parEC();
        const b = parEC();
        expect(() => cargarCon({
            OAUTH_JWT_PRIVATE_KEY: b64(a.privateKey), OAUTH_JWT_PUBLIC_KEY: b64(b.publicKey),
        })).toThrow(/no es la pareja/);
    });

    it('rechaza una curva distinta de P-256 (ES256 la exige)', () => {
        const { privateKey, publicKey } = parEC('secp256k1');
        expect(() => cargarCon({
            OAUTH_JWT_PRIVATE_KEY: b64(privateKey), OAUTH_JWT_PUBLIC_KEY: b64(publicKey),
        })).toThrow(/P-256/);
    });

    it('media configuración es un error, no un par efímero silencioso', () => {
        const { privateKey } = parEC();
        expect(() => cargarCon({
            NODE_ENV: 'development', OAUTH_JWT_PRIVATE_KEY: b64(privateKey), OAUTH_JWT_PUBLIC_KEY: undefined,
        })).toThrow(/deben venir las dos/);
    });
});

describe('oauthTokens — PKCE', () => {
    const mod = cargarCon({});

    it('acepta el verifier cuyo S256 coincide', () => {
        const verifier = 'a'.repeat(50);
        expect(mod.verificarPkce(verifier, mod.retoDesdeVerifier(verifier))).toBe(true);
    });

    it('rechaza verifier corto, con caracteres fuera del RFC o que no coincide', () => {
        const reto = mod.retoDesdeVerifier('a'.repeat(50));
        expect(mod.verificarPkce('a'.repeat(42), mod.retoDesdeVerifier('a'.repeat(42)))).toBe(false);
        expect(mod.verificarPkce(`${'a'.repeat(49)}!`, reto)).toBe(false);
        expect(mod.verificarPkce('b'.repeat(50), reto)).toBe(false);
        expect(mod.verificarPkce(undefined, reto)).toBe(false);
    });
});
