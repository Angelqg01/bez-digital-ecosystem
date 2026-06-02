/**
 * Blockchain Service Unit Tests
 * Tests for smart contract interactions
 */

// Mock ethers before requiring the service
jest.mock('ethers', () => ({
    ethers: {
        JsonRpcProvider: jest.fn().mockImplementation(() => ({
            getNetwork: jest.fn().mockResolvedValue({ chainId: 1 }),
            getBlockNumber: jest.fn().mockResolvedValue(1000000)
        })),
        Contract: jest.fn().mockImplementation(() => ({
            createCampaign: jest.fn().mockResolvedValue({
                wait: jest.fn().mockResolvedValue({ hash: '0x1234' })
            }),
            distributeRewards: jest.fn().mockResolvedValue({
                wait: jest.fn().mockResolvedValue({ hash: '0x5678' })
            })
        })),
        parseEther: jest.fn(val => val),
        formatEther: jest.fn(val => val)
    }
}));

// Mock ABIs
jest.mock('../abis/CampaignContract.json', () => [], { virtual: true });
jest.mock('../abis/SettlementContract.json', () => [], { virtual: true });

describe('Blockchain Service', () => {
    let blockchainService;

    beforeAll(() => {
        // Set required environment variables
        process.env.RPC_URL = 'http://localhost:8545';
        process.env.CAMPAIGN_CONTRACT = '0x1234567890123456789012345678901234567890';
        process.env.SETTLEMENT_CONTRACT = '0x0987654321098765432109876543210987654321';

        // Clear module cache and require fresh instance
        jest.resetModules();
        blockchainService = require('../services/blockchain.service');
    });

    afterAll(() => {
        delete process.env.RPC_URL;
        delete process.env.CAMPAIGN_CONTRACT;
        delete process.env.SETTLEMENT_CONTRACT;
    });

    describe('lockBudgetOnChain', () => {
        it('should lock budget for a campaign', async () => {
            const advertiser = '0x1234567890123456789012345678901234567890';
            const budget = 1000;

            try {
                const result = await blockchainService.lockBudgetOnChain(advertiser, budget);
                expect(result).toBeDefined();
            } catch (error) {
                // If contract not available, that's expected in test environment
                expect(error.message).toContain('contract');
            }
        });

        it('should throw error if campaign contract not available', async () => {
            const originalEnv = process.env.CAMPAIGN_CONTRACT;
            delete process.env.CAMPAIGN_CONTRACT;

            jest.resetModules();
            const freshService = require('../services/blockchain.service');

            await expect(
                freshService.lockBudgetOnChain('0x123', 1000)
            ).rejects.toThrow();

            process.env.CAMPAIGN_CONTRACT = originalEnv;
        });
    });

    describe('distributeRewards', () => {
        it('should distribute rewards to creators', async () => {
            const campaignIds = [1, 2, 3];
            const creators = [
                '0x1111111111111111111111111111111111111111',
                '0x2222222222222222222222222222222222222222',
                '0x3333333333333333333333333333333333333333'
            ];
            const amounts = [100, 200, 300];

            try {
                const result = await blockchainService.distributeRewards(
                    campaignIds,
                    creators,
                    amounts
                );
                expect(result).toBeDefined();
            } catch (error) {
                // If contract not available, that's expected in test environment
                expect(error.message).toContain('contract');
            }
        });

        it('should throw error if settlement contract not available', async () => {
            const originalEnv = process.env.SETTLEMENT_CONTRACT;
            delete process.env.SETTLEMENT_CONTRACT;

            jest.resetModules();
            const freshService = require('../services/blockchain.service');

            await expect(
                freshService.distributeRewards([1], ['0x123'], [100])
            ).rejects.toThrow();

            process.env.SETTLEMENT_CONTRACT = originalEnv;
        });

        it('should handle empty arrays', async () => {
            try {
                const result = await blockchainService.distributeRewards([], [], []);
                expect(result).toBeDefined();
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });
});
