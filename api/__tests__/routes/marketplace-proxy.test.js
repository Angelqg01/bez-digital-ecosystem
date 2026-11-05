/**
 * API Marketplace, paso 2: proxy de sólo lectura, contrato OpenAPI, registro de
 * llamadas y recibos firmados.
 */
const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { mockQuery, mockCheckRateLimit } = require('../helpers');
const { JWT_SECRET } = require('../../config/secrets');
const { encryptSecret } = require('../../services/secretVault');

const mockSafeFetch = jest.fn();
jest.mock('../../utils/safeFetch', () => ({
    ...jest.requireActual('../../utils/safeFetch'),
    safeFetch: (...a) => mockSafeFetch(...a),
}));

const breaker = require('../../services/marketplace/circuitBreaker');
const receipts = require('../../services/marketplace/receipts');
const marketplaceRoutes = require('../../routes/marketplace');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1/marketplace', marketplaceRoutes);

const BASE = '/api/gateway/v1/marketplace';
const KEY = 'test-consumer-key';
const CONSUMER = '33333333-3333-4333-8333-333333333333';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const SECRETO = 'mkts_' + 'a'.repeat(48);

const OPENAPI = {
    openapi: '3.1.0',
    info: { title: 'Tarifas', version: '1.0.0' },
    paths: {
        '/tariffs/{hs}': {
            get: {
                parameters: [
                    { name: 'hs', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9]{4,10}$' } },
                    { name: 'country', in: 'query', schema: { type: 'string', enum: ['ES', 'PT'] } },
                ],
                responses: {
                    200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Tariff' } } } },
                },
            },
        },
    },
    components: {
        schemas: {
            Tariff: { type: 'object', required: ['hs', 'rate'], properties: { hs: { type: 'string' }, rate: { type: 'number' } } },
        },
    },
};
const LISTING = {
    id: LISTING_ID, slug: 'tarifas-aduana', upstream_url: 'https://api.proveedor.example/v1/',
    upstream_secret: encryptSecret(SECRETO), openapi: OPENAPI,
    pricing: { model: 'per_call', amount_cents: 2, currency: 'eur' }, writes: false, updated_at: '2026-11-05T00:00:00Z',
};

const auth = (scopes = ['marketplace:consume']) => mockQuery.mockResolvedValueOnce({
    rows: [{ id: CONSUMER, app_name: 'naviera', scopes, tier: 'standard', is_active: true }], rowCount: 1,
});
const filas = (rows) => mockQuery.mockResolvedValueOnce({ rows, rowCount: rows.length });
const sql = (f) => mockQuery.mock.calls.find((c) => String(c[0]).includes(f));
const upstream = (status, body, tipo = 'application/json') => mockSafeFetch.mockResolvedValueOnce({
    ok: status < 300, status, headers: { 'content-type': tipo },
    text: async () => JSON.stringify(body), json: async () => body,
});
/** auth + listing + acceso: el camino hasta el upstream. */
const preparado = (listing = LISTING) => { auth(); filas([listing]); filas([{ '?column?': 1 }]); };
const llamar = (ruta = '/tariffs/0101?country=ES&debug=1') => request(app).get(`${BASE}/call/tarifas-aduana${ruta}`).set('x-api-key', KEY);

