/**
 * Blockchain Queue Service
 * Manages blockchain transaction queues for reliable Web3 operations
 * Handles retries, gas optimization, and transaction lifecycle
 * 
 * @module services/blockchain-queue.service
 */

const { Queue, Worker, QueueScheduler } = require('bullmq');
const { ethers } = require('ethers');
const pino = require('pino');
const redisService = require('./redis.service');
const cacheService = require('./cache.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Queue configuration
const QUEUE_NAMES = {
    BLOCKCHAIN_TX: 'blockchain-transactions',
    QUALITY_VALIDATION: 'quality-validation',
    AI_PROCESSING: 'ai-processing',
    NOTIFICATION: 'notifications',
    NFT_MINTING: 'nft-minting',
    STAKING: 'staking-operations'
};

// Job types
const JOB_TYPES = {
    // Post operations
    SUBMIT_POST: 'SUBMIT_POST',
    VALIDATE_POST: 'VALIDATE_POST',

    // DAO operations
    VOTE_DAO: 'VOTE_DAO',
    CREATE_PROPOSAL: 'CREATE_PROPOSAL',
    EXECUTE_PROPOSAL: 'EXECUTE_PROPOSAL',

    // Token operations
    TRANSFER_TOKEN: 'TRANSFER_TOKEN',
    APPROVE_TOKEN: 'APPROVE_TOKEN',

    // NFT operations
    MINT_NFT: 'MINT_NFT',
    TRANSFER_NFT: 'TRANSFER_NFT',
    LIST_NFT: 'LIST_NFT',
    BUY_NFT: 'BUY_NFT',

    // Staking
    STAKE: 'STAKE',
    UNSTAKE: 'UNSTAKE',
    CLAIM_REWARDS: 'CLAIM_REWARDS',

    // Quality Oracle
    REQUEST_VALIDATION: 'REQUEST_VALIDATION',
    SUBMIT_VALIDATION_RESULT: 'SUBMIT_VALIDATION_RESULT'
};

class BlockchainQueueService {
    constructor() {
        this.queues = new Map();
        this.workers = new Map();
        this.schedulers = new Map();
        this.connection = null;
        this.isInitialized = false;
        this.provider = null;
        this.signer = null;
    }

    /**
     * Initialize the queue service
     */
    async initialize() {
        try {
            // Get Redis connection
            this.connection = await redisService.getConnection();

            if (!this.connection) {
                logger.warn('Redis not available. Queue service running in degraded mode.');
                return false;
            }

            // Initialize blockchain provider
            if (process.env.RPC_URL) {
                this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

                // Initialize signer for backend transactions
                if (process.env.BACKEND_SIGNER_KEY) {
                    this.signer = new ethers.Wallet(process.env.BACKEND_SIGNER_KEY, this.provider);
                    logger.info({ address: this.signer.address }, 'Backend signer initialized');
                }
            }

            // Create queues
            await this.createQueues();

            // Create workers
            await this.createWorkers();

            this.isInitialized = true;
            logger.info('✅ Blockchain queue service initialized');

            return true;
        } catch (error) {
            logger.error({ error: error.message }, '❌ Failed to initialize blockchain queue service');
            return false;
        }
    }

    /**
     * Create all queues
     */
    async createQueues() {
        const defaultOptions = {
            connection: this.connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: {
                    count: 100,
                    age: 3600 // 1 hour
                },
                removeOnFail: {
                    count: 50,
                    age: 86400 // 24 hours
                }
            }
        };

        // Blockchain transactions queue - high priority, fewer retries
        this.queues.set(QUEUE_NAMES.BLOCKCHAIN_TX, new Queue(QUEUE_NAMES.BLOCKCHAIN_TX, {
            ...defaultOptions,
            defaultJobOptions: {
                ...defaultOptions.defaultJobOptions,
                attempts: 5,
                backoff: {
                    type: 'custom' // Will use custom backoff for gas price adjustment
                },
                timeout: 120000 // 2 minutes for blockchain txs
            }
        }));

        // Quality validation queue
        this.queues.set(QUEUE_NAMES.QUALITY_VALIDATION, new Queue(QUEUE_NAMES.QUALITY_VALIDATION, {
            ...defaultOptions,
            defaultJobOptions: {
                ...defaultOptions.defaultJobOptions,
                attempts: 5,
                timeout: 60000
            }
        }));

        // AI processing queue - longer timeout
        this.queues.set(QUEUE_NAMES.AI_PROCESSING, new Queue(QUEUE_NAMES.AI_PROCESSING, {
            ...defaultOptions,
            defaultJobOptions: {
                ...defaultOptions.defaultJobOptions,
                attempts: 2,
                timeout: 30000 // 30 seconds for AI calls
            }
        }));

        // NFT minting queue
        this.queues.set(QUEUE_NAMES.NFT_MINTING, new Queue(QUEUE_NAMES.NFT_MINTING, {
            ...defaultOptions,
            defaultJobOptions: {
                ...defaultOptions.defaultJobOptions,
                attempts: 3,
                timeout: 180000 // 3 minutes for NFT minting
            }
        }));

        // Notification queue - high throughput
        this.queues.set(QUEUE_NAMES.NOTIFICATION, new Queue(QUEUE_NAMES.NOTIFICATION, {
            ...defaultOptions,
            defaultJobOptions: {
                attempts: 2,
                timeout: 10000,
                removeOnComplete: { count: 1000 }
            }
        }));

        // Staking operations queue
        this.queues.set(QUEUE_NAMES.STAKING, new Queue(QUEUE_NAMES.STAKING, {
            ...defaultOptions
        }));

        logger.info({ queues: Object.keys(QUEUE_NAMES).length }, 'Queues created');
    }

    /**
     * Create workers for processing jobs
     */
    async createWorkers() {
        // Blockchain transaction worker
        const blockchainWorker = new Worker(
            QUEUE_NAMES.BLOCKCHAIN_TX,
            async (job) => this.processBlockchainJob(job),
            {
                connection: this.connection,
                concurrency: 3, // Process 3 txs in parallel
                limiter: {
                    max: 10,
                    duration: 10000 // Max 10 jobs per 10 seconds
                }
            }
        );

        blockchainWorker.on('completed', (job, result) => {
            logger.info({ jobId: job.id, type: job.data.type, txHash: result?.transactionHash }, 'Blockchain job completed');
            this.emitJobUpdate(job, 'completed', result);
        });

        blockchainWorker.on('failed', (job, error) => {
            logger.error({ jobId: job.id, type: job.data.type, error: error.message }, 'Blockchain job failed');
            this.emitJobUpdate(job, 'failed', { error: error.message });
        });

        this.workers.set(QUEUE_NAMES.BLOCKCHAIN_TX, blockchainWorker);

        // Quality validation worker
        const qualityWorker = new Worker(
            QUEUE_NAMES.QUALITY_VALIDATION,
            async (job) => this.processQualityValidation(job),
            {
                connection: this.connection,
                concurrency: 5
            }
        );

        this.workers.set(QUEUE_NAMES.QUALITY_VALIDATION, qualityWorker);

        // AI processing worker
        const aiWorker = new Worker(
            QUEUE_NAMES.AI_PROCESSING,
            async (job) => this.processAIJob(job),
            {
                connection: this.connection,
                concurrency: 2, // AI calls are resource-intensive
                limiter: {
                    max: 20,
                    duration: 60000 // Max 20 AI calls per minute
                }
            }
        );

        this.workers.set(QUEUE_NAMES.AI_PROCESSING, aiWorker);

        // NFT minting worker
        const nftWorker = new Worker(
            QUEUE_NAMES.NFT_MINTING,
            async (job) => this.processNFTJob(job),
            {
                connection: this.connection,
                concurrency: 2
            }
        );

        this.workers.set(QUEUE_NAMES.NFT_MINTING, nftWorker);

        // Notification worker - high throughput
        const notificationWorker = new Worker(
            QUEUE_NAMES.NOTIFICATION,
            async (job) => this.processNotification(job),
            {
                connection: this.connection,
                concurrency: 20
            }
        );

        this.workers.set(QUEUE_NAMES.NOTIFICATION, notificationWorker);

        logger.info({ workers: this.workers.size }, 'Workers created');
    }

    /**
     * Process blockchain transaction job
     */
    async processBlockchainJob(job) {
        const { type, payload, userAddress, priority } = job.data;

        logger.info({ jobId: job.id, type, userAddress }, 'Processing blockchain job');

        try {
            switch (type) {
                case JOB_TYPES.SUBMIT_POST:
                    return await this.handleSubmitPost(payload);

                case JOB_TYPES.VOTE_DAO:
                    return await this.handleDAOVote(payload);

                case JOB_TYPES.TRANSFER_TOKEN:
                    return await this.handleTokenTransfer(payload);

                case JOB_TYPES.STAKE:
                    return await this.handleStake(payload);

                case JOB_TYPES.UNSTAKE:
                    return await this.handleUnstake(payload);

                case JOB_TYPES.CLAIM_REWARDS:
                    return await this.handleClaimRewards(payload);

                default:
                    throw new Error(`Unknown job type: ${type}`);
            }
        } catch (error) {
            // Check if we should retry with higher gas
            if (this.isGasError(error) && job.attemptsMade < job.opts.attempts) {
                await job.updateData({
                    ...job.data,
                    gasMultiplier: (job.data.gasMultiplier || 1) * 1.2
                });
                throw error; // Retry with updated gas
            }
            throw error;
        }
    }

    /**
     * Check if error is gas-related
     */
    isGasError(error) {
        const gasErrors = [
            'replacement fee too low',
            'transaction underpriced',
            'gas too low',
            'insufficient funds for gas'
        ];
        return gasErrors.some(msg => error.message?.toLowerCase().includes(msg));
    }

    /**
     * Handle post submission to Quality Oracle
     */
    async handleSubmitPost(payload) {
        const { contentHash, userId, postType } = payload;

        // In production, this would call the Quality Oracle contract
        // For now, return mock success
        logger.info({ contentHash, userId }, 'Post submitted to Quality Oracle');

        return {
            success: true,
            transactionHash: `0x${Date.now().toString(16)}mock`,
            contentHash
        };
    }

    /**
     * Handle DAO vote
     */
    async handleDAOVote(payload) {
        const { proposalId, vote, voter } = payload;

        logger.info({ proposalId, vote, voter }, 'DAO vote submitted');

        return {
            success: true,
            transactionHash: `0x${Date.now().toString(16)}mock`,
            proposalId
        };
    }

    /**
     * Handle token transfer
     */
    async handleTokenTransfer(payload) {
        const { to, amount, from } = payload;

        logger.info({ to, amount, from }, 'Token transfer processed');

        return {
            success: true,
            transactionHash: `0x${Date.now().toString(16)}mock`,
            amount
        };
    }

    /**
     * Handle stake operation
     */
    async handleStake(payload) {
        const { amount, user, poolId } = payload;

        logger.info({ amount, user, poolId }, 'Stake operation processed');

        return {
            success: true,
            transactionHash: `0x${Date.now().toString(16)}mock`,
            amount
        };
    }

    /**
     * Handle unstake operation
     */
    async handleUnstake(payload) {
        const { amount, user, poolId } = payload;

        logger.info({ amount, user, poolId }, 'Unstake operation processed');

        return {
            success: true,
            transactionHash: `0x${Date.now().toString(16)}mock`,
            amount
        };
    }

    /**
     * Handle claim rewards
     */
    async handleClaimRewards(payload) {
        const { user, poolId } = payload;

        logger.info({ user, poolId }, 'Rewards claim processed');

        return {
            success: true,
            transactionHash: `0x${Date.now().toString(16)}mock`
        };
    }

    /**
     * Process quality validation job
     */
    async processQualityValidation(job) {
        const { contentHash, content, validationType } = job.data;

        logger.info({ jobId: job.id, contentHash }, 'Processing quality validation');

        // Call AI service for content analysis
        const aiQueue = this.queues.get(QUEUE_NAMES.AI_PROCESSING);

        const aiJob = await aiQueue.add('analyze-content', {
            type: 'CONTENT_ANALYSIS',
            payload: { content, contentHash }
        }, { priority: 1 });

        return {
            contentHash,
            validationJobId: aiJob.id,
            status: 'queued_for_ai'
        };
    }

    /**
     * Process AI job
     */
    async processAIJob(job) {
        const { type, payload } = job.data;

        logger.info({ jobId: job.id, type }, 'Processing AI job');

        // Mock AI processing - in production, call actual AI service
        await this.delay(100); // Simulate AI processing

        return {
            type,
            result: {
                score: Math.random() * 100,
                analysis: 'AI analysis completed'
            }
        };
    }

    /**
     * Process NFT job
     */
    async processNFTJob(job) {
        const { type, payload } = job.data;

        logger.info({ jobId: job.id, type }, 'Processing NFT job');

        return {
            type,
            transactionHash: `0x${Date.now().toString(16)}nft`,
            success: true
        };
    }

    /**
     * Process notification
     */
    async processNotification(job) {
        const { userId, type, data } = job.data;

        // In production, emit via WebSocket
        logger.debug({ userId, type }, 'Notification processed');

        return { delivered: true };
    }

    /**
     * Emit job update via WebSocket
     */
    emitJobUpdate(job, status, result) {
        const { userAddress, type, trackingId } = job.data;

        // This will be connected to WebSocket service
        // For now, just log
        logger.debug({ userAddress, type, status, trackingId }, 'Job update emitted');
    }

    // ============ PUBLIC API ============

    /**
     * Add a blockchain transaction job
     */
    async addBlockchainJob(type, payload, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Queue service not initialized');
        }

        const queue = this.queues.get(QUEUE_NAMES.BLOCKCHAIN_TX);

        const jobData = {
            type,
            payload,
            userAddress: options.userAddress,
            trackingId: options.trackingId || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            priority: options.priority || 0,
            gasMultiplier: 1
        };

        const job = await queue.add(type, jobData, {
            priority: options.priority || 0,
            delay: options.delay || 0
        });

        logger.info({ jobId: job.id, type, trackingId: jobData.trackingId }, 'Blockchain job added');

        return {
            jobId: job.id,
            trackingId: jobData.trackingId,
            queue: QUEUE_NAMES.BLOCKCHAIN_TX
        };
    }

    /**
     * Add a quality validation job
     */
    async addValidationJob(contentHash, content, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Queue service not initialized');
        }

        const queue = this.queues.get(QUEUE_NAMES.QUALITY_VALIDATION);

        const job = await queue.add('validate', {
            contentHash,
            content,
            validationType: options.validationType || 'standard',
            userId: options.userId
        }, {
            priority: options.priority || 0
        });

        return { jobId: job.id, contentHash };
    }

    /**
     * Add an AI processing job
     */
    async addAIJob(type, payload, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Queue service not initialized');
        }

        const queue = this.queues.get(QUEUE_NAMES.AI_PROCESSING);

        const job = await queue.add(type, {
            type,
            payload,
            userId: options.userId
        }, {
            priority: options.priority || 0
        });

        return { jobId: job.id, type };
    }

    /**
     * Add notification job
     */
    async addNotification(userId, type, data) {
        if (!this.isInitialized) {
            // Fallback: just log if queue not available
            logger.debug({ userId, type }, 'Notification (no queue)');
            return null;
        }

        const queue = this.queues.get(QUEUE_NAMES.NOTIFICATION);

        const job = await queue.add('notify', {
            userId,
            type,
            data,
            timestamp: Date.now()
        });

        return { jobId: job.id };
    }

    /**
     * Get job status
     */
    async getJobStatus(queueName, jobId) {
        const queue = this.queues.get(queueName);
        if (!queue) return null;

        const job = await queue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();

        return {
            id: job.id,
            state,
            data: job.data,
            progress: job.progress,
            attemptsMade: job.attemptsMade,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            returnvalue: job.returnvalue,
            failedReason: job.failedReason
        };
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        const stats = {};

        for (const [name, queue] of this.queues) {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount(),
                queue.getDelayedCount()
            ]);

            stats[name] = {
                waiting,
                active,
                completed,
                failed,
                delayed,
                total: waiting + active + delayed
            };
        }

        return stats;
    }

    /**
     * Clean old jobs
     */
    async cleanOldJobs(grace = 3600000) {
        for (const [name, queue] of this.queues) {
            await queue.clean(grace, 100, 'completed');
            await queue.clean(grace * 24, 100, 'failed');
        }

        logger.info('Old jobs cleaned');
    }

    /**
     * Utility: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Shutdown gracefully
     */
    async shutdown() {
        logger.info('Shutting down queue service...');

        // Close all workers
        for (const [name, worker] of this.workers) {
            await worker.close();
        }

        // Close all queues
        for (const [name, queue] of this.queues) {
            await queue.close();
        }

        this.isInitialized = false;
        logger.info('Queue service shut down');
    }
}

// Export job types for external use
module.exports.JOB_TYPES = JOB_TYPES;
module.exports.QUEUE_NAMES = QUEUE_NAMES;

// Singleton instance
const queueService = new BlockchainQueueService();
module.exports = queueService;
