/**
 * Integration tests — AegisService (telemetry → validate → mint NFT).
 *
 * Tests the full flow: receive telemetry data, validate with Aegis AI
 * (or fallback), mint BeZhasLogisticsNFT on-chain, and record in DB.
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

// ── Mock axios (Aegis AI calls) ──
const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({ post: (...a) => mockAxiosPost(...a) }));

// ── Env ──
process.env.BEZHAS_L2_RPC_URL = anvil.RPC_URL;
process.env.DEPLOYER_PRIVATE_KEY = anvil.DEPLOYER_KEY;
process.env.BEZHAS_CHAIN_ID = '31337';

let aegisService;

// ═══════════════════════════════════════════════
//  Lifecycle
// ═══════════════════════════════════════════════

beforeAll(async () => {
    await anvil.startAnvil();
    await anvil.deployContracts();

    // Patch contractService to use Anvil provider/deployer directly
    anvil.patchContractService();
    aegisService = require('../../services/aegisService');

    // Wire up the contract address lookup so aegisService can get NFT contract
    const addressQuery = anvil.mockContractAddressQuery();
    mockQuery.mockImplementation((sql, params) => {
        if (sql.includes('contract_addresses')) {
            return addressQuery(sql, params);
        }
        // INSERT/UPDATE queries for ai_logs, telemetry_logs, transactions
        if (sql.includes('INSERT')) {
            return {
                rows: [{
                    tx_hash: params?.[0] || '0x',
                    from_address: params?.[1] || '0x',
                    to_address: params?.[2] || '0x',
                    value_wei: params?.[3] || '0',
                    contract_name: params?.[4] || null,
                    method_name: params?.[5] || null,
                    status: params?.[6] || 'confirmed',
                    chain_id: params?.[7] || 31337,
                    block_number: params?.[8] || 1,
                    gas_used: params?.[9] || '21000',
                }],
                rowCount: 1,
            };
        }
        return { rows: [], rowCount: 0 };
    });
}, 60000);

afterAll(async () => {
    await anvil.stopAnvil();
});

beforeEach(() => {
    mockAxiosPost.mockReset();
    mockPublish.mockClear();
});

// ═══════════════════════════════════════════════
//  Full flow: Aegis approved → NFT minted
// ═══════════════════════════════════════════════

describe('processTelemetryAndTokenize — full chain', () => {
    const validTelemetry = {
        temperature: -18,
        humidity: 45,
        gps_lat: 40.7128,
        gps_lng: -74.0060,
    };

    test('mints NFT when Aegis AI approves', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: true, score: 0.95 },
        });

        const result = await aegisService.processTelemetryAndTokenize(
            anvil.user.address,
            'CONT-001',
            validTelemetry
        );

        expect(result.success).toBe(true);
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
        expect(result.metadataUri).toContain('CONT-001');
        expect(result.blockNumber).toBeGreaterThan(0);

        // Verify NFT was actually minted on-chain
        const nft = anvil.contracts.BeZhasLogisticsNFT.instance;
        const owner = await nft.ownerOf(0); // first token
        // Owner could be user.address depending on the mint recipient
        expect(owner.toLowerCase()).toBe(anvil.user.address.toLowerCase());
    }, 20000);

    test('logs AI decision to database', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: true, score: 0.88 },
        });

        await aegisService.processTelemetryAndTokenize(
            anvil.enterprise.address,
            'CONT-002',
            validTelemetry
        );

        const aiLogInsert = mockQuery.mock.calls.find(c =>
            c[0].includes('ai_logs')
        );
        expect(aiLogInsert).toBeDefined();
        expect(aiLogInsert[1]).toContain('anomaly_detector');
    }, 20000);

    test('logs telemetry to database', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: true, score: 0.90 },
        });

        await aegisService.processTelemetryAndTokenize(
            anvil.enterprise.address,
            'CONT-003',
            validTelemetry
        );

        const telemetryInsert = mockQuery.mock.calls.find(c =>
            c[0].includes('telemetry_logs')
        );
        expect(telemetryInsert).toBeDefined();
    }, 20000);

    test('publishes minted event to Redis', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: true, score: 0.92 },
        });

        await aegisService.processTelemetryAndTokenize(
            anvil.user.address,
            'CONT-004',
            validTelemetry
        );

        expect(mockPublish).toHaveBeenCalledWith(
            'event:aegis:minted',
            expect.objectContaining({ containerId: 'CONT-004' })
        );
    }, 20000);
});

// ═══════════════════════════════════════════════
//  Aegis rejected — no mint
// ═══════════════════════════════════════════════

describe('processTelemetryAndTokenize — rejection', () => {
    test('returns failure when Aegis rejects telemetry', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: false, score: 0.3 },
        });

        const result = await aegisService.processTelemetryAndTokenize(
            anvil.user.address,
            'CONT-BAD',
            { temperature: 50, humidity: 95 }
        );

        expect(result.success).toBe(false);
        expect(result.reason).toContain('rejected');
    }, 10000);

    test('still logs the rejected decision to ai_logs', async () => {
        mockAxiosPost.mockResolvedValueOnce({
            data: { approved: false, score: 0.1 },
        });

        await aegisService.processTelemetryAndTokenize(
            anvil.user.address,
            'CONT-REJECT',
            { temperature: 100, humidity: 100 }
        );

        const aiLogInsert = mockQuery.mock.calls.find(c =>
            c[0].includes('ai_logs')
        );
        expect(aiLogInsert).toBeDefined();
    }, 10000);
});

// ═══════════════════════════════════════════════
//  Aegis offline — fallback validation
// ═══════════════════════════════════════════════

describe('processTelemetryAndTokenize — fallback mode', () => {
    test('uses fallback validation when Aegis is offline', async () => {
        mockAxiosPost.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const result = await aegisService.processTelemetryAndTokenize(
            anvil.user.address,
            'CONT-FALLBACK',
            { temperature: -17, humidity: 40 } // within fallback range
        );

        expect(result.success).toBe(true);
        expect(result.txHash).toMatch(/^0x/);
    }, 20000);

    test('fallback rejects out-of-range temperature', async () => {
        mockAxiosPost.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const result = await aegisService.processTelemetryAndTokenize(
            anvil.user.address,
            'CONT-FAIL-FB',
            { temperature: 25, humidity: 40 } // outside -20 to -15 range
        );

        expect(result.success).toBe(false);
    }, 10000);
});
