const request = require('supertest');
const { mockQuery } = require('../helpers');
const app = require('../../index');

describe('Routes: /api/nfts', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /', () => {
        it('returns paginated NFTs', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ count: '2' }] })   // COUNT query
                .mockResolvedValueOnce({ rows: [{ token_id: 1 }, { token_id: 2 }] }); // SELECT query
            const res = await request(app).get('/api/nfts');
            expect(res.status).toBe(200);
            expect(res.body.nfts).toHaveLength(2);
            expect(res.body.pagination.total).toBe(2);
        });

        it('applies owner filter', async () => {
            const addr = '0x' + 'a'.repeat(40);
            mockQuery
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [] });
            await request(app).get(`/api/nfts?owner=${addr}`);
            expect(mockQuery.mock.calls[0][1]).toContain(addr);
        });
    });

    describe('GET /:tokenId', () => {
        it('returns NFT by tokenId', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ token_id: 1, name: 'TestNFT' }] });
            const res = await request(app).get('/api/nfts/1');
            expect(res.status).toBe(200);
            expect(res.body.token_id).toBe(1);
        });

        it('returns 404 when not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await request(app).get('/api/nfts/9999');
            expect(res.status).toBe(404);
        });

        it('returns 400 for non-integer tokenId', async () => {
            const res = await request(app).get('/api/nfts/abc');
            expect(res.status).toBe(400);
        });
    });
});
