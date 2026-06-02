const request = require('supertest');
const { mockQuery, mockAxios, mockAegisService, makeToken, makeAdminToken } = require('../helpers');
const app = require('../../index');

describe('Routes: /api/ai-control', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('PUT /mode', () => {
        it('sets AI mode as admin', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.put.mockResolvedValueOnce({ data: { mode: 'supervised' } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .put('/api/ai-control/mode')
                .set('Authorization', `Bearer ${token}`)
                .send({ mode: 'supervised' });
            expect(res.status).toBe(200);
        });

        it('rejects non-admin users', async () => {
            const token = makeToken({ role: 'user' });
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'user' }] });
            const res = await request(app)
                .put('/api/ai-control/mode')
                .set('Authorization', `Bearer ${token}`)
                .send({ mode: 'autonomous' });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /status', () => {
        it('returns Aegis status', async () => {
            const token = makeToken();
            mockAxios.get.mockResolvedValueOnce({ data: { mode: 'autonomous', active_models: 4 } });
            const res = await request(app)
                .get('/api/ai-control/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.mode).toBe('autonomous');
        });

        it('returns fallback when Aegis is offline', async () => {
            const token = makeToken();
            mockAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
            const res = await request(app)
                .get('/api/ai-control/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
        });
    });

    describe('POST /telemetry', () => {
        it('processes valid telemetry', async () => {
            const token = makeToken();
            mockAegisService.processTelemetryAndTokenize.mockResolvedValueOnce({ success: true, tokenId: 42 });
            const res = await request(app)
                .post('/api/ai-control/telemetry')
                .set('Authorization', `Bearer ${token}`)
                .send({ containerId: 'CNT-001', telemetryData: { temperature: 25.5, humidity: 60 } });
            expect(res.status).toBe(200);
            expect(res.body.tokenId).toBe(42);
        });

        it('returns 400 for missing telemetry fields', async () => {
            const token = makeToken();
            const res = await request(app)
                .post('/api/ai-control/telemetry')
                .set('Authorization', `Bearer ${token}`)
                .send({ containerId: 'CNT-001', telemetryData: {} });
            expect(res.status).toBe(400);
        });

        it('returns 401 without token', async () => {
            const res = await request(app)
                .post('/api/ai-control/telemetry')
                .send({ containerId: 'CNT-001', telemetryData: { temperature: 25, humidity: 60 } });
            expect(res.status).toBe(401);
        });
    });

    describe('GET /logs', () => {
        it('returns paginated AI logs', async () => {
            const token = makeToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'user' }] }); // requireRole
            mockQuery.mockResolvedValueOnce({ rows: [{ cnt: 5 }] }); // count
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: 1, module: 'telemetry', action: 'APPROVED', severity: 'info', confidence: 98, created_at: '2026-03-23T00:00:00Z' },
                ],
            });
            const res = await request(app)
                .get('/api/ai-control/logs?page=1&limit=10')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('rows');
            expect(res.body).toHaveProperty('total');
        });

        it('returns empty on DB error', async () => {
            const token = makeToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'user' }] }); // requireRole
            mockQuery.mockRejectedValueOnce(new Error('DB down'));
            const res = await request(app)
                .get('/api/ai-control/logs')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.rows).toEqual([]);
        });
    });

    describe('POST /pause (admin only)', () => {
        it('pauses system as admin', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.post.mockResolvedValueOnce({ data: { status: 'success', message: 'paused' } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .post('/api/ai-control/pause')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });

        it('rejects non-admin', async () => {
            const token = makeToken({ role: 'user' });
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'user' }] });
            const res = await request(app)
                .post('/api/ai-control/pause')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });
    });

    describe('POST /resume (admin only)', () => {
        it('resumes system as admin', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.post.mockResolvedValueOnce({ data: { status: 'success', message: 'resumed' } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .post('/api/ai-control/resume')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });

    describe('POST /trigger (admin only)', () => {
        it('triggers purge_cache action', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.post.mockResolvedValueOnce({ data: { status: 'success', data: { action: 'purge_cache' } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .post('/api/ai-control/trigger')
                .set('Authorization', `Bearer ${token}`)
                .send({ action: 'purge_cache' });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /suggestions/:id/approve', () => {
        it('approves a suggestion as admin', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.post.mockResolvedValueOnce({ data: { status: 'success', data: { suggestion_id: 'sug_1', status: 'approved' } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .post('/api/ai-control/suggestions/sug_1/approve')
                .set('Authorization', `Bearer ${token}`)
                .send({ feedback: 'Looks good' });
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('approved');
        });

        it('returns 404 when Aegis returns 404', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            const err = new Error('Not found');
            err.response = { status: 404, data: { detail: 'Suggestion not found' } };
            mockAxios.post.mockRejectedValueOnce(err);
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit (error)
            const res = await request(app)
                .post('/api/ai-control/suggestions/sug_nonexistent/approve')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(404);
        });
    });

    describe('POST /suggestions/:id/reject', () => {
        it('rejects a suggestion as admin', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.post.mockResolvedValueOnce({ data: { status: 'success', data: { suggestion_id: 'sug_2', status: 'rejected' } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .post('/api/ai-control/suggestions/sug_2/reject')
                .set('Authorization', `Bearer ${token}`)
                .send({ feedback: 'False positive' });
            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe('rejected');
        });
    });

    describe('GET /suggestions', () => {
        it('returns pending suggestions', async () => {
            const token = makeToken();
            mockAxios.get.mockResolvedValueOnce({ data: { status: 'success', data: { suggestions: [], total: 0 } } });
            const res = await request(app)
                .get('/api/ai-control/suggestions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });

        it('returns empty fallback on Aegis error', async () => {
            const token = makeToken();
            mockAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
            const res = await request(app)
                .get('/api/ai-control/suggestions')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.data.suggestions).toEqual([]);
        });
    });

    describe('PUT /threshold (admin only)', () => {
        it('sets anomaly threshold', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.put.mockResolvedValueOnce({ data: { status: 'success', data: { threshold: 0.7 } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .put('/api/ai-control/threshold')
                .set('Authorization', `Bearer ${token}`)
                .send({ level: 0.7 });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /false-positive', () => {
        it('marks log as false positive', async () => {
            const token = makeToken();
            mockAxios.post.mockResolvedValueOnce({ data: { status: 'success', data: { log_id: 42, marked_as: 'false_positive' } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .post('/api/ai-control/false-positive')
                .set('Authorization', `Bearer ${token}`)
                .send({ log_id: 42, reason: 'testing' });
            expect(res.status).toBe(200);
            expect(res.body.data.marked_as).toBe('false_positive');
        });
    });

    describe('PUT /config/telemetry (admin only)', () => {
        it('enables telemetry', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.put.mockResolvedValueOnce({ data: { status: 'success', data: { telemetry_enabled: true } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .put('/api/ai-control/config/telemetry')
                .set('Authorization', `Bearer ${token}`)
                .send({ enabled: true });
            expect(res.status).toBe(200);
        });
    });

    describe('PUT /config/samplerate (admin only)', () => {
        it('sets samplerate', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.put.mockResolvedValueOnce({ data: { status: 'success', data: { samplerate: 0.1 } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .put('/api/ai-control/config/samplerate')
                .set('Authorization', `Bearer ${token}`)
                .send({ rate: 0.1 });
            expect(res.status).toBe(200);
        });
    });

    describe('POST /retrain (admin only)', () => {
        it('starts model retrain', async () => {
            const token = makeAdminToken();
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] }); // requireRole
            mockAxios.post.mockResolvedValueOnce({ data: { status: 'success', data: { job_id: 'retrain_job_1', status: 'queued' } } });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // logAdminAction audit
            const res = await request(app)
                .post('/api/ai-control/retrain')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });
});
