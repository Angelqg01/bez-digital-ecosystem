/**
 * Blockchain Indexer Service
 * Indexes blockchain events for fast querying - Critical for Web3 UX
 * Replaces the need for The Graph in early stages
 * 
 * @module services/blockchain-indexer.service
 */

const { ethers } = require('ethers');
const EventEmitter = require('events');
const pino = require('pino');
const IndexedEvent = require('../models/IndexedEvent.model');
const cacheService = require('./cache.service');

// ABIs
const BezhasTokenABI = require('../abis/BezhasToken.json');
const BeZhasMarketplaceABI = require('../abis/BeZhasMarketplace.json');
const BezhasNFTABI = require('../abis/BezhasNFT.json');
const PostABI = require('../abis/Post.json');
const StakingPoolABI = require('../abis/StakingPool.json');
const GamificationABI = require('../abis/GamificationSystem.json');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Contract configuration for indexing
 */
const CONTRACT_CONFIGS = {
    BezhasToken: {
        abi: BezhasTokenABI,
        events: ['Transfer', 'Approval', 'Mint', 'Burn'],
        addressEnv: 'BEZHAS_TOKEN_ADDRESS'
    },
    BeZhasMarketplace: {
        abi: BeZhasMarketplaceABI,
        events: ['ItemListed', 'ItemSold', 'ItemCancelled', 'OfferMade', 'OfferAccepted'],
        addressEnv: 'MARKETPLACE_ADDRESS'
    },
    BezhasNFT: {
        abi: BezhasNFTABI,
        events: ['Transfer', 'Approval', 'ApprovalForAll', 'NFTMinted', 'NFTBurned'],
        addressEnv: 'NFT_ADDRESS'
    },
    Post: {
        abi: PostABI,
        events: ['PostCreated', 'PostValidated', 'PostRejected', 'PostLiked', 'PostShared'],
        addressEnv: 'POST_CONTRACT_ADDRESS'
    },
    StakingPool: {
        abi: StakingPoolABI,
        events: ['Staked', 'Unstaked', 'RewardClaimed', 'RewardDistributed'],
        addressEnv: 'STAKING_POOL_ADDRESS'
    },
    GamificationSystem: {
        abi: GamificationABI,
        events: ['PointsEarned', 'LevelUp', 'AchievementUnlocked', 'BadgeAwarded'],
        addressEnv: 'GAMIFICATION_ADDRESS'
    }
};

class BlockchainIndexer extends EventEmitter {
    constructor() {
        super();
        this.provider = null;
        this.contracts = new Map();
        this.isRunning = false;
        this.syncInterval = null;
        this.chainId = 137; // Default Polygon
        this.network = 'polygon';
        this.batchSize = 1000; // Blocks per batch for historical sync
        this.pollingInterval = 12000; // 12 seconds (Polygon block time ~2s, so 6 blocks)
    }

    /**
     * Initialize the indexer with provider and contracts
     */
    async initialize() {
        try {
            const rpcUrl = process.env.RPC_URL || process.env.POLYGON_RPC_URL;

            if (!rpcUrl) {
                logger.warn('No RPC_URL configured. Blockchain indexer disabled.');
                return false;
            }

            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Get network info
            const network = await this.provider.getNetwork();
            this.chainId = Number(network.chainId);
            this.network = this.getNetworkName(this.chainId);

            logger.info({ chainId: this.chainId, network: this.network }, 'Blockchain indexer connecting...');

            // Initialize contracts
            await this.initializeContracts();

            logger.info({
                contractsLoaded: this.contracts.size,
                chainId: this.chainId
            }, '✅ Blockchain indexer initialized');

            return true;
        } catch (error) {
            logger.error({ error: error.message }, '❌ Failed to initialize blockchain indexer');
            return false;
        }
    }

    /**
     * Get network name from chain ID
     */
    getNetworkName(chainId) {
        const networks = {
            1: 'ethereum',
            137: 'polygon',
            80002: 'amoy',
            31337: 'localhost'
        };
        return networks[chainId] || 'unknown';
    }

