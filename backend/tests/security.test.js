/**
 * ============================================================================
 * PRUEBAS DE SEGURIDAD - Plataforma Web3 BeZhas
 * ============================================================================
 *
 * Este fichero **no era una suite de Jest**: era un script suelto que se
 * ejecutaba al importarse, abría sockets contra `localhost:3001` y `:3002`,
 * imprimía un informe con colores y terminaba llamando a `process.exit()`
 * —dentro de Jest, eso mata al worker—. Como no había servidores levantados,
 * cada ejecución agotaba su propio timeout de 5 s.
 *
 * Y lo que comprobaba era en buena parte tautológico: el «test» de rate
 * limiting devolvía `true` pasara lo que pasara, y las comprobaciones de
 * producción se saltan solas cuando `NODE_ENV !== 'production'`, que es
 * siempre en pruebas. Una señal que no puede ponerse roja no es una señal.
 *
 * Aquí se comprueban las mismas invariantes, pero sobre el código y sin
 * servidores: se invoca directamente el middleware de autenticación de
 * Socket.IO, el limitador de conexiones y los verificadores de administración,
 * y se simula `NODE_ENV=production` para ejercitar de verdad las rutas de
 * producción, que es justo lo que el script original nunca llegaba a ejecutar.
 */

const jwt = require('jsonwebtoken');

const SECRETO_PRUEBAS = process.env.JWT_SECRET;

/** Socket de mentira con la forma que leen los middlewares. */
function socketFalso({ token, headers = {}, address = '10.0.0.1', query = {} } = {}) {
    return {
        id: `socket_${Math.random().toString(36).slice(2)}`,
        handshake: {
            auth: token === undefined ? {} : { token },
            query,
            headers,
            address,
        },
        conn: { remoteAddress: address },
    };
}

/** Ejecuta un middleware de Socket.IO y devuelve el error con el que llamó a next(). */
function ejecutar(middleware, socket) {
    return new Promise((resolve) => {
        middleware(socket, (err) => resolve(err || null));
    });
}

describe('Autenticación del socket de chat', () => {
    const { authenticationMiddleware, resolveChatJwtSecret } = require('../chat/socketHandlers');

    const NODE_ENV_ORIGINAL = process.env.NODE_ENV;
    const JWT_SECRET_ORIGINAL = process.env.JWT_SECRET;

    afterEach(() => {
        process.env.NODE_ENV = NODE_ENV_ORIGINAL;
        if (JWT_SECRET_ORIGINAL === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = JWT_SECRET_ORIGINAL;
    });

    it('rechaza una conexión sin token', async () => {
        const error = await ejecutar(authenticationMiddleware, socketFalso());
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/Authentication required/);
    });

    it('rechaza un token con basura', async () => {
        const error = await ejecutar(authenticationMiddleware, socketFalso({ token: 'esto-no-es-un-jwt' }));
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/Invalid or expired token/);
    });

    it('rechaza un token firmado con otro secreto', async () => {
        const ajeno = jwt.sign({ id: 'atacante' }, 'otro-secreto-cualquiera', { expiresIn: '1h' });
        const error = await ejecutar(authenticationMiddleware, socketFalso({ token: ajeno }));
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/Invalid or expired token/);
    });

    it('rechaza un token caducado', async () => {
        const caducado = jwt.sign({ id: 'usuario' }, SECRETO_PRUEBAS, { expiresIn: '-1h' });
        const error = await ejecutar(authenticationMiddleware, socketFalso({ token: caducado }));
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(/Invalid or expired token/);
    });

    it('acepta un token válido y cuelga la identidad del socket', async () => {
        const valido = jwt.sign(
            { id: 'usuario_1234567890', walletAddress: '0xabc', username: 'ana' },
            SECRETO_PRUEBAS,
            { expiresIn: '1h' }
        );
        const socket = socketFalso({ token: valido });

        const error = await ejecutar(authenticationMiddleware, socket);

        expect(error).toBeNull();
        expect(socket.userId).toBe('usuario_1234567890');
        expect(socket.walletAddress).toBe('0xabc');
        expect(socket.username).toBe('ana');
    });

    describe('secreto de verificación', () => {
        it('en producción exige JWT_SECRET: sin él no hay secreto por defecto', () => {
            process.env.NODE_ENV = 'production';
            delete process.env.JWT_SECRET;

            // Antes devolvía 'bezhas_super_secret_key_change_in_production', una
            // cadena publicada en este mismo repositorio: cualquiera podía
            // firmarse un token de chat válido con ella.
            expect(resolveChatJwtSecret()).toBeNull();
        });

        it('en producción sin secreto la conexión se rechaza, no se acepta a ciegas', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.JWT_SECRET;

            const conElSecretoFiltrado = jwt.sign(
                { id: 'atacante' },
                'bezhas_super_secret_key_change_in_production',
                { expiresIn: '1h' }
            );

            const error = await ejecutar(
                authenticationMiddleware,
                socketFalso({ token: conElSecretoFiltrado })
            );
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toMatch(/configuration/i);
        });

        it('en producción con JWT_SECRET configurado usa ese', () => {
            process.env.NODE_ENV = 'production';
            process.env.JWT_SECRET = 'secreto-de-produccion';
            expect(resolveChatJwtSecret()).toBe('secreto-de-produccion');
        });

        it('fuera de producción admite el secreto de desarrollo', () => {
            process.env.NODE_ENV = 'development';
            delete process.env.JWT_SECRET;
            expect(resolveChatJwtSecret()).toBe('bezhas_super_secret_key_change_in_production');
        });
    });
});

