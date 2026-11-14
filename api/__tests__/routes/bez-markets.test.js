/**
 * routes/bez-markets — tokenización, fracciones RWA y swap de BEZ por el Gateway.
 */
const { makeToken } = require('../helpers');
const request = require('supertest');
const express = require('express');
const { ethers } = require('ethers');
const polygon = require('../../services/polygonReader');
const bezMarkets = require('../../routes/bez-markets');

const WALLET = '0x' + 'f'.repeat(40);
const OTRA = '0x' + '1'.repeat(40);

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/gateway/v1', bezMarkets);
    return app;
}

describe('Gateway: mercados de BEZ y RWA', () => {
    const app = buildApp();
    const token = makeToken({ address: WALLET });
    const auth = (r) => r.set('Authorization', `Bearer ${token}`);
    const envAntes = { ...process.env };

    afterEach(() => {
        process.env = { ...envAntes };
        polygon._setLlamador(null);
        jest.clearAllMocks();
    });

    it('exige autenticación', async () => {
        const res = await request(app).get('/api/gateway/v1/bez/swap/status');
        expect(res.status).toBe(401);
    });

    it('GET /bez/swap/status dice que el mercado no está abierto', async () => {
        delete process.env.BEZ_DEX_ROUTER;
        const res = await auth(request(app).get('/api/gateway/v1/bez/swap/status'));
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, activo: false });
    });

    it('POST /bez/swap/prepare sin pool: 503 DEX_NOT_CONFIGURED', async () => {
        delete process.env.BEZ_DEX_ROUTER;
        const res = await auth(request(app).post('/api/gateway/v1/bez/swap/prepare'))
            .send({ lado: 'venta', importe: '100', wallet: WALLET });
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('DEX_NOT_CONFIGURED');
    });

    it('POST /bez/swap/prepare con pool devuelve dos transacciones sin firmar', async () => {
        process.env.BEZ_DEX_ROUTER = '0x' + 'a'.repeat(40);
        polygon._setLlamador(jest.fn().mockResolvedValue([ethers.parseEther('100'), 750_000n]));
        const res = await auth(request(app).post('/api/gateway/v1/bez/swap/prepare'))
            .send({ lado: 'venta', importe: '100', wallet: WALLET });
        expect(res.status).toBe(200);
        expect(res.body.transacciones).toHaveLength(2);
        expect(res.body.recibesEstimado).toEqual({ activo: 'USDC', importe: '0.75' });
    });

    it('GET /bez/swap/quote valida el lado', async () => {
        const res = await auth(request(app).get('/api/gateway/v1/bez/swap/quote')).query({ lado: 'x', importe: '1' });
        expect(res.status).toBe(400);
    });

    it('POST /rwa/tokenize/prepare valida antes de leer la cadena', async () => {
        const llamador = jest.fn();
        polygon._setLlamador(llamador);
        const res = await auth(request(app).post('/api/gateway/v1/rwa/tokenize/prepare'))
            .send({ nombre: 'X', categoria: 'castillo' });
        expect(res.status).toBe(400);
        expect(llamador).not.toHaveBeenCalled();
    });

    it('GET /rwa/:fabrica/assets/:id devuelve la ficha', async () => {
        polygon._setLlamador(jest.fn().mockResolvedValue({
            name: 'Nave', category: 7n, legalDocumentCID: 'QmL', imagesCID: '', totalSupply: 10n, valuationUSD: 100n,
            pricePerFraction: ethers.parseEther('1'), estimatedYield: 0n, creator: WALLET, location: 'Algeciras',
            createdAt: 1790000000n, isActive: true,
        }));
        const res = await auth(request(app).get('/api/gateway/v1/rwa/activos/assets/2'));
        expect(res.status).toBe(200);
        expect(res.body.activo).toMatchObject({ assetId: '2', categoria: 'objeto', fabrica: 'activos' });
    });

    it('GET /rwa/:fabrica/assets con fábrica desconocida: 400', async () => {
        const res = await auth(request(app).get('/api/gateway/v1/rwa/otra/assets/2'));
        expect(res.status).toBe(400);
    });

    it('GET /rwa/:fabrica/creators/:address no deja consultar wallets ajenas', async () => {
        const res = await auth(request(app).get(`/api/gateway/v1/rwa/activos/creators/${OTRA}`));
        expect(res.status).toBe(403);
    });

    it('POST /rwa/sale/buy/prepare no deja comprar en nombre de otra wallet', async () => {
        process.env.RWA_PRIMARY_SALE_ADDRESS = '0x' + '5'.repeat(40);
        const llamador = jest.fn();
        polygon._setLlamador(llamador);
        const res = await auth(request(app).post('/api/gateway/v1/rwa/sale/buy/prepare'))
            .send({ listingId: 1, cantidad: 1, comprador: OTRA });
        expect(res.status).toBe(403);
        expect(llamador).not.toHaveBeenCalled();
    });

    it('POST /rwa/sale/buy/prepare sin contrato de venta: 503 SALE_NOT_DEPLOYED', async () => {
        delete process.env.RWA_PRIMARY_SALE_ADDRESS;
        const res = await auth(request(app).post('/api/gateway/v1/rwa/sale/buy/prepare'))
            .send({ listingId: 1, cantidad: 1, comprador: WALLET });
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('SALE_NOT_DEPLOYED');
    });
    describe('reparto de rentas', () => {
        it('POST /rwa/rent/claim/prepare no deja cobrar en nombre de otra wallet', async () => {
            const llamador = jest.fn();
            polygon._setLlamador(llamador);
            const res = await auth(request(app).post('/api/gateway/v1/rwa/rent/claim/prepare'))
                .send({ distributionId: 1, cuenta: OTRA });
            expect(res.status).toBe(403);
            expect(llamador).not.toHaveBeenCalled();
        });

        it('POST /rwa/rent/claim/prepare sin contrato de reparto: 503 DISTRIBUTOR_NOT_DEPLOYED', async () => {
            delete process.env.RWA_RENT_DISTRIBUTOR_ADDRESS;
            const res = await auth(request(app).post('/api/gateway/v1/rwa/rent/claim/prepare'))
                .send({ distributionId: 1, cuenta: WALLET });
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('DISTRIBUTOR_NOT_DEPLOYED');
        });

        it('POST /rwa/rent/distribute/prepare valida el cuerpo', async () => {
            const res = await auth(request(app).post('/api/gateway/v1/rwa/rent/distribute/prepare'))
                .send({ assetId: 0, emisor: 'no-es-una-direccion', importe: '1,5', token: 'doge' });
            expect(res.status).toBe(400);
            const campos = res.body.errors.map((e) => e.path);
            expect(campos).toEqual(expect.arrayContaining(['assetId', 'emisor', 'importe', 'token']));
        });

        it('POST /rwa/rent/distribute/prepare sin contrato de reparto: 503', async () => {
            delete process.env.RWA_RENT_DISTRIBUTOR_ADDRESS;
            const res = await auth(request(app).post('/api/gateway/v1/rwa/rent/distribute/prepare'))
                .send({ assetId: 1, emisor: WALLET, importe: '100' });
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('DISTRIBUTOR_NOT_DEPLOYED');
        });

        it('GET /rwa/:fabrica/assets/:id/rent/distributions con la cuenta de otro: 403 sin tocar la cadena', async () => {
            const llamador = jest.fn();
            polygon._setLlamador(llamador);
            const res = await auth(request(app).get(`/api/gateway/v1/rwa/activos/assets/3/rent/distributions?cuenta=${OTRA}`));
            expect(res.status).toBe(403);
            expect(llamador).not.toHaveBeenCalled();
        });

        it('GET /rwa/:fabrica/assets/:id/rent/distributions sin contrato de reparto: 503', async () => {
            delete process.env.RWA_RENT_DISTRIBUTOR_ADDRESS;
            const res = await auth(request(app).get('/api/gateway/v1/rwa/activos/assets/3/rent/distributions'));
            expect(res.status).toBe(503);
            expect(res.body.code).toBe('DISTRIBUTOR_NOT_DEPLOYED');
        });

        it('GET /rwa/:fabrica/rent/distributions/:id rechaza una fábrica desconocida', async () => {
            const res = await auth(request(app).get('/api/gateway/v1/rwa/otra/rent/distributions/1'));
            expect(res.status).toBe(400);
        });

        it('GET /rwa/:fabrica/rent/distributions/:id lee el reparto', async () => {
            process.env.RWA_RENT_DISTRIBUTOR_ADDRESS = '0x' + 'd'.repeat(40);
            polygon._setLlamador(jest.fn().mockResolvedValue({
                assetId: 3n, issuer: WALLET, token: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                amount: 900_000_000n, remaining: 300_000_000n, merkleRoot: '0x' + '1'.repeat(64),
                snapshotBlock: 9872n, claimDeadline: BigInt(Math.floor(Date.now() / 1000) + 86400), detailsCID: '',
            }));
            const res = await auth(request(app).get('/api/gateway/v1/rwa/activos/rent/distributions/1'));
            expect(res.status).toBe(200);
            expect(res.body.reparto).toMatchObject({ token: 'USDC', importe: '900.0', sinReclamar: '300.0', abierto: true });
        });
    });
});
