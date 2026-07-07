/**
 * KYC tiers (MiCA) — gate de volumen en /payments/buy + endpoints de estado.
 */
const request = require('supertest');
const express = require('express');
const { mockQuery } = require('../helpers');

const gatewayRoutes = require('../../routes/gateway');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1', gatewayRoutes);

const API_KEY = 'test-gateway-key';
const INTERNAL_KEY = 'test-internal-key';
const WALLET = '0x' + 'f'.repeat(40);
const APP_ROW = { id: 7, app_name: 'test-app', scopes: ['wallet'], tier: 'business', is_active: true };
const mockAppAuth = () => mockQuery.mockResolvedValueOnce({ rows: [APP_ROW], rowCount: 1 });

describe('KYC volume gates', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('POST /payments/buy con gate', () => {
        it('bloquea con KYC_REQUIRED al superar el límite del nivel 0 (150 USD)', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [] });                    // kyc_status: sin registro → nivel 0
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '100' }] });    // volumen 12m ya usado
            const res = await request(app)
                .post('/api/gateway/v1/payments/buy')
                .set('x-api-key', API_KEY)
                .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('KYC_REQUIRED');
            expect(res.body.requiredLevel).toBe(1);
            expect(res.body.usedUSD).toBe(100);
            const inserts = mockQuery.mock.calls.filter(c => String(c[0]).includes('INSERT INTO payment_transactions'));
            expect(inserts).toHaveLength(0); // la orden nunca se crea
        });

        it('permite la compra dentro del límite y con nivel 2 no consulta volumen', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [] });                    // nivel 0
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '0' }] });      // sin volumen previo
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 42, status: 'pending', created_at: 'now', expires_at: 'later', checkout_token: 'a'.repeat(32) }] });
            const ok = await request(app)
                .post('/api/gateway/v1/payments/buy')
                .set('x-api-key', API_KEY)
                .send({ walletAddress: WALLET, amountUSD: 100, paymentMethod: 'bank' });
            expect(ok.status).toBe(200);
            expect(ok.body.paymentId).toBe(42);

            mockQuery.mockClear();
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [{ level: 2, provider: 'sumsub', verified_at: 'now' }] }); // nivel 2
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 43, status: 'pending', created_at: 'now', expires_at: 'later', checkout_token: 'b'.repeat(32) }] });
            const vip = await request(app)
                .post('/api/gateway/v1/payments/buy')
                .set('x-api-key', API_KEY)
                .send({ walletAddress: WALLET, amountUSD: 500000, paymentMethod: 'bank' });
            expect(vip.status).toBe(200);
            const volumeQueries = mockQuery.mock.calls.filter(c => String(c[0]).includes("INTERVAL '365 days'"));
            expect(volumeQueries).toHaveLength(0);
        });
    });

    describe('GET /kyc/status/:address', () => {
        it('devuelve nivel, límite y margen restante', async () => {
            mockAppAuth();
            mockQuery.mockResolvedValueOnce({ rows: [{ level: 1, provider: 'onfido', verified_at: '2026-01-01' }] });
            mockQuery.mockResolvedValueOnce({ rows: [{ total: '5000' }] });
            const res = await request(app)
                .get(`/api/gateway/v1/kyc/status/${WALLET}`)
                .set('x-api-key', API_KEY);
            expect(res.status).toBe(200);
            expect(res.body.level).toBe(1);
            expect(res.body.limitUSD).toBe(15000);
            expect(res.body.remainingUSD).toBe(10000);
        });
    });

    describe('POST /kyc/status (interno)', () => {
        it('exige la settlement key y persiste el nivel', async () => {
            const noKey = await request(app)
                .post('/api/gateway/v1/kyc/status')
                .send({ walletAddress: WALLET, level: 1 });
            expect(noKey.status).toBe(401);

            mockQuery.mockResolvedValueOnce({
                rows: [{ wallet_address: WALLET.toLowerCase(), level: 1, provider: 'sumsub', verified_at: 'now' }],
            });
            const res = await request(app)
                .post('/api/gateway/v1/kyc/status')
                .set('x-internal-key', INTERNAL_KEY)
                .send({ walletAddress: WALLET, level: 1, provider: 'sumsub', reference: 'appl_123' });
            expect(res.status).toBe(200);
            expect(res.body.kyc.level).toBe(1);
            const upsert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO kyc_status'));
            expect(upsert[1]).toEqual([WALLET.toLowerCase(), 1, 'sumsub', 'appl_123']);
        });

        it('rechaza niveles fuera de rango', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/kyc/status')
                .set('x-internal-key', INTERNAL_KEY)
                .send({ walletAddress: WALLET, level: 5 });
            expect(res.status).toBe(400);
        });
    });
});
