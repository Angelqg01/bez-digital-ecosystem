/**
 * Refunds — POST /payments/:id/refund (interno, settlement key).
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const INTERNAL_KEY = 'test-internal-key'; // fijada en jest.setup.js (INTERNAL_API_KEY)
const COMPLETED = {
    id: 42, wallet_address: '0x' + 'f'.repeat(40), amount_usd: '103.00', amount_bez: '1000',
    payment_method: 'crypto', type: 'buy', status: 'completed',
    note: JSON.stringify({ provider: 'onchain' }), app_id: 7,
};

describe('POST /api/gateway/v1/payments/:id/refund', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('exige la settlement key (401 sin ella)', async () => {
        const res = await request(app).post('/api/gateway/v1/payments/42/refund').send({});
        expect(res.status).toBe(401);
    });

    it('reembolsa una orden completed, registra auditoría y encola payment.refunded', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [COMPLETED] });                       // SELECT orden
        mockQuery.mockResolvedValueOnce({ rows: [{ ...COMPLETED, status: 'refunded' }] }); // UPDATE
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 11, events: ['payment.refunded'] }] }); // webhooks del app
        mockQuery.mockResolvedValueOnce({ rows: [] });                                 // insert delivery

        const res = await request(app)
            .post('/api/gateway/v1/payments/42/refund')
            .set('x-internal-key', INTERNAL_KEY)
            .send({ reason: 'cliente canceló', refundTxHash: '0x' + 'b'.repeat(64), requestedBy: 'backoffice:yoel' });

        expect(res.status).toBe(200);
        expect(res.body.payment.status).toBe('refunded');
        expect(res.body.refund.reason).toBe('cliente canceló');
        expect(res.body.refund.refundTxHash).toBe('0x' + 'b'.repeat(64));

        const update = mockQuery.mock.calls.find(c => String(c[0]).includes("SET status = 'refunded'"));
        expect(JSON.parse(update[1][0]).refund.requestedBy).toBe('backoffice:yoel');
    });

    it('409 si ya está refunded; 422 si no está completed', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ ...COMPLETED, status: 'refunded' }] });
        const dup = await request(app)
            .post('/api/gateway/v1/payments/42/refund')
            .set('x-internal-key', INTERNAL_KEY).send({});
        expect(dup.status).toBe(409);

        mockQuery.mockResolvedValueOnce({ rows: [{ ...COMPLETED, status: 'pending' }] });
        const notDone = await request(app)
            .post('/api/gateway/v1/payments/42/refund')
            .set('x-internal-key', INTERNAL_KEY).send({});
        expect(notDone.status).toBe(422);
    });

    it('404 si la orden no existe y 400 con txHash inválido', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        const missing = await request(app)
            .post('/api/gateway/v1/payments/42/refund')
            .set('x-internal-key', INTERNAL_KEY).send({});
        expect(missing.status).toBe(404);

        const badTx = await request(app)
            .post('/api/gateway/v1/payments/42/refund')
            .set('x-internal-key', INTERNAL_KEY)
            .send({ refundTxHash: 'nope' });
        expect(badTx.status).toBe(400);
    });
});