describe('API Marketplace — proxy (paso 2)', () => {
    beforeEach(() => {
        process.env.MARKETPLACE_PROXY_ENABLED = 'true';
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        mockSafeFetch.mockReset();
        mockCheckRateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 60, remaining: 59, resetInSec: 60 });
        breaker._estados.clear();
    });
    afterAll(() => { delete process.env.MARKETPLACE_PROXY_ENABLED; });

    it('apagado por defecto: 503 sin tocar la base', async () => {
        delete process.env.MARKETPLACE_PROXY_ENABLED;
        auth();
        const res = await llamar();
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('MARKETPLACE_PROXY_DISABLED');
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('exige marketplace:consume', async () => {
        auth(['marketplace:read']);
        expect((await llamar()).status).toBe(403);
    });

    it('un listing de sólo lectura no admite POST (405)', async () => {
        auth();
        filas([LISTING]);
        const res = await request(app).post(`${BASE}/call/tarifas-aduana/tariffs/0101`).set('x-api-key', KEY).send({});
        expect(res.status).toBe(405);
        expect(res.body.code).toBe('READ_ONLY_LISTING');
        expect(res.headers.allow).toBe('GET, HEAD');
    });

    it('403 sin acceso concedido', async () => {
        auth();
        filas([LISTING]);
        const res = await llamar();
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('NOT_SUBSCRIBED');
        expect(mockSafeFetch).not.toHaveBeenCalled();
    });

    it('429 al superar el límite por (consumidor, listing)', async () => {
        preparado();
        mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, resetInSec: 12 });
        const res = await llamar();
        expect(res.status).toBe(429);
        expect(res.headers['retry-after']).toBe('12');
        expect(mockCheckRateLimit.mock.calls.at(-1)[0]).toBe(`mkt:${LISTING_ID}:${CONSUMER}`);
    });

    it('reenvía firmado, filtra la respuesta, registra la llamada y devuelve el recibo', async () => {
        preparado();
        upstream(200, { hs: '0101', rate: 4.5, interno: 'no-declarado' });
        const res = await llamar();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ hs: '0101', rate: 4.5 });

        const [url, opts] = mockSafeFetch.mock.calls[0];
        // Sin la barra final del upstream, y sin el parámetro no declarado.
        expect(url).toBe('https://api.proveedor.example/v1/tariffs/0101?country=ES');
        const h = opts.headers;
        expect(h['x-api-key']).toBeUndefined();
        expect(h['X-BeZhas-Consumer']).toMatch(/^c_[0-9a-f]{32}$/);
        expect(h['X-BeZhas-Consumer']).not.toContain(CONSUMER);
        const esperada = crypto.createHmac('sha256', SECRETO)
            .update(`${h['X-BeZhas-Timestamp']}.${h['X-BeZhas-Nonce']}.GET./tariffs/0101?country=ES.`).digest('hex');
        expect(h['X-BeZhas-Signature']).toBe(`sha256=${esperada}`);
        expect(opts.maxBytes).toBe(5 * 1024 * 1024);

        const insert = sql('INSERT INTO marketplace_calls');
        expect(insert[1][0]).toBe(res.headers['x-bezhas-receipt']);
        expect(insert[1].slice(1, 4)).toEqual([LISTING_ID, CONSUMER, 200]);
        expect(insert[1][5]).toBe(crypto.createHash('sha256').update(JSON.stringify(res.body)).digest('hex'));
        expect(insert[0]).toContain('0, 0)');
    });

    it.each([
        ['ruta no declarada', '/admin', 404, 'ROUTE_NOT_DECLARED'],
        ['parámetro que no cumple el patrón', '/tariffs/abc', 400, 'INVALID_REQUEST'],
        ['enum de query', '/tariffs/0101?country=FR', 400, 'INVALID_REQUEST'],
        ['barra codificada', '/tariffs/01%2F..%2Fadmin', 400, 'INVALID_REQUEST'],
        ['query con forma de objeto', '/tariffs/0101?country[a]=ES', 400, 'INVALID_REQUEST'],
    ])('400/404 sin llamar al proveedor: %s', async (_c, ruta, status, code) => {
        preparado();
        const res = await llamar(ruta);
        expect(res.status).toBe(status);
        expect(res.body.code).toBe(code);
        expect(mockSafeFetch).not.toHaveBeenCalled();
    });

    it('502 si la respuesta no cumple el contrato, sin reenviar el cuerpo', async () => {
        preparado();
        upstream(200, { hs: '0101', rate: 'secreto-interno' });
        const res = await llamar();
        expect(res.status).toBe(502);
        expect(res.body.code).toBe('RESPONSE_CONTRACT_VIOLATION');
        expect(JSON.stringify(res.body)).not.toContain('secreto-interno');
        expect(sql('INSERT INTO marketplace_calls')).toBeUndefined();
    });

    it('502 si el proveedor no responde JSON', async () => {
        preparado();
        upstream(200, '<html>', 'text/html');
        expect((await llamar()).body.code).toBe('UPSTREAM_NOT_JSON');
    });

    it('un 4xx del proveedor se devuelve sin su cuerpo y no se registra', async () => {
        preparado();
        upstream(404, { stack: 'at Server.handler (/srv/app.js:12)' });
        const res = await llamar();
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('UPSTREAM_REJECTED');
        expect(JSON.stringify(res.body)).not.toContain('/srv/app.js');
        expect(sql('INSERT INTO marketplace_calls')).toBeUndefined();
    });

    it('tras 5 fallos seguidos abre el circuito y no vuelve a llamar', async () => {
        for (let i = 0; i < breaker.UMBRAL; i += 1) {
            preparado();
            mockSafeFetch.mockRejectedValueOnce(new Error('Timeout tras 10000 ms.'));
            expect((await llamar()).status).toBe(502);
        }
        preparado();
        const res = await llamar();
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('UPSTREAM_CIRCUIT_OPEN');
        expect(mockSafeFetch).toHaveBeenCalledTimes(breaker.UMBRAL);
    });

    it('si falla el registro, responde igual pero sin recibo', async () => {
        preparado();
        upstream(200, { hs: '0101', rate: 1 });
        mockQuery.mockRejectedValueOnce(new Error('db caída'));
        const res = await llamar();
        expect(res.status).toBe(200);
        expect(res.headers['x-bezhas-receipt']).toBeUndefined();
    });
});

