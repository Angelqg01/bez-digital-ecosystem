const request = require('supertest');
const { mockQuery, mockCacheGet, mockCacheSet, mockContractService } = require('../helpers');
const app = require('../../index');

describe('Routes: /api/market', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /stats', () => {
        it('returns market stats from DB + chain', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            mockQuery
                .mockResolvedValueOnce({ rows: [{ total_nfts: '100', owners: '25' }] })
                .mockResolvedValueOnce({ rows: [{ total_volume: '5000', volume_24h: '200' }] });
            mockContractService.getBlockchainStats.mockResolvedValueOnce({ blockNumber: 50, gasPrice: '1e9' });
            mockContractService.getBEZTotalSupply.mockResolvedValueOnce('1000000');

            const res = await request(app).get('/api/market/stats');
            expect(res.status).toBe(200);
            expect(res.body.totalNFTs).toBe(100);
            expect(res.body.totalSupply).toBe('1000000');
            expect(mockCacheSet).toHaveBeenCalledWith('market:stats', expect.any(Object), 30);
        });

        it('returns cached stats', async () => {
            mockCacheGet.mockResolvedValueOnce({ totalNFTs: 50 });
            const res = await request(app).get('/api/market/stats');
            expect(res.status).toBe(200);
            expect(res.body.totalNFTs).toBe(50);
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });
});
