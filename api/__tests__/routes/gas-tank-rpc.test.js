const express = require('express');
const request = require('supertest');

// Autenticación simulada: la clave "key-ok" es una app con scope gas; "key-noscope" no tiene scope; otra cosa, 401.
jest.mock('../../middleware/gateway-auth', () => ({
    authenticateGateway: (req, res, next) => {
        const k = req.headers['x-api-key'];
        if (k === 'key-ok') { req.registeredApp = { id: 'app-1', scopes: ['gas'] }; return next(); }
        if (k === 'key-noscope') { req.registeredApp = { id: 'app-2', scopes: ['wallet'] }; return next(); }
        return res.status(401).json({ error: 'Invalid API key' });
    },
    requireScope: (...sc) => (req, res, next) => (req.registeredApp.scopes.some((s) => sc.includes(s)) ? next() : res.status(403).json({ error: 'Insufficient scope' })),
}));
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...a) => mockQuery(...a) }));
const mockMethods = { pm_getPaymasterStubData: jest.fn(), pm_getPaymasterData: jest.fn() };
jest.mock('../../services/gasTank/erc7677', () => {
    const real = jest.requireActual('../../services/gasTank/erc7677');
    return { ...real, METHODS: mockMethods };
});

const app = express();
app.use(express.json());
app.use('/api/rpc/paymaster', require('../../routes/gas-tank-rpc'));

const call = (path, key, body) => request(app).post(path).set(key ? { 'x-api-key': key } : {}).send(body);
const rpc = (method, params = [{}, '0xEP', '0x89']) => ({ jsonrpc: '2.0', id: 9, method, params });

beforeEach(() => { mockQuery.mockReset(); Object.values(mockMethods).forEach((f) => f.mockReset()); });

test('sin clave o con clave inválida: 401; sin scope gas: 403', async () => {
    expect((await call('/api/rpc/paymaster', null, rpc('pm_getPaymasterData'))).status).toBe(401);
    expect((await call('/api/rpc/paymaster', 'nope', rpc('pm_getPaymasterData'))).status).toBe(401);
    expect((await call('/api/rpc/paymaster', 'key-noscope', rpc('pm_getPaymasterData'))).status).toBe(403);
});

test('la clave también vale en la URL, y la cabecera tiene prioridad', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'org-1' }] });
    mockMethods.pm_getPaymasterData.mockResolvedValue({ paymaster: '0x1' });
    const viaUrl = await call('/api/rpc/paymaster/key-ok', null, rpc('pm_getPaymasterData'));
    expect(viaUrl.body).toMatchObject({ jsonrpc: '2.0', id: 9, result: { paymaster: '0x1' } });
    const mixed = await call('/api/rpc/paymaster/key-noscope', 'key-ok', rpc('pm_getPaymasterData'));
    expect(mixed.body.result).toBeDefined();
});

test('resuelve la organización de la app y llama al método con orgId, appId y params', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'org-1' }] });
    mockMethods.pm_getPaymasterStubData.mockResolvedValue({ isFinal: false });
    const params = [{ sender: '0x1' }, '0xEP', '0x89', { x: 1 }];
    const res = await call('/api/rpc/paymaster', 'key-ok', rpc('pm_getPaymasterStubData', params));
    expect(res.body.result).toEqual({ isFinal: false });
    expect(mockMethods.pm_getPaymasterStubData).toHaveBeenCalledWith({ orgId: 'org-1', appId: 'app-1', params });
});

test('errores JSON-RPC con HTTP 200: método desconocido, parámetros, app sin organización, política denegada, interno', async () => {
    expect((await call('/api/rpc/paymaster', 'key-ok', rpc('eth_call'))).body.error.code).toBe(-32601);
    expect((await call('/api/rpc/paymaster', 'key-ok', { jsonrpc: '2.0', id: 1, method: 'pm_getPaymasterData', params: [] })).body.error.code).toBe(-32602);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect((await call('/api/rpc/paymaster', 'key-ok', rpc('pm_getPaymasterData'))).body.error.code).toBe(-32001);

    mockQuery.mockResolvedValue({ rows: [{ id: 'org-1' }] });
    mockMethods.pm_getPaymasterData.mockRejectedValueOnce(Object.assign(new Error('no permitido'), { status: 403, code: 'TARGET_NOT_ALLOWED' }));
    const denied = await call('/api/rpc/paymaster', 'key-ok', rpc('pm_getPaymasterData'));
    expect(denied.status).toBe(200);
    expect(denied.body.error).toMatchObject({ code: -32001, data: { code: 'TARGET_NOT_ALLOWED' } });

    mockMethods.pm_getPaymasterData.mockRejectedValueOnce(new Error('connection to db:5432 refused'));
    const internal = await call('/api/rpc/paymaster', 'key-ok', rpc('pm_getPaymasterData'));
    expect(internal.body.error).toEqual({ code: -32603, message: 'Error interno' });
});