describe('API Marketplace — escritura con mTLS e idempotencia (paso 6)', () => {
    const OPENAPI_W = {
        openapi: '3.1.0',
        info: { title: 'Pedidos', version: '1.0.0' },
        paths: {
            '/orders': {
                post: {
                    requestBody: {
                        required: true,
                        content: { 'application/json': { schema: {
                            type: 'object', required: ['sku', 'qty'], additionalProperties: false,
                            properties: { sku: { type: 'string' }, qty: { type: 'integer', minimum: 1 } },
                        } } },
                    },
                    responses: { 201: { content: { 'application/json': { schema: { type: 'object', properties: { orderId: { type: 'string' } } } } } } },
                },
            },
            '/orders/{id}': { delete: { parameters: [{ name: 'id', in: 'path', schema: { type: 'string' } }], responses: { 204: { description: 'borrado' } } } },
        },
    };
    const LW = { ...LISTING, writes: true, openapi: OPENAPI_W, upstream_spki_pin: null, updated_at: '2026-11-05T01:00:00Z' };
    const authW = (scopes = ['marketplace:consume', 'marketplace:consume:write']) => auth(scopes);
    const pedir = (body = { sku: 'A-1', qty: 2 }, clave = 'pedido-0001') => request(app)
        .post(`${BASE}/call/tarifas-aduana/orders`).set('x-api-key', KEY).set('Idempotency-Key', clave).send(body);
    /** auth + listing + acceso + reserva de idempotencia concedida. */
    const listoW = () => { authW(); filas([LW]); filas([{ '?column?': 1 }]); filas([{ status: 'in_progress' }]); };

    beforeAll(() => {
        process.env.MARKETPLACE_MTLS_CERT = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
        process.env.MARKETPLACE_MTLS_KEY = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----';
    });
    afterAll(() => { delete process.env.MARKETPLACE_MTLS_CERT; delete process.env.MARKETPLACE_MTLS_KEY; });
    beforeEach(() => {
        process.env.MARKETPLACE_PROXY_ENABLED = 'true';
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        mockSafeFetch.mockReset();
        mockCheckRateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 60, remaining: 59, resetInSec: 60 });
        breaker._estados.clear();
    });

    it('exige el scope marketplace:consume:write', async () => {
        authW(['marketplace:consume']);
        filas([LW]);
        expect((await pedir()).body.code).toBe('WRITE_SCOPE_REQUIRED');
    });

    it('exige Idempotency-Key', async () => {
        authW();
        filas([LW]);
        const res = await request(app).post(`${BASE}/call/tarifas-aduana/orders`).set('x-api-key', KEY).send({ sku: 'A', qty: 1 });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('sin certificado de cliente no se reenvía ninguna escritura', async () => {
        const cert = process.env.MARKETPLACE_MTLS_CERT;
        delete process.env.MARKETPLACE_MTLS_CERT;
        authW();
        filas([LW]);
        const res = await pedir();
        process.env.MARKETPLACE_MTLS_CERT = cert;
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('MTLS_NOT_CONFIGURED');
    });

    it('valida el cuerpo contra el contrato antes de reservar la clave', async () => {
        authW();
        filas([LW]);
        filas([{ '?column?': 1 }]);
        const res = await pedir({ sku: 'A-1', qty: 0, extra: true });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_REQUEST');
        expect(sql('INSERT INTO marketplace_idempotency')).toBeUndefined();
        expect(mockSafeFetch).not.toHaveBeenCalled();
    });

    it('reenvía con mTLS, firma el cuerpo y una clave de idempotencia opaca, y cierra con recibo', async () => {
        listoW();
        upstream(201, { orderId: 'o-1', interno: 'x' });
        const res = await pedir();
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ orderId: 'o-1' });

        const [url, opts] = mockSafeFetch.mock.calls[0];
        expect(url).toBe('https://api.proveedor.example/v1/orders');
        expect(opts.method).toBe('POST');
        expect(opts.body).toBe(JSON.stringify({ sku: 'A-1', qty: 2 }));
        expect(opts.tls.cert).toContain('BEGIN CERTIFICATE');
        expect(opts.tls.key).toContain('PRIVATE KEY');
        const h = opts.headers;
        expect(h['Idempotency-Key']).toMatch(/^[0-9a-f]{64}$/);
        expect(h['Idempotency-Key']).not.toContain('pedido-0001');
        const esperada = crypto.createHmac('sha256', SECRETO)
            .update(`${h['X-BeZhas-Timestamp']}.${h['X-BeZhas-Nonce']}.POST./orders.${opts.body}`).digest('hex');
        expect(h['X-BeZhas-Signature']).toBe(`sha256=${esperada}`);

        const cierre = mockQuery.mock.calls.find((c) => String(c[0]).includes('UPDATE marketplace_idempotency'));
        expect(cierre[1].slice(3)).toEqual(['completed', 201, res.headers['x-bezhas-receipt']]);
    });

    it('la misma clave ya completada devuelve el recibo, no repite la escritura', async () => {
        authW();
        filas([LW]);
        filas([{ '?column?': 1 }]);
        filas([]); // la reserva no se concede
        const reqHash = crypto.createHash('sha256').update(`POST /orders\n${JSON.stringify({ sku: 'A-1', qty: 2 })}`).digest('hex');
        filas([{ status: 'completed', request_hash: reqHash, http_status: 201, call_id: '44444444-4444-4444-8444-444444444444' }]);
        const res = await pedir();
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ replayed: true, upstreamStatus: 201, receipt: '44444444-4444-4444-8444-444444444444' });
        expect(res.headers['idempotent-replayed']).toBe('true');
        expect(mockSafeFetch).not.toHaveBeenCalled();
    });

    it('la misma clave con otra petición es 422', async () => {
        authW();
        filas([LW]);
        filas([{ '?column?': 1 }]);
        filas([]);
        filas([{ status: 'completed', request_hash: 'f'.repeat(64), http_status: 201, call_id: null }]);
        expect((await pedir()).status).toBe(422);
    });

    it('un timeout deja el resultado como desconocido y pide reintentar con la misma clave', async () => {
        listoW();
        mockSafeFetch.mockRejectedValueOnce(new Error('Timeout tras 10000 ms.'));
        const res = await pedir();
        expect(res.status).toBe(502);
        expect(res.body.code).toBe('UPSTREAM_OUTCOME_UNKNOWN');
        const cierre = mockQuery.mock.calls.find((c) => String(c[0]).includes('UPDATE marketplace_idempotency'));
        expect(cierre[1][3]).toBe('unknown');
    });

    it('DELETE sin cuerpo con 204 responde 204 y registra la llamada', async () => {
        listoW();
        mockSafeFetch.mockResolvedValueOnce({ ok: true, status: 204, headers: {}, text: async () => '', json: async () => null });
        const res = await request(app).delete(`${BASE}/call/tarifas-aduana/orders/o-1`).set('x-api-key', KEY).set('Idempotency-Key', 'borrar-o-1');
        expect(res.status).toBe(204);
        expect(mockSafeFetch.mock.calls[0][1].body).toBeUndefined();
        expect(sql('INSERT INTO marketplace_calls')).toBeDefined();
    });

    it('415 si el cuerpo no es JSON', async () => {
        authW();
        filas([LW]);
        filas([{ '?column?': 1 }]);
        const res = await request(app).post(`${BASE}/call/tarifas-aduana/orders`).set('x-api-key', KEY)
            .set('Idempotency-Key', 'pedido-0002').set('Content-Type', 'text/plain').send('sku=A');
        expect(res.status).toBe(415);
    });
});

