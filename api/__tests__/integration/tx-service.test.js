/**
 * Integration tests — txService against a real Anvil node.
 *
 * Tests: sendBEZ (native transfer), watchTx (receipt + DB record),
 * and recordTx (DB upsert) with a real blockchain backend.
 */
const { ethers } = require('ethers');
const anvil = require('./setup');

// ── Mock DB ──
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

// ── Mock Redis ──
const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue('OK');
const mockPublish = jest.fn().mockResolvedValue(1);
jest.mock('../../cache/redis', () => ({
    cacheGet: (...a) => mockCacheGet(...a),
    cacheSet: (...a) => mockCacheSet(...a),
    publish: (...a) => mockPublish(...a),
    connectRedis: jest.fn(),
    checkRateLimit: jest.fn().mockResolvedValue(false),
}));

// ── Env ──
process.env.BEZHAS_L2_RPC_URL = anvil.RPC_URL;
process.env.DEPLOYER_PRIVATE_KEY = anvil.DEPLOYER_KEY;
process.env.BEZHAS_CHAIN_ID = '31337';

let txService;

// ═══════════════════════════════════════════════
//  Lifecycle
// ═══════════════════════════════════════════════

beforeAll(async () => {
    await anvil.startAnvil();
    await anvil.deployContracts();
    // Patch contractService to use Anvil provider/deployer directly
    anvil.patchContractService();
    txService = require('../../services/txService');
}, 60000);

afterAll(async () => {
    await anvil.stopAnvil();
});

beforeEach(() => {
    mockQuery.mockReset();
    mockPublish.mockClear();
    // Default: recordTx INSERT returns the inserted row
    mockQuery.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO transactions')) {
            return {
                rows: [{
                    tx_hash: params[0],
                    from_address: params[1],
                    to_address: params[2],
                    value_wei: params[3],
                    contract_name: params[4],
                    method_name: params[5],
                    status: params[6],
                    chain_id: params[7],
                    block_number: params[8],
                    gas_used: params[9],
                }],
                rowCount: 1,
            };
        }
        if (sql.includes('SELECT COUNT')) {
            return { rows: [{ count: '0' }], rowCount: 1 };
        }
        if (sql.includes('SELECT * FROM transactions')) {
            return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
    });
});

// ═══════════════════════════════════════════════
//  sendBEZ — Native token transfer
// ═══════════════════════════════════════════════

describe('sendBEZ — real blockchain transfer', () => {
    test('sends native ETH to target address', async () => {
        const balanceBefore = await anvil.provider.getBalance(anvil.user.address);

        const record = await txService.sendBEZ(anvil.user.address, '1.0');

        expect(record).toBeDefined();
        expect(record.tx_hash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(record.status).toBe('confirmed');
        expect(record.contract_name).toBe('NativeTransfer');
        expect(record.method_name).toBe('sendBEZ');

        const balanceAfter = await anvil.provider.getBalance(anvil.user.address);
        const diff = balanceAfter - balanceBefore;
        expect(diff).toBe(ethers.parseEther('1.0'));
    }, 15000);

    test('records transaction in DB via INSERT', async () => {
        await txService.sendBEZ(anvil.enterprise.address, '0.5');

        const insertCalls = mockQuery.mock.calls.filter(c => c[0].includes('INSERT INTO transactions'));
        expect(insertCalls.length).toBeGreaterThanOrEqual(1);

        const params = insertCalls[0][1];
        expect(params[0]).toMatch(/^0x/); // tx_hash
        expect(params[6]).toBe('confirmed'); // status
    }, 15000);

    test('publishes tx:confirmed event to Redis', async () => {
        await txService.sendBEZ(anvil.user.address, '0.1');

        expect(mockPublish).toHaveBeenCalledWith(
            'tx:confirmed',
            expect.objectContaining({ tx_hash: expect.any(String) })
        );
    }, 15000);
});

// ═══════════════════════════════════════════════
//  watchTx — Receipt tracking
// ═══════════════════════════════════════════════

describe('watchTx — receipt tracking', () => {
    test('watches a real tx and records receipt', async () => {
        // Send raw tx from deployer
        const tx = await anvil.deployer.sendTransaction({
            to: anvil.enterprise.address,
            value: ethers.parseEther('0.01'),
        });

        const record = await txService.watchTx(tx.hash, {
            contract: 'TestTransfer',
            method: 'manual',
        });

        expect(record.tx_hash).toBe(tx.hash);
        expect(record.status).toBe('confirmed');
        expect(record.contract_name).toBe('TestTransfer');
        expect(parseInt(record.block_number)).toBeGreaterThan(0);
    }, 15000);
});

// ═══════════════════════════════════════════════
//  getRecentTxs — Pagination from DB
// ═══════════════════════════════════════════════

describe('getRecentTxs — DB pagination', () => {
    test('returns paginated results', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
            .mockResolvedValueOnce({
                rows: [
                    { tx_hash: '0x' + 'a'.repeat(64), from_address: '0x1', status: 'confirmed' },
                    { tx_hash: '0x' + 'b'.repeat(64), from_address: '0x2', status: 'confirmed' },
                ],
                rowCount: 2,
            });

        const result = await txService.getRecentTxs({ page: 1, limit: 2 });
        expect(result.transactions).toHaveLength(2);
        expect(result.total).toBe(5);
        expect(result.page).toBe(1);
        expect(result.pages).toBe(3);
    });

    test('filters by address', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ tx_hash: '0x' + 'c'.repeat(64) }], rowCount: 1 });

        const result = await txService.getRecentTxs({ address: '0x1234' });
        // The address filter should appear in the SQL
        const firstCall = mockQuery.mock.calls.find(c => c[0].includes('from_address'));
        expect(firstCall).toBeDefined();
    });
});

// ═══════════════════════════════════════════════
//  getTxByHash — DB fallback to chain
// ═══════════════════════════════════════════════

describe('getTxByHash — chain fallback', () => {
    test('returns tx from DB when found', async () => {
        const fakeTx = { tx_hash: '0x' + 'a'.repeat(64), status: 'confirmed' };
        mockQuery.mockResolvedValueOnce({ rows: [fakeTx], rowCount: 1 });

        const result = await txService.getTxByHash('0x' + 'a'.repeat(64));
        expect(result).toEqual(fakeTx);
    });

    test('falls back to chain when not in DB', async () => {
        // Send a real tx so we can look it up
        const tx = await anvil.deployer.sendTransaction({
            to: anvil.user.address,
            value: ethers.parseEther('0.001'),
        });
        await tx.wait();

        // Configure mock: SELECT returns empty, INSERT returns the inserted row
        mockQuery.mockReset();
        mockQuery.mockImplementation((sql, params) => {
            if (sql.includes('INSERT INTO transactions')) {
                return {
                    rows: [{
                        tx_hash: params[0],
                        from_address: params[1],
                        to_address: params[2],
                        status: params[6],
                        block_number: params[8],
                    }],
                    rowCount: 1,
                };
            }
            return { rows: [], rowCount: 0 };
        });

        const result = await txService.getTxByHash(tx.hash);
        expect(result).toBeDefined();
        expect(result.tx_hash).toBe(tx.hash);
        expect(result.status).toBe('confirmed');
    }, 15000);
});
