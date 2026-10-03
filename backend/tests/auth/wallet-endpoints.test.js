/**
 * Regresión de seguridad: los endpoints de wallet de /api/auth deben exigir una
 * firma SIWE verificada (nonce de un solo uso). Antes /login-or-register emitía
 * JWT solo con la dirección, y /login-wallet|/register-wallet aceptaban cualquier mensaje.
 */
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { Wallet } = require('ethers');
const { SiweMessage } = require('siwe');

process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.WALLET_AUTH_ALLOWED_DOMAINS = 'localhost:3000';

const mockUsers = new Map();
jest.mock('../../models/pg/User', () => ({
    findByWallet: async (a) => mockUsers.get(a) || null,
    findByEmail: async () => null,
    findOne: async () => null,
    create: async (d) => {
        const id = `u${mockUsers.size + 1}`;
        const u = { id, _id: id, walletAddress: d.walletAddress, username: d.username, roles: d.roles, affiliate: d.affiliate };
        mockUsers.set(d.walletAddress, u);
        return u;
    },
}));
jest.mock('../../middleware/auth.middleware', () => ({ ensureSuperAdminRole: async (u) => u, protect: (_q, _s, n) => n() }));
jest.mock('../../models/mockModels', () => ({ AffiliateEvent: function () { this.save = async () => {}; } }));
['rewards.service', 'email.service', 'totp.service', 'key-management.service', 'account-abstraction.service'].forEach((m) =>
    jest.doMock(`../../services/${m}`, () => ({ grantReferralReward: async () => ({}) })));
// Módulos de sesión/2FA que no intervienen en estos endpoints (evitan cargar winston/redis).
jest.mock('../../middleware/refreshTokenSystem', () => ({ verifyTokenMiddleware: (_q, _s, n) => n() }));
jest.mock('../../middleware/twoFactorAuth', () => ({}));
jest.mock('../../bridge', () => ({ bridgeCore: { getAdapter: () => null } }));

const walletAuth = require('../../services/walletAuth.service');

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = { info() {}, warn() {}, error() {} }; next(); });
app.use('/api/auth', require('../../routes/auth.routes'));

async function signed(wallet, over = {}) {
    const { nonce } = await walletAuth.issueNonce(wallet.address);
    const message = new SiweMessage({
        domain: 'localhost:3000', address: wallet.address, statement: 'Sign in', uri: 'http://localhost:3000', version: '1',
        chainId: 137, nonce, issuedAt: new Date().toISOString(), expirationTime: new Date(Date.now() + 600000).toISOString(), ...over,
    }).prepareMessage();
    return { message, signature: await wallet.signMessage(message) };
}

beforeEach(() => mockUsers.clear());

describe('POST /api/auth/login-or-register', () => {
    test('el ataque original (solo walletAddress, sin firma) ya NO da token', async () => {
        const victim = Wallet.createRandom();
        const res = await request(app).post('/api/auth/login-or-register').send({ walletAddress: victim.address });
        expect(res.status).toBe(400);
        expect(res.body.token).toBeUndefined();
    });

    test('firma válida: registra (201) y luego inicia sesión (200) con JWT válido', async () => {
        const w = Wallet.createRandom();
        const r1 = await request(app).post('/api/auth/login-or-register').send(await signed(w)).expect(201);
        expect(jwt.verify(r1.body.token, process.env.JWT_SECRET).id).toBe(r1.body.user.id);
        await request(app).post('/api/auth/login-or-register').send(await signed(w)).expect(200);
    });

    test('firma de otra clave sobre el mensaje de la víctima → 401 y sin usuario creado', async () => {
        const victim = Wallet.createRandom(); const attacker = Wallet.createRandom();
        const s = await signed(victim);
        s.signature = await attacker.signMessage(s.message);
        await request(app).post('/api/auth/login-or-register').send(s).expect(401);
        expect(mockUsers.size).toBe(0);
    });

    test('replay de una firma válida → 401', async () => {
        const w = Wallet.createRandom();
        const s = await signed(w);
        await request(app).post('/api/auth/login-or-register').send(s).expect(201);
        await request(app).post('/api/auth/login-or-register').send(s).expect(401);
    });
});

