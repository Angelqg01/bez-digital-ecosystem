/**
 * Endpoints de webhooks salientes del gateway (registro, listado, dead-letter).
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const API_KEY = 'test-gateway-key';
const APP_ROW = { id: 7, app_name: 'test-app', scopes: ['wallet'], tier: 'business', is_active: true };
const mockAppAuth = () => mockQuery.mockResolvedValueOnce({ rows: [APP_ROW], rowCount: 1 });

describe('Gateway outbound webhooks', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('exige API key (401 sin x-api-key)', async () => {
        const res = await request(app).get('/api/gateway/v1/webhooks');
        expect(res.status).toBe(401);
    });

    describe('POST /webhooks/register', () => {
        it('registra la URL y devuelve el secreto una sola vez', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 3, url: 'https://client.example/hook', events: ['payment.settled'], created_at: 'now' }],
            });
            const res = await request(app)
                .post('/api/gateway/v1/webhooks/register')
                .set('x-api-key', API_KEY)
                .send({ url: 'https://client.example/hook' });
            expect(res.status).toBe(200);
            expect(res.body.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
            expect(res.body.signatureHeader).toBe('X-BeZhas-Signature');
            const insert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO payment_webhooks'));
            expect(insert[1][0]).toBe(APP_ROW.id);
            expect(insert[1][2]).toBe(res.body.secret);
        });

        it('400 con URL inválida', async () => {
            mockAppAuth();
            const res = await request(app)
                .post('/api/gateway/v1/webhooks/register')
                .set('x-api-key', API_KEY)
                .send({ url: 'not-a-url' });
            expect(res.status).toBe(400);
        });
    });

    it('GET /webhooks lista sin exponer secretos', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({
            rows: [{ id: 3, url: 'https://client.example/hook', events: ['payment.settled'], is_active: true, created_at: 'now' }],
        });
        const res = await request(app).get('/api/gateway/v1/webhooks').set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        expect(res.body.webhooks).toHaveLength(1);
        expect(res.body.webhooks[0].secret).toBeUndefined();
        const select = mockQuery.mock.calls.find(c => String(c[0]).includes('FROM payment_webhooks WHERE app_id'));
        expect(String(select[0])).not.toContain('secret');
    });

    it('GET /webhooks/deliveries filtra por estado y limita al app', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 9, status: 'dead', event_name: 'payment.settled' }] });
        const res = await request(app)
            .get('/api/gateway/v1/webhooks/deliveries?status=dead')
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        expect(res.body.deliveries[0].status).toBe('dead');
        const select = mockQuery.mock.calls.find(c => String(c[0]).includes('payment_webhook_deliveries'));
        expect(select[1]).toEqual([APP_ROW.id, 'dead']);
    });

    it('POST /webhooks/deliveries/:id/retry re-encola una entrega muerta', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 9, status: 'pending' }] });
        const res = await request(app)
            .post('/api/gateway/v1/webhooks/deliveries/9/retry')
            .set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        expect(res.body.delivery.status).toBe('pending');
    });

    it('DELETE /webhooks/:id desactiva y 404 si es de otro app', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 3 }] });
        const ok = await request(app).delete('/api/gateway/v1/webhooks/3').set('x-api-key', API_KEY);
        expect(ok.status).toBe(200);

        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [] });
        const notMine = await request(app).delete('/api/gateway/v1/webhooks/99').set('x-api-key', API_KEY);
        expect(notMine.status).toBe(404);
    });
});
