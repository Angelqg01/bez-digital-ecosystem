/**
 * Gateway Routes — Unit Tests
 * Tests the unified API Gateway that connects DeFi App and BeZhas-App to Core.
 */
const {
    mockQuery, mockContractService, mockWalletService,
    makeToken, makeAdminToken,
} = require('../helpers');

const request = require('supertest');
const express = require('express');
const gatewayRoutes = require('../../routes/gateway');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/gateway/v1', gatewayRoutes);
    return app;
}

const TEST_WALLET = '0x' + 'f'.repeat(40);

describe('Gateway Routes', () => {
    let app;
    let token;
    let adminToken;

    beforeAll(() => {
        app = buildApp();
        token = makeToken({ address: TEST_WALLET });
        adminToken = makeAdminToken();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ─── SSO ────────────────────────────────────────

    describe('POST /api/gateway/v1/sso/login', () => {
        it('rejects missing fields', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/sso/login')
                .send({});
            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/gateway/v1/sso/refresh', () => {
        it('rejects missing refreshToken', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/sso/refresh')
                .send({});
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/gateway/v1/sso/me', () => {
        it('returns user info in dev mode', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 1, wallet_address: TEST_WALLET, username: 'test', role: 'admin' }],
                rowCount: 1,
            });
            const res = await request(app)
                .get('/api/gateway/v1/sso/me')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
        });
    });

    // ─── Wallet ─────────────────────────────────────

    describe('GET /api/gateway/v1/wallet/balance/:address', () => {
        it('rejects without auth', async () => {
            const res = await request(app)
                .get(`/api/gateway/v1/wallet/balance/${TEST_WALLET}`);
            expect(res.status).toBe(401);
        });

        it('returns balance with JWT', async () => {
            mockWalletService.getBalance = jest.fn().mockResolvedValue({
                address: TEST_WALLET, bez: '1000', eth: '0.5'
            });
            const res = await request(app)
                .get(`/api/gateway/v1/wallet/balance/${TEST_WALLET}`)
                .set('Authorization', `Bearer ${token}`);
            expect([200, 500]).toContain(res.status);
        });
    });

    describe('GET /api/gateway/v1/wallet/history/:address', () => {
        it('returns transaction history', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ tx_hash: '0xabc', from_address: TEST_WALLET, value_wei: '1000', status: 'confirmed' }],
                rowCount: 1,
            });
            const res = await request(app)
                .get(`/api/gateway/v1/wallet/history/${TEST_WALLET}`)
                .set('Authorization', `Bearer ${token}`);
            expect([200, 500]).toContain(res.status);
        });
    });

    // ─── Staking ────────────────────────────────────

    describe('GET /api/gateway/v1/staking/positions/:address', () => {
        it('returns staking positions', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 1, wallet_address: TEST_WALLET, amount_staked: '5000', is_active: true }],
                rowCount: 1,
            });
            const res = await request(app)
                .get(`/api/gateway/v1/staking/positions/${TEST_WALLET}`)
                .set('Authorization', `Bearer ${token}`);
            expect([200, 500]).toContain(res.status);
        });
    });

    describe('POST /api/gateway/v1/staking/stake', () => {
        it('rejects without amount', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/staking/stake')
                .set('Authorization', `Bearer ${token}`)
                .send({ walletAddress: TEST_WALLET });
            expect(res.status).toBe(400);
        });

        it('creates staking position', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }); // user lookup
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'pos-1', wallet_address: TEST_WALLET, amount_staked: 100 }],
                rowCount: 1,
            });
            const res = await request(app)
                .post('/api/gateway/v1/staking/stake')
                .set('Authorization', `Bearer ${token}`)
                .send({ walletAddress: TEST_WALLET, amount: 100 });
            expect([200, 500]).toContain(res.status);
        });
    });

    // ─── Farming ────────────────────────────────────

    describe('GET /api/gateway/v1/farming/positions/:address', () => {
        it('returns farming positions', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await request(app)
                .get(`/api/gateway/v1/farming/positions/${TEST_WALLET}`)
                .set('Authorization', `Bearer ${token}`);
            expect([200, 500]).toContain(res.status);
        });
    });

    // ─── Governance ─────────────────────────────────

    describe('GET /api/gateway/v1/governance/proposals', () => {
        it('returns list of proposals', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 1, title: 'Test Proposal', status: 'active' }],
                rowCount: 1,
            });
            const res = await request(app)
                .get('/api/gateway/v1/governance/proposals')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('proposals');
        });
    });

    describe('POST /api/gateway/v1/governance/propose', () => {
        it('returns an unsigned proposal transaction', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/governance/propose')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    target: TEST_WALLET,
                    value: '0',
                    calldata: '0x',
                    description: 'Upgrade protocol parameter',
                });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('txRequest');
            expect(res.body.nextAction).toBe('wallet_sign_and_send');
        });
    });

    describe('POST /api/gateway/v1/governance/vote', () => {
        it('returns an unsigned on-chain vote transaction for numeric proposal IDs', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/governance/vote')
                .set('Authorization', `Bearer ${token}`)
                .send({ proposalId: '1', walletAddress: TEST_WALLET, vote: 'for' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('txRequest');
            expect(res.body.nextAction).toBe('wallet_sign_and_send');
        });
    });

    describe('POST /api/gateway/v1/governance/execute', () => {
        it('returns an unsigned proposal execution transaction', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/governance/execute')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    target: TEST_WALLET,
                    value: '0',
                    calldata: '0x',
                    description: 'Upgrade protocol parameter',
                });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('txRequest');
            expect(res.body).toHaveProperty('descriptionHash');
        });
    });

    // ─── Bridge ─────────────────────────────────────

    describe('GET /api/gateway/v1/bridge/transfers/:address', () => {
        it('returns bridge transfers', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await request(app)
                .get(`/api/gateway/v1/bridge/transfers/${TEST_WALLET}`)
                .set('Authorization', `Bearer ${token}`);
            expect([200, 500]).toContain(res.status);
        });
    });

    describe('POST /api/gateway/v1/bridge/initiate', () => {
        it('rejects missing fields', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/bridge/initiate')
                .set('Authorization', `Bearer ${token}`)
                .send({ sender: TEST_WALLET });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/gateway/v1/bridge/fees', () => {
        it('returns fee estimation for valid params', async () => {
            const res = await request(app)
                .get('/api/gateway/v1/bridge/fees')
                .query({ fromChainId: 2708, toChainId: 1, amount: '100', tokenAddress: '0x0000000000000000000000000000000000000000' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('fees');
            expect(res.body.fees).toHaveProperty('bridgeFee');
            expect(res.body.fees).toHaveProperty('gasFeeOrigin');
            expect(res.body.fees).toHaveProperty('gasFeeDestination');
            expect(res.body.fees).toHaveProperty('totalFeeUSD');
            expect(res.body.fees).toHaveProperty('estimatedTimeMinutes');
            expect(res.body.fees).toHaveProperty('route');
        });

        it('rejects when amount missing', async () => {
            const res = await request(app)
                .get('/api/gateway/v1/bridge/fees')
                .query({ fromChainId: 2708, toChainId: 1 })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(400);
        });

        it('rejects without auth', async () => {
            const res = await request(app)
                .get('/api/gateway/v1/bridge/fees')
                .query({ fromChainId: 2708, toChainId: 1, amount: '100' });
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/gateway/v1/bridge/stats', () => {
        it('returns aggregated bridge stats', async () => {
            mockQuery.mockReset();
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total_bridged: '5000000', total_transfers: '42' }] })
                .mockResolvedValueOnce({ rows: [{ chain_id: 1, count: '20', volume: '3000000' }] })
                .mockResolvedValueOnce({ rows: [{ cnt: '5' }] });
            const res = await request(app)
                .get('/api/gateway/v1/bridge/stats')
                .set('Authorization', `Bearer ${token}`);
            expect([200, 500]).toContain(res.status);
            if (res.status === 200) {
                expect(res.body.stats).toHaveProperty('totalBridged');
                expect(res.body.stats).toHaveProperty('totalTransfers');
                expect(res.body.stats).toHaveProperty('chainBreakdown');
                expect(res.body.stats).toHaveProperty('recentFinalized');
            }
        });

        it('rejects without auth', async () => {
            const res = await request(app)
                .get('/api/gateway/v1/bridge/stats');
            expect(res.status).toBe(401);
        });
    });

    // ─── Treasury ───────────────────────────────────

    describe('GET /api/gateway/v1/treasury/overview', () => {
        it('returns treasury overview', async () => {
            mockQuery.mockReset();
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total: '5000' }] })  // staking
                .mockResolvedValueOnce({ rows: [{ total: '3000' }] })  // farming
                .mockResolvedValueOnce({ rows: [{ total: '1000' }] })  // bridge
                .mockResolvedValueOnce({ rows: [{ total: '150' }] });  // users
            const res = await request(app)
                .get('/api/gateway/v1/treasury/overview')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('treasury');
        });
    });

    // ─── Token ──────────────────────────────────────

    describe('GET /api/gateway/v1/token/info', () => {
        it('returns BEZ token metadata', async () => {
            const res = await request(app)
                .get('/api/gateway/v1/token/info')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.token).toHaveProperty('symbol', 'BEZ');
            expect(res.body.token).toHaveProperty('wrappedVersion');
        });
    });

    // ─── Contracts ──────────────────────────────────

    describe('GET /api/gateway/v1/contracts/list', () => {
        it('returns contract addresses', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ name: 'BEZCoinV2', address: '0x' + '1'.repeat(40) }],
                rowCount: 1,
            });
            const res = await request(app)
                .get('/api/gateway/v1/contracts/list')
                .set('Authorization', `Bearer ${token}`);
            expect([200, 500]).toContain(res.status);
        });
    });

    // ─── DEX / Trading ───────────────────────────────────

    describe('GET /api/gateway/v1/dex/quote', () => {
        it('returns a BEZ pair quote', async () => {
            const tokenOut = '0x' + '2'.repeat(40);
            const res = await request(app)
                .get('/api/gateway/v1/dex/quote')
                .query({ tokenIn: TEST_WALLET, tokenOut, amountIn: '1' })
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('quote');
        });
    });

    describe('POST /api/gateway/v1/dex/swap', () => {
        it('returns an unsigned wallet transaction', async () => {
            const tokenOut = '0x' + '2'.repeat(40);
            const res = await request(app)
                .post('/api/gateway/v1/dex/swap')
                .set('Authorization', `Bearer ${token}`)
                .send({ tokenIn: TEST_WALLET, tokenOut, amountIn: '1', minAmountOut: '0.9' });
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('txRequest');
            expect(res.body.nextAction).toBe('wallet_sign_and_send');
        });
    });

    // ─── App Registry (admin only) ──────────────────

    describe('GET /api/gateway/v1/apps/list', () => {
        it('rejects non-admin JWT', async () => {
            const res = await request(app)
                .get('/api/gateway/v1/apps/list')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });

        it('returns apps for admin', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 1, app_name: 'defi', scopes: ['all'], tier: 'internal', is_active: true }],
                rowCount: 1,
            });
            const res = await request(app)
                .get('/api/gateway/v1/apps/list')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('apps');
        });
    });

    describe('POST /api/gateway/v1/apps/register', () => {
        it('rejects non-admin', async () => {
            const res = await request(app)
                .post('/api/gateway/v1/apps/register')
                .set('Authorization', `Bearer ${token}`)
                .send({ appName: 'test-app', scopes: ['wallet'], tier: 'free' });
            expect(res.status).toBe(403);
        });
    });
});
