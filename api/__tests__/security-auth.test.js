/**
 * Security regression tests for the auth hardening:
 *  - wallet-signature login nonce is single-use (anti-replay)
 *  - verifyWalletSignature rejects missing/replayed nonces
 *  - AUTH_BYPASS can never be enabled under NODE_ENV=production
 */

// Avoid real Redis/DB side effects; walletNonce falls back to its in-memory store.
jest.mock('../cache/redis', () => ({
    connectRedis: jest.fn().mockRejectedValue(new Error('no redis in test')),
    cacheGet: jest.fn(),
    cacheSet: jest.fn(),
    publish: jest.fn(),
    checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
}));
jest.mock('../db/pool', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }));

const { ethers } = require('ethers');
const walletNonce = require('../utils/walletNonce');
const { verifyWalletSignature } = require('../middleware/security');

function mockRes() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
}

describe('walletNonce (anti-replay)', () => {
    it('issues a nonce embedded in the message and consumes it exactly once', async () => {
        const addr = ethers.Wallet.createRandom().address;
        const { nonce, message } = await walletNonce.issueNonce(addr);

        expect(nonce).toMatch(/^[a-f0-9]{32,}$/);
        expect(walletNonce.extractNonce(message)).toBe(nonce);

        const first = await walletNonce.consumeNonce(addr);
        expect(first).toBe(nonce);

        // Single-use: a second consume must return null.
        const second = await walletNonce.consumeNonce(addr);
        expect(second).toBeNull();
    });
});

describe('verifyWalletSignature', () => {
    it('rejects a login message without a nonce', async () => {
        const wallet = ethers.Wallet.createRandom();
        const message = 'BeZhas Login\nno nonce here';
        const signature = await wallet.signMessage(message);

        const req = { body: { address: wallet.address, signature, message } };
        const res = mockRes();
        const next = jest.fn();

        await verifyWalletSignature(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    it('accepts a valid signature+nonce once, then rejects the replay', async () => {
        const wallet = ethers.Wallet.createRandom();
        const { message } = await walletNonce.issueNonce(wallet.address);
        const signature = await wallet.signMessage(message);

        // First attempt: valid → next() called.
        const req1 = { body: { address: wallet.address, signature, message } };
        const res1 = mockRes();
        const next1 = jest.fn();
        await verifyWalletSignature(req1, res1, next1);
        expect(next1).toHaveBeenCalled();
        expect(req1.walletAddress).toBe(wallet.address);

        // Replay the exact same signature+message → nonce already consumed → 401.
        const req2 = { body: { address: wallet.address, signature, message } };
        const res2 = mockRes();
        const next2 = jest.fn();
        await verifyWalletSignature(req2, res2, next2);
        expect(next2).not.toHaveBeenCalled();
        expect(res2.statusCode).toBe(401);
    });

    it('rejects a forged signer (address mismatch)', async () => {
        const wallet = ethers.Wallet.createRandom();
        const other = ethers.Wallet.createRandom();
        const { message } = await walletNonce.issueNonce(wallet.address);
        const signature = await other.signMessage(message); // signed by the wrong key

        const req = { body: { address: wallet.address, signature, message } };
        const res = mockRes();
        const next = jest.fn();
        await verifyWalletSignature(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });
});

describe('AUTH_BYPASS hardening (config/secrets)', () => {
    const ORIGINAL_ENV = { ...process.env };
    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        jest.resetModules();
    });

    it('is impossible in production even if AUTH_BYPASS=true', () => {
        jest.resetModules();
        process.env.NODE_ENV = 'production';
        process.env.AUTH_BYPASS = 'true';
        process.env.JWT_SECRET = 'a-strong-production-secret';
        process.env.INTERNAL_API_KEY = 'a-strong-internal-key';
        const secrets = require('../config/secrets');
        expect(secrets.AUTH_BYPASS).toBe(false);
        expect(secrets.IS_PRODUCTION).toBe(true);
    });

    it('refuses to boot in production with the well-known dev secret', () => {
        jest.resetModules();
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'dev-only-secret';
        process.env.INTERNAL_API_KEY = 'something';
        expect(() => require('../config/secrets')).toThrow(/development secrets/i);
    });

    it('enables bypass only with explicit opt-in in non-production', () => {
        jest.resetModules();
        process.env.NODE_ENV = 'development';
        process.env.AUTH_BYPASS = 'true';
        delete process.env.JWT_SECRET;
        delete process.env.INTERNAL_API_KEY;
        const secrets = require('../config/secrets');
        expect(secrets.AUTH_BYPASS).toBe(true);
    });
});
