/**
 * Integration tests — GasMonitor against a real Anvil node.
 *
 * Tests: balance checking, auto-recharge when below threshold,
 * DB upsert of gas balances.
 */
const { ethers } = require('ethers');
const anvil = require('./setup');

// ── Mock DB ──
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

// ── Mock Redis ──
const mockPublish = jest.fn().mockResolvedValue(1);
jest.mock('../../cache/redis', () => ({
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheSet: jest.fn().mockResolvedValue('OK'),
    publish: (...a) => mockPublish(...a),
    connectRedis: jest.fn(),
    checkRateLimit: jest.fn().mockResolvedValue(false),
}));

// ── Env ──
process.env.BEZHAS_L2_RPC_URL = anvil.RPC_URL;
process.env.DEPLOYER_PRIVATE_KEY = anvil.DEPLOYER_KEY;
process.env.BEZHAS_CHAIN_ID = '31337';

let gasMonitor;

beforeAll(async () => {
    await anvil.startAnvil();
    await anvil.deployContracts();
    // Patch contractService to use Anvil provider/deployer directly
    anvil.patchContractService();
    gasMonitor = require('../../services/gasMonitor');
}, 60000);

afterAll(async () => {
    await anvil.stopAnvil();
});

beforeEach(() => {
    mockQuery.mockReset();
    mockPublish.mockClear();
    gasMonitor.isRunning = false;
});

// ═══════════════════════════════════════════════
//  Enterprise balance check
// ═══════════════════════════════════════════════

describe('GasMonitor — balance scanning', () => {
    test('skips when no enterprises in DB', async () => {
        // getEnterprises returns empty
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

        await gasMonitor.checkAndRechargeEnterpriseNodes();

        // Only one query (enterprise fetch) should have been made
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('checks balance and upserts when enterprise has sufficient gas', async () => {
        // Enterprise with the user address (has 10000 ETH from Anvil)
        mockQuery
            .mockResolvedValueOnce({
                rows: [{ id: 1, name: 'TestCorp', gas_tank_address: anvil.user.address }],
                rowCount: 1,
            })
            // gas_balances SELECT (no existing row)
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            // gas_balances INSERT
            .mockResolvedValueOnce({ rows: [], rowCount: 1 });

        await gasMonitor.checkAndRechargeEnterpriseNodes();

        // Should have done enterprise fetch + balance check + INSERT
        const insertCall = mockQuery.mock.calls.find(c =>
            c[0].includes('INSERT INTO gas_balances')
        );
        expect(insertCall).toBeDefined();
        // Balance should be > 1 BEZ, so NO recharge
    });

    test('auto-recharges when balance is below threshold', async () => {
        // Create a fresh address with 0 balance
        const emptyWallet = ethers.Wallet.createRandom();

        mockQuery
            .mockResolvedValueOnce({
                rows: [{ id: 2, name: 'LowGasCorp', gas_tank_address: emptyWallet.address }],
                rowCount: 1,
            })
            // gas_balances SELECT
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            // gas_balances INSERT
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })
            // sendBEZ → recordTx INSERT
            .mockImplementation((sql, params) => {
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
                return { rows: [], rowCount: 0 };
            });

        await gasMonitor.checkAndRechargeEnterpriseNodes();

        // Verify that balance was topped up on-chain
        const balance = await anvil.provider.getBalance(emptyWallet.address);
        expect(balance).toBe(ethers.parseEther('50'));

        // Verify recordTx was called
        const txInsert = mockQuery.mock.calls.find(c =>
            c[0].includes('INSERT INTO transactions') && c[1]?.[4] === 'GasTankRecharge'
        );
        expect(txInsert).toBeDefined();
    }, 20000);

    test('updates existing gas_balances row', async () => {
        mockQuery
            .mockResolvedValueOnce({
                rows: [{ id: 3, name: 'UpdateCorp', gas_tank_address: anvil.enterprise.address }],
                rowCount: 1,
            })
            // gas_balances SELECT (existing row)
            .mockResolvedValueOnce({ rows: [{ id: 10 }], rowCount: 1 })
            // gas_balances UPDATE
            .mockResolvedValueOnce({ rows: [], rowCount: 1 });

        await gasMonitor.checkAndRechargeEnterpriseNodes();

        const updateCall = mockQuery.mock.calls.find(c =>
            c[0].includes('UPDATE gas_balances')
        );
        expect(updateCall).toBeDefined();
    });
});

// ═══════════════════════════════════════════════
//  Concurrency guard
// ═══════════════════════════════════════════════

describe('GasMonitor — concurrency', () => {
    test('skips if already running', async () => {
        gasMonitor.isRunning = true;
        await gasMonitor.checkAndRechargeEnterpriseNodes();
        expect(mockQuery).not.toHaveBeenCalled();
    });
});
