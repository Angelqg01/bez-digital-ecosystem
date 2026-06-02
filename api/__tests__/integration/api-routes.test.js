/**
 * Integration tests — API routes with real blockchain backend.
 *
 * Uses Supertest to call Express routes, with a real Anvil node
 * for blockchain reads. DB and Redis are mocked.
 */
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const anvil = require('./setup');

// ── Mock DB ──
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

// ── Mock Redis ──
const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue('OK');
jest.mock('../../cache/redis', () => ({
    cacheGet: (...a) => mockCacheGet(...a),
    cacheSet: (...a) => mockCacheSet(...a),
    publish: jest.fn().mockResolvedValue(1),
    connectRedis: jest.fn().mockResolvedValue(true),
    checkRateLimit: jest.fn().mockResolvedValue(false),
}));

// ── Mock services that auto-start ──
jest.mock('../../services/eventListener', () => ({ startListening: jest.fn().mockResolvedValue(true) }));
jest.mock('../../services/gasMonitor', () => ({ startDaemon: jest.fn() }));

// ── Env ──
process.env.BEZHAS_L2_RPC_URL = anvil.RPC_URL;
process.env.DEPLOYER_PRIVATE_KEY = anvil.DEPLOYER_KEY;
process.env.BEZHAS_CHAIN_ID = '31337';
process.env.JWT_SECRET = 'test-integration-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
let app;
let baseMockImpl;

const JWT_SECRET = process.env.JWT_SECRET;

function makeToken(overrides = {}) {
    return jwt.sign({
        address: anvil.DEPLOYER_KEY ? '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' : '0x' + 'f'.repeat(40),
        userId: 1,
        role: 'admin',
        ...overrides,
    }, JWT_SECRET, { expiresIn: '1h' });
}

// ═══════════════════════════════════════════════
//  Lifecycle
// ═══════════════════════════════════════════════

beforeAll(async () => {
    await anvil.startAnvil();
    await anvil.deployContracts();
    // Patch contractService to use Anvil provider/deployer directly
    anvil.patchContractService();
    app = require('../../index');

    // Wire contract address lookups + user role queries
    baseMockImpl = buildBaseMock();
    mockQuery.mockImplementation(baseMockImpl);
}, 60000);

function buildBaseMock() {
    const addressQuery = anvil.mockContractAddressQuery();
    return (sql, params) => {
        if (sql.includes('contract_addresses')) {
            return addressQuery(sql, params);
        }
        // requireRole middleware: SELECT role FROM users WHERE wallet_address = $1
        if (sql.includes('role') && sql.includes('users')) {
            return { rows: [{ role: 'admin' }], rowCount: 1 };
        }
        if (sql.includes('SELECT') && sql.includes('users')) {
            return {
                rows: [{
                    id: 1,
                    wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
                    username: 'deployer',
                    email: 'deployer@bez.digital',
                    role: 'admin',
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
        if (sql.includes('INSERT')) {
            return { rows: [{ id: 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
    };
}

afterAll(async () => {
    await anvil.stopAnvil();
});

beforeEach(() => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockClear();
    if (baseMockImpl) mockQuery.mockImplementation(baseMockImpl);
});

// ═══════════════════════════════════════════════
//  Health check
// ═══════════════════════════════════════════════

describe('GET /api/health — with real blockchain', () => {
    test('returns healthy with DB connection', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
    });
});

// ═══════════════════════════════════════════════
//  GET /api/contracts — real address resolution
// ═══════════════════════════════════════════════

describe('GET /api/contracts — real blockchain', () => {
    test('returns grouped contract addresses', async () => {
        const res = await request(app).get('/api/contracts?chainId=31337');

        expect(res.status).toBe(200);
        expect(res.body.chainId).toBe(31337);
        expect(res.body.contracts).toBeDefined();
        expect(res.body.contracts.core).toHaveProperty('BEZCoinV2');
        // Address should match deployed contract
        expect(res.body.contracts.core.BEZCoinV2).toBe(anvil.contracts.BEZCoinV2.address);
    });

    test('returns single contract info', async () => {
        const res = await request(app).get('/api/contracts/BEZCoinV2?chainId=31337');

        expect(res.status).toBe(200);
        expect(res.body.address).toBe(anvil.contracts.BEZCoinV2.address);
    });

    test('returns 404 for unknown contract', async () => {
        const res = await request(app).get('/api/contracts/NonExistent?chainId=31337');
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════
//  GET /api/gas/status — real gas price
// ═══════════════════════════════════════════════

describe('GET /api/gas/status — real blockchain', () => {
    test('returns real block number and gas price', async () => {
        const res = await request(app).get('/api/gas/status');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('blockNumber');
        expect(res.body).toHaveProperty('gasPrice');
        expect(res.body.blockNumber).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════
//  GET /api/transactions — DB query through HTTP
// ═══════════════════════════════════════════════

describe('GET /api/transactions — with mocked DB', () => {
    test('returns paginated transaction list', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [
                    { tx_hash: '0x' + 'a'.repeat(64), status: 'confirmed', value_wei: '1000' },
                    { tx_hash: '0x' + 'b'.repeat(64), status: 'confirmed', value_wei: '2000' },
                ],
                rowCount: 2,
            });

        const res = await request(app).get('/api/transactions?page=1&limit=10');

        expect(res.status).toBe(200);
        expect(res.body.transactions).toHaveLength(2);
        expect(res.body.total).toBe(2);
        expect(res.body.page).toBe(1);
    });

    test('validates tx hash format', async () => {
        const res = await request(app).get('/api/transactions/invalid-hash');
        expect(res.status).toBe(400);
    });
});

// ═══════════════════════════════════════════════
//  GET /api/gas/balances — authenticated route
// ═══════════════════════════════════════════════

describe('GET /api/gas/balances — auth required', () => {
    test('returns 401 without token', async () => {
        const res = await request(app).get('/api/gas/balances');
        expect(res.status).toBe(401);
    });

    test('returns balances with valid admin token', async () => {
        const token = makeToken({ role: 'admin' });

        const addrQ = anvil.mockContractAddressQuery();
        mockQuery.mockImplementation((sql, params) => {
            if (sql.includes('contract_addresses')) return addrQ(sql, params);
            if (sql.includes('role') && sql.includes('users')) {
                return { rows: [{ role: 'admin' }], rowCount: 1 };
            }
            if (sql.includes('gas_balances')) {
                return {
                    rows: [
                        { enterprise_id: 1, wallet_address: anvil.user.address, balance_bez: 50.5, enterprise_name: 'TestCorp', sector: 'logistics' },
                    ],
                    rowCount: 1,
                };
            }
            return { rows: [], rowCount: 0 };
        });

        const res = await request(app)
            .get('/api/gas/balances')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.balances).toHaveLength(1);
        expect(res.body.balances[0].enterprise_name).toBe('TestCorp');
    });
});
