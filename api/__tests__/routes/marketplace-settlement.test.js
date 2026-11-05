/**
 * API Marketplace, paso 5: pago en BEZ por MarketplaceSettlement (sin custodia).
 */
const request = require('supertest');
const express = require('express');
const { ethers } = require('ethers');
const { mockQuery } = require('../helpers');

const settlement = require('../../services/marketplace/settlement');
const marketplaceRoutes = require('../../routes/marketplace');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1/marketplace', marketplaceRoutes);

const BASE = '/api/gateway/v1/marketplace';
const CONTRATO = '0x' + '5'.repeat(40);
const CONSUMER = '33333333-3333-4333-8333-333333333333';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const PAGADOR = '0x' + 'a'.repeat(40);
const TX = '0x' + 'b'.repeat(64);
const PURCHASE = '0x' + 'c'.repeat(64);
const iface = new ethers.Interface(settlement.ABI);

function logPaid({ address = CONTRATO, listingId = LISTING_ID, payer = PAGADOR } = {}) {
    const { data, topics } = iface.encodeEventLog('Paid', [
        PURCHASE, settlement.claveListing(listingId), payer, '0x' + 'd'.repeat(40), 100n * 10n ** 18n, 15n * 10n ** 18n,
    ]);
    return { address, data, topics };
}

let recibo;
let bloque;
const rpc = {
    getNetwork: async () => ({ chainId: 137n }),
    getTransactionReceipt: async () => recibo,
    getBlockNumber: async () => bloque,
};

const auth = (addresses = [PAGADOR]) => mockQuery.mockResolvedValueOnce({
    rows: [{ id: CONSUMER, app_name: 'naviera', scopes: ['marketplace:consume'], tier: 'standard', is_active: true, authorized_addresses: addresses }],
    rowCount: 1,
});
const filas = (rows) => mockQuery.mockResolvedValueOnce({ rows, rowCount: rows.length });
const comprar = () => request(app).post(`${BASE}/catalog/tarifas-aduana/purchase`).set('x-api-key', 'k').send({ txHash: TX });

describe('API Marketplace — pago en BEZ (paso 5)', () => {
    beforeAll(() => {
        process.env.MARKETPLACE_SETTLEMENT_ADDRESS = CONTRATO;
        process.env.POLYGON_RPC_URL = 'https://polygon.example';
        settlement._setProveedorRpc(() => rpc);
    });
    afterAll(() => {
        delete process.env.MARKETPLACE_SETTLEMENT_ADDRESS;
        delete process.env.POLYGON_RPC_URL;
    });
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        recibo = { status: 1, hash: TX, blockNumber: 1000, logs: [logPaid()] };
        bloque = 1100;
    });

    it('activa el acceso con un pago válido de una wallet de la app', async () => {
        auth();
        filas([{ id: LISTING_ID }]);
        filas([{ purchase_id: PURCHASE }]);
        filas([{ consumer_app_id: CONSUMER, listing_id: LISTING_ID, status: 'active' }]);
        const res = await comprar();
        expect(res.status).toBe(201);
        expect(res.body.subscription.status).toBe('active');
        const ins = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO marketplace_onchain_payments'));
        expect(ins[1].slice(0, 6)).toEqual([PURCHASE, TX, 137, LISTING_ID, CONSUMER, PAGADOR]);
    });

    it('403 si el pagador no es una wallet autorizada de la app (pago ajeno)', async () => {
        auth(['0x' + 'e'.repeat(40)]);
        filas([{ id: LISTING_ID }]);
        const res = await comprar();
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('PAYER_NOT_AUTHORIZED');
    });

    it('409 si el mismo pago ya activó un acceso', async () => {
        auth();
        filas([{ id: LISTING_ID }]);
        filas([]);
        const res = await comprar();
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('PAYMENT_ALREADY_USED');
    });

    it('ignora un Paid emitido por otro contrato', async () => {
        recibo.logs = [logPaid({ address: '0x' + '6'.repeat(40) })];
        auth();
        filas([{ id: LISTING_ID }]);
        expect((await comprar()).body.code).toBe('PAYMENT_NOT_FOUND');
    });

    it('rechaza el pago de otro listing', async () => {
        recibo.logs = [logPaid({ listingId: '99999999-9999-4999-8999-999999999999' })];
        auth();
        filas([{ id: LISTING_ID }]);
        expect((await comprar()).body.code).toBe('PAYMENT_NOT_FOUND');
    });

    it('exige confirmaciones', async () => {
        bloque = 1005;
        auth();
        filas([{ id: LISTING_ID }]);
        const res = await comprar();
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('TX_NOT_CONFIRMED');
    });

    it('rechaza una transacción revertida', async () => {
        recibo.status = 0;
        auth();
        filas([{ id: LISTING_ID }]);
        expect((await comprar()).body.code).toBe('TX_REVERTED');
    });

    it('precio en BEZ: decimal con 18 decimales como máximo', () => {
        expect(settlement.aWei('100').toString()).toBe((100n * 10n ** 18n).toString());
        expect(() => settlement.aWei('-1')).toThrow();
        expect(() => settlement.aWei('1.0000000000000000001')).toThrow();
    });
});