    /**
     * Initialize contract instances
     */
    async initializeContracts() {
        for (const [name, config] of Object.entries(CONTRACT_CONFIGS)) {
            const address = process.env[config.addressEnv];

            if (!address) {
                logger.debug({ contract: name }, 'Contract address not configured, skipping');
                continue;
            }

            try {
                const contract = new ethers.Contract(address, config.abi, this.provider);

                this.contracts.set(name, {
                    contract,
                    address: address.toLowerCase(),
                    events: config.events,
                    abi: config.abi
                });

                logger.info({ contract: name, address }, 'Contract registered for indexing');
            } catch (error) {
                logger.error({ contract: name, error: error.message }, 'Failed to initialize contract');
            }
        }
    }

    /**
     * Start the indexer
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Indexer already running');
            return;
        }

        const initialized = await this.initialize();
        if (!initialized) {
            return;
        }

        this.isRunning = true;

        // Sync historical events first
        await this.syncHistoricalEvents();

        // Setup real-time event listeners
        this.setupEventListeners();

        // Start polling for new blocks (backup for missed events)
        this.startPolling();

        logger.info('🔗 Blockchain indexer started');
        this.emit('started');
    }

    /**
     * Stop the indexer
     */
    async stop() {
        this.isRunning = false;

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Remove all contract event listeners
        for (const [name, { contract }] of this.contracts) {
            contract.removeAllListeners();
        }

        logger.info('Blockchain indexer stopped');
        this.emit('stopped');
    }

    /**
     * Sync historical events from last indexed block
     */
    async syncHistoricalEvents() {
        logger.info('Starting historical sync...');

        const currentBlock = await this.provider.getBlockNumber();

        for (const [name, { contract, events, address }] of this.contracts) {
            try {
                const lastIndexedBlock = await IndexedEvent.getLastIndexedBlock(name, this.chainId);
                const fromBlock = lastIndexedBlock > 0 ? lastIndexedBlock + 1 : currentBlock - 10000; // Last ~10k blocks if new

                if (fromBlock >= currentBlock) {
                    logger.debug({ contract: name }, 'Contract already synced');
                    continue;
                }

                logger.info({
                    contract: name,
                    fromBlock,
                    toBlock: currentBlock,
                    blocksToSync: currentBlock - fromBlock
                }, 'Syncing historical events');

                // Sync in batches to avoid RPC limits
                for (let startBlock = fromBlock; startBlock < currentBlock; startBlock += this.batchSize) {
                    const endBlock = Math.min(startBlock + this.batchSize - 1, currentBlock);

                    await this.syncBlockRange(name, contract, address, events, startBlock, endBlock);

                    // Small delay between batches to avoid rate limiting
                    await this.delay(100);
                }

                logger.info({ contract: name }, 'Historical sync completed');
            } catch (error) {
                logger.error({ contract: name, error: error.message }, 'Historical sync failed');
            }
        }

        logger.info('✅ All historical syncs completed');
    }

    /**
     * Sync a specific block range for a contract
     */
    async syncBlockRange(contractName, contract, address, eventNames, fromBlock, toBlock) {
        try {
            // Query all events in range
            const filter = { address };
            const logs = await this.provider.getLogs({
                ...filter,
                fromBlock,
                toBlock
            });

            if (logs.length === 0) return;

            const events = [];

            for (const log of logs) {
                try {
                    const parsed = contract.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });

                    if (!parsed || !eventNames.includes(parsed.name)) continue;

                    // Get block for timestamp
                    const block = await this.getBlockWithCache(log.blockNumber);

                    const eventData = {
                        contractName,
                        contractAddress: address,
                        eventName: parsed.name,
                        eventSignature: parsed.signature,
                        args: this.serializeArgs(parsed.args, parsed.fragment),
                        blockNumber: log.blockNumber,
                        blockHash: log.blockHash,
                        blockTimestamp: new Date(block.timestamp * 1000),
                        transactionHash: log.transactionHash,
                        transactionIndex: log.transactionIndex,
                        logIndex: log.index,
                        chainId: this.chainId,
                        network: this.network
                    };

                    events.push(eventData);
                } catch (parseError) {
                    // Skip unparseable logs (might be from different contract)
                    continue;
                }
            }

