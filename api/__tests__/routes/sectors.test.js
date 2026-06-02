const request = require('supertest');
const { mockQuery, mockCacheGet, mockCacheSet } = require('../helpers');
const app = require('../../index');

describe('Routes: /api/sectors', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /', () => {
        it('returns sectors from DB when cache miss', async () => {
            mockCacheGet.mockResolvedValueOnce(null);
            const rows = [{ key: 'logistics', contracts: 3, transactions: 5, active: true }];
            mockQuery.mockResolvedValueOnce({ rows });
            const res = await request(app).get('/api/sectors');
            expect(res.status).toBe(200);
            expect(res.body.sectors).toEqual(rows);
            expect(mockCacheSet).toHaveBeenCalledWith('sectors:overview', rows, 300);
        });

        it('returns cached data on cache hit', async () => {
            const cached = [{ key: 'logistics' }];
            mockCacheGet.mockResolvedValueOnce(cached);
            const res = await request(app).get('/api/sectors');
            expect(res.status).toBe(200);
            expect(res.body).toEqual(cached);
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });

    describe('GET /:sector', () => {
        it('returns contracts and transactions for a sector', async () => {
            const contracts = [{ id: 1, contract_name: 'LogisticsNFT', sector: 'logistics', address: '0x123', chain_id: 31337, deployed_at: null }];
            const transactions = [{ id: 1, tx_hash: '0xabc', contract_name: 'LogisticsNFT' }];
            mockQuery
                .mockResolvedValueOnce({ rows: contracts })
                .mockResolvedValueOnce({ rows: transactions });
            const res = await request(app).get('/api/sectors/logistics');
            expect(res.status).toBe(200);
            expect(res.body.sector).toBe('logistics');
            expect(res.body.contracts).toEqual(contracts);
            expect(res.body.transactions).toEqual(transactions);
        });

        it('returns 404 for unknown sector', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/api/sectors/unknown');
            expect(res.status).toBe(404);
        });
    });
});
