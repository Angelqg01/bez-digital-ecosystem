/**
 * E2E Flow Tests — 5 end-to-end scenarios using real Anvil blockchain.
 *
 * Flow 1: Webhook → Mint (Telemetry → AI validation → NFT mint)
 * Flow 2: Gas Auto-Recharge (Enterprise balance monitoring + BEZ transfer)
 * Flow 3: Dashboard Live (Real-time contract/gas/transaction data)
 * Flow 4: AI Anomaly Detection (Reject bad telemetry, approve good)
 * Flow 5: Sector Operation (Sector listing + contract registry)
 */
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const anvil = require('../integration/setup');

// ── Mock DB ──
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

// ── Mock Redis ──
const mockPublish = jest.fn().mockResolvedValue(1);
const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue('OK');
jest.mock('../../cache/redis', () => ({
    cacheGet: (...a) => mockCacheGet(...a),
    cacheSet: (...a) => mockCacheSet(...a),
    publish: (...a) => mockPublish(...a),
    connectRedis: jest.fn().mockResolvedValue(true),
    checkRateLimit: jest.fn().mockResolvedValue(false),
}));

// ── Mock axios (Aegis AI proxy) ──
const mockAxiosPost = jest.fn();
const mockAxiosGet = jest.fn();
const mockAxiosPut = jest.fn();
jest.mock('axios', () => ({
    post: (...a) => mockAxiosPost(...a),
    get: (...a) => mockAxiosGet(...a),
    put: (...a) => mockAxiosPut(...a),
}));

// ── Mock auto-start services ──
jest.mock('../../services/eventListener', () => ({ startListening: jest.fn() }));
jest.mock('../../services/gasMonitor', () => ({
    startDaemon: jest.fn(),
    checkAndRechargeEnterpriseNodes: jest.fn(),
}));

// ── Env ──
process.env.BEZHAS_L2_RPC_URL = anvil.RPC_URL;
process.env.DEPLOYER_PRIVATE_KEY = anvil.DEPLOYER_KEY;
process.env.BEZHAS_CHAIN_ID = '31337';
process.env.JWT_SECRET = 'e2e-test-secret-key';
process.env.NODE_ENV = 'test';

let app;
let baseMockImpl;

