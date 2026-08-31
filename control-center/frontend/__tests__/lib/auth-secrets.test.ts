/**
 * @jest-environment node
 */
import { readFileSync } from 'fs';
import path from 'path';

/**
 * auth-secrets tiene efectos al importarse: resuelve el secreto y lanza si la
 * configuración es insegura. Por eso cada caso lo vuelve a cargar aislado en vez
 * de importarlo una sola vez arriba.
 */
type AuthSecrets = typeof import('@/lib/auth-secrets');

const TOUCHED = ['NODE_ENV', 'JWT_SECRET', 'JWT_ACCESS_TTL'] as const;

function applyEnv(env: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
}

async function loadAuthSecrets(env: Record<string, string | undefined> = {}): Promise<AuthSecrets> {
    applyEnv(env);
    let mod!: AuthSecrets;
    await jest.isolateModulesAsync(async () => {
        mod = await import('@/lib/auth-secrets');
    });
    return mod;
}

let saved: Record<string, string | undefined>;

beforeEach(() => {
    saved = Object.fromEntries(TOUCHED.map((key) => [key, process.env[key]]));
});

afterEach(() => {
    applyEnv(saved);
});

describe('resolución del secreto', () => {
    it('fuera de producción cae al secreto de desarrollo', async () => {
        const { JWT_SECRET } = await loadAuthSecrets({
            NODE_ENV: 'development',
            JWT_SECRET: undefined,
        });

        expect(JWT_SECRET).toBe('dev-only-secret');
    });

    it('prefiere JWT_SECRET del entorno cuando existe', async () => {
        const { JWT_SECRET } = await loadAuthSecrets({
            NODE_ENV: 'development',
            JWT_SECRET: 'un-secreto-de-verdad',
        });

        expect(JWT_SECRET).toBe('un-secreto-de-verdad');
    });

    it('se niega a arrancar en producción sin JWT_SECRET', async () => {
        await expect(
            loadAuthSecrets({ NODE_ENV: 'production', JWT_SECRET: undefined }),
        ).rejects.toThrow(/falta JWT_SECRET en producción/);
    });

    it('se niega a arrancar en producción con el secreto de desarrollo', async () => {
        await expect(
            loadAuthSecrets({ NODE_ENV: 'production', JWT_SECRET: 'dev-only-secret' }),
        ).rejects.toThrow(/Rótalo antes de desplegar/);
    });

    it('arranca en producción con un secreto propio', async () => {
        const { JWT_SECRET } = await loadAuthSecrets({
            NODE_ENV: 'production',
            JWT_SECRET: 'secreto-rotado-de-produccion',
        });

        expect(JWT_SECRET).toBe('secreto-rotado-de-produccion');
    });
});

describe('vida del token', () => {
    it('por defecto son 24h, o sea 86400 segundos', async () => {
        const mod = await loadAuthSecrets({ NODE_ENV: 'development', JWT_ACCESS_TTL: undefined });

        expect(mod.JWT_ACCESS_TTL).toBe('24h');
        expect(mod.JWT_ACCESS_TTL_SECONDS).toBe(86400);
    });

    it.each([
        ['30s', 30],
        ['15m', 900],
        ['12h', 43200],
        ['7d', 604800],
        ['3600', 3600],
    ])('convierte %s a %i segundos', async (ttl, expected) => {
        const mod = await loadAuthSecrets({ NODE_ENV: 'development', JWT_ACCESS_TTL: ttl });

        expect(mod.JWT_ACCESS_TTL_SECONDS).toBe(expected);
    });

    it('tolera espacios alrededor del valor', async () => {
        const mod = await loadAuthSecrets({ NODE_ENV: 'development', JWT_ACCESS_TTL: '  15m  ' });

        expect(mod.JWT_ACCESS_TTL_SECONDS).toBe(900);
    });

    it.each(['banana', '15x', '0', '-5m'])(
        'rechaza el TTL inservible %p en lugar de asumir un valor',
        async (ttl) => {
            await expect(
                loadAuthSecrets({ NODE_ENV: 'development', JWT_ACCESS_TTL: ttl }),
            ).rejects.toThrow(/JWT_ACCESS_TTL no reconocido/);
        },
    );

    it('un JWT_ACCESS_TTL vacío se trata como no definido y cae a 24h', async () => {
        const mod = await loadAuthSecrets({ NODE_ENV: 'development', JWT_ACCESS_TTL: '' });

        expect(mod.JWT_ACCESS_TTL).toBe('24h');
    });
});

/**
 * El Control Center emite tokens que otras Apps Nativas verifican. Si su fallback de
 * desarrollo se separa del de api/config/secrets.js, el SSO se rompe en local sin
 * dar ningún error: cada servicio firma con un secreto distinto y el token del uno
 * simplemente no valida en el otro. Ese fue el bug de 8d47f06 — este test evita
 * que vuelva por la puerta de atrás.
 */
describe('invariante con api/config/secrets.js', () => {
    const apiSecrets = readFileSync(
        path.resolve(__dirname, '../../../../api/config/secrets.js'),
        'utf8',
    );

    it('comparte el mismo fallback de desarrollo que la API', async () => {
        const { JWT_SECRET } = await loadAuthSecrets({
            NODE_ENV: 'development',
            JWT_SECRET: undefined,
        });

        expect(apiSecrets).toContain(`'${JWT_SECRET}'`);
        expect(JWT_SECRET).toBe('dev-only-secret');
    });

    it('comparte el mismo TTL por defecto que la API', async () => {
        const mod = await loadAuthSecrets({ NODE_ENV: 'development', JWT_ACCESS_TTL: undefined });

        expect(apiSecrets).toContain(`JWT_ACCESS_TTL || '${mod.JWT_ACCESS_TTL}'`);
    });
});
