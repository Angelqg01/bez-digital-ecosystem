/**
 * GET /payments/:id — polling de un intent, con aislamiento por app/wallet.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery, makeToken } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const API_KEY = 'test-gateway-key';
const WALLET = '0x' + 'f'.repeat(40);
const APP_ROW = { id: 7, app_name: 'test-app', scopes: ['wallet'], tier: 'business', is_active: true };
const mockAppAuth = (row = APP_ROW) => mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });

const ORDER = {
    id: 42, wallet_address: WALLET, amount_usd: '103.00', amount_bez: null,
    platform_fee_usd: '3.00', payment_method: 'crypto', type: 'buy', status: 'pending',
    note: JSON.stringify({ provider: 'onchain', treasury: '0x' + '9'.repeat(40), expectedBez: 1000, token: 'BEZ' }),
    tx_hash: null, app_id: 7, expires_at: '2026-07-08T00:00:00Z',
    created_at: '2026-07-07T00:00:00Z', updated_at: '2026-07-07T00:00:00Z',
};

describe('GET /api/gateway/v1/payments/:id', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('devuelve el intent con instrucciones on-chain al app propietario', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [ORDER] });
        const res = await request(app).get('/api/gateway/v1/payments/42').set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        expect(res.body.payment.paymentId).toBe(42);
        expect(res.body.payment.status).toBe('pending');
        expect(res.body.payment.onchain.expectedBez).toBe(1000);
        expect(res.body.payment.expiresAt).toBe('2026-07-08T00:00:00Z');
    });

    it('oculta órdenes de otro app (404, sin filtrar existencia)', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [{ ...ORDER, app_id: 99, wallet_address: '0x' + '1'.repeat(40) }] });
        const res = await request(app).get('/api/gateway/v1/payments/42').set('x-api-key', API_KEY);
        expect(res.status).toBe(404);
    });

    it('una sesión JWT ve las órdenes de su propia wallet', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ ...ORDER, app_id: null }] });
        const res = await request(app)
            .get('/api/gateway/v1/payments/42')
            .set('Authorization', `Bearer ${makeToken({ address: WALLET })}`);
        expect(res.status).toBe(200);
        expect(res.body.payment.walletAddress).toBe(WALLET);
    });

    it('expone settlement tras liquidar', async () => {
        mockAppAuth();
        const settled = {
            ...ORDER, status: 'completed', tx_hash: '0x' + 'a'.repeat(64),
            note: JSON.stringify({ provider: 'onchain', settlement: { status: 'completed', amountBEZ: '1000', providerReference: 'onchain-watcher:137' } }),
        };
        mockQuery.mockResolvedValueOnce({ rows: [settled] });
        const res = await request(app).get('/api/gateway/v1/payments/42').set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        expect(res.body.payment.settlement.providerReference).toBe('onchain-watcher:137');
    });

    it('404 si no existe', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [] });
        const res = await request(app).get('/api/gateway/v1/payments/42').set('x-api-key', API_KEY);
        expect(res.status).toBe(404);
    });
});
