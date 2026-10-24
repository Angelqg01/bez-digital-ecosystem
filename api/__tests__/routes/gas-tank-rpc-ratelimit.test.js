process.env.GAS_RPC_KEY_RATE_LIMIT = '3';
process.env.GAS_RPC_IP_RATE_LIMIT = '8';

const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/gateway-auth', () => ({
    authenticateGateway: (req, res, next) => {
        if ((req.headers['x-api-key'] || '').startsWith('key-ok')) { req.registeredApp = { id: 'app-1', scopes: ['gas'] }; return next(); }
        return res.status(401).json({ error: 'Invalid API key' });
    },
    requireScope: () => (_req, _res, next) => next(),
}));
jest.mock('../../db/pool', () => ({ query: async () => ({ rows: [{ id: 'org-1' }] }) }));
jest.mock('../../services/gasTank/erc7677', () => ({
    ...jest.requireActual('../../services/gasTank/erc7677'),
    METHODS: { pm_getPaymasterData: async () => ({ ok: true }) },
}));

const build = () => {
    let router;
    jest.isolateModules(() => { router = require('../../routes/gas-tank-rpc'); });
    const app = express();
    app.use(express.json());
    app.use('/rpc', router);
    return app;
};
const body = { jsonrpc: '2.0', id: 1, method: 'pm_getPaymasterData', params: [{}, '0x', '0x1'] };

test('límite por clave: la cuarta petición recibe 429 JSON-RPC -32005; otra clave sigue pasando', async () => {
    const app = build();
    for (let i = 0; i < 3; i += 1) expect((await request(app).post('/rpc').set('x-api-key', 'key-ok-A').send(body)).status).toBe(200);
    const limited = await request(app).post('/rpc').set('x-api-key', 'key-ok-A').send(body);
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({ code: -32005 });
    expect((await request(app).post('/rpc').set('x-api-key', 'key-ok-B').send(body)).status).toBe(200);
});

test('la clave en la URL cuenta contra el mismo límite que la cabecera', async () => {
    const app = build();
    for (let i = 0; i < 3; i += 1) await request(app).post('/rpc/key-ok-C').send(body);
    expect((await request(app).post('/rpc').set('x-api-key', 'key-ok-C').send(body)).status).toBe(429);
});

test('límite por IP: una avalancha de claves falsas se corta antes de autenticar', async () => {
    const app = build();
    const statuses = [];
    for (let i = 0; i < 10; i += 1) statuses.push((await request(app).post('/rpc').set('x-api-key', `fake-${i}`).send(body)).status);
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
});
