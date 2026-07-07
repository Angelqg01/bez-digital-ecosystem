/**
 * Idempotency-Key en POST /payments/buy — un retry con la misma clave devuelve
 * la orden original (nunca duplica), estilo Stripe.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const API_KEY = 'test-gateway-key';
const WALLET = '0x' + 'f'.repeat(40);
const APP_ROW = { id: 7, app_name: 'test-app', scopes: ['wallet'], tier: 'business', is_active: true };
const KEY = 'retry-safe-key-001';

const mockAppAuth = () => mockQuery.mockResolvedValueOnce({ rows: [APP_ROW], rowCount: 1 });

const ORDER_ROW = {
    id: 42,
    status: 'pending',
    wallet_address: WALLET,
    amount_usd: '103.00',
    platform_fee_usd: '3.00',
    payment_method: 'bank',
    note: JSON.stringify({ provider: 'bank_transfer' }),
    created_at: '2026-07-07T00:00:00Z',
};

describe('POST /payments/buy — idempotency', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('rechaza claves con formato inválido', async () => {
        mockAppAuth();
        const res = await request(app)
            .post('/api/gateway/v1/payments/buy')
            .set('x-api-key', API_KEY)
            .set('Idempotency-Key', 'x!')
            .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Idempotency-Key/);
    });

    it('crea la orden y persiste la clave la primera vez', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // lookup por clave: no existe
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 42, status: 'pending', created_at: 'now' }], rowCount: 1 }); // insert
        const res = await request(app)
            .post('/api/gateway/v1/payments/buy')
            .set('x-api-key', API_KEY)
            .set('Idempotency-Key', KEY)
            .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(200);
        expect(res.body.paymentId).toBe(42);
        expect(res.body.idempotent).toBeUndefined();
        const insert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO payment_transactions'));
        expect(insert[1][5]).toBe(KEY); // idempotency_key como parámetro
        expect(String(insert[0])).toContain('ON CONFLICT (idempotency_key)');
    });

    it('replay: la misma clave devuelve la orden original sin insertar', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [ORDER_ROW], rowCount: 1 }); // lookup por clave: existe
        const res = await request(app)
            .post('/api/gateway/v1/payments/buy')
            .set('x-api-key', API_KEY)
            .set('Idempotency-Key', KEY)
            .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(200);
        expect(res.body.idempotent).toBe(true);
        expect(res.body.paymentId).toBe(42);
        expect(res.body.nextAction).toBe('display_bank_transfer_instructions');
        const inserts = mockQuery.mock.calls.filter(c => String(c[0]).includes('INSERT INTO payment_transactions'));
        expect(inserts).toHaveLength(0);
    });

    it('409 si la clave ya se usó con otra wallet (aislamiento entre tenants)', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [{ ...ORDER_ROW, wallet_address: '0x' + '1'.repeat(40) }], rowCount: 1 });
        const res = await request(app)
            .post('/api/gateway/v1/payments/buy')
            .set('x-api-key', API_KEY)
            .set('Idempotency-Key', KEY)
            .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(409);
    });

    it('carrera perdida: INSERT no devuelve fila → replay de la orden ganadora', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // lookup inicial: aún no existe
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // insert: ON CONFLICT DO NOTHING
        mockQuery.mockResolvedValueOnce({ rows: [ORDER_ROW], rowCount: 1 }); // re-lookup
        const res = await request(app)
            .post('/api/gateway/v1/payments/buy')
            .set('x-api-key', API_KEY)
            .set('Idempotency-Key', KEY)
            .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(200);
        expect(res.body.idempotent).toBe(true);
        expect(res.body.paymentId).toBe(42);
    });

    it('sin clave: comportamiento actual intacto', async () => {
        mockAppAuth();
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 43, status: 'pending', created_at: 'now' }], rowCount: 1 }); // insert directo
        const res = await request(app)
            .post('/api/gateway/v1/payments/buy')
            .set('x-api-key', API_KEY)
            .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
        expect(res.status).toBe(200);
        expect(res.body.paymentId).toBe(43);
        const insert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO payment_transactions'));
        expect(insert[1][5]).toBeNull();
    });
});
