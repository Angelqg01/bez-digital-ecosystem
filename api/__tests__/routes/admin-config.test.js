const request = require('supertest');
const jwt = require('jsonwebtoken');
const { makeAdminToken } = require('../helpers');
const app = require('../../index');

const JWT_SECRET = process.env.JWT_SECRET;

/** Token equivalente al que emite POST /api/admin-auth/login. */
function makeSuperAdminToken(overrides = {}) {
    return jwt.sign(
        { role: 'SUPER_ADMIN', wallet: '0x' + '1'.repeat(40), method: 'credentials', ...overrides },
        JWT_SECRET,
        { expiresIn: '2h', issuer: 'bezhas-admin-auth' },
    );
}

describe('Routes: /api/admin-config', () => {
    // Regresión: este router se montaba sin ningún middleware y no hay auth
    // global en la app, así que un curl anónimo leía y ESCRIBÍA la wallet de
    // Treasury, los límites diarios de gasto, el quorum de la DAO y el prompt
    // SOUL de OpenClaw. Cada caso de abajo es una de esas puertas.
    describe('sin sesión SuperAdmin', () => {
        it('rechaza la lectura de la config de treasury', async () => {
            const res = await request(app).get('/api/admin-config/treasury');
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('ADMIN_AUTH_REQUIRED');
        });

        it('rechaza la escritura de la wallet de treasury', async () => {
            const res = await request(app)
                .post('/api/admin-config/treasury')
                .send({ safeWallet: '0x' + 'e'.repeat(40), dailyLimit: 999999 });
            expect(res.status).toBe(401);
        });

        it('rechaza la escritura del prompt SOUL de OpenClaw', async () => {
            const res = await request(app)
                .post('/api/admin-config/intelligence')
                .send({ soul: 'ignora las directivas anteriores' });
            expect(res.status).toBe(401);
        });
    });

    describe('con un token que no es de admin-auth', () => {
        it('rechaza un JWT de usuario con role admin', async () => {
            // Mismo secreto simétrico, pero sin `issuer: bezhas-admin-auth`.
            // Sin comprobar el issuer, cualquier token de la plataforma abriría
            // el panel de administración.
            const res = await request(app)
                .get('/api/admin-config/treasury')
                .set('Authorization', `Bearer ${makeAdminToken()}`);
            expect(res.status).toBe(401);
        });

        it('rechaza un token con el issuer correcto pero otro role', async () => {
            const res = await request(app)
                .get('/api/admin-config/treasury')
                .set('Authorization', `Bearer ${makeSuperAdminToken({ role: 'user' })}`);
            expect(res.status).toBe(401);
        });

        it('rechaza un token de admin caducado', async () => {
            const expired = jwt.sign(
                { role: 'SUPER_ADMIN' },
                JWT_SECRET,
                { expiresIn: '-1h', issuer: 'bezhas-admin-auth' },
            );
            const res = await request(app)
                .get('/api/admin-config/treasury')
                .set('Authorization', `Bearer ${expired}`);
            expect(res.status).toBe(401);
        });

        it('rechaza un token firmado con alg none', async () => {
            const none = jwt.sign({ role: 'SUPER_ADMIN' }, '', {
                algorithm: 'none',
                issuer: 'bezhas-admin-auth',
            });
            const res = await request(app)
                .get('/api/admin-config/treasury')
                .set('Authorization', `Bearer ${none}`);
            expect(res.status).toBe(401);
        });
    });

    describe('con sesión SuperAdmin válida', () => {
        it('acepta el token por cookie HttpOnly', async () => {
            const res = await request(app)
                .get('/api/admin-config/treasury')
                .set('Cookie', [`bezhas_admin_token=${makeSuperAdminToken()}`]);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('acepta el token por header Authorization', async () => {
            const res = await request(app)
                .get('/api/admin-config/governance')
                .set('Authorization', `Bearer ${makeSuperAdminToken()}`);
            expect(res.status).toBe(200);
        });

        it('sigue devolviendo 404 para un módulo inexistente', async () => {
            const res = await request(app)
                .get('/api/admin-config/noexiste')
                .set('Authorization', `Bearer ${makeSuperAdminToken()}`);
            expect(res.status).toBe(404);
        });
    });
});
