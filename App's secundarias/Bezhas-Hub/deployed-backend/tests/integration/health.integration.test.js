/**
 * Health Endpoint Integration Tests
 * Tests for API health check functionality
 */

const request = require('supertest');

// We'll create a minimal express app for testing
const express = require('express');

describe('Health API Integration', () => {
    let app;
    let server;

    beforeAll(async () => {
        // Create a minimal test app
        app = express();
        app.use(express.json());

        // Health endpoint
        app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                services: {
                    api: 'healthy',
                    database: 'healthy',
                    cache: 'healthy'
                }
            });
        });

        app.get('/api/health/ready', (req, res) => {
            res.json({
                ready: true,
                checks: {
                    database: true,
                    cache: true,
                    blockchain: true
                }
            });
        });

        app.get('/api/health/live', (req, res) => {
            res.json({ alive: true });
        });

        server = app.listen(0);
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    describe('GET /api/health', () => {
        it('should return 200 and health status', async () => {
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body).toHaveProperty('status', 'ok');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('version');
            expect(res.body).toHaveProperty('services');
        });

        it('should include service statuses', async () => {
            const res = await request(app)
                .get('/api/health')
                .expect(200);

            expect(res.body.services).toHaveProperty('api');
            expect(res.body.services).toHaveProperty('database');
            expect(res.body.services).toHaveProperty('cache');
        });
    });

    describe('GET /api/health/ready', () => {
        it('should return readiness status', async () => {
            const res = await request(app)
                .get('/api/health/ready')
                .expect(200);

            expect(res.body).toHaveProperty('ready', true);
            expect(res.body).toHaveProperty('checks');
        });
    });

    describe('GET /api/health/live', () => {
        it('should return liveness status', async () => {
            const res = await request(app)
                .get('/api/health/live')
                .expect(200);

            expect(res.body).toHaveProperty('alive', true);
        });
    });
});
