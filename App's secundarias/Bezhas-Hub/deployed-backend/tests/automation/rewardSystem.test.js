const RewardAutomationService = require('../../services/automation/rewardSystem.service');
const { Queue, Worker } = require('bullmq');
const Post = require('../../models/post.model');
const User = require('../../models/user.model');
const VIPSubscription = require('../../models/VIPSubscription.model');
const UnifiedAI = require('../../services/unified-ai.service');

// Mocks
jest.mock('bullmq');
jest.mock('../../models/post.model');
jest.mock('../../models/user.model');
jest.mock('../../models/VIPSubscription.model');
// Manual mock for UnifiedAI to ensure methods exist
jest.mock('../../services/unified-ai.service', () => ({
    analyzeContent: jest.fn(),
    generateText: jest.fn()
}));
jest.mock('ethers', () => {
    return {
        JsonRpcProvider: jest.fn(),
        Wallet: jest.fn(),
        parseUnits: (val) => val // simple mock
    };
});

describe('RewardAutomationService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculatePendingEarnings', () => {
        it('should calculate earnings based on high-quality posts', async () => {
            const mockPosts = [
                { content: 'Good post 1', createdAt: new Date() },
                { content: 'Bad post', createdAt: new Date() },
                { content: 'Good post 2', createdAt: new Date() }
            ];

            // Mock Post.find to return these posts
            Post.find.mockResolvedValue(mockPosts);

            // Mock AI analysis
            UnifiedAI.analyzeContent
                .mockResolvedValueOnce({ score: 85 }) // Post 1
                .mockResolvedValueOnce({ score: 40 }) // Post 2
                .mockResolvedValueOnce({ score: 90 }); // Post 3

            const result = await RewardAutomationService.calculatePendingEarnings('user123');

            // Expect 2 valid posts * 5 BEZ = 10 BEZ
            expect(result.amountInfo.bez).toBe(10);
            expect(result.metrics.validPosts).toBe(2);
        });
    });

    describe('processUserReward', () => {
        it('should SKIP payout if balance is below threshold', async () => {
            // Mock earnings < 100 AND < 9.99 EUR
            // Rate is 0.5. So 10 BEZ = 5 EUR. Both below threshold.
            jest.spyOn(RewardAutomationService, 'calculatePendingEarnings').mockResolvedValue({
                amountInfo: { bez: 10 },
                metrics: { validPosts: 2, totalScore: 160 }
            });

            // Mock subscription (Standard/Free tier)
            VIPSubscription.findOne.mockResolvedValue({ tier: 'free' });

            const consoleSpy = jest.spyOn(console, 'log');

            await RewardAutomationService.processUserReward('user123', '0xWallet');

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('below threshold'));
        });

        it('should PROCESS payout if balance is above threshold', async () => {
            // Mock earnings > 100
            jest.spyOn(RewardAutomationService, 'calculatePendingEarnings').mockResolvedValue({
                amountInfo: { bez: 150 },
                metrics: { validPosts: 30, totalScore: 2400 }
            });

            VIPSubscription.findOne.mockResolvedValue({ tier: 'free' });

            const consoleSpy = jest.spyOn(console, 'log');

            await RewardAutomationService.processUserReward('user123', '0xWallet');

            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Paying User user123: 150 BEZ'));
        });

        it('should respect VIP lowered thresholds', async () => {
            // Mock earnings = 60 (Below standard 100, but above Platinum 50)
            jest.spyOn(RewardAutomationService, 'calculatePendingEarnings').mockResolvedValue({
                amountInfo: { bez: 60 },
                metrics: { validPosts: 12, totalScore: 900 }
            });

            // Mock VIP Platinum
            VIPSubscription.findOne.mockResolvedValue({ tier: 'platinum' });

            const consoleSpy = jest.spyOn(console, 'log');

            await RewardAutomationService.processUserReward('userVIP', '0xWallet');

            // Should pay because 60 > 50 (Platinum threshold)
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Paying User userVIP: 60 BEZ'));
        });
    });
});
