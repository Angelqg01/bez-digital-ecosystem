/**
 * Regresión: la cabecera `x-wallet-address` la declara el cliente, así que NUNCA identifica a nadie.
 * Antes bastaba enviar la dirección de otra persona (p. ej. un admin) para actuar como ella.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';

const VICTIM = '0x' + 'a'.repeat(40);
const ATTACKER_WALLET = '0x' + 'b'.repeat(40);

const mockUsers = new Map();
const mockCreate = jest.fn();
jest.mock('../../models/pg/User', () => ({
    findById: (id) => ({ select: async () => mockUsers.get(String(id)) || null }),
    findByWallet: async (w) => [...mockUsers.values()].find((u) => u.walletAddress === w) || null,
    findOne: async () => null,
    create: (...a) => mockCreate(...a),
}));
jest.mock('../../models/mockModels', () => ({ UserRole: { ADMIN: 'ADMIN', DEVELOPER: 'DEVELOPER' }, AffiliateEvent: function () {} }), { virtual: false });
jest.mock('mongoose', () => ({ Types: { ObjectId: function () { return 'dev'; } }, connection: { readyState: 0 } }), { virtual: true });
jest.mock('../../middleware/refreshTokenSystem', () => ({ verifyTokenMiddleware: (_q, _s, n) => n() }));
jest.mock('../../middleware/twoFactorAuth', () => ({}));
jest.mock('../../bridge', () => ({ bridgeCore: { getAdapter: () => null } }));
['rewards.service', 'email.service', 'totp.service', 'key-management.service', 'account-abstraction.service'].forEach((m) =>
    jest.doMock(`../../services/${m}`, () => ({ grantReferralReward: async () => ({}) })));

const mockWorkflows = new Map();
jest.mock('../../models/pg/Workflow', () => {
    function Workflow(d) { Object.assign(this, d); this._id = `wf${mockWorkflows.size + 1}`; this.save = async () => { mockWorkflows.set(this._id, this); }; }
    Workflow.findById = (id) => { const w = mockWorkflows.get(id); const r = Promise.resolve(w || null); r.lean = () => w || null; r.select = () => r; return r; };
    Workflow.find = () => ({ select() { return this; }, sort() { return this; }, lean: async () => [...mockWorkflows.values()] });
    Workflow.findByIdAndDelete = async (id) => mockWorkflows.delete(id);
    return Workflow;
});
jest.mock('../../services/automationEngine', () => ({ executeWorkflow: async () => ({}), TOOL_ENDPOINTS: {} }));
jest.mock('../../services/leadFinder', () => ({ findLeads: async () => [], enrichLead: async () => ({}) }));
jest.mock('../../services/clothing-rental.service', () => ({ createRental: async (d) => ({ id: 'r1', ...d }), recordMerchantDecision: async () => ({}) }));

const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const bearer = (id) => ({ Authorization: `Bearer ${sign(id)}` });

const admin = { _id: 'admin1', id: 'admin1', walletAddress: VICTIM, role: 'ADMIN', roles: ['ADMIN'] };
const mallory = { _id: 'mallory', id: 'mallory', walletAddress: ATTACKER_WALLET, role: 'USER', roles: ['USER'] };
const banned = { _id: 'banned', id: 'banned', walletAddress: '0x' + 'c'.repeat(40), role: 'USER', isBanned: true };

beforeEach(() => {
    mockUsers.clear(); mockWorkflows.clear(); mockCreate.mockReset();
    [admin, mallory, banned].forEach((u) => mockUsers.set(u.id, u));
});

const appWith = (mount, router) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.log = { info() {}, warn() {}, error() {} }; next(); });
    app.use(mount, router);
    return app;
};

describe('ninguna ruta del servidor confía en x-wallet-address', () => {
    const roots = ['routes', 'middleware', 'services', 'chat', 'bridge', 'controllers'];
    const walk = (p) => !fs.existsSync(p) ? [] : fs.statSync(p).isDirectory()
        ? fs.readdirSync(p).flatMap((f) => (f === 'node_modules' ? [] : walk(path.join(p, f))))
        : (p.endsWith('.js') ? [p] : []);

    test('no hay lecturas de la cabecera como identidad', () => {
        const re = /headers\s*\[\s*['"]x-wallet-address['"]\s*\]|headers\.['"]?x-wallet-address|\.get\(\s*['"]x-wallet-address['"]\s*\)/i;
        const offenders = roots.flatMap((r) => walk(path.join(__dirname, '../..', r))).filter((f) => re.test(fs.readFileSync(f, 'utf8')));
        expect(offenders).toEqual([]);
    });
});

describe('walletIdentity', () => {
    const { authenticatedWallet, requireWallet } = require('../../middleware/walletIdentity');

    test('solo toma la wallet de req.user / req.admin, nunca de la cabecera', () => {
        expect(authenticatedWallet({ headers: { 'x-wallet-address': VICTIM } })).toBeNull();
        expect(authenticatedWallet({ user: { walletAddress: VICTIM.toUpperCase().replace('0X', '0x') } })).toBe(VICTIM);
        expect(authenticatedWallet({ admin: { wallet_address: ATTACKER_WALLET } })).toBe(ATTACKER_WALLET);
        expect(authenticatedWallet({ user: { walletAddress: 'no-es-una-wallet' } })).toBeNull();
    });

    test('requireWallet responde 401 sin sesión con wallet', () => {
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        requireWallet({ headers: { 'x-wallet-address': VICTIM } }, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});

describe('requireAuth (JWT)', () => {
    const { requireAuth, requireAdmin } = require('../../middleware/auth.middleware');
    const app = appWith('/t', (() => {
        const r = express.Router();
        r.get('/me', requireAuth, (req, res) => res.json({ id: req.user.id }));
        r.get('/admin', requireAuth, requireAdmin, (req, res) => res.json({ ok: true }));
        return r;
    })());

    test('solo la cabecera con la wallet de un admin NO autentica (escalada a admin)', async () => {
        await request(app).get('/t/admin').set('x-wallet-address', VICTIM).expect(401);
        await request(app).get('/t/me').set('x-wallet-address', VICTIM).expect(401);
        await request(app).get('/t/me').send({ walletAddress: VICTIM }).expect(401);
    });

    test('con JWT válido la identidad es la del token aunque la cabecera diga otra', async () => {
        const res = await request(app).get('/t/me').set(bearer('mallory')).set('x-wallet-address', VICTIM).expect(200);
        expect(res.body.id).toBe('mallory');
        await request(app).get('/t/admin').set(bearer('mallory')).set('x-wallet-address', VICTIM).expect(403);
        await request(app).get('/t/admin').set(bearer('admin1')).expect(200);
    });

    test('un usuario baneado recibe 403', async () => {
        await request(app).get('/t/me').set(bearer('banned')).expect(403);
    });
});

describe('GET /api/auth/me', () => {
    const app = appWith('/api/auth', require('../../routes/auth.routes'));

    test('sin JWT 401 y no crea usuarios (antes creaba una cuenta por cualquier wallet)', async () => {
        await request(app).get('/api/auth/me').set('x-wallet-address', '0x' + 'd'.repeat(40)).expect(401);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    test('con JWT devuelve el usuario del token, no el de la cabecera', async () => {
        const res = await request(app).get('/api/auth/me').set(bearer('mallory')).set('x-wallet-address', VICTIM).expect(200);
        expect(res.body.user.walletAddress).toBe(ATTACKER_WALLET);
    });
});

describe('automation workflows', () => {
    const app = appWith('/api/automation', require('../../routes/automation.routes'));

    test('sin JWT 401 aunque se envíe la cabecera', async () => {
        await request(app).post('/api/automation/workflows').set('x-wallet-address', VICTIM).send({ name: 'x' }).expect(401);
        await request(app).get('/api/automation/workflows').set('x-wallet-address', VICTIM).expect(401);
    });

    test('el creador sale del token y otro usuario no ve, ejecuta ni borra el workflow', async () => {
        const created = await request(app).post('/api/automation/workflows').set(bearer('admin1')).set('x-wallet-address', ATTACKER_WALLET).send({ name: 'wf' }).expect(201);
        const id = created.body.data._id;
        expect(created.body.data.createdBy).toBe(VICTIM);

        await request(app).get(`/api/automation/workflows/${id}`).set(bearer('mallory')).expect(404);
        await request(app).post(`/api/automation/workflows/${id}/run`).set(bearer('mallory')).expect(404);
        await request(app).get(`/api/automation/workflows/${id}/logs`).set(bearer('mallory')).expect(404);
        await request(app).delete(`/api/automation/workflows/${id}`).set(bearer('mallory')).set('x-wallet-address', VICTIM).expect(403);
        expect(mockWorkflows.has(id)).toBe(true);

        await request(app).get(`/api/automation/workflows/${id}`).set(bearer('admin1')).expect(200);
        await request(app).delete(`/api/automation/workflows/${id}`).set(bearer('admin1')).expect(200);
    });
});

describe('clothing-rental', () => {
    const app = appWith('/api/clothing-rental', require('../../routes/clothingRental.routes'));
    const body = { transactionType: 'RENTAL', merchantId: 'm1', items: [{ name: 'a', category: 'b' }] };

    test('sin JWT 401; con JWT el cliente es la wallet del token, no la del body ni la cabecera', async () => {
        await request(app).post('/api/clothing-rental').set('x-wallet-address', VICTIM).send(body).expect(401);
        const res = await request(app).post('/api/clothing-rental').set(bearer('mallory')).set('x-wallet-address', VICTIM).send({ ...body, customerWallet: VICTIM });
        expect(res.status).toBe(201);
        expect(JSON.stringify(res.body)).toContain(ATTACKER_WALLET);
        expect(JSON.stringify(res.body)).not.toContain(VICTIM);
    });
});
