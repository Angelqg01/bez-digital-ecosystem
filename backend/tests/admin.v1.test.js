const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, server } = require('../server');

/**
 * Esta suite fallaba con 403 en las dos pruebas. No era un fallo del servidor:
 * el token que firmaba llevaba solo `{ id, role: 'admin' }`, y desde el
 * endurecimiento de `middleware/admin.middleware.js` y
 * `middleware/verifyAdminJWT.js` un token de administrador sin
 * `twoFactorVerified` (ni `bootstrap`) se rechaza a propósito.
 *
 * Es decir: la prueba llevaba tiempo describiendo una política de acceso que
 * ya no es la vigente. Se actualiza al contrato real y, de paso, se fija ese
 * contrato con pruebas negativas: sin 2FA, sin token y con rol de usuario
 * normal no se entra.
 */

// `tests/setup.js` fija JWT_SECRET; el `||` solo cubre una ejecución suelta.
const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key';

function firmar(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/** Token que cumple la política vigente: rol administrativo + 2FA verificado. */
function makeAdminToken(extra = {}) {
    return firmar({ id: 'admin_test', role: 'admin', twoFactorVerified: true, ...extra });
}

describe('Admin v1 API', () => {
    const auth = { Authorization: `Bearer ${makeAdminToken()}` };

    afterAll((done) => {
        try { server.close(() => done()); } catch (_) { done(); }
    });

    describe('Control de acceso', () => {
        it('rechaza con 401 si no hay token', async () => {
            const res = await request(app).get('/api/admin/v1/stats');
            expect(res.status).toBe(401);
        });

        it('rechaza con 403 un token de administrador sin 2FA', async () => {
            const sin2FA = firmar({ id: 'admin_test', role: 'admin' });
            const res = await request(app)
                .get('/api/admin/v1/stats')
                .set({ Authorization: `Bearer ${sin2FA}` });
            expect(res.status).toBe(403);
            expect(String(res.body.error)).toMatch(/2FA/i);
        });

        it('rechaza con 403 un token de usuario normal, aunque lleve 2FA', async () => {
            const usuario = firmar({ id: 'user_test', role: 'user', twoFactorVerified: true });
            const res = await request(app)
                .get('/api/admin/v1/stats')
                .set({ Authorization: `Bearer ${usuario}` });
            expect(res.status).toBe(403);
        });

        it('rechaza con 403 un token firmado con otro secreto', async () => {
            const falso = jwt.sign(
                { id: 'admin_test', role: 'admin', twoFactorVerified: true },
                'secreto-que-no-es-el-nuestro',
                { expiresIn: '1h' }
            );
            const res = await request(app)
                .get('/api/admin/v1/stats')
                .set({ Authorization: `Bearer ${falso}` });
            expect(res.status).toBe(403);
        });

        it('acepta el token administrativo completo, que es el caso bueno', async () => {
            const res = await request(app).get('/api/admin/v1/stats').set(auth);
            expect(res.status).toBe(200);
        });
    });

    describe('Endpoints', () => {
        it('GET /api/admin/v1/stats devuelve el objeto de estadísticas', async () => {
            const res = await request(app).get('/api/admin/v1/stats').set(auth).expect(200);
            expect(res.body).toHaveProperty('totalUsers');
            expect(res.body).toHaveProperty('totalPosts');
            expect(res.body).toHaveProperty('totalGroups');
            expect(res.body).toHaveProperty('activeUsers24h');
        });

        it('GET /api/admin/v1/users devuelve la lista de usuarios', async () => {
            const res = await request(app).get('/api/admin/v1/users').set(auth).expect(200);
            expect(res.body).toHaveProperty('users');
            expect(Array.isArray(res.body.users)).toBe(true);
            expect(res.body).toHaveProperty('total');
        });

        it('GET /api/admin/v1/users respeta el parámetro limit', async () => {
            const res = await request(app)
                .get('/api/admin/v1/users?limit=5')
                .set(auth)
                .expect(200);
            expect(res.body.users.length).toBeLessThanOrEqual(5);
        });
    });
});
