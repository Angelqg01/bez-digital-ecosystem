const request = require('supertest');
const jwt = require('jsonwebtoken');
const { mockQuery, mockCacheGet, mockCacheSet, makeAdminToken } = require('../helpers');
const app = require('../../index');

const JWT_SECRET = process.env.JWT_SECRET;

function superAdminCookie() {
    const token = jwt.sign(
        { role: 'SUPER_ADMIN', wallet: '0x' + '1'.repeat(40), method: 'credentials' },
        JWT_SECRET,
        { expiresIn: '2h', issuer: 'bezhas-admin-auth' },
    );
    return [`bezhas_admin_token=${token}`];
}

/**
 * Todos estos endpoints los llamaba el panel SuperAdmin sin que existieran:
 * devolvían 404 y cada pestaña lo tragaba pintando ceros, listas vacías o
 * datos de relleno. Cada bloque cubre uno.
 */
describe('Endpoints del panel SuperAdmin', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /api/analytics/ai-logs', () => {
        it('exige sesión SuperAdmin', async () => {
            const res = await request(app).get('/api/analytics/ai-logs');
            expect(res.status).toBe(401);
        });

        it('no acepta un JWT de usuario normal con role admin', async () => {
            const res = await request(app)
                .get('/api/analytics/ai-logs')
                .set('Authorization', `Bearer ${makeAdminToken()}`);
            expect(res.status).toBe(401);
        });

        it('traduce la severidad al vocabulario del panel', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [
                { id: '1', module: 'aegis', action: 'x', severity: 'warning', input_data: {}, created_at: new Date() },
                { id: '2', module: 'aegis', action: 'y', severity: 'critical', input_data: {}, created_at: new Date() },
                { id: '3', module: 'aegis', action: 'z', severity: 'info', input_data: {}, created_at: new Date() },
            ] });
            const res = await request(app).get('/api/analytics/ai-logs').set('Cookie', superAdminCookie());
            expect(res.status).toBe(200);
            expect(res.body.rows.map(r => r.severity)).toEqual(['warn', 'error', 'info']);
        });

        it('saca la wallet de input_data y cae a "system" si no hay actor', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [
                { id: '1', module: 'a', action: 'x', severity: 'info', input_data: { wallet: '0xabc' }, created_at: new Date() },
                { id: '2', module: 'b', action: 'y', severity: 'info', input_data: {}, created_at: new Date() },
            ] });
            const res = await request(app).get('/api/analytics/ai-logs').set('Cookie', superAdminCookie());
            expect(res.body.rows.map(r => r.wallet_address)).toEqual(['0xabc', 'system']);
        });

        it('acota el limit para que no se pueda pedir la tabla entera', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/api/analytics/ai-logs?limit=99999').set('Cookie', superAdminCookie());
            expect(res.body.limit).toBe(200);
        });
    });

    describe('GET /api/sectors/rwa-factory-stats', () => {
        it('no lo intercepta el comodín /:sector', async () => {
            // Regresión de orden de rutas: colgado después de router.get('/:sector'),
            // el comodín se queda 'rwa-factory-stats' como nombre de sector.
            mockCacheGet.mockResolvedValueOnce(null);
            mockQuery.mockResolvedValueOnce({ rows: [{ total: 7, types: 2, last_30d: 1 }] });
            const res = await request(app).get('/api/sectors/rwa-factory-stats').set('Cookie', superAdminCookie());
            expect(res.status).toBe(200);
            expect(res.body.stats).toBeDefined();
            expect(res.body.stats.total_rwa_assets).toBe(7);
        });

        it('devuelve null —no 0— para la liquidez, que no tiene fuente', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockQuery.mockResolvedValueOnce({ rows: [{ total: 0, types: 0, last_30d: 0 }] });
            const res = await request(app).get('/api/sectors/rwa-factory-stats').set('Cookie', superAdminCookie());
            expect(res.body.stats.locked_liquidity_usd).toBeNull();
            expect(res.body.sources.locked_liquidity_usd).toMatch(/unavailable/);
        });

        it('exige sesión SuperAdmin', async () => {
            expect((await request(app).get('/api/sectors/rwa-factory-stats')).status).toBe(401);
        });
    });

    describe('POST /api/sectors/rwa-factory-pause', () => {
        it('rechaza un valor que no sea booleano', async () => {
            const res = await request(app)
                .post('/api/sectors/rwa-factory-pause')
                .set('Cookie', superAdminCookie())
                .send({ pause: 'si' });
            expect(res.status).toBe(400);
        });

        it('devuelve 503 si no se pudo persistir', async () => {
            // Contestar 200 sin haber guardado deja el panel pintando
            // "pausado" sobre una factoría que sigue activa.
            mockCacheGet.mockResolvedValueOnce(null);
            mockCacheSet.mockResolvedValueOnce(false);
            const res = await request(app)
                .post('/api/sectors/rwa-factory-pause')
                .set('Cookie', superAdminCookie())
                .send({ pause: true });
            expect(res.status).toBe(503);
        });
    });

    describe('/api/ai-control/aegis-config', () => {
        it('devuelve los valores por defecto cuando no hay nada guardado', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            const res = await request(app).get('/api/ai-control/aegis-config').set('Cookie', superAdminCookie());
            expect(res.status).toBe(200);
            expect(res.body.config.vision_model).toBe('gemini-2.0-flash');
        });

        it('rechaza gemini-1.5-flash, deprecado en el proyecto', async () => {
            const res = await request(app)
                .put('/api/ai-control/aegis-config')
                .set('Cookie', superAdminCookie())
                .send({ config: { confidence_threshold: 80, vision_model: 'gemini-1.5-flash', auto_pause_on_failure: true } });
            expect(res.status).toBe(400);
            expect(res.body.allowed).toContain('gemini-2.0-flash');
        });

        it('rechaza un umbral fuera de 0..100', async () => {
            const res = await request(app)
                .put('/api/ai-control/aegis-config')
                .set('Cookie', superAdminCookie())
                .send({ config: { confidence_threshold: 150, vision_model: 'gpt-4o', auto_pause_on_failure: true } });
            expect(res.status).toBe(400);
        });

        it('guarda una configuración válida', async () => {
            mockCacheSet.mockResolvedValueOnce(true);
            const res = await request(app)
                .put('/api/ai-control/aegis-config')
                .set('Cookie', superAdminCookie())
                .send({ config: { confidence_threshold: 92, vision_model: 'gpt-4o', auto_pause_on_failure: false } });
            expect(res.status).toBe(200);
            expect(res.body.config.confidence_threshold).toBe(92);
        });
    });

    describe('GET /api/user (listado RBAC)', () => {
        it('exige sesión SuperAdmin — expone wallets y correos de todos', async () => {
            expect((await request(app).get('/api/user?limit=10')).status).toBe(401);
        });

        it('trata role=all como "sin filtro", no como un rol literal', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: '1', username: 'a', role: 'user' }] })
                .mockResolvedValueOnce({ rows: [{ total: 1 }] });
            const res = await request(app).get('/api/user?limit=10&role=all').set('Cookie', superAdminCookie());
            expect(res.status).toBe(200);
            // Sin filtro: la consulta de listado no lleva ningún parámetro de rol.
            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).not.toMatch(/WHERE role/);
            expect(params).toEqual([10, 0]);
        });

        it('filtra de verdad cuando se pide un rol concreto', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ total: 0 }] });
            await request(app).get('/api/user?role=enterprise').set('Cookie', superAdminCookie());
            const [sql, params] = mockQuery.mock.calls[0];
            expect(sql).toMatch(/WHERE role = \$1/);
            expect(params[0]).toBe('enterprise');
        });
    });

    describe('GET /api/admin/governance/proposals', () => {
        it('exige sesión SuperAdmin', async () => {
            expect((await request(app).get('/api/admin/governance/proposals')).status).toBe(401);
        });

        it('distingue "sin propuestas" de "módulo sin desplegar"', async () => {
            mockQuery.mockRejectedValueOnce(new Error('relation "governance_proposals" does not exist'));
            const res = await request(app).get('/api/admin/governance/proposals').set('Cookie', superAdminCookie());
            expect(res.status).toBe(200);
            expect(res.body.available).toBe(false);

            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res2 = await request(app).get('/api/admin/governance/proposals').set('Cookie', superAdminCookie());
            expect(res2.body.available).toBeUndefined();
        });
    });
});
