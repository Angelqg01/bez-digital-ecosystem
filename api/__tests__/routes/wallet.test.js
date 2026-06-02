const request = require('supertest');
const { mockWalletService, makeToken } = require('../helpers');
const app = require('../../index');

const VALID_ADDR = '0x' + 'f'.repeat(40);
const WALLET_ADDR = '0x' + '2'.repeat(40);

describe('Routes: /api/wallet', () => {
    beforeEach(() => jest.clearAllMocks());

    // ── Smart Wallet ──
    describe('POST /create', () => {
        it('creates smart wallet for authenticated user', async () => {
            const token = makeToken();
            mockWalletService.createSmartWallet.mockResolvedValueOnce({ walletAddress: WALLET_ADDR });
            const res = await request(app)
                .post('/api/wallet/create')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.walletAddress).toBe(WALLET_ADDR);
        });

        it('returns 401 without token', async () => {
            const res = await request(app).post('/api/wallet/create').send({});
            expect(res.status).toBe(401);
        });
    });

    describe('GET /my-wallets', () => {
        it('returns user wallets', async () => {
            const token = makeToken();
            mockWalletService.getUserWallets.mockResolvedValueOnce([{ address: WALLET_ADDR }]);
            const res = await request(app)
                .get('/api/wallet/my-wallets')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.wallets).toHaveLength(1);
        });
    });

    describe('GET /info/:address', () => {
        it('returns wallet info', async () => {
            mockWalletService.getSmartWalletInfo.mockResolvedValueOnce({ owner: VALID_ADDR, balance: '100' });
            const res = await request(app).get(`/api/wallet/info/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.owner).toBe(VALID_ADDR);
        });

        it('returns 400 for invalid address', async () => {
            const res = await request(app).get('/api/wallet/info/notanaddress');
            expect(res.status).toBe(400);
        });
    });

    describe('GET /daily-limit/:address', () => {
        it('returns remaining daily limit', async () => {
            mockWalletService.getRemainingDailyLimit.mockResolvedValueOnce('500');
            const res = await request(app).get(`/api/wallet/daily-limit/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.remainingDailyLimit).toBe('500');
        });
    });

    describe('GET /portfolio', () => {
        it('returns portfolio for authenticated user', async () => {
            const token = makeToken();
            mockWalletService.getWalletPortfolio.mockResolvedValueOnce({ total: '1000' });
            const res = await request(app)
                .get('/api/wallet/portfolio')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.total).toBe('1000');
        });
    });

    // ── MultiSig ──
    describe('GET /multisig/:address', () => {
        it('returns multisig info', async () => {
            mockWalletService.getMultiSigInfo.mockResolvedValueOnce({ owners: [VALID_ADDR], threshold: 2 });
            const res = await request(app).get(`/api/wallet/multisig/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.threshold).toBe(2);
        });
    });

    describe('GET /multisig/:address/pending', () => {
        it('returns pending transactions', async () => {
            mockWalletService.getMultiSigPendingTxs.mockResolvedValueOnce([{ id: 1 }]);
            const res = await request(app).get(`/api/wallet/multisig/${VALID_ADDR}/pending`);
            expect(res.status).toBe(200);
            expect(res.body.pendingTransactions).toHaveLength(1);
        });
    });

    // ── Security ──
    describe('GET /security/status', () => {
        it('returns security status', async () => {
            const token = makeToken();
            mockWalletService.getSecurityStatus.mockResolvedValueOnce({ healthy: true });
            const res = await request(app)
                .get('/api/wallet/security/status')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.healthy).toBe(true);
        });
    });

    // ── Guardians ──
    describe('GET /guardians/:wallet', () => {
        it('returns wallet guardians', async () => {
            mockWalletService.getWalletGuardians.mockResolvedValueOnce([VALID_ADDR]);
            const res = await request(app).get(`/api/wallet/guardians/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.guardians).toHaveLength(1);
        });
    });

    describe('GET /guardian-score/:guardian', () => {
        it('returns guardian trust score', async () => {
            mockWalletService.getGuardianTrustScore.mockResolvedValueOnce(92);
            const res = await request(app).get(`/api/wallet/guardian-score/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.trustScore).toBe(92);
        });
    });
});