describe('POST /api/auth/login-wallet', () => {
    test('mensaje arbitrario firmado (formato antiguo) es rechazado', async () => {
        const w = Wallet.createRandom();
        const message = 'cualquier cosa';
        const res = await request(app).post('/api/auth/login-wallet').send({ walletAddress: w.address, message, signature: await w.signMessage(message) });
        expect(res.status).toBe(400);
        expect(res.body.token).toBeUndefined();
    });

    test('wallet no registrada → 404; registrada → 200', async () => {
        const w = Wallet.createRandom();
        await request(app).post('/api/auth/login-wallet').send(await signed(w)).expect(404);
        await request(app).post('/api/auth/register-wallet').send(await signed(w)).expect(201);
        const ok = await request(app).post('/api/auth/login-wallet').send(await signed(w)).expect(200);
        expect(ok.body.token).toBeTruthy();
    });
});

describe('POST /api/auth/register-wallet', () => {
    test('registra con firma válida y respeta username; segunda vez → 409', async () => {
        const w = Wallet.createRandom();
        const r = await request(app).post('/api/auth/register-wallet').send({ ...(await signed(w)), username: 'angel_1' }).expect(201);
        expect(r.body.user.username).toBe('angel_1');
        await request(app).post('/api/auth/register-wallet').send(await signed(w)).expect(409);
    });

    test('sin firma válida no crea usuario', async () => {
        const w = Wallet.createRandom();
        await request(app).post('/api/auth/register-wallet').send({ walletAddress: w.address, message: 'hola', signature: '0x00' }).expect(400);
        expect(mockUsers.size).toBe(0);
    });
});

describe('GET /api/auth/nonce', () => {
    test('devuelve nonce SIWE de servidor; sin dirección válida → 400', async () => {
        const w = Wallet.createRandom();
        const ok = await request(app).get('/api/auth/nonce').query({ address: w.address }).expect(200);
        expect(ok.body.nonce).toMatch(/^[a-zA-Z0-9]{8,}$/);
        await request(app).get('/api/auth/nonce').expect(400);
    });
});

describe('compatibilidad con el frontend antiguo (frontend/src/utils/siwe.js)', () => {
    test('el mensaje que construye el cliente es aceptado por el backend', async () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(path.join(__dirname, '../../../frontend/src/utils/siwe.js'), 'utf8').replace(/^export /gm, '');
        const buildSiweMessage = new Function(`${src}; return buildSiweMessage;`)();

        const w = Wallet.createRandom();
        const { nonce } = await walletAuth.issueNonce(w.address);
        const message = buildSiweMessage({
            domain: 'localhost:3000', address: w.address, statement: 'Iniciar sesion en BeZhas.', uri: 'http://localhost:3000',
            chainId: 137, nonce, issuedAt: new Date().toISOString(), expirationTime: new Date(Date.now() + 600000).toISOString(),
        });
        const res = await request(app).post('/api/auth/login-or-register').send({ message, signature: await w.signMessage(message) });
        expect(res.status).toBe(201);
        expect(res.body.token).toBeTruthy();
    });
});

describe('statements SIWE de los frontends', () => {
    test('son ASCII y la librería los acepta (con tildes el parser falla y el login no funciona)', () => {
        const fs = require('fs');
        const path = require('path');
        const files = ['frontend-next/src/hooks/useWalletLogin.ts', 'frontend/src/context/AuthContext.jsx'];
        const w = Wallet.createRandom();
        for (const f of files) {
            const src = fs.readFileSync(path.join(__dirname, '../../..', f), 'utf8');
            const m = src.match(/statement:\s*(["'])(.*?)\1/);
            expect(m).not.toBeNull();
            expect(/^[\x20-\x7E]*$/.test(m[2])).toBe(true);
            expect(() => new SiweMessage({ domain: 'localhost:3000', address: w.address, statement: m[2], uri: 'http://localhost:3000', version: '1', chainId: 1, nonce: 'abcdefgh12' })).not.toThrow();
        }
        // y se documenta el fallo original:
        expect(() => new SiweMessage({ domain: 'localhost:3000', address: w.address, statement: 'sesión', uri: 'http://localhost:3000', version: '1', chainId: 1, nonce: 'abcdefgh12' })).toThrow();
    });
});
