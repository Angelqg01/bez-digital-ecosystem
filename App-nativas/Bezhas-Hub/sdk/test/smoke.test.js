/**
 * Smoke test del SDK (sin red): inyecta un fetch falso y verifica que cada
 * método del manifest construye la petición correcta (URL, verbo, headers,
 * path params, query y body).
 *
 * Uso: node test/smoke.test.js   (también via `pnpm test` en sdk/)
 */
'use strict';

const assert = require('node:assert');
const { BezhasHubClient, BezhasHubError, ENDPOINTS } = require('../index.js');

let calls = [];
const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
    };
};

async function main() {
    const hub = new BezhasHubClient({
        baseUrl: 'https://hub.test/api',
        apiKey: 'test-key',
        fetch: fakeFetch,
    });

    // 1) Todos los métodos del manifest existen como funciones
    for (const key of Object.keys(ENDPOINTS)) {
        const [ns, method] = key.split('.');
        assert.strictEqual(typeof hub[ns]?.[method], 'function', `Falta hub.${key}()`);
    }

    // 2) GET simple con headers correctos
    calls = [];
    await hub.health.get();
    assert.strictEqual(calls[0].init.method, 'GET');
    assert.strictEqual(calls[0].url, 'https://hub.test/api/health');
    assert.strictEqual(calls[0].init.headers['X-API-Key'], 'test-key');

    // 3) Path params interpolados y escapados
    calls = [];
    await hub.escrow.get('42');
    assert.strictEqual(calls[0].url, 'https://hub.test/api/escrow/42');
    calls = [];
    await hub.clothingRental.byCustomer('0xAbC/123');
    assert.ok(calls[0].url.endsWith('/clothing-rental/customer/0xAbC%2F123'), 'path param sin escapar');

    // 4) Query params
    calls = [];
    await hub.web3.indexerEvents({ query: { contractName: 'BezhasToken', limit: 10, skip: undefined } });
    const u = new URL(calls[0].url);
    assert.strictEqual(u.searchParams.get('contractName'), 'BezhasToken');
    assert.strictEqual(u.searchParams.get('limit'), '10');
    assert.strictEqual(u.searchParams.has('skip'), false, 'undefined no debe serializarse');

    // 5) POST con body JSON
    calls = [];
    await hub.escrow.create({ body: { clientWallet: '0x1' } });
    assert.strictEqual(calls[0].init.method, 'POST');
    assert.strictEqual(calls[0].init.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(calls[0].init.body), { clientWallet: '0x1' });

    // 6) Falta path param → error claro
    assert.throws(() => hub.escrow.get(), /Falta el parámetro de ruta/);

    // 7) Error HTTP → BezhasHubError con status y body
    const errFetch = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: 'Invalid API Key' }) });
    const hubErr = new BezhasHubClient({ baseUrl: 'https://hub.test/api', fetch: errFetch });
    await assert.rejects(() => hubErr.health.get(), (e) => {
        assert.ok(e instanceof BezhasHubError);
        assert.strictEqual(e.status, 403);
        assert.strictEqual(e.message, 'Invalid API Key');
        return true;
    });

    console.log(`✅ SDK smoke: ${Object.keys(ENDPOINTS).length} métodos generados, 7 grupos de aserciones OK`);
}

main().catch((e) => {
    console.error('❌ SDK smoke falló:', e.message);
    process.exit(1);
});