describe('API Marketplace — recibos y accesos piloto', () => {
    const CALL_ID = '44444444-4444-4444-8444-444444444444';
    const FILA = {
        id: CALL_ID, listing_id: LISTING_ID, consumer_app_id: CONSUMER, at: '2026-11-05T10:00:00Z', http_status: 200,
        req_hash: 'a'.repeat(64), resp_hash: 'b'.repeat(64), amount_cents: 0, fee_cents: 0, slug: 'tarifas-aduana',
        currency: 'eur', batch_id: null,
    };

    beforeAll(() => {
        const par = crypto.generateKeyPairSync('ec', {
            namedCurve: 'prime256v1',
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
            publicKeyEncoding: { type: 'spki', format: 'pem' },
        });
        process.env.MARKETPLACE_RECEIPT_PRIVATE_KEY = Buffer.from(par.privateKey).toString('base64');
        process.env.MARKETPLACE_RECEIPT_PUBLIC_KEY = Buffer.from(par.publicKey).toString('base64');
    });
    afterAll(() => {
        delete process.env.MARKETPLACE_RECEIPT_PRIVATE_KEY;
        delete process.env.MARKETPLACE_RECEIPT_PUBLIC_KEY;
        receipts._reset();
    });
    beforeEach(() => {
        receipts._reset();
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('en producción sin claves, 503 en vez de un recibo sin firma', async () => {
        const antes = { ...process.env };
        delete process.env.MARKETPLACE_RECEIPT_PRIVATE_KEY;
        delete process.env.MARKETPLACE_RECEIPT_PUBLIC_KEY;
        process.env.NODE_ENV = 'production';
        receipts._reset();
        auth();
        const res = await request(app).get(`${BASE}/receipts/${CALL_ID}`).set('x-api-key', KEY);
        process.env = antes;
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('RECEIPTS_UNAVAILABLE');
    });

    it('recibo firmado ES256 verificable con la JWKS pública', async () => {
        auth();
        filas([FILA]);
        const res = await request(app).get(`${BASE}/receipts/${CALL_ID}`).set('x-api-key', KEY);
        expect(res.status).toBe(200);
        expect(sql('c.consumer_app_id = $2 OR l.provider_app_id = $2')[1]).toEqual([CALL_ID, CONSUMER]);

        const keys = await request(app).get(`${BASE}/receipts/keys`);
        expect(keys.status).toBe(200);
        const publica = crypto.createPublicKey({ key: keys.body.keys[0], format: 'jwk' });
        const verificado = jwt.verify(res.body.signature, publica, { algorithms: ['ES256'], issuer: 'bezhas-marketplace' });
        expect(verificado.call_id).toBe(CALL_ID);
        expect(verificado.consumer).not.toContain(CONSUMER);
        expect(res.body.anchor).toBeNull();
    });

    it('404 para quien no es parte de la llamada', async () => {
        auth();
        const res = await request(app).get(`${BASE}/receipts/${CALL_ID}`).set('x-api-key', KEY);
        expect(res.status).toBe(404);
    });

    it('conceder acceso piloto exige sesión SuperAdmin', async () => {
        const sinAdmin = await request(app).post(`${BASE}/admin/listings/${LISTING_ID}/grants`).set('x-api-key', KEY)
            .send({ consumer_app_id: CONSUMER });
        expect(sinAdmin.status).toBe(401);

        filas([{ consumer_app_id: CONSUMER, listing_id: LISTING_ID, status: 'active' }]);
        const token = jwt.sign({ role: 'SUPER_ADMIN', sub: 'a' }, JWT_SECRET, { expiresIn: '1h', issuer: 'bezhas-admin-auth' });
        const res = await request(app).post(`${BASE}/admin/listings/${LISTING_ID}/grants`)
            .set('Authorization', `Bearer ${token}`).send({ consumer_app_id: CONSUMER });
        expect(res.status).toBe(201);
        expect(sql('INSERT INTO marketplace_subscriptions')[1]).toEqual([CONSUMER, LISTING_ID]);
    });
});