            if (events.length > 0) {
                await IndexedEvent.insertMany(events, { ordered: false }).catch(err => {
                    // Ignore duplicate key errors
                    if (err.code !== 11000) throw err;
                });

                logger.debug({
                    contract: contractName,
                    eventsIndexed: events.length,
                    blockRange: `${fromBlock}-${toBlock}`
                }, 'Events indexed');

                // Emit for real-time processing
                events.forEach(event => this.emit('newEvent', event));
            }
        } catch (error) {
            logger.error({
                contract: contractName,
                fromBlock,
                toBlock,
                error: error.message
            }, 'Failed to sync block range');
        }
    }

    /**
     * Get block with caching
     */
    async getBlockWithCache(blockNumber) {
        const cacheKey = `block:${this.chainId}:${blockNumber}`;

        // Try cache first
        let block = await cacheService.get(cacheKey);
        if (block) return block;

        // Fetch from chain
        block = await this.provider.getBlock(blockNumber);

        // Cache for 24 hours (blocks are immutable)
        await cacheService.set(cacheKey, { timestamp: block.timestamp }, 86400);

        return block;
    }

    /**
     * Serialize event args for storage
     */
    serializeArgs(args, fragment) {
        const serialized = {};

        fragment.inputs.forEach((input, index) => {
            const value = args[index];

            if (typeof value === 'bigint') {
                serialized[input.name] = value.toString();
            } else if (ethers.isAddress(value)) {
                serialized[input.name] = value.toLowerCase();
            } else if (Array.isArray(value)) {
                serialized[input.name] = value.map(v =>
                    typeof v === 'bigint' ? v.toString() : v
                );
            } else {
                serialized[input.name] = value;
            }
        });

        return serialized;
    }

    /**
     * Setup real-time event listeners
     */
    setupEventListeners() {
        for (const [name, { contract, events, address }] of this.contracts) {
            // Listen to all events
            contract.on('*', async (event) => {
                if (!events.includes(event.eventName)) return;

                try {
                    await this.processRealtimeEvent(name, address, event);
                } catch (error) {
                    logger.error({
                        contract: name,
                        event: event.eventName,
                        error: error.message
                    }, 'Failed to process realtime event');
                }
            });

            logger.debug({ contract: name, events }, 'Event listeners setup');
        }
    }

    /**
     * Process a real-time event
     */
    async processRealtimeEvent(contractName, address, event) {
        const block = await this.getBlockWithCache(event.log.blockNumber);

        const eventData = {
            contractName,
            contractAddress: address,
            eventName: event.eventName,
            eventSignature: event.fragment.format(),
            args: this.serializeArgs(event.args, event.fragment),
            blockNumber: event.log.blockNumber,
            blockHash: event.log.blockHash,
            blockTimestamp: new Date(block.timestamp * 1000),
            transactionHash: event.log.transactionHash,
            transactionIndex: event.log.transactionIndex,
            logIndex: event.log.index,
            chainId: this.chainId,
            network: this.network
        };

        // Save to database
        try {
            await IndexedEvent.create(eventData);
        } catch (error) {
            if (error.code !== 11000) throw error; // Ignore duplicates
        }

        // Emit for real-time handlers
        this.emit('newEvent', eventData);

        // Invalidate relevant caches
        await this.invalidateEventCaches(eventData);

        logger.info({
            contract: contractName,
            event: event.eventName,
            txHash: event.log.transactionHash
        }, '⚡ Real-time event indexed');
    }

    /**
     * Invalidate caches when new events arrive
     */
    async invalidateEventCaches(eventData) {
        const { contractName, eventName, decodedArgs } = eventData;

        // Invalidate user-specific caches
        const userAddresses = [
            decodedArgs?.from,
            decodedArgs?.to,
            decodedArgs?.user
        ].filter(Boolean);

        for (const address of userAddresses) {
            await cacheService.invalidate(`user:${address}`);
            await cacheService.invalidate(`events:${address}`);
        }

        // Invalidate contract-specific caches
        await cacheService.invalidate(`contract:${contractName}`);
    }

    /**
     * Start polling for new blocks (backup mechanism)
     */
    startPolling() {
        this.syncInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                const currentBlock = await this.provider.getBlockNumber();

                for (const [name, { contract, events, address }] of this.contracts) {
                    const lastIndexed = await IndexedEvent.getLastIndexedBlock(name, this.chainId);

                    if (lastIndexed < currentBlock - 1) {
                        // Missed some blocks, sync them
                        await this.syncBlockRange(
                            name, contract, address, events,
                            lastIndexed + 1, currentBlock
                        );
                    }
                }
            } catch (error) {
                logger.error({ error: error.message }, 'Polling sync failed');
            }
        }, this.pollingInterval);
    }

    /**
     * Query indexed events (fast, from MongoDB)
     */
    async queryEvents(options = {}) {
        const {
            contractName,
            eventName,
            userAddress,
            fromBlock,
            toBlock,
            fromDate,
            toDate,
            limit = 50,
            skip = 0
        } = options;

        const cacheKey = `query:${JSON.stringify(options)}`;

        // Try cache first
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;

        const query = { chainId: this.chainId };

        if (contractName) query.contractName = contractName;
        if (eventName) query.eventName = eventName;
        if (fromBlock) query.blockNumber = { ...query.blockNumber, $gte: fromBlock };
        if (toBlock) query.blockNumber = { ...query.blockNumber, $lte: toBlock };
        if (fromDate) query.blockTimestamp = { ...query.blockTimestamp, $gte: fromDate };
        if (toDate) query.blockTimestamp = { ...query.blockTimestamp, $lte: toDate };

        if (userAddress) {
            query.$or = [
                { 'decodedArgs.user': userAddress.toLowerCase() },
                { 'decodedArgs.from': userAddress.toLowerCase() },
                { 'decodedArgs.to': userAddress.toLowerCase() }
            ];
        }

        const events = await IndexedEvent.find(query)
            .sort({ blockTimestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Cache for 30 seconds
        await cacheService.set(cacheKey, events, 30);

        return events;
    }

    /**
     * Get user activity summary
     */
    async getUserActivity(userAddress) {
        const cacheKey = `activity:${userAddress.toLowerCase()}`;

        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;

        const activity = await IndexedEvent.aggregate([
            {
                $match: {
                    chainId: this.chainId,
                    $or: [
                        { 'decodedArgs.user': userAddress.toLowerCase() },
                        { 'decodedArgs.from': userAddress.toLowerCase() },
                        { 'decodedArgs.to': userAddress.toLowerCase() }
                    ]
                }
            },
            {
                $group: {
                    _id: { contract: '$contractName', event: '$eventName' },
                    count: { $sum: 1 },
                    lastActivity: { $max: '$blockTimestamp' }
                }
            },
            {
                $group: {
                    _id: '$_id.contract',
                    events: {
                        $push: {
                            name: '$_id.event',
                            count: '$count',
                            lastActivity: '$lastActivity'
                        }
                    },
                    totalEvents: { $sum: '$count' }
                }
            }
        ]);

        // Cache for 5 minutes
        await cacheService.set(cacheKey, activity, 300);

        return activity;
    }

    /**
     * Utility: delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get indexer stats
     */
    async getStats() {
        const stats = await IndexedEvent.getStats(this.chainId);
        const currentBlock = await this.provider.getBlockNumber();

        return {
            chainId: this.chainId,
            network: this.network,
            currentBlock,
            contractsIndexed: this.contracts.size,
            isRunning: this.isRunning,
            contracts: stats
        };
    }
}

// Singleton instance
const indexer = new BlockchainIndexer();

module.exports = indexer;
module.exports.BlockchainIndexer = BlockchainIndexer;
