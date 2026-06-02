const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { makeToken } = require('../helpers');

const app = require('../../index');

const token = makeToken();
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

// Check if real deployment file exists for conditional assertions
const DEPLOYMENTS_PATH = path.resolve(__dirname, '../../../smart-contracts/deployments/31337.json');
const hasDeployments = fs.existsSync(DEPLOYMENTS_PATH);

describe('Routes: /api/contracts', () => {
    beforeEach(() => jest.clearAllMocks());

    /* ─── GET /api/contracts/deployments ─── */
    describe('GET /deployments', () => {
        it('returns deployment manifest structure', async () => {
            const res = await auth(request(app).get('/api/contracts/deployments')).expect(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data).toHaveProperty('chainId');
            expect(res.body.data).toHaveProperty('core');
            expect(res.body.data).toHaveProperty('sectors');
            expect(typeof res.body.data.total).toBe('number');
        });

        if (hasDeployments) {
            it('returns chainId 31337 for local deployment', async () => {
                const res = await auth(request(app).get('/api/contracts/deployments')).expect(200);
                expect(res.body.data.chainId).toBe(31337);
            });
        }

        it('requires authentication', async () => {
            await request(app).get('/api/contracts/deployments').expect(401);
        });
    });

    /* ─── GET /api/contracts/abi/:name ─── */
    describe('GET /abi/:name', () => {
        it('returns 404 when ABI not found', async () => {
            const res = await auth(request(app).get('/api/contracts/abi/NonExistentContractXYZ')).expect(404);
            expect(res.body.error).toMatch(/ABI not found/i);
        });

        it('validates contract name format (rejects special chars)', async () => {
            await auth(request(app).get('/api/contracts/abi/drop--table')).expect(400);
        });

        it('rejects path traversal attempts', async () => {
            // The route param won't match because of the regex validator
            await auth(request(app).get('/api/contracts/abi/..%2F..%2Fetc')).expect(400);
        });

        it('requires authentication', async () => {
            await request(app).get('/api/contracts/abi/BEZCoinV2').expect(401);
        });

        // If real ABI artifacts exist, test the success path
        const sdkABI = path.resolve(__dirname, '../../../sdk/artifacts/contracts/BEZCoinV2.sol/BEZCoinV2.json');
        if (fs.existsSync(sdkABI)) {
            it('returns real ABI for BEZCoinV2', async () => {
                const res = await auth(request(app).get('/api/contracts/abi/BEZCoinV2')).expect(200);
                expect(res.body.status).toBe('success');
                expect(res.body.data.name).toBe('BEZCoinV2');
                expect(Array.isArray(res.body.data.abi)).toBe(true);
                expect(res.body.data.abi.length).toBeGreaterThan(0);
                expect(typeof res.body.data.functions).toBe('number');
                expect(typeof res.body.data.events).toBe('number');
                expect(typeof res.body.data.deployed).toBe('boolean');
            });
        }
    });

    /* ─── GET /api/contracts/agent/:id ─── */
    describe('GET /agent/:id', () => {
        it('returns contracts mapped to a known agent', async () => {
            const res = await auth(request(app).get('/api/contracts/agent/food')).expect(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.agent_id).toBe('food');
            expect(Array.isArray(res.body.data.contracts)).toBe(true);
            expect(res.body.data.contracts.length).toBeGreaterThan(0);
            for (const c of res.body.data.contracts) {
                expect(c).toHaveProperty('name');
                expect(c).toHaveProperty('address');
                expect(c).toHaveProperty('deployed');
            }
            expect(typeof res.body.data.total_deployed).toBe('number');
            expect(typeof res.body.data.total_mapped).toBe('number');
        });

        it('returns 404 for unknown agent', async () => {
            const res = await auth(request(app).get('/api/contracts/agent/nonexistent_xyz')).expect(404);
            expect(res.body.error).toMatch(/not found/i);
        });

        it('requires authentication', async () => {
            await request(app).get('/api/contracts/agent/food').expect(401);
        });

        it('returns orch agent with BEZCoinV2 and StakingPool', async () => {
            const res = await auth(request(app).get('/api/contracts/agent/orch')).expect(200);
            const names = res.body.data.contracts.map(c => c.name);
            expect(names).toContain('BEZCoinV2');
            expect(names).toContain('StakingPool');
        });

        it('includes deployment status boolean per contract', async () => {
            const res = await auth(request(app).get('/api/contracts/agent/orch')).expect(200);
            const bez = res.body.data.contracts.find(c => c.name === 'BEZCoinV2');
            expect(bez).toBeDefined();
            expect(typeof bez.deployed).toBe('boolean');
        });

        it('returns food agent with QualityEscrow', async () => {
            const res = await auth(request(app).get('/api/contracts/agent/food')).expect(200);
            const names = res.body.data.contracts.map(c => c.name);
            expect(names).toContain('QualityEscrow');
        });

        it('returns creditscore agent with CreditScoreOracle', async () => {
            const res = await auth(request(app).get('/api/contracts/agent/creditscore')).expect(200);
            const names = res.body.data.contracts.map(c => c.name);
            expect(names).toContain('CreditScoreOracle');
        });
    });
});
