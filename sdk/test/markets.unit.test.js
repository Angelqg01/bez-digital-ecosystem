const assert = require('node:assert/strict');
const test = require('node:test');
const { ethers } = require('ethers');

const { GatewayClient } = require('../gateway-client');
const RWAManager = require('../rwa');

/** Sustituye fetch y devuelve las llamadas hechas. */
function conFetch(respuesta, fn) {
    const original = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
        calls.push({ url, options, body: options.body ? JSON.parse(options.body) : undefined });
        return { ok: true, status: 200, async json() { return { success: true, ...respuesta }; } };
    };
    return Promise.resolve(fn(calls)).finally(() => { global.fetch = original; });
}

const client = () => new GatewayClient({ gatewayUrl: 'https://api.bezhas.test/api/gateway/v1', apiKey: 'bzk_test' });
const WALLET = '0x4444444444444444444444444444444444444444';

test('bez.quote y bez.prepareSwap usan las rutas y nombres del Gateway', () => conFetch({}, async (calls) => {
    const gw = client();
    await gw.bez.quote({ side: 'venta', amount: 1000 });
    await gw.bez.prepareSwap({ side: 'compra', amount: '25.5', wallet: WALLET, slippageBps: 50 });

    assert.equal(calls[0].url, 'https://api.bezhas.test/api/gateway/v1/bez/swap/quote?lado=venta&importe=1000');
    assert.equal(calls[1].url, 'https://api.bezhas.test/api/gateway/v1/bez/swap/prepare');
    assert.deepEqual(calls[1].body, { lado: 'compra', importe: '25.5', wallet: WALLET, deslizamientoBps: 50 });
}));

test('rwa.prepareTokenization traduce los campos al Gateway', () => conFetch({}, async (calls) => {
    await client().rwa.prepareTokenization({
        name: 'Nave', category: 'objeto', legalCID: 'QmLegal', supply: 100, valuationUSD: 5000,
        pricePerFractionBEZ: 2, estimatedYieldPct: 5, location: 'Algeciras',
    });
    assert.equal(calls[0].url.endsWith('/rwa/tokenize/prepare'), true);
    assert.deepEqual(calls[0].body, {
        fabrica: 'activos', nombre: 'Nave', categoria: 'objeto', cidDocumentacion: 'QmLegal', fracciones: 100,
        valoracionUsd: 5000, precioFraccionBez: '2', rendimientoAnualPct: 5, ubicacion: 'Algeciras',
    });
}));

test('rwa: venta primaria y consultas', () => conFetch({}, async (calls) => {
    const gw = client();
    await gw.rwa.getAsset({ factory: 'industrial', assetId: 7 });
    await gw.rwa.getListing({ listingId: 3 });
    await gw.rwa.prepareListing({ assetId: 7, amount: 10, pricePerFractionBEZ: '1.5', seller: WALLET });
    await gw.rwa.preparePurchase({ listingId: 3, amount: 2, buyer: WALLET });

    assert.equal(calls[0].url.endsWith('/rwa/industrial/assets/7'), true);
    assert.equal(calls[1].url.endsWith('/rwa/activos/sale/listings/3'), true);
    assert.deepEqual(calls[2].body, { fabrica: 'activos', assetId: 7, cantidad: 10, precioFraccionBez: '1.5', vendedor: WALLET });
    assert.deepEqual(calls[3].body, { fabrica: 'activos', listingId: 3, cantidad: 2, comprador: WALLET });
}));

test('RWAManager usa el ABI real del RWAFactory desplegado', () => {
    const rwa = new RWAManager({ provider: new ethers.JsonRpcProvider('http://127.0.0.1:1', 137, { staticNetwork: true }) });
    assert.equal(rwa.rwaFactoryAddress, RWAManager.RWA_FACTORIES.activos);
    const iface = new ethers.Interface(rwa.rwaFactoryABI);
    // El selector tiene que ser el de la función que existe en el contrato.
    assert.ok(iface.getFunction('tokenizeAsset'));
    assert.ok(iface.getFunction('getCreatorAssets'));
    assert.equal(iface.getFunction('createAsset'), null);
    assert.equal(new RWAManager({ factory: 'industrial', provider: rwa.provider }).rwaFactoryAddress,
        RWAManager.RWA_FACTORIES.industrial);
});

test('RWAManager.tokenizeAsset rechaza categorías y documentación inválidas sin tocar la red', async () => {
    const rwa = new RWAManager({ provider: new ethers.JsonRpcProvider('http://127.0.0.1:1', 137, { staticNetwork: true }) });
    const r1 = await rwa.tokenizeAsset({ category: 'castillo', legalCID: 'Qm' }, {});
    assert.equal(r1.success, false);
    assert.match(r1.error, /Categoría no válida/);
    const r2 = await rwa.tokenizeAsset({ category: 'objeto' }, {});
    assert.match(r2.error, /legalCID/);
});
