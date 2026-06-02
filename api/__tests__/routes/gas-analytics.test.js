const request = require('supertest');
const { mockQuery, mockCacheGet, mockCacheSet, mockContractService, makeToken, makeAdminToken, makeEnterpriseToken } = require('../helpers');
const app = require('../../index');

const VALID_ADDR = '0x' + 'f'.repeat(40);

describe('Routes: /api/gas', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /status', () => {
        it('returns blockchain stats', async () => {
            mockContractService.getBlockchainStats.mockResolvedValueOnce({ blockNumber: 42, gasPrice: '1000000000' });
            const res = await request(app).get('/api/gas/status');
            expect(res.status).toBe(200);
            expect(res.body.blockNumber).toBe(42);
        });

        it('returns fallback when chain unreachable', async () => {
            mockContractService.getBlockchainStats.mockRejectedValueOnce(new Error('timeout'));
            const res = await request(app).get('/api/gas/status');
            expect(res.status).toBe(200);
            expect(res.body.gasPrice).toBe('0');
        });
    });

    describe('GET /balances', () => {
        it('returns balances for admin', async () => {
            const token = makeAdminToken();
            // requireRole does a DB lookup
            mockQuery
                .mockResolvedValueOnce({ rows: [{ role: 'admin' }] })   // requireRole check
                .mockResolvedValueOnce({ rows: [{ enterprise_id: 1, balance: '100' }] }); // actual query
            const res = await request(app)
                .get('/api/gas/balances')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.balances).toBeDefined();
        });

        it('rejects non-admin users', async () => {
            const token = makeToken({ role: 'user' });
            mockQuery.mockResolvedValueOnce({ rows: [{ role: 'user' }] });
            const res = await request(app)
                .get('/api/gas/balances')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });

        it('returns 401 without token', async () => {
            const res = await request(app).get('/api/gas/balances');
            expect(res.status).toBe(401);
        });
    });
});

