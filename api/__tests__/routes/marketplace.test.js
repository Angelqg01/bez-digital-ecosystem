/**
 * API Marketplace, paso 1: proveedores, listings en borrador, catálogo y revisión.
 */
const request = require('supertest');
const express = require('express');
const dns = require('dns');
const jwt = require('jsonwebtoken');
const { mockQuery } = require('../helpers');
const { JWT_SECRET } = require('../../config/secrets');
const { decryptSecret } = require('../../services/secretVault');

const marketplaceRoutes = require('../../routes/marketplace');

const app = express();
app.use(express.json());
app.use('/api/gateway/v1/marketplace', marketplaceRoutes);

const BASE = '/api/gateway/v1/marketplace';
const KEY = 'test-mkt-key';
const APP_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const PROVEEDOR = {
    app_id: APP_ID, legal_name: 'Aduanas Sur SL', kyb_status: 'pending', stripe_account_id: null,
    payout_address: null, dpa_signed_at: null, status: 'onboarding', created_at: 'now', updated_at: 'now',
};
const LISTO = { ...PROVEEDOR, kyb_status: 'verified', stripe_account_id: 'acct_123' };

const OPENAPI = {
    openapi: '3.1.0',
    info: { title: 'Tarifas', version: '1.0.0' },
    paths: { '/tariffs/{hs}': { get: { responses: { 200: { description: 'ok' } } } } },
};
const LISTING = {
    slug: 'tarifas-aduana',
    title: 'Tarifas aduaneras',
    version: '1.0.0',
    upstream_url: 'https://api.proveedor.example/v1',
    openapi: OPENAPI,
    pricing: { model: 'per_call', amount_cents: 2, currency: 'eur' },
};

const auth = (scopes = ['marketplace:publish']) =>
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: APP_ID, app_name: 'aduanas-sur', scopes, tier: 'standard', is_active: true }],
        rowCount: 1,
    });
const filas = (rows) => mockQuery.mockResolvedValueOnce({ rows, rowCount: rows.length });
const sql = (fragmento) => mockQuery.mock.calls.find((c) => String(c[0]).includes(fragmento));
const adminToken = () => jwt.sign({ role: 'SUPER_ADMIN', sub: 'admin-1' }, JWT_SECRET, { expiresIn: '1h', issuer: 'bezhas-admin-auth' });