function makeToken(overrides = {}) {
    return jwt.sign({
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        userId: 1,
        role: 'admin',
        ...overrides,
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const adminToken = () => makeToken({ role: 'admin' });
const enterpriseToken = () => makeToken({
    role: 'enterprise',
    address: anvil.ENTERPRISE_KEY
        ? '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
        : '0x' + 'e'.repeat(40),
});

function buildBaseMock() {
    const addressQuery = anvil.mockContractAddressQuery();
    return (sql, params) => {
        if (sql.includes('contract_addresses')) {
            return addressQuery(sql, params);
        }
        if (sql.includes('role') && sql.includes('users')) {
            return { rows: [{ role: 'admin' }], rowCount: 1 };
        }
        if (sql.includes('SELECT') && sql.includes('users')) {
            return {
                rows: [{
                    id: 1,
                    wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    role: 'admin',
                }],
                rowCount: 1,
            };
        }
        if (sql.includes('INSERT INTO ai_logs')) {
            return { rows: [{ id: 1 }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO telemetry_logs')) {
            return { rows: [{ id: 1 }], rowCount: 1 };
        }
        if (sql.includes('INSERT')) {
            return {
                rows: [{
                    tx_hash: params?.[0] || '0x',
                    from_address: params?.[1] || '0x',
                    to_address: params?.[2] || '0x',
                    value_wei: params?.[3] || '0',
                    status: 'confirmed',
                    block_number: 1,
                    gas_used: '21000',
                }],
                rowCount: 1,
            };
        }
        if (sql.includes('SELECT NOW')) {
            return { rows: [{ now: new Date() }], rowCount: 1 };
        }
        if (sql.includes('SELECT COUNT')) {
            return { rows: [{ count: '0' }], rowCount: 1 };
        }
        if (sql.includes('SELECT')) {
            return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
    };
}

// ═══════════════════════════════════════════════
//  GLOBAL LIFECYCLE
// ═══════════════════════════════════════════════

beforeAll(async () => {
    await anvil.startAnvil();
    await anvil.deployContracts();
    anvil.patchContractService();
    app = require('../../index');
    baseMockImpl = buildBaseMock();
    mockQuery.mockImplementation(baseMockImpl);
}, 90000);

afterAll(async () => {
    await anvil.stopAnvil();
});

beforeEach(() => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockClear();
    mockPublish.mockClear();
    mockAxiosPost.mockReset();
    mockAxiosGet.mockReset();
    mockAxiosPut.mockReset();
    if (baseMockImpl) mockQuery.mockImplementation(baseMockImpl);
});

// ═══════════════════════════════════════════════
//  FLOW 1: Webhook → Mint
//  POST /api/ai-control/telemetry → Aegis validates → NFT minted on-chain
// ═══════════════════════════════════════════════

describe('Flow 1: Webhook → Mint (Telemetry to NFT)', () => {
    test('full pipeline: submit telemetry → AI approves → NFT minted → event published', async () => {
        // 1. Aegis AI approves the telemetry
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: true, score: 0.95 },
        });

        const token = adminToken();
        const res = await request(app)
            .post('/api/ai-control/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({
                containerId: 'E2E-CONT-001',
                telemetryData: {
                    temperature: -18,
                    humidity: 42,
                    gps_lat: 40.7128,
                    gps_lng: -74.006,
                },
            });

        // 2. Verify HTTP response
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(res.body.metadataUri).toContain('E2E-CONT-001');
        expect(res.body.blockNumber).toBeGreaterThan(0);

        // 3. Verify NFT was minted on-chain
        const nft = anvil.contracts.BeZhasLogisticsNFT.instance;
        const owner = await nft.ownerOf(0);
        expect(owner).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');

        // 4. Verify AI decision was logged to DB
        const aiLogCall = mockQuery.mock.calls.find(c =>
            c[0].includes('ai_logs')
        );
        expect(aiLogCall).toBeDefined();

        // 5. Verify minted event published to Redis
        expect(mockPublish).toHaveBeenCalledWith(
            'event:aegis:minted',
            expect.objectContaining({ containerId: 'E2E-CONT-001' })
        );
    }, 30000);

    test('rejects request with missing fields', async () => {
        const token = adminToken();
        const res = await request(app)
            .post('/api/ai-control/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({ containerId: '' }); // missing telemetryData

        expect(res.status).toBe(400);
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .post('/api/ai-control/telemetry')
            .send({
                containerId: 'UNAUTH',
                telemetryData: { temperature: -18, humidity: 42 },
            });

        expect(res.status).toBe(401);
    });
});

// ═══════════════════════════════════════════════
//  FLOW 2: Gas Auto-Recharge
//  Monitor enterprise balances → detect low gas → recharge via BEZ transfer
// ═══════════════════════════════════════════════

describe('Flow 2: Gas Auto-Recharge', () => {
    test('GET /api/gas/status returns real chain data', async () => {
        const res = await request(app).get('/api/gas/status');

        expect(res.status).toBe(200);
        expect(res.body.blockNumber).toBeGreaterThan(0);
        expect(res.body.gasPrice).toBeDefined();
    });

    test('GET /api/gas/balances returns enterprise balances (admin)', async () => {
        const addrQ = anvil.mockContractAddressQuery();
        mockQuery.mockImplementation((sql, params) => {
            if (sql.includes('contract_addresses')) return addrQ(sql, params);
            if (sql.includes('role') && sql.includes('users')) {
                return { rows: [{ role: 'admin' }], rowCount: 1 };
            }
            if (sql.includes('gas_balances')) {
                return {
                    rows: [{
                        enterprise_id: 1,
                        wallet_address: anvil.user.address,
                        balance_bez: 0.5,
                        enterprise_name: 'TestCorp',
                        sector: 'logistics',
                    }],
                    rowCount: 1,
                };
            }
            return { rows: [], rowCount: 0 };
        });

        const res = await request(app)
            .get('/api/gas/balances')
            .set('Authorization', `Bearer ${adminToken()}`);

        expect(res.status).toBe(200);
        expect(res.body.balances).toHaveLength(1);
        expect(res.body.balances[0].balance_bez).toBe(0.5);
        expect(res.body.balances[0].enterprise_name).toBe('TestCorp');
    });

    test('BEZ transfer succeeds on-chain (recharge simulation)', async () => {
        // Simulate what gasMonitor does: sendBEZ to enterprise wallet
        const { sendBEZ } = require('../../services/txService');

        const record = await sendBEZ(anvil.enterprise.address, 50, {
            contract: 'GasTankRecharge',
            method: 'autoRecharge',
        });

        expect(record.tx_hash).toMatch(/^0x/);
        expect(record.status).toBe('confirmed');

        // Verify on-chain: enterprise got native BEZ (gas token)
        // Anvil accounts start with 10000 ETH; after +50 native BEZ:
        const balance = await anvil.provider.getBalance(anvil.enterprise.address);
        expect(parseFloat(ethers.formatEther(balance))).toBeGreaterThanOrEqual(10050);
    }, 20000);
});

// ═══════════════════════════════════════════════
//  FLOW 3: Dashboard Live Data
//  Health → Contracts → Gas Status → Transactions → all real data
// ═══════════════════════════════════════════════

describe('Flow 3: Dashboard Live Data', () => {
    test('health check confirms all services up', async () => {
        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
        expect(res.body.services.database).toBe('up');
    });

    test('contract registry returns all deployed contracts', async () => {
        const res = await request(app).get('/api/contracts?chainId=31337');

        expect(res.status).toBe(200);
        expect(res.body.chainId).toBe(31337);
        expect(res.body.contracts).toBeDefined();
        expect(res.body.contracts.core).toHaveProperty('BEZCoinV2');
        expect(res.body.contracts.core).toHaveProperty('BeZhasLogisticsNFT');
        expect(res.body.contracts.core).toHaveProperty('QualityEscrow');
    });

    test('gas status returns real block info', async () => {
        const res = await request(app).get('/api/gas/status');

        expect(res.status).toBe(200);
        expect(typeof res.body.blockNumber).toBe('number');
        expect(res.body.blockNumber).toBeGreaterThan(0);
    });

    test('transaction endpoint returns paginated data', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [
                    { tx_hash: '0x' + 'a'.repeat(64), status: 'confirmed', value_wei: '1000', block_number: 1, contract_name: 'BEZCoinV2' },
                    { tx_hash: '0x' + 'b'.repeat(64), status: 'confirmed', value_wei: '2000', block_number: 2, contract_name: 'BEZCoinV2' },
                    { tx_hash: '0x' + 'c'.repeat(64), status: 'confirmed', value_wei: '3000', block_number: 3, contract_name: 'BeZhasLogisticsNFT' },
                ],
                rowCount: 3,
            });

        const res = await request(app).get('/api/transactions?page=1&limit=10');

        expect(res.status).toBe(200);
        expect(res.body.transactions).toHaveLength(3);
        expect(res.body.total).toBe(3);
        expect(res.body.page).toBe(1);
    });

    test('single contract info resolves by name', async () => {
        const res = await request(app).get('/api/contracts/BEZCoinV2?chainId=31337');

        expect(res.status).toBe(200);
        expect(res.body.address).toBe(anvil.contracts.BEZCoinV2.address);
        expect(res.body.name).toBe('BEZCoinV2');
    });
});