describe('Limitador de conexiones de Socket.IO', () => {
    const ConnectionRateLimiter = require('../chat/connectionRateLimiter');

    it('deja pasar las conexiones dentro del límite y bloquea las que sobran', async () => {
        const limitador = new ConnectionRateLimiter({ maxConnections: 3, windowMs: 60000 });
        const middleware = limitador.middleware();

        const resultados = [];
        for (let i = 0; i < 5; i++) {
            resultados.push(await ejecutar(middleware, socketFalso({ address: '203.0.113.7' })));
        }

        expect(resultados.slice(0, 3).every((r) => r === null)).toBe(true);
        expect(resultados[3]).toBeInstanceOf(Error);
        expect(resultados[3].message).toMatch(/Too many connection attempts/);
        expect(resultados[4]).toBeInstanceOf(Error);
    });

    it('cuenta por IP: una dirección saturada no bloquea a las demás', async () => {
        const limitador = new ConnectionRateLimiter({ maxConnections: 2, windowMs: 60000 });
        const middleware = limitador.middleware();

        await ejecutar(middleware, socketFalso({ address: '203.0.113.8' }));
        await ejecutar(middleware, socketFalso({ address: '203.0.113.8' }));
        const bloqueada = await ejecutar(middleware, socketFalso({ address: '203.0.113.8' }));
        const otraIp = await ejecutar(middleware, socketFalso({ address: '203.0.113.9' }));

        expect(bloqueada).toBeInstanceOf(Error);
        expect(otraIp).toBeNull();
    });

    it('prefiere x-forwarded-for, que es lo que ve detrás de un proxy', async () => {
        const limitador = new ConnectionRateLimiter({ maxConnections: 1, windowMs: 60000 });
        const middleware = limitador.middleware();

        // Misma dirección de socket (el proxy), clientes distintos.
        const proxy = { address: '10.0.0.1' };
        const primero = await ejecutar(
            middleware,
            socketFalso({ ...proxy, headers: { 'x-forwarded-for': '198.51.100.1' } })
        );
        const segundo = await ejecutar(
            middleware,
            socketFalso({ ...proxy, headers: { 'x-forwarded-for': '198.51.100.2' } })
        );
        const repetido = await ejecutar(
            middleware,
            socketFalso({ ...proxy, headers: { 'x-forwarded-for': '198.51.100.1' } })
        );

        expect(primero).toBeNull();
        expect(segundo).toBeNull();
        expect(repetido).toBeInstanceOf(Error);
    });

    it('se puede desactivar explícitamente', async () => {
        const limitador = new ConnectionRateLimiter({ maxConnections: 1, enabled: false });
        const middleware = limitador.middleware();

        for (let i = 0; i < 5; i++) {
            expect(await ejecutar(middleware, socketFalso({ address: '203.0.113.10' }))).toBeNull();
        }
    });
});

