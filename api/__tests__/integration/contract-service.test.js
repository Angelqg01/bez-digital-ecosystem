/**
 * Integration tests — contractService against a real Anvil node.
 *
 * Tests: BEZ balance, total supply, NFT ownership, blockchain stats,
 * contract address resolution through the service layer.
 */
const { ethers } = require('ethers');
const anvil = require('./setup');

// ── Set env BEFORE anything else loads ──
process.env.BEZHAS_L2_RPC_URL = anvil.RPC_URL;
process.env.DEPLOYER_PRIVATE_KEY = anvil.DEPLOYER_KEY;
process.env.BEZHAS_CHAIN_ID = '31337';

// ── Mock DB + Redis (contractService uses them for address cache) ──
const mockQuery = anvil.mockContractAddressQuery();
jest.mock('../../db/pool', () => ({ query: (...args) => mockQuery(...args) }));

const mockCacheGet = jest.fn().mockResolvedValue(null);
const mockCacheSet = jest.fn().mockResolvedValue('OK');
jest.mock('../../cache/redis', () => ({
    cacheGet: (...a) => mockCacheGet(...a),
    cacheSet: (...a) => mockCacheSet(...a),
    publish: jest.fn().mockResolvedValue(1),
    connectRedis: jest.fn(),
    checkRateLimit: jest.fn().mockResolvedValue(false),
}));

// contractService is loaded AFTER env + mocks are set
let contractService;

// ═══════════════════════════════════════════════
//  Lifecycle
// ═══════════════════════════════════════════════

beforeAll(async () => {
    await anvil.startAnvil();
    await anvil.deployContracts();
    // Patch contractService to use Anvil provider/deployer directly
    contractService = anvil.patchContractService();
}, 60000);

afterAll(async () => {
    await anvil.stopAnvil();
});

beforeEach(() => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockClear();
});

// ═══════════════════════════════════════════════
//  BEZCoinV2 — Balance & Supply
// ═══════════════════════════════════════════════

describe('BEZCoinV2 on-chain reads', () => {
    test('getBEZBalance returns formatted balance for deployer', async () => {
        const balance = await contractService.getBEZBalance(anvil.deployer.address);
        expect(parseFloat(balance)).toBeGreaterThanOrEqual(1000000);
    });

    test('getBEZBalance returns formatted balance for user', async () => {
        const balance = await contractService.getBEZBalance(anvil.user.address);
        expect(parseFloat(balance)).toBe(10000);
    });

    test('getBEZTotalSupply returns positive supply', async () => {
        const supply = await contractService.getBEZTotalSupply();
        expect(parseFloat(supply)).toBeGreaterThan(0);
    });

    test('getBEZTotalSupply caches result', async () => {
        await contractService.getBEZTotalSupply();
        expect(mockCacheSet).toHaveBeenCalledWith(
            'bez:totalSupply',
            expect.any(String),
            60
        );
    });

    test('getBEZTotalSupply uses cache when available', async () => {
        mockCacheGet.mockResolvedValueOnce('999999');
        const supply = await contractService.getBEZTotalSupply();
        expect(supply).toBe('999999');
    });
});

// ═══════════════════════════════════════════════
//  BeZhasLogisticsNFT — Mint & Ownership
// ═══════════════════════════════════════════════

describe('BeZhasLogisticsNFT on-chain reads', () => {
    let tokenId;

    beforeAll(async () => {
        // Mint an NFT directly via contract
        const nft = anvil.contracts.BeZhasLogisticsNFT.instance;
        const tx = await nft.safeMint(anvil.user.address, 'ipfs://test/container-001', 'CONT-TEST-001');
        const receipt = await tx.wait();
        // Token ID from Transfer event (first token = 0)
        const transferLog = receipt.logs.find(l => {
            try { return nft.interface.parseLog(l)?.name === 'Transfer'; } catch { return false; }
        });
        tokenId = nft.interface.parseLog(transferLog).args.tokenId;
    });

    test('getNFTOwner returns correct owner', async () => {
        const owner = await contractService.getNFTOwner(tokenId);
        expect(owner.toLowerCase()).toBe(anvil.user.address.toLowerCase());
    });

    test('getNFTOwner throws for non-existent token', async () => {
        await expect(contractService.getNFTOwner(99999)).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════
//  Blockchain Stats
// ═══════════════════════════════════════════════

describe('Blockchain stats', () => {
    test('getBlockchainStats returns block number and gas price', async () => {
        const stats = await contractService.getBlockchainStats();
        expect(stats).toHaveProperty('blockNumber');
        expect(stats).toHaveProperty('gasPrice');
        expect(stats.blockNumber).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════
//  Contract Address Resolution
// ═══════════════════════════════════════════════

describe('Contract address resolution', () => {
    test('getAllAddresses returns grouped contracts', async () => {
        const grouped = await contractService.getAllAddresses(31337);
        expect(grouped).toHaveProperty('core');
        expect(grouped.core).toHaveProperty('BEZCoinV2');
        expect(grouped.core.BEZCoinV2).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    test('getContract returns a working read-only instance', async () => {
        const bez = await contractService.getContract('BEZCoinV2', 31337);
        const name = await bez.name();
        expect(name).toBeDefined();
        expect(typeof name).toBe('string');
    });

    test('getSignedContract returns a signer-enabled instance', async () => {
        const nft = await contractService.getSignedContract('BeZhasLogisticsNFT', 31337);
        // Should be able to send a tx (mint)
        const tx = await nft.safeMint(anvil.deployer.address, 'ipfs://test/signed-mint', 'CONT-SIGNED-001');
        const receipt = await tx.wait();
        expect(receipt.status).toBe(1);
    });

    test('getContract throws for unknown contract', async () => {
        await expect(contractService.getContract('NonExistent', 31337)).rejects.toThrow();
    });
});
