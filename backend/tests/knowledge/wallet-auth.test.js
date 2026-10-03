
// tests/setup.js fija REDIS_URL globalmente; estos tests ejercitan los nonces en memoria (el almacén Redis se prueba en wallet-nonce-store.test.js).
delete process.env.REDIS_URL;
delete process.env.REDIS_HOST;
delete process.env.REDIS_PORT;
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { Wallet } = require('ethers');
const { SiweMessage } = require('siwe');

process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.WALLET_AUTH_ALLOWED_DOMAINS = 'localhost:3000,bezhas.com';

const svc = require('../../services/walletAuth.service');

const makeUserModel = () => {
    const rows = new Map();
    return {
        rows,
        findByWallet: async (a) => rows.get(a) || null,
        create: async (d) => { const u = { id: `id_${rows.size + 1}`, _id: `id_${rows.size + 1}`, roles: d.roles, username: d.username, walletAddress: d.walletAddress }; rows.set(d.walletAddress, u); return u; },
    };
};
const ensureSuperAdminRole = async (u) => u;

async function signedMessage(wallet, nonce, over = {}) {
    const msg = new SiweMessage({
        domain: 'localhost:3000', address: wallet.address, statement: 'Sign in to BeZhas', uri: 'http://localhost:3000',
        version: '1', chainId: 137, nonce, issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(), ...over,
    });
    const message = msg.prepareMessage();
    return { message, signature: await wallet.signMessage(message) };
}

describe('walletAuth (SIWE → JWT)', () => {
    const wallet = Wallet.createRandom();
    const deps = () => ({ User: makeUserModel(), ensureSuperAdminRole });

    test('registro con firma válida emite un JWT que protect aceptaría', async () => {
        const d = deps();
        const { nonce } = await svc.issueNonce(wallet.address);
        const out = await svc.loginOrRegisterWithWallet(await signedMessage(wallet, nonce), d);
        expect(out.isNewUser).toBe(true);
        expect(out.user.walletAddress).toBe(wallet.address.toLowerCase());
        expect(jwt.verify(out.token, process.env.JWT_SECRET).id).toBe(out.user.id);
    });

    test('segundo login reutiliza el usuario existente', async () => {
        const d = deps();
        const a = await svc.loginOrRegisterWithWallet(await signedMessage(wallet, (await svc.issueNonce(wallet.address)).nonce), d);
        const b = await svc.loginOrRegisterWithWallet(await signedMessage(wallet, (await svc.issueNonce(wallet.address)).nonce), d);
        expect(a.isNewUser).toBe(true);
        expect(b.isNewUser).toBe(false);
        expect(b.user.id).toBe(a.user.id);
    });

    test('replay: el nonce es de un solo uso', async () => {
        const d = deps();
        const signed = await signedMessage(wallet, (await svc.issueNonce(wallet.address)).nonce);
        await svc.loginOrRegisterWithWallet(signed, d);
        await expect(svc.loginOrRegisterWithWallet(signed, d)).rejects.toMatchObject({ status: 401 });
    });

    test('nonce inventado por el cliente es rechazado', async () => {
        const signed = await signedMessage(wallet, 'nonceInventado123');
        await expect(svc.loginOrRegisterWithWallet(signed, deps())).rejects.toMatchObject({ status: 401 });
    });

    test('nonce ligado a la dirección: otra wallet no puede usarlo', async () => {
        const attacker = Wallet.createRandom();
        const { nonce } = await svc.issueNonce(wallet.address);
        await expect(svc.loginOrRegisterWithWallet(await signedMessage(attacker, nonce), deps())).rejects.toMatchObject({ status: 401 });
    });

    test('suplantación: firmar con otra clave un mensaje que declara la dirección de la víctima', async () => {
        const attacker = Wallet.createRandom();
        const { nonce } = await svc.issueNonce(wallet.address);
        const signed = await signedMessage(wallet, nonce); // mensaje de la víctima
        signed.signature = await attacker.signMessage(signed.message); // firma del atacante
        await expect(svc.loginOrRegisterWithWallet(signed, deps())).rejects.toMatchObject({ status: 401 });
    });

    test('dominio no permitido (phishing) es rechazado', async () => {
        const { nonce } = await svc.issueNonce(wallet.address);
        await expect(svc.loginOrRegisterWithWallet(await signedMessage(wallet, nonce, { domain: 'evil.example', uri: 'https://evil.example' }), deps())).rejects.toMatchObject({ status: 401 });
    });

    test('sin expirationTime, caducado o demasiado largo es rechazado', async () => {
        for (const over of [{ expirationTime: undefined }, { expirationTime: new Date(Date.now() - 1000).toISOString(), issuedAt: new Date(Date.now() - 5000).toISOString() }, { expirationTime: new Date(Date.now() + 24 * 3600e3).toISOString() }]) {
            const { nonce } = await svc.issueNonce(wallet.address);
            await expect(svc.loginOrRegisterWithWallet(await signedMessage(wallet, nonce, over), deps())).rejects.toMatchObject({ status: 401 });
        }
    });

    test('sin JWT_SECRET en producción no se emite token', async () => {
        const saved = process.env.JWT_SECRET; const env = process.env.NODE_ENV;
        delete process.env.JWT_SECRET; process.env.NODE_ENV = 'production';
        try {
            const { nonce } = await svc.issueNonce(wallet.address);
            await expect(svc.loginOrRegisterWithWallet(await signedMessage(wallet, nonce), deps())).rejects.toMatchObject({ status: 503 });
        } finally { process.env.JWT_SECRET = saved; process.env.NODE_ENV = env; }
    });

    test('entradas inválidas: dirección y mensaje basura', async () => {
        await expect(svc.issueNonce('0x123')).rejects.toThrow('inválida');
        await expect(svc.loginOrRegisterWithWallet({ message: 'basura', signature: '0x00' }, deps())).rejects.toMatchObject({ status: 400 });
    });
});

describe('POST /api/wallet-auth', () => {
    const app = express();
    app.use(express.json());
    app.use('/api/wallet-auth', require('../../routes/wallet-auth.routes'));

    test('nonce devuelve nonce y dominios; dirección inválida → 400', async () => {
        const wallet = Wallet.createRandom();
        const ok = await request(app).post('/api/wallet-auth/nonce').send({ address: wallet.address }).expect(200);
        expect(ok.body.nonce).toMatch(/^[a-zA-Z0-9]{8,}$/);
        await request(app).post('/api/wallet-auth/nonce').send({ address: 'x' }).expect(400);
        await request(app).post('/api/wallet-auth/verify').send({}).expect(400);
    });
});
