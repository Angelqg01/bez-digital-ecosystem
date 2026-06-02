const request = require('supertest');
const { mockQuery, mockPublish, makeToken } = require('../helpers');
const app = require('../../index');

const VALID_ADDR = '0x' + 'f'.repeat(40);
const RECIPIENT_ADDR = '0x' + 'a'.repeat(40);

describe('Routes: /api/notifications', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /', () => {
        it('returns notifications for authenticated user', async () => {
            const token = makeToken();
            const rows = [{ id: 1, title: 'Test', type: 'message', is_read: false }];
            mockQuery.mockResolvedValueOnce({ rows });
            const res = await request(app)
                .get('/api/notifications')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.notifications).toEqual(rows);
        });

        it('returns 401 without token', async () => {
            const res = await request(app).get('/api/notifications');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /send', () => {
        it('sends notification to valid recipient', async () => {
            const token = makeToken();
            mockQuery
                .mockResolvedValueOnce({ rows: [{ id: 2 }] })  // resolve recipient
                .mockResolvedValueOnce({ rows: [{ id: 10, type: 'message', title: 'Hello', created_at: '2025-01-01' }] });
            const res = await request(app)
                .post('/api/notifications/send')
                .set('Authorization', `Bearer ${token}`)
                .send({ to: RECIPIENT_ADDR, type: 'message', title: 'Hello', message: 'World' });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockPublish).toHaveBeenCalledWith('notification:new', expect.objectContaining({ userId: 2 }));
        });

        it('returns 404 when recipient not found', async () => {
            const token = makeToken();
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app)
                .post('/api/notifications/send')
                .set('Authorization', `Bearer ${token}`)
                .send({ to: RECIPIENT_ADDR, type: 'message', title: 'Hello', message: 'World' });
            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid type', async () => {
            const token = makeToken();
            const res = await request(app)
                .post('/api/notifications/send')
                .set('Authorization', `Bearer ${token}`)
                .send({ to: RECIPIENT_ADDR, type: 'invalid_type', title: 'Hello', message: 'World' });
            expect(res.status).toBe(400);
        });
    });

    describe('PATCH /:id/read', () => {
        it('marks notification as read', async () => {
            const token = makeToken();
            mockQuery.mockResolvedValueOnce({ rowCount: 1 });
            const res = await request(app)
                .patch('/api/notifications/5/read')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
