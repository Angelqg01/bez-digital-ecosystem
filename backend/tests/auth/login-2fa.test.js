/**
 * Login con 2FA: la contraseña se verifica primero y el servidor emite un token de
 * 5 min; verify-login-2fa deriva el usuario de ese token (antes aceptaba un userId
 * del cliente, sin límite de intentos) y además existía un `const user` reasignado
 * que hacía fallar con 500 todo login por email.
 */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';

const mockState = { users: new Map(), validCode: '123456' };
const mockQuery = (u) => ({ select: async () => u });
jest.mock('../../models/pg/User', () => ({
    findByEmail: (e) => mockQuery(mockState.users.get(e) || null),
    findById: (id) => mockQuery([...mockState.users.values()].find((u) => u._id === id) || null),
    findByWallet: async () => null,
    findOne: async () => null,
}));
jest.mock('../../middleware/auth.middleware', () => ({ ensureSuperAdminRole: async (u) => u, protect: (_q, _s, n) => n() }));
jest.mock('../../models/mockModels', () => ({ AffiliateEvent: function () { this.save = async () => {}; } }));
jest.mock('../../services/totp.service', () => ({
    is2FAEnabled: () => true,
    decryptSecret: () => 'secret',
    verify2FAToken: (code) => code === mockState.validCode,
    verifyBackupCode: (code, codes) => (codes.includes(code) ? { valid: true, remainingCodes: codes.filter((c) => c !== code) } : { valid: false, remainingCodes: codes }),
}));
['rewards.service', 'email.service', 'key-management.service', 'account-abstraction.service'].forEach((m) =>
    jest.doMock(`../../services/${m}`, () => ({ grantReferralReward: async () => ({}), sendLoginAlert: async () => {} })));
jest.mock('../../middleware/refreshTokenSystem', () => ({ verifyTokenMiddleware: (_q, _s, n) => n() }));
jest.mock('../../middleware/twoFactorAuth', () => ({}));
jest.mock('../../bridge', () => ({ bridgeCore: { getAdapter: () => null } }));

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = { info() {}, warn() {}, error() {} }; next(); });
app.use('/api/auth', require('../../routes/auth.routes'));

const addUser = (over = {}) => {
    const u = { _id: 'u1', id: 'u1', email: 'a@b.co', username: 'a', roles: ['USER'], password: bcrypt.hashSync('secret123', 4), is2FAEnabled: false, affiliate: {}, ...over };
    mockState.users.set(u.email, u);
    return u;
};

beforeEach(() => mockState.users.clear());

describe('POST /api/auth/login-email', () => {
    test('sin 2FA devuelve token (no 500 por reasignar const)', async () => {
        addUser();
        const res = await request(app).post('/api/auth/login-email').send({ email: 'a@b.co', password: 'secret123' });
        expect(res.status).toBe(200);
        expect(jwt.verify(res.body.token, process.env.JWT_SECRET).id).toBe('u1');
    });

    test('con 2FA NO devuelve sesión: solo twoFactorToken y sin userId', async () => {
        addUser({ is2FAEnabled: true });
        const res = await request(app).post('/api/auth/login-email').send({ email: 'a@b.co', password: 'secret123' });
        expect(res.status).toBe(200);
        expect(res.body.requires2FA).toBe(true);
        expect(res.body.token).toBeUndefined();
        expect(res.body.userId).toBeUndefined();
        expect(jwt.verify(res.body.twoFactorToken, process.env.JWT_SECRET).purpose).toBe('2fa-login');
    });
});

describe('POST /api/auth/verify-login-2fa', () => {
    const step1 = async () => (await request(app).post('/api/auth/login-email').send({ email: 'a@b.co', password: 'secret123' })).body.twoFactorToken;

    test('código correcto con twoFactorToken emite sesión', async () => {
        addUser({ is2FAEnabled: true });
        const res = await request(app).post('/api/auth/verify-login-2fa').send({ twoFactorToken: await step1(), token: '123456' });
        expect(res.status).toBe(200);
        expect(jwt.verify(res.body.token, process.env.JWT_SECRET).id).toBe('u1');
    });

    test('código de respaldo válido emite sesión y se consume', async () => {
        const u = addUser({ is2FAEnabled: true, backupCodes: ['ABCD1234', 'ZZZZ9999'], save: async () => {} });
        const res = await request(app).post('/api/auth/verify-login-2fa').send({ twoFactorToken: await step1(), token: 'ABCD1234' });
        expect(res.status).toBe(200);
        expect(u.backupCodes).toEqual(['ZZZZ9999']);
    });

    test('código erróneo → 401', async () => {
        addUser({ is2FAEnabled: true });
        const res = await request(app).post('/api/auth/verify-login-2fa').send({ twoFactorToken: await step1(), token: '000000' });
        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    test('el ataque anterior (solo userId + código) ya no funciona', async () => {
        addUser({ is2FAEnabled: true });
        const res = await request(app).post('/api/auth/verify-login-2fa').send({ userId: 'u1', token: '123456' });
        expect(res.status).toBe(400);
        expect(res.body.token).toBeUndefined();
    });

    test('un JWT de sesión normal no sirve como twoFactorToken', async () => {
        addUser({ is2FAEnabled: true });
        const sessionJwt = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
        const res = await request(app).post('/api/auth/verify-login-2fa').send({ twoFactorToken: sessionJwt, token: '123456' });
        expect(res.status).toBe(401);
    });

    test('token caducado → 401', async () => {
        addUser({ is2FAEnabled: true });
        const expired = jwt.sign({ id: 'u1', purpose: '2fa-login' }, process.env.JWT_SECRET, { expiresIn: -10 });
        const res = await request(app).post('/api/auth/verify-login-2fa').send({ twoFactorToken: expired, token: '123456' });
        expect(res.status).toBe(401);
    });
});
