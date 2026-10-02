const fs = require('fs');
const path = require('path');

const load = () => { jest.resetModules(); return require('../../config/jwtSecret'); };
const withEnv = (vars, fn) => {
    const saved = { ...process.env };
    Object.assign(process.env, vars);
    for (const k of Object.keys(vars)) if (vars[k] === undefined) delete process.env[k];
    try { return fn(); } finally { process.env = saved; }
};

describe('config/jwtSecret', () => {
    test('usa JWT_SECRET si está configurado', () => {
        withEnv({ JWT_SECRET: 'a'.repeat(40), NODE_ENV: 'production' }, () => expect(load().getJwtSecret()).toBe('a'.repeat(40)));
    });

    test('producción sin secreto o con valor de plantilla: lanza error (no hay valor por defecto)', () => {
        withEnv({ JWT_SECRET: undefined, NODE_ENV: 'production' }, () => expect(() => load().getJwtSecret()).toThrow());
        for (const v of ['default-secret-key', 'change-me-dev-jwt-secret', 'bezhas_super_secret_key', 'your-super-secret-jwt-key-change-this-in-production-min-32-chars']) {
            withEnv({ JWT_SECRET: v, NODE_ENV: 'production' }, () => expect(() => load().getJwtSecret()).toThrow());
        }
    });

    test('desarrollo sin secreto: aleatorio, estable en el proceso y distinto entre procesos', () => {
        const a = withEnv({ JWT_SECRET: undefined, NODE_ENV: 'test' }, () => { const m = load(); return [m.getJwtSecret(), m.getJwtSecret()]; });
        const b = withEnv({ JWT_SECRET: undefined, NODE_ENV: 'test' }, () => load().getJwtSecret());
        expect(a[0]).toBe(a[1]);
        expect(a[0]).not.toBe(b);
        expect(a[0]).toHaveLength(96);
        expect(a[0]).not.toMatch(/default|secret|change/i);
    });

    test('refresh: JWT_REFRESH_SECRET o derivado del JWT_SECRET (distinto de él)', () => {
        withEnv({ JWT_SECRET: 'k'.repeat(40), JWT_REFRESH_SECRET: undefined, NODE_ENV: 'production' }, () => {
            const m = load();
            expect(m.getRefreshSecret()).not.toBe(m.getJwtSecret());
            expect(m.getRefreshSecret()).toBe(m.getRefreshSecret());
        });
        withEnv({ JWT_SECRET: 'k'.repeat(40), JWT_REFRESH_SECRET: 'explicit', NODE_ENV: 'production' }, () => expect(load().getRefreshSecret()).toBe('explicit'));
    });
});

describe('no quedan secretos JWT por defecto en el código', () => {
    const roots = ['routes', 'middleware', 'services', 'chat', 'config', 'config.js', 'server.js'];
    const deployedRoots = roots.map((r) => path.join('..', 'deployed-backend', r));
    const walk = (p) => fs.statSync(p).isDirectory()
        ? fs.readdirSync(p).flatMap((f) => (f === 'node_modules' ? [] : walk(path.join(p, f))))
        : (p.endsWith('.js') ? [p] : []);

    test('ningún literal conocido como fallback de JWT_SECRET', () => {
        const bad = /JWT_SECRET\s*\|\|\s*['"`]|JWT_REFRESH_SECRET\s*\|\|\s*['"`]/;
        const offenders = [...roots, ...deployedRoots].flatMap((r) => walk(path.join(__dirname, '../..', r)))
            .filter((f) => bad.test(fs.readFileSync(f, 'utf8')));
        expect(offenders).toEqual([]);
    });
});

describe('deployed-backend: endpoints de wallet deshabilitados (fail closed)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../deployed-backend/routes/auth.routes.js'), 'utf8');

    test('login-or-register, login-wallet, register-wallet y nonce responden 410 antes de cualquier otra ruta', () => {
        const guard = src.indexOf("router.all(['/login-or-register', '/login-wallet', '/register-wallet', '/nonce']");
        const firstRoute = src.search(/router\.(get|post|put|delete)\(/);
        expect(guard).toBeGreaterThan(-1);
        expect(guard).toBeLessThan(firstRoute);
        expect(src).toMatch(/status\(410\)/);
    });

    test('server.js ya no expone el nonce Math.random ni el override sin SIWE', () => {
        const server = fs.readFileSync(path.join(__dirname, '../../../deployed-backend/server.js'), 'utf8');
        expect(server).not.toMatch(/usersDB|verifyWalletSignature|Math\.random\(\) \* 1000000/);
    });
});
