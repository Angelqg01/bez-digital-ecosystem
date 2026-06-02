const request = require('supertest');
const { mockQuery, mockContractService } = require('../helpers');
const app = require('../../index');

describe('Routes: /api/contracts', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('GET /', () => {
        it('returns grouped contracts for default chainId', async () => {
            mockContractService.getAllAddresses.mockResolvedValueOnce({ BEZCoinV2: '0x1111' });
            const res = await request(app).get('/api/contracts');
            expect(res.status).toBe(200);
            expect(res.body.contracts).toEqual({ BEZCoinV2: '0x1111' });
            expect(mockContractService.getAllAddresses).toHaveBeenCalledWith(parseInt(process.env.BEZHAS_CHAIN_ID || '31337', 10));
        });

        it('accepts custom chainId', async () => {
            mockContractService.getAllAddresses.mockResolvedValueOnce({});
            const res = await request(app).get('/api/contracts?chainId=2708');
            expect(res.status).toBe(200);
            expect(mockContractService.getAllAddresses).toHaveBeenCalledWith(2708);
        });

        it('returns flat list when flat=true', async () => {
            const rows = [{ id: 1, contract_name: 'BEZCoinV2', sector: 'finanzas', address: '0x1111', chain_id: 31337, deployed_at: null }];
            mockQuery.mockResolvedValueOnce({ rows });
            const res = await request(app).get('/api/contracts?flat=true');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toEqual(rows);
        });
    });

    describe('GET /:name', () => {
        it('returns contract by name', async () => {
            const row = { name: 'BEZCoinV2', address: '0x1111', chain_id: 31337 };
            mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 });
            const res = await request(app).get('/api/contracts/BEZCoinV2');
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('BEZCoinV2');
        });

        it('returns 404 when contract not found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            const res = await request(app).get('/api/contracts/UnknownContract');
            expect(res.status).toBe(404);
            expect(res.body.error).toMatch(/not found/i);
        });
    });
});