describe('Protección del bypass de administración', () => {
    const NODE_ENV_ORIGINAL = process.env.NODE_ENV;
    const BYPASS_ORIGINAL = process.env.AUTH_BYPASS_ENABLED;

    afterEach(() => {
        process.env.NODE_ENV = NODE_ENV_ORIGINAL;
        if (BYPASS_ORIGINAL === undefined) delete process.env.AUTH_BYPASS_ENABLED;
        else process.env.AUTH_BYPASS_ENABLED = BYPASS_ORIGINAL;
        jest.resetModules();
    });

    /** Ejecuta verifyAdminJWT contra una petición de mentira. */
    async function pedirComoAdmin({ token } = {}) {
        const verifyAdminJWT = require('../middleware/verifyAdminJWT');
        const req = { headers: token ? { authorization: `Bearer ${token}` } : {}, body: {}, query: {} };
        let estado = null;
        let cuerpo = null;
        let siguiente = false;
        const res = {
            status(c) { estado = c; return this; },
            json(b) { cuerpo = b; return this; },
        };
        await verifyAdminJWT(req, res, () => { siguiente = true; });
        return { estado, cuerpo, siguiente, req };
    }

    it('sin token no se entra', async () => {
        const { estado, siguiente } = await pedirComoAdmin();
        expect(siguiente).toBe(false);
        expect(estado).toBe(401);
    });

    it('el bypass NO se activa en producción aunque AUTH_BYPASS_ENABLED=true', async () => {
        process.env.NODE_ENV = 'production';
        process.env.AUTH_BYPASS_ENABLED = 'true';
        jest.resetModules();

        const { estado, siguiente } = await pedirComoAdmin();

        expect(siguiente).toBe(false);
        expect(estado).toBe(401);
    });

    it('el bypass tampoco se activa en desarrollo si falta la bandera explícita', async () => {
        process.env.NODE_ENV = 'development';
        delete process.env.AUTH_BYPASS_ENABLED;
        jest.resetModules();

        const { estado, siguiente } = await pedirComoAdmin();

        expect(siguiente).toBe(false);
        expect(estado).toBe(401);
    });

    it('un token de administrador sin 2FA no pasa', async () => {
        const sin2FA = jwt.sign({ id: 'admin', role: 'admin' }, SECRETO_PRUEBAS, { expiresIn: '1h' });
        const { estado, cuerpo, siguiente } = await pedirComoAdmin({ token: sin2FA });

        expect(siguiente).toBe(false);
        expect(estado).toBe(403);
        expect(String(cuerpo.error)).toMatch(/2FA/i);
    });

    it('un token de administrador con 2FA sí pasa', async () => {
        const completo = jwt.sign(
            { id: 'admin', role: 'admin', twoFactorVerified: true },
            SECRETO_PRUEBAS,
            { expiresIn: '1h' }
        );
        const { siguiente, req } = await pedirComoAdmin({ token: completo });

        expect(siguiente).toBe(true);
        expect(req.admin).toBeDefined();
    });

    it('un token de usuario normal no pasa por administrador', async () => {
        const usuario = jwt.sign(
            { id: 'u1', role: 'user', twoFactorVerified: true },
            SECRETO_PRUEBAS,
            { expiresIn: '1h' }
        );
        const { siguiente } = await pedirComoAdmin({ token: usuario });

        expect(siguiente).toBe(false);
    });
});

describe('Configuración sensible', () => {
    const NODE_ENV_ORIGINAL = process.env.NODE_ENV;
    const JWT_SECRET_ORIGINAL = process.env.JWT_SECRET;

    afterEach(() => {
        process.env.NODE_ENV = NODE_ENV_ORIGINAL;
        if (JWT_SECRET_ORIGINAL === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = JWT_SECRET_ORIGINAL;
        jest.resetModules();
    });

    it('el verificador de admin nunca autentica en producción sin JWT_SECRET', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        jest.resetModules();

        const verifyAdminJWT = require('../middleware/verifyAdminJWT');
        const token = jwt.sign({ id: 'admin', role: 'admin', twoFactorVerified: true }, 'lo-que-sea');
        const req = { headers: { authorization: `Bearer ${token}` }, body: {}, query: {} };
        let siguiente = false;
        const res = { status() { return this; }, json() { return this; } };

        // Puede rechazar o lanzar; lo que no puede es dejar pasar con un
        // secreto adivinable.
        try {
            await verifyAdminJWT(req, res, () => { siguiente = true; });
        } catch (_) { /* lanzar también es una negativa válida */ }

        expect(siguiente).toBe(false);
    });

    it('ningún fichero de entorno de ejemplo trae secretos reales', () => {
        const fs = require('fs');
        const path = require('path');
        const ejemplos = ['.env.example', '.env.sample', '.env.template']
            .map((f) => path.join(__dirname, '..', f))
            .filter((f) => fs.existsSync(f));

        for (const fichero of ejemplos) {
            const contenido = fs.readFileSync(fichero, 'utf8');
            // Claves de Stripe en vivo y claves privadas nunca deben aparecer.
            expect(contenido).not.toMatch(/sk_live_[A-Za-z0-9]/);
            expect(contenido).not.toMatch(/-----BEGIN (RSA |EC )?PRIVATE KEY-----/);
        }
    });
});
