const request = require('supertest');
const jwt = require('jsonwebtoken');
const { mockQuery, makeToken, makeAdminToken } = require('../helpers');
const app = require('../../index');
const { isValidBezhasId } = require('../../lib/bezhasId');

const VALID_ADDR = '0x' + 'f'.repeat(40);

describe('Routes: /api/auth', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('POST /refresh', () => {
        // El endpoint reconstruye el payload desde la BD en vez de copiarlo del
        // token entrante, así que hay que darle una fila.
        const dbUser = {
            id: 1,
            wallet_address: VALID_ADDR,
            primary_wallet_address: VALID_ADDR,
            role: 'user',
            auth_type: 'wallet',
            bezhas_id: 'BZ-K4R7M2X9PQ',
        };

        it('returns a new token for authenticated user', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [dbUser] });
            const token = makeToken();
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
        });

        it('keeps bezhas_id and auth_type in the refreshed token', async () => {
            // Regresión: el token renovado se emitía sin bezhas_id, así que tras
            // el primer refresh la sesión perdía su identidad canónica y las
            // SubApps dejaban de reconocer al usuario.
            mockQuery.mockResolvedValueOnce({ rows: [dbUser] });
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${makeToken()}`);

            const decoded = jwt.decode(res.body.token);
            expect(decoded.bezhas_id).toBe('BZ-K4R7M2X9PQ');
            expect(decoded.auth_type).toBe('wallet');
            expect(decoded.userId).toBe(1);
        });

        it('reads role from the DB, not from the incoming token', async () => {
            // Si a alguien se le degrada el rol, el refresh no debe devolverle
            // el que llevaba en el token viejo.
            mockQuery.mockResolvedValueOnce({ rows: [{ ...dbUser, role: 'user' }] });
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${makeAdminToken()}`);

            expect(jwt.decode(res.body.token).role).toBe('user');
        });

        it('emits a BeZhas_ID for a legacy row that still has none', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ ...dbUser, bezhas_id: null }] })
                .mockResolvedValueOnce({ rows: [] }); // el UPDATE que lo persiste
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${makeToken()}`);

            expect(res.status).toBe(200);
            expect(isValidBezhasId(jwt.decode(res.body.token).bezhas_id)).toBe(true);
        });

        it('returns 401 if the user no longer exists', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${makeToken()}`);
            expect(res.status).toBe(401);
        });

        it('returns 401 without token', async () => {
            const res = await request(app).post('/api/auth/refresh');
            expect(res.status).toBe(401);
        });
    });
});

describe('Routes: /api/user', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /profile/:address', () => {
        it('returns user profile', async () => {
            const user = { wallet_address: VALID_ADDR, username: 'test', nfts_owned: '5', tokens_staked: '100' };
            mockQuery.mockResolvedValueOnce({ rows: [user] });
            const res = await request(app).get(`/api/user/profile/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.wallet_address).toBe(VALID_ADDR);
            expect(res.body.bez_balance).toBeDefined();
        });

        it('returns 404 for unknown address', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get(`/api/user/profile/${VALID_ADDR}`);
            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid address', async () => {
            const res = await request(app).get('/api/user/profile/notanaddress');
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /profile', () => {
        it('updates profile with valid token', async () => {
            const token = makeToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ wallet_address: VALID_ADDR, username: 'newname' }] });
            const res = await request(app)
                .put('/api/user/profile')
                .set('Authorization', `Bearer ${token}`)
                .send({ username: 'newname' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('returns 401 without token', async () => {
            const res = await request(app).put('/api/user/profile').send({ username: 'test' });
            expect(res.status).toBe(401);
        });

        it('returns 400 with nothing to update', async () => {
            const token = makeToken();
            const res = await request(app)
                .put('/api/user/profile')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });
    });
});
