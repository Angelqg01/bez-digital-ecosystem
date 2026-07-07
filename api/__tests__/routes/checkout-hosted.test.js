/**
 * Checkout hosted — página /c/:token + endpoint público de estado por token.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');
const checkoutRoutes = require('../../routes/checkout');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);
app.use('/c', checkoutRoutes);

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const ONCHAIN_ORDER = {
    id: 42, status: 'pending', amount_usd: '103.00', platform_fee_usd: '3.00',
    payment_method: 'crypto',
    note: JSON.stringify({ provider: 'onchain', token: 'BEZ', treasury: '0x' + '9'.repeat(40), expectedBez: 1000, sendFrom: '0x' + 'f'.repeat(40) }),
    tx_hash: null, expires_at: '2026-07-08T00:00:00Z', created_at: 'now', updated_at: 'now',
};

describe('Hosted checkout', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('GET /api/gateway/v1/checkout/:token (público, sin API key)', () => {
        it('devuelve instrucciones on-chain para una orden pendiente', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [ONCHAIN_ORDER] });
            const res = await request(app).get(`/api/gateway/v1/checkout/${TOKEN}`);
            expect(res.status).toBe(200);
            expect(res.body.checkout.status).toBe('pending');
            expect(res.body.checkout.onchain.expectedBez).toBe(1000);
            expect(res.body.checkout.onchain.treasury).toBe('0x' + '9'.repeat(40));
            // Nunca expone campos internos
            expect(res.body.checkout.app_id).toBeUndefined();
            expect(res.body.checkout.walletAddress).toBeUndefined();
            const select = mockQuery.mock.calls[0];
            expect(select[1]).toEqual([TOKEN]);
        });

        it('refleja el settlement al completarse', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ ...ONCHAIN_ORDER, status: 'completed', tx_hash: '0x' + 'a'.repeat(64) }],
            });
            const res = await request(app).get(`/api/gateway/v1/checkout/${TOKEN}`);
            expect(res.body.checkout.status).toBe('completed');
            expect(res.body.checkout.txHash).toBe('0x' + 'a'.repeat(64));
        });

        it('404 con token desconocido y formato inválido ni consulta', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const unknown = await request(app).get(`/api/gateway/v1/checkout/${TOKEN}`);
            expect(unknown.status).toBe(404);

            mockQuery.mockClear();
            const badFormat = await request(app).get('/api/gateway/v1/checkout/not-a-token');
            expect(badFormat.status).toBe(404);
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });

    describe('GET /c/:token (página)', () => {
        it('sirve la página HTML self-contained con el token embebido', async () => {
            const res = await request(app).get(`/c/${TOKEN}`);
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toMatch(/text\/html/);
            expect(res.headers['cache-control']).toBe('no-store');
            expect(res.text).toContain('BeZhas');
            expect(res.text).toContain(`"${TOKEN}"`);
            expect(res.text).toContain('/api/gateway/v1/checkout/');
            // Self-contained: sin assets externos
            expect(res.text).not.toMatch(/src="http|href="http/);
        });

        it('404 con formato de token inválido', async () => {
            const res = await request(app).get('/c/short');
            expect(res.status).toBe(404);
        });
    });
});