// ═══════════════════════════════════════════════
//  FLOW 4: AI Anomaly Detection
//  Submit bad telemetry → rejected by AI → submit good → approved → mint
// ═══════════════════════════════════════════════

describe('Flow 4: AI Anomaly Detection', () => {
    test('AI rejects anomalous telemetry (high temperature)', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: false, score: 0.15, reason: 'Temperature anomaly detected' },
        });

        const token = adminToken();
        const res = await request(app)
            .post('/api/ai-control/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({
                containerId: 'ANOMALY-001',
                telemetryData: {
                    temperature: 35, // way too hot for cold chain
                    humidity: 90,
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(false);
        expect(res.body.reason).toContain('rejected');

        // AI decision still logged
        const aiLog = mockQuery.mock.calls.find(c =>
            c[0].includes('ai_logs') && c[1]?.includes('anomaly_detector')
        );
        expect(aiLog).toBeDefined();
    });

    test('AI approves normal telemetry after rejection', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: true, score: 0.92 },
        });

        const token = adminToken();
        const res = await request(app)
            .post('/api/ai-control/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({
                containerId: 'ANOMALY-002',
                telemetryData: {
                    temperature: -17.5,
                    humidity: 45,
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.txHash).toMatch(/^0x/);
    }, 20000);

    test('fallback validation when Aegis is offline', async () => {
        mockAxiosPost.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const token = adminToken();
        const res = await request(app)
            .post('/api/ai-control/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({
                containerId: 'FALLBACK-001',
                telemetryData: {
                    temperature: -18, // within -20 to -15 fallback range
                    humidity: 40,
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.txHash).toMatch(/^0x/);
    }, 20000);

    test('fallback rejects out-of-range when Aegis offline', async () => {
        mockAxiosPost.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const token = adminToken();
        const res = await request(app)
            .post('/api/ai-control/telemetry')
            .set('Authorization', `Bearer ${token}`)
            .send({
                containerId: 'FALLBACK-BAD',
                telemetryData: {
                    temperature: 50, // outside -20...-15
                    humidity: 95,
                },
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════
//  FLOW 5: Sector Operation
//  List sectors → query by sector → 404 for unknown sector
// ═══════════════════════════════════════════════

describe('Flow 5: Sector Operation', () => {
    test('GET /api/sectors returns all sectors', async () => {
        const addrQ = anvil.mockContractAddressQuery();
        mockQuery.mockImplementation((sql, params) => {
            if (sql.includes('contract_addresses') && sql.includes('GROUP BY')) {
                return {
                    rows: [
                        {
                            sector: 'core',
                            contract_count: 3,
                            contracts: [
                                { name: 'BEZCoinV2', address: anvil.contracts.BEZCoinV2.address },
                                { name: 'BeZhasLogisticsNFT', address: anvil.contracts.BeZhasLogisticsNFT.address },
                                { name: 'QualityEscrow', address: anvil.contracts.QualityEscrow.address },
                            ],
                        },
                    ],
                    rowCount: 1,
                };
            }
            if (sql.includes('contract_addresses')) return addrQ(sql, params);
            return baseMockImpl(sql, params);
        });

        const res = await request(app).get('/api/sectors');

        expect(res.status).toBe(200);
        expect(res.body.sectors).toHaveLength(1);
        expect(res.body.sectors[0].sector).toBe('core');
        expect(res.body.sectors[0].contract_count).toBe(3);
    });

    test('GET /api/sectors/:sector returns contracts for sector', async () => {
        const addrQ = anvil.mockContractAddressQuery();
        mockQuery.mockImplementation((sql, params) => {
            if (sql.includes('contract_addresses') && sql.includes('category')) {
                return {
                    rows: [
                        { name: 'BEZCoinV2', address: anvil.contracts.BEZCoinV2.address, category: 'core', chain_id: 31337 },
                        { name: 'BeZhasLogisticsNFT', address: anvil.contracts.BeZhasLogisticsNFT.address, category: 'core', chain_id: 31337 },
                    ],
                    rowCount: 2,
                };
            }
            if (sql.includes('contract_addresses')) return addrQ(sql, params);
            return baseMockImpl(sql, params);
        });

        const res = await request(app).get('/api/sectors/core?chainId=31337');

        expect(res.status).toBe(200);
        expect(res.body.sector).toBe('core');
        expect(res.body.contracts).toHaveLength(2);
    });

    test('GET /api/sectors/:sector returns 404 for unknown sector', async () => {
        mockQuery.mockImplementation((sql, params) => {
            if (sql.includes('contract_addresses') && sql.includes('category')) {
                return { rows: [], rowCount: 0 };
            }
            return baseMockImpl(sql, params);
        });

        const res = await request(app).get('/api/sectors/nonexistent?chainId=31337');

        expect(res.status).toBe(404);
    });
});
