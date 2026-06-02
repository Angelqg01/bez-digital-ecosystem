const request = require('supertest');
require('../helpers'); // load all mocks
const app = require('../../index');

describe('Health & Telemetry endpoints', () => {
    describe('GET /api/health', () => {
        it('returns ok status', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('OK');
        });
    });
});
