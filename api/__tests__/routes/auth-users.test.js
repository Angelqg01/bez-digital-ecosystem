const request = require('supertest');
const { mockQuery, makeToken, makeAdminToken } = require('../helpers');
const app = require('../../index');

const VALID_ADDR = '0x' + 'f'.repeat(40);

describe('Routes: /api/auth', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('POST /refresh', () => {
        it('returns a new token for authenticated user', async () => {
            const token = makeToken();
            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
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