describe('API Marketplace — paso 1', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        jest.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    });
    afterEach(() => jest.restoreAllMocks());

    describe('autenticación y scopes', () => {
        it('401 sin api-key', async () => {
            expect((await request(app).get(`${BASE}/catalog`)).status).toBe(401);
        });

        it('403 publicar sin marketplace:publish', async () => {
            auth(['marketplace:read']);
            const res = await request(app).post(`${BASE}/listings`).set('x-api-key', KEY).send(LISTING);
            expect(res.status).toBe(403);
        });

        it('403 catálogo sin marketplace:read ni :consume', async () => {
            auth(['wallet']);
            expect((await request(app).get(`${BASE}/catalog`).set('x-api-key', KEY)).status).toBe(403);
        });

        it('la api-key no abre las rutas de admin', async () => {
            const res = await request(app).get(`${BASE}/admin/listings`).set('x-api-key', KEY);
            expect(res.status).toBe(401);
            expect(res.body.code).toBe('ADMIN_AUTH_REQUIRED');
        });
    });

    describe('proveedores', () => {
        it('alta: crea la fila de la app llamante y lista lo que falta', async () => {
            auth();
            filas([PROVEEDOR]);
            const res = await request(app).post(`${BASE}/providers`).set('x-api-key', KEY).send({ legal_name: 'Aduanas Sur SL' });
            expect(res.status).toBe(201);
            expect(res.body.missing).toEqual(['kyb_verified', 'stripe_connect_account']);
            expect(sql('INSERT INTO marketplace_providers')[1][0]).toBe(APP_ID);
        });

        it('409 si la app ya es proveedor', async () => {
            auth();
            const res = await request(app).post(`${BASE}/providers`).set('x-api-key', KEY).send({ legal_name: 'Aduanas Sur SL' });
            expect(res.status).toBe(409);
        });

        it('el proveedor no puede marcarse KYB ni Stripe por la API', async () => {
            auth();
            const res = await request(app).patch(`${BASE}/providers/me`).set('x-api-key', KEY)
                .send({ kyb_status: 'verified', stripe_account_id: 'acct_x' });
            expect(res.status).toBe(400);
            expect(sql('UPDATE marketplace_providers')).toBeUndefined();
        });
    });

    describe('POST /listings', () => {
        it('crea el borrador con el secreto cifrado y lo devuelve una sola vez', async () => {
            auth();
            filas([PROVEEDOR]);
            filas([{ id: LISTING_ID, slug: LISTING.slug, status: 'draft' }]);
            const res = await request(app).post(`${BASE}/listings`).set('x-api-key', KEY).send(LISTING);
            expect(res.status).toBe(201);
            expect(res.body.upstreamSecret).toMatch(/^mkts_[0-9a-f]{48}$/);
            const insert = sql('INSERT INTO marketplace_listings');
            expect(insert[1][0]).toBe(APP_ID);
            const guardado = insert[1][6];
            expect(guardado).not.toContain(res.body.upstreamSecret);
            expect(decryptSecret(guardado)).toBe(res.body.upstreamSecret);
            expect(insert[0]).not.toMatch(/RETURNING[\s\S]*upstream_secret[,\s]/);
        });

        it('409 si la app no es proveedor', async () => {
            auth();
            filas([]);
            const res = await request(app).post(`${BASE}/listings`).set('x-api-key', KEY).send(LISTING);
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('PROVIDER_NOT_FOUND');
        });

        it('400 si el upstream resuelve a una IP interna (SSRF)', async () => {
            dns.promises.lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
            auth();
            filas([PROVEEDOR]);
            const res = await request(app).post(`${BASE}/listings`).set('x-api-key', KEY).send(LISTING);
            expect(res.status).toBe(400);
            expect(res.body.field).toBe('upstream_url');
            expect(sql('INSERT INTO marketplace_listings')).toBeUndefined();
        });

        it('400 con el detalle de cada error de forma', async () => {
            auth();
            const res = await request(app).post(`${BASE}/listings`).set('x-api-key', KEY)
                .send({ ...LISTING, slug: 'X', pricing: { model: 'gratis' } });
            expect(res.status).toBe(400);
            expect(res.body.details.length).toBeGreaterThanOrEqual(2);
        });

        it('409 si el slug ya existe', async () => {
            auth();
            filas([PROVEEDOR]);
            mockQuery.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
            const res = await request(app).post(`${BASE}/listings`).set('x-api-key', KEY).send(LISTING);
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('SLUG_TAKEN');
        });
    });

    describe('edición y envío a revisión', () => {
        it('BOLA: GET de un listing ajeno filtra por la app llamante y da 404', async () => {
            auth();
            const res = await request(app).get(`${BASE}/listings/${LISTING_ID}`).set('x-api-key', KEY);
            expect(res.status).toBe(404);
            expect(sql('FROM marketplace_listings WHERE id = $1 AND provider_app_id = $2')[1]).toEqual([LISTING_ID, APP_ID]);
        });

        it('404 con un id que no es UUID, sin consultar la base', async () => {
            auth();
            const res = await request(app).get(`${BASE}/listings/1 OR 1=1`).set('x-api-key', KEY);
            expect(res.status).toBe(404);
            expect(mockQuery).toHaveBeenCalledTimes(1);
        });

        it('PUT sobre un listing en review lo devuelve a borrador', async () => {
            auth();
            filas([{ status: 'review', openapi: OPENAPI, writes: false }]);
            filas([{ id: LISTING_ID, status: 'draft' }]);
            const res = await request(app).put(`${BASE}/listings/${LISTING_ID}`).set('x-api-key', KEY).send({ title: 'Tarifas TARIC' });
            expect(res.status).toBe(200);
            expect(res.body.returnedToDraft).toBe(true);
            expect(sql('UPDATE marketplace_listings')[0]).toContain("status = 'draft'");
        });

        it('PUT 409 sobre un listing live', async () => {
            auth();
            filas([{ status: 'live', openapi: OPENAPI, writes: false }]);
            const res = await request(app).put(`${BASE}/listings/${LISTING_ID}`).set('x-api-key', KEY).send({ title: 'Otro título' });
            expect(res.status).toBe(409);
        });

        it('PUT que quita writes a un OpenAPI con POST se rechaza', async () => {
            auth();
            filas([{ status: 'draft', openapi: { ...OPENAPI, paths: { '/o': { post: {} } } }, writes: true }]);
            const res = await request(app).put(`${BASE}/listings/${LISTING_ID}`).set('x-api-key', KEY).send({ writes: false });
            expect(res.status).toBe(400);
            expect(sql('UPDATE marketplace_listings')).toBeUndefined();
        });

        it('submit 409 con la lista de requisitos pendientes', async () => {
            auth();
            filas([{ id: LISTING_ID, status: 'draft', data_categories: ['contact'] }]);
            filas([PROVEEDOR]);
            const res = await request(app).post(`${BASE}/listings/${LISTING_ID}/submit`).set('x-api-key', KEY);
            expect(res.status).toBe(409);
            expect(res.body.missing).toEqual(['kyb_verified', 'stripe_connect_account', 'dpa_signed']);
        });

        it('submit pasa a review si el proveedor está listo', async () => {
            auth();
            filas([{ id: LISTING_ID, status: 'draft', data_categories: [] }]);
            filas([LISTO]);
            filas([{ id: LISTING_ID, status: 'review' }]);
            const res = await request(app).post(`${BASE}/listings/${LISTING_ID}/submit`).set('x-api-key', KEY);
            expect(res.status).toBe(200);
            expect(res.body.listing.status).toBe('review');
        });

        it('rotar el secreto devuelve uno nuevo y guarda sólo el cifrado', async () => {
            auth();
            filas([{ id: LISTING_ID, upstream_secret_rotated_at: 'now' }]);
            const res = await request(app).post(`${BASE}/listings/${LISTING_ID}/rotate-secret`).set('x-api-key', KEY);
            expect(res.status).toBe(200);
            const upd = sql('SET upstream_secret = $3');
            expect(upd[1].slice(0, 2)).toEqual([LISTING_ID, APP_ID]);
            expect(decryptSecret(upd[1][2])).toBe(res.body.upstreamSecret);
        });
    });

    describe('catálogo', () => {
        it('sólo live, sin upstream y con el OpenAPI apuntando al proxy', async () => {
            auth(['marketplace:read']);
            filas([{
                slug: 'tarifas-aduana', title: 'Tarifas', summary: null, version: '1.0.0',
                pricing: LISTING.pricing, data_categories: [], writes: false, provider_name: 'Aduanas Sur SL',
                openapi: { ...OPENAPI, servers: [{ url: 'https://api.proveedor.example/v1' }] },
            }]);
            const res = await request(app).get(`${BASE}/catalog/tarifas-aduana`).set('x-api-key', KEY);
            expect(res.status).toBe(200);
            expect(JSON.stringify(res.body)).not.toContain('proveedor.example');
            expect(res.body.listing.openapi.servers).toEqual([{ url: '/api/gateway/v1/marketplace/call/tarifas-aduana' }]);
            expect(sql("l.status = 'live'")).toBeDefined();
        });

        it('escapa los comodines de LIKE en la búsqueda', async () => {
            auth(['marketplace:consume']);
            const res = await request(app).get(`${BASE}/catalog?q=100%25_`).set('x-api-key', KEY);
            expect(res.status).toBe(200);
            expect(sql('ILIKE')[1][1]).toBe('100\\%\\_');
        });
    });

    describe('admin', () => {
        it('aprueba sólo si el proveedor sigue cumpliendo los requisitos', async () => {
            filas([{ id: LISTING_ID, status: 'review', data_categories: [], provider_app_id: APP_ID }]);
            filas([{ ...LISTO, kyb_status: 'rejected' }]);
            const res = await request(app).post(`${BASE}/admin/listings/${LISTING_ID}/approve`)
                .set('Authorization', `Bearer ${adminToken()}`);
            expect(res.status).toBe(409);
            expect(res.body.missing).toEqual(['kyb_verified']);
        });

        it('aprueba un listing en review', async () => {
            filas([{ id: LISTING_ID, status: 'review', data_categories: [], provider_app_id: APP_ID }]);
            filas([LISTO]);
            filas([{ id: LISTING_ID, slug: 'tarifas-aduana', status: 'live', reviewed_at: 'now' }]);
            const res = await request(app).post(`${BASE}/admin/listings/${LISTING_ID}/approve`)
                .set('Authorization', `Bearer ${adminToken()}`);
            expect(res.status).toBe(200);
            expect(res.body.listing.status).toBe('live');
        });

        it('suspender exige motivo', async () => {
            const res = await request(app).post(`${BASE}/admin/listings/${LISTING_ID}/suspend`)
                .set('Authorization', `Bearer ${adminToken()}`).send({});
            expect(res.status).toBe(400);
        });

        it('un JWT de usuario normal no vale como admin', async () => {
            const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
            const res = await request(app).get(`${BASE}/admin/listings`).set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(401);
        });
    });
});
