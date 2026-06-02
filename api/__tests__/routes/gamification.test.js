const request = require('supertest');
const { mockQuery, mockCacheGet, mockCacheSet } = require('../helpers');
const app = require('../../index');

const VALID_ADDR = '0x' + 'f'.repeat(40);

describe('Routes: /api/gamification', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /profile/:address', () => {
        it('returns gamification profile with level', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ wallet_address: VALID_ADDR }] })  // user lookup
                .mockResolvedValueOnce({ rows: [{ total: '10' }] })   // txCount
                .mockResolvedValueOnce({ rows: [{ total: '2' }] })    // nftCount
                .mockResolvedValueOnce({ rows: [{ total: '50' }] });   // stakingCount
            const res = await request(app).get(`/api/gamification/profile/${VALID_ADDR}`);
            expect(res.status).toBe(200);
            expect(res.body.address).toBe(VALID_ADDR);
            expect(res.body.level).toBeGreaterThanOrEqual(1);
            expect(res.body.breakdown).toBeDefined();
        });

        it('returns 404 for unknown user', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get(`/api/gamification/profile/${VALID_ADDR}`);
            expect(res.status).toBe(404);
        });
    });

    describe('GET /leaderboard/:type', () => {
        it('returns transactions leaderboard', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            const rows = [{ address: VALID_ADDR, score: '50' }];
            mockQuery.mockResolvedValueOnce({ rows });
            const res = await request(app).get('/api/gamification/leaderboard/transactions');
            expect(res.status).toBe(200);
            expect(res.body.type).toBe('transactions');
            expect(res.body.leaderboard[0].rank).toBe(1);
        });

        it('returns cached leaderboard', async () => {
            mockCacheGet.mockResolvedValueOnce({ type: 'nfts', leaderboard: [] });
            const res = await request(app).get('/api/gamification/leaderboard/nfts');
            expect(res.status).toBe(200);
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('returns 400 for invalid type', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            const res = await request(app).get('/api/gamification/leaderboard/invalid');
            expect(res.status).toBe(400);
        });

        it('supports staking leaderboard', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockQuery.mockResolvedValueOnce({ rows: [{ address: VALID_ADDR, score: '1000' }] });
            const res = await request(app).get('/api/gamification/leaderboard/staking?limit=5');
            expect(res.status).toBe(200);
            expect(mockQuery.mock.calls[0][1]).toContain(5);
        });
    });
});