describe('Routes: /api/analytics', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /stats', () => {
        it('returns dashboard stats with computed TPS', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockContractService.getBlockchainStats.mockResolvedValueOnce({ blockNumber: 12345, gasPrice: '1' });

            mockQuery
                .mockResolvedValueOnce({ rows: [{ cnt: 1200 }] }) // tx total
                .mockResolvedValueOnce({ rows: [{ total: '45000' }] }) // gas total
                .mockResolvedValueOnce({ rows: [{ cnt: 300 }] }) // nfts
                .mockResolvedValueOnce({ rows: [{ cnt: 25 }] }) // enterprises
                .mockResolvedValueOnce({ rows: [{ cnt: 60 }] }) // contracts
                .mockResolvedValueOnce({ rows: [{ cnt: 150 }] }); // tx in 5m

            const res = await request(app).get('/api/analytics/stats');
            expect(res.status).toBe(200);
            expect(res.body.block_height).toBe(12345);
            expect(res.body.total_transactions).toBe(1200);
            expect(res.body.tps).toBe(0.5);
        });
    });

    describe('GET /kpis/realtime', () => {
        it('returns realtime KPI snapshot', async () => {
            mockCacheGet.mockResolvedValueOnce(null);

            mockQuery
                .mockResolvedValueOnce({ rows: [{ cnt: 60 }] }) // tx_1m
                .mockResolvedValueOnce({ rows: [{ cnt: 240 }] }) // tx_5m
                .mockResolvedValueOnce({ rows: [{ cnt: 3600 }] }) // tx_1h
                .mockResolvedValueOnce({ rows: [{ cnt: 12 }] }) // failed_24h
                .mockResolvedValueOnce({ rows: [{ avg: '21000.5' }] }); // avg_gas_24h

            const res = await request(app).get('/api/analytics/kpis/realtime');
            expect(res.status).toBe(200);
            expect(res.body.tx_1m).toBe(60);
            expect(res.body.tps_1m).toBe(1);
            expect(res.body.tps_5m).toBe(0.8);
            expect(res.body.tps_1h).toBe(1);
            expect(res.body.failed_24h).toBe(12);
            expect(res.body.avg_gas_24h).toBe('21000.5');
            expect(typeof res.body.computed_at).toBe('string');
        });
    });

    describe('GET /forecast', () => {
        it('returns forecast points for valid metric', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            const rows = Array.from({ length: 30 }, (_, i) => ({
                date: `2026-03-${String((i % 30) + 1).padStart(2, '0')}`,
                value: String(100 + i),
            }));
            mockQuery.mockResolvedValueOnce({ rows });

            const res = await request(app).get('/api/analytics/forecast?metric=transactions&horizon=7');
            expect(res.status).toBe(200);
            expect(res.body.metric).toBe('transactions');
            expect(res.body.horizon).toBe(7);
            expect(res.body.model).toBe('baseline_linear_trend_v1');
            expect(Array.isArray(res.body.points)).toBe(true);
            expect(res.body.points).toHaveLength(7);
            expect(res.body.points[0]).toHaveProperty('predicted');
            expect(res.body.points[0]).toHaveProperty('lower');
            expect(res.body.points[0]).toHaveProperty('upper');
        });

        it('rejects invalid metric', async () => {
            const res = await request(app).get('/api/analytics/forecast?metric=invalid_metric&horizon=7');
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid metric');
            expect(Array.isArray(res.body.allowed)).toBe(true);
        });
    });

    describe('GET /deltas', () => {
        it('returns period deltas for valid metric', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockQuery.mockResolvedValueOnce({
                rows: [{ current_total: '140', previous_total: '100' }],
            });

            const res = await request(app).get('/api/analytics/deltas?metric=transactions&window=7');
            expect(res.status).toBe(200);
            expect(res.body.metric).toBe('transactions');
            expect(res.body.window_days).toBe(7);
            expect(res.body.current_total).toBe(140);
            expect(res.body.previous_total).toBe(100);
            expect(res.body.delta_abs).toBe(40);
            expect(res.body.delta_pct).toBe(40);
            expect(res.body.trend).toBe('up');
        });

        it('returns null delta_pct when previous period is zero', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockQuery.mockResolvedValueOnce({
                rows: [{ current_total: '25', previous_total: '0' }],
            });

            const res = await request(app).get('/api/analytics/deltas?metric=nfts_minted&window=14');
            expect(res.status).toBe(200);
            expect(res.body.delta_pct).toBeNull();
            expect(res.body.trend).toBe('up');
        });

        it('rejects invalid metric', async () => {
            const res = await request(app).get('/api/analytics/deltas?metric=invalid_metric&window=7');
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid metric');
            expect(Array.isArray(res.body.allowed)).toBe(true);
        });
    });

    describe('GET /platform', () => {
        it('returns platform analytics for authenticated user', async () => {
            const token = makeToken();
            mockCacheGet.mockResolvedValueOnce(null);
            const statsRow = { total: '10', active24h: '5', active7d: '8', new24h: '1' };
            const txRow = { total: '100', volume_bez: '500', today: '10' };
            const nftRow = { total: '50', minted24h: '3' };
            const telRow = { total: '200' };
            mockQuery
                .mockResolvedValueOnce({ rows: [statsRow] })
                .mockResolvedValueOnce({ rows: [txRow] })
                .mockResolvedValueOnce({ rows: [nftRow] })
                .mockResolvedValueOnce({ rows: [telRow] });

            const res = await request(app)
                .get('/api/analytics/platform')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.users).toEqual(statsRow);
            expect(res.body.transactions).toEqual(txRow);
        });

        it('returns cached analytics', async () => {
            const token = makeToken();
            const cached = { users: {}, transactions: {} };
            mockCacheGet.mockResolvedValueOnce(cached);
            const res = await request(app)
                .get('/api/analytics/platform')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body).toEqual(cached);
        });

        it('returns 401 without token', async () => {
            const res = await request(app).get('/api/analytics/platform');
            expect(res.status).toBe(401);
        });
    });

    describe('GET /user/:address', () => {
        it('returns user analytics', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ wallet_address: VALID_ADDR }] })
                .mockResolvedValueOnce({ rows: [{ total: '10' }] })
                .mockResolvedValueOnce({ rows: [{ total: '5' }] })
                .mockResolvedValueOnce({ rows: [{ total_staked: '100', total_rewards: '10' }] })
                .mockResolvedValueOnce({ rows: [{ positions: '2', pending: '5' }] });
            const res = await request(app).get(`/api/analytics/user/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.address).toBe(VALID_ADDR);
            expect(res.body.totalTransactions).toBe(10);
        });
    });
});
