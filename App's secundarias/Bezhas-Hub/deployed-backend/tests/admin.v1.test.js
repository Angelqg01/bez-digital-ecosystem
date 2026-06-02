const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, server } = require('../server');

const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key';

function makeAdminToken() {
    const payload = { id: 'admin_test', role: 'admin' };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

describe('Admin v1 API', () => {
    const token = makeAdminToken();
    const auth = { Authorization: `Bearer ${token}` };

    afterAll((done) => {
        try { server.close(() => done()); } catch (_) { done(); }
    });

    it('GET /api/admin/v1/stats should return stats object', async () => {
        const res = await request(app).get('/api/admin/v1/stats').set(auth).expect(200);
        expect(res.body).toHaveProperty('totalUsers');
        expect(res.body).toHaveProperty('totalPosts');
        expect(res.body).toHaveProperty('totalGroups');
        expect(res.body).toHaveProperty('activeUsers24h');
    });

    it('GET /api/admin/v1/users should return users list', async () => {
        const res = await request(app).get('/api/admin/v1/users').set(auth).expect(200);
        expect(res.body).toHaveProperty('users');
        expect(Array.isArray(res.body.users)).toBe(true);
        expect(res.body).toHaveProperty('total');
    });
});
