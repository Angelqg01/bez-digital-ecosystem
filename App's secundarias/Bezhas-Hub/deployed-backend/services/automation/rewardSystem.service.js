const { Queue, Worker } = require('bullmq');
const ethers = require('ethers');
const nodeCron = require('node-cron');
const path = require('path');
const fs = require('fs/promises');

// Load environment variables from root
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Models
const User = require('../../models/user.model');
const Post = require('../../models/post.model');
const VIPSubscription = require('../../models/VIPSubscription.model');

// Services
const UnifiedAI = require('../unified-ai.service');

// Configuration
const REWARD_THRESHOLD_BEZ = 100;
const REWARD_THRESHOLD_EUR = 9.99;
const BEZ_TO_EUR_RATE = 0.50; // Placeholder rate, should come from Oracle

class RewardAutomationService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology');

        // Initialize Hot Wallet if key exists
        if (process.env.HOT_WALLET_PRIVATE_KEY) {
            this.wallet = new ethers.Wallet(process.env.HOT_WALLET_PRIVATE_KEY, this.provider);
        } else {
            console.warn('⚠️ HOT_WALLET_PRIVATE_KEY missing. Reward payouts will be simulated.');
        }

        // Initialize Queue
        this.rewardsQueue = new Queue('weekly-rewards', {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }
        });

        this.setupWorker();
        this.scheduleCron();
    }

    /**
     * Start the weekly cron job
     */
    scheduleCron() {
        // Runs every Monday at 00:00
        nodeCron.schedule('0 0 * * 1', async () => {
            console.log('⏰ Starting Weekly Reward Distribution Cycle...');
            await this.distributeRewards();
        });
        console.log('✅ Weekly Rewards Cron Scheduled (Mondays 00:00)');
    }

    /**
     * Main distribution logic integration
     */
    async distributeRewards() {
        try {
            // Get all active users
            // Note: In real mongoose this would be User.find({ status: 'active' }) or similar
            const users = await User.find({});

            for (const user of users) {
                // Add job to queue for each user to process in background
                await this.rewardsQueue.add('process-user-reward', {
                    userId: user._id,
                    walletAddress: user.walletAddress
                });
            }
        } catch (error) {
            console.error('❌ Error initializing reward distribution:', error);
        }
    }

    /**
     * Setup the BullMQ Worker
     */
    setupWorker() {
        new Worker('weekly-rewards', async job => {
            const { userId, walletAddress } = job.data;
            await this.processUserReward(userId, walletAddress);
        }, {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
            }
        });
    }

    /**
     * Process individual user reward
     */
    async processUserReward(userId, walletAddress) {
        if (!walletAddress) return;

        try {
            // 1. Calculate Pending Earnings (Mock calculation based on high quality posts)
            const earnings = await this.calculatePendingEarnings(userId);

            // 2. Check Subscription Level for Multipliers/Thresholds
            const sub = await VIPSubscription.findOne({ user: userId });
            const userThreshold = this.getThresholdForTier(sub?.tier);

            // Currency Values
            const valueInBez = earnings.amountInfo.bez;
            const valueInEur = valueInBez * BEZ_TO_EUR_RATE;

            // 3. Threshold Check
            if (valueInBez < userThreshold && valueInEur < REWARD_THRESHOLD_EUR) {
                console.log(`ℹ️ User ${userId} skipped. Balance ${valueInBez} BEZ below threshold ${userThreshold}. Accumulating...`);
                // Logic to save accumulation would go here
                return;
            }

            // 4. Payout
            console.log(`💰 Paying User ${userId}: ${valueInBez} BEZ`);

            if (this.wallet) {
                // Real Blockchain Transaction
                // const tx = await this.tokenContract.transfer(walletAddress, ethers.parseUnits(valueInBez.toString(), 18));
                // await tx.wait();
                // console.log(`✅ Transaction sent: ${tx.hash}`);
            }

            // 5. Generate Optimization Report (If SDK data available)
            // This links to the "Usability Analysis" requirement
            await this.generateUserOptimizationReport(userId, earnings.metrics);

        } catch (error) {
            console.error(`Error processing reward for user ${userId}:`, error);
        }
    }

    /**
     * Calculate earnings based on AI Quality score of recent posts
     */
    async calculatePendingEarnings(userId) {
        // Fetch last week's posts
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        // Assuming Post has 'createdAt' and 'author'
        // In mock models, we might filter manually
        let posts = [];
        try {
            // Mock filter logic, depends on actual DB implementation
            posts = await Post.find({ author: userId });
            posts = posts.filter(p => new Date(p.createdAt) > oneWeekAgo);
        } catch (e) {
            posts = [];
        }

        let totalScore = 0;
        let validPosts = 0;

        for (const post of posts) {
            // Use UnifiedAI to check quality if not already checked
            const quality = await UnifiedAI.analyzeContent(post.content || '');

            if (quality && quality.score > 70) {
                totalScore += quality.score;
                validPosts++;
            }
        }

        // Simple reward formula
        const earnedBez = validPosts * 5; // 5 BEZ per good post

        return {
            amountInfo: { bez: earnedBez },
            metrics: { validPosts, totalScore }
        };
    }

    getThresholdForTier(tier) {
        switch (tier) {
            case 'platinum': return 50;  // Lower threshold for VIPs
            case 'gold': return 80;
            default: return REWARD_THRESHOLD_BEZ; // 100
        }
    }

    async generateUserOptimizationReport(userId, metrics) {
        // Only generate if we have data suggesting improvements needed
        if (metrics.validPosts === 0) {
            const advice = await UnifiedAI.generateText(
                `El usuario ${userId} no ha generado ingresos esta semana. ` +
                `Analiza tendencias actuales de Web3 y sugiere 3 temas para publicar en BeZhas.`
            );
            // Save advice to DB or Notification
        }
    }
}

module.exports = new RewardAutomationService();
