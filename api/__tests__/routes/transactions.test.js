const request = require('supertest');
const { mockTxService } = require('../helpers');
const app = require('../../index');

describe('Routes: /api/transactions', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /', () => {
        it('returns paginated transactions', async () => {
            mockTxService.getRecentTxs.mockResolvedValueOnce({ transactions: [{ tx_hash: '0xabc' }], total: 1, page: 1 });
            const res = await request(app).get('/api/transactions');
            expect(res.status).toBe(200);
            expect(res.body.transactions).toHaveLength(1);
            expect(mockTxService.getRecentTxs).toHaveBeenCalledWith({ page: 1, limit: 20, address: undefined, contract: undefined });
        });

        it('respects pagination params', async () => {
            mockTxService.getRecentTxs.mockResolvedValueOnce({ transactions: [], total: 0, page: 2 });
            await request(app).get('/api/transactions?page=2&limit=5');
            expect(mockTxService.getRecentTxs).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 5 }));
        });

        it('caps limit at 100', async () => {
            mockTxService.getRecentTxs.mockResolvedValueOnce({ transactions: [], total: 0, page: 1 });
            await request(app).get('/api/transactions?limit=500');
            expect(mockTxService.getRecentTxs).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
        });
    });

    describe('GET /:txHash', () => {
        const validHash = '0x' + 'a'.repeat(64);

        it('returns tx by hash', async () => {
            mockTxService.getTxByHash.mockResolvedValueOnce({ tx_hash: validHash, status: 'confirmed' });
            const res = await request(app).get(`/api/transactions/${validHash}`);
            expect(res.status).toBe(200);
            expect(res.body.tx_hash).toBe(validHash);
        });

        it('returns 400 for invalid hash format', async () => {
            const res = await request(app).get('/api/transactions/not-a-hash');
            expect(res.status).toBe(400);
        });

        it('returns 404 when tx not found', async () => {
            mockTxService.getTxByHash.mockResolvedValueOnce(null);
            const res = await request(app).get(`/api/transactions/${validHash}`);
            expect(res.status).toBe(404);
        });
    });
});
