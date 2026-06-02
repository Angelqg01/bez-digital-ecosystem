const request = require('supertest');
const express = require('express');
const ecosystemBridgeRoutes = require('./routes/ecosystem-bridge');
require('dotenv').config({ path: '../.env' });

describe('Ecosystem Bridge API', () => {
    let app;
    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/api/ecosystem-bridge', ecosystemBridgeRoutes);
    });

    describe('POST /api/ecosystem-bridge/users/sync', () => {
        it('should reject without API key', async () => {
            const res = await request(app)
                .post('/api/ecosystem-bridge/users/sync')
                .send({ username: 'test', email: 'test@bez.digital', walletAddress: '0xabc' });
            expect(res.statusCode).toBe(401);
        });
        it('should reject with invalid API key', async () => {
            const res = await request(app)
                .post('/api/ecosystem-bridge/users/sync')
                .set('x-api-key', 'INVALID_KEY')
                .send({ username: 'test', email: 'test@bez.digital', walletAddress: '0xabc' });
            expect(res.statusCode).toBe(401);
        });
        it('should reject if walletAddress is missing', async () => {
            const res = await request(app)
                .post('/api/ecosystem-bridge/users/sync')
                .set('x-api-key', process.env.BRIDGE_API_KEY || 'CAMBIA_ESTE_VALOR')
                .send({ username: 'test', email: 'test@bez.digital' });
            expect(res.statusCode).toBe(400);
        });
        // Add more tests for success and db errors as needed
    });

    describe('POST /api/ecosystem-bridge/payments/notify', () => {
        it('should reject without API key', async () => {
            const res = await request(app)
                .post('/api/ecosystem-bridge/payments/notify')
                .send({ paymentId: 'p1', walletAddress: '0xabc', amount: 1, type: 'test', txHash: '0x123' });
            expect(res.statusCode).toBe(401);
        });
        it('should reject with invalid API key', async () => {
            const res = await request(app)
                .post('/api/ecosystem-bridge/payments/notify')
                .set('x-api-key', 'INVALID_KEY')
                .send({ paymentId: 'p1', walletAddress: '0xabc', amount: 1, type: 'test', txHash: '0x123' });
            expect(res.statusCode).toBe(401);
        });
        // Add more tests for success and db errors as needed
    });
});
