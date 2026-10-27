/**
 * POST /payments/buy con amountEUR — órdenes SEPA en EUR (la cuenta de cobro
 * es en EUR). Internamente la orden sigue en USD al cambio del BCE.
 */
jest.mock('../../services/fxService', () => ({
    getEurUsdRate: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');
const { getEurUsdRate } = require('../../services/fxService');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const API_KEY = 'test-gateway-key';
const WALLET = '0x' + 'f'.repeat(40);
const APP_ROW = { id: 7, app_name: 'test-app', scopes: ['wallet'], tier: 'business', is_active: true };
const mockAppAuth = () => mockQuery.mockResolvedValueOnce({ rows: [APP_ROW], rowCount: 1 });

const comprar = (body) => request(app)
    .post('/api/gateway/v1/payments/buy')
    .set('x-api-key', API_KEY)
    .send({ walletAddress: WALLET, ...body });

describe('POST /payments/buy — SEPA en EUR', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        getEurUsdRate.mockReset();
        getEurUsdRate.mockResolvedValue({ rate: 1.1, source: 'ecb', asOf: '2026-10-27T14:00:00.000Z' });
    });

    it('cotiza en EUR, guarda el cambio y devuelve el importe exacto a transferir', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // kyc_status: nivel 0
        mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] }); // volumen 12m
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 42, status: 'pending', created_at: 'now', checkout_token: 'a'.repeat(32) }], rowCount: 1 });

        const res = await comprar({ amountEUR: 100, paymentMethod: 'bank' });

        expect(res.status).toBe(200);
        expect(res.body.currency).toBe('EUR');
        expect(res.body.netAmountEUR).toBe(100);
        expect(res.body.platformFeeEUR).toBe(2.5);
        expect(res.body.amountEUR).toBe(102.5);
        expect(res.body.eurUsdRate).toBe(1.1);
        expect(res.body.netAmountUSD).toBe(110);
        expect(res.body.bankTransfer).toMatchObject({ currency: 'EUR', amount: 102.5, reference: 'BEZ-42' });

        const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO payment_transactions/.test(sql));
        const [, params] = insert;
        expect(params[1]).toBe(112.75); // amount_usd bruto: 110 + 2,5 %
        expect(JSON.parse(params[4]).fiat).toMatchObject({ currency: 'EUR', grossAmount: 102.5, eurUsd: 1.1, rateSource: 'ecb' });
    });

    it('el límite KYC se aplica sobre el contravalor en USD', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // kyc_status: nivel 0
        mockQuery.mockResolvedValueOnce({ rows: [{ total: '999999' }] }); // volumen 12m ya agotado
        const res = await comprar({ amountEUR: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('KYC_REQUIRED');
    });

    it('rechaza amountEUR con un método que no es SEPA', async () => {
        mockAppAuth();
        const res = await comprar({ amountEUR: 100, paymentMethod: 'card' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('CURRENCY_NOT_SUPPORTED');
        expect(getEurUsdRate).not.toHaveBeenCalled();
    });

    it('exige amountUSD o amountEUR, pero no los dos', async () => {
        mockAppAuth();
        const ambos = await comprar({ amountUSD: 100, amountEUR: 100, paymentMethod: 'bank' });
        expect(ambos.status).toBe(400);
        mockAppAuth();
        const ninguno = await comprar({ paymentMethod: 'bank' });
        expect(ninguno.status).toBe(400);
    });

    it('sin tipo de cambio no crea la orden (503, nunca un cambio inventado)', async () => {
        getEurUsdRate.mockRejectedValue(new Error('ECB down'));
        mockAppAuth();
        const res = await comprar({ amountEUR: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('FX_UNAVAILABLE');
        expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO payment_transactions/.test(sql))).toBe(false);
    });

    it('las órdenes en USD no cambian', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 43, status: 'pending', created_at: 'now', checkout_token: 'b'.repeat(32) }], rowCount: 1 });
        const res = await comprar({ amountUSD: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(200);
        expect(res.body.amountUSD).toBe(102.5);
        expect(res.body.amountEUR).toBeUndefined();
        expect(res.body.bankTransfer.amount).toBeUndefined();
        expect(getEurUsdRate).not.toHaveBeenCalled();
    });

    it('GET /payments/fx expone el cambio con el que se cotiza', async () => {
        mockAppAuth();
        const res = await request(app).get('/api/gateway/v1/payments/fx').set('x-api-key', API_KEY);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ base: 'EUR', quote: 'USD', rate: 1.1, source: 'ecb' });
    });
});
