/**
 * IndexedEvent Model
 * Stores blockchain events indexed for fast querying
 * Critical for Web3 UX - eliminates slow blockchain queries
 */

const mongoose = require('mongoose');

const indexedEventSchema = new mongoose.Schema({
    // Contract identification
    contractName: {
        type: String,
        required: true,
        index: true,
        enum: [
            'BezhasToken', 'BeZhasMarketplace', 'BezhasNFT',
            'QualityOracle', 'DAO', 'StakingPool',
            'GamificationSystem', 'Post', 'Messages',
            'CampaignContract', 'SettlementContract', 'TokenSale'
        ]
    },
    contractAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },

    // Event data
    eventName: {
        type: String,
        required: true,
        index: true
    },
    eventSignature: {
        type: String,
        required: true
    },
    args: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    // Decoded args for common patterns
    decodedArgs: {
        from: { type: String, lowercase: true, sparse: true },
        to: { type: String, lowercase: true, sparse: true },
        user: { type: String, lowercase: true, sparse: true },
        tokenId: { type: String, sparse: true },
        amount: { type: String, sparse: true },
        proposalId: { type: String, sparse: true },
        postId: { type: String, sparse: true }
    },

    // Block data
    blockNumber: {
        type: Number,
        required: true,
        index: true
    },
    blockHash: {
        type: String,
        required: true
    },
    blockTimestamp: {
        type: Date,
        required: true,
        index: true
    },

    // Transaction data
    transactionHash: {
        type: String,
        required: true,
        unique: true
    },
    transactionIndex: {
        type: Number,
        required: true
    },
    logIndex: {
        type: Number,
        required: true
    },

    // Network
    chainId: {
        type: Number,
        required: true,
        default: 137, // Polygon mainnet
        index: true
    },
    network: {
        type: String,
        required: true,
        default: 'polygon',
        enum: ['polygon', 'amoy', 'localhost', 'ethereum']
    },

    // Processing status
    processed: {
        type: Boolean,
        default: false,
        index: true
    },
    processedAt: {
        type: Date,
        sparse: true
    },
    processingError: {
        type: String,
        sparse: true
    },

    // Indexing metadata
    indexedAt: {
        type: Date,
        default: Date.now
    },
    indexerVersion: {
        type: String,
        default: '1.0.0'
    }
}, {
    timestamps: true,
    collection: 'indexed_events'
});

// Compound indexes for common query patterns
indexedEventSchema.index({ contractName: 1, eventName: 1, blockNumber: -1 });
indexedEventSchema.index({ 'decodedArgs.user': 1, eventName: 1, blockTimestamp: -1 });
indexedEventSchema.index({ 'decodedArgs.from': 1, blockTimestamp: -1 });
indexedEventSchema.index({ 'decodedArgs.to': 1, blockTimestamp: -1 });
indexedEventSchema.index({ contractName: 1, processed: 1, blockNumber: 1 });
indexedEventSchema.index({ chainId: 1, blockNumber: -1 });

// TTL index for old processed events (optional cleanup after 90 days)
// indexedEventSchema.index({ blockTimestamp: 1 }, { expireAfterSeconds: 7776000 });

// Static methods for common queries
indexedEventSchema.statics = {
    /**
     * Get events for a specific user address
     */
    async getEventsForUser(userAddress, options = {}) {
        const {
            limit = 50,
            skip = 0,
            eventNames = [],
            fromDate = null,
            toDate = null
        } = options;

        const query = {
            $or: [
                { 'decodedArgs.user': userAddress.toLowerCase() },
                { 'decodedArgs.from': userAddress.toLowerCase() },
                { 'decodedArgs.to': userAddress.toLowerCase() }
            ]
        };

        if (eventNames.length > 0) {
            query.eventName = { $in: eventNames };
        }

        if (fromDate || toDate) {
            query.blockTimestamp = {};
            if (fromDate) query.blockTimestamp.$gte = fromDate;
            if (toDate) query.blockTimestamp.$lte = toDate;
        }

        return this.find(query)
            .sort({ blockTimestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
    },

    /**
     * Get latest events by contract
     */
    async getLatestByContract(contractName, limit = 20) {
        return this.find({ contractName })
            .sort({ blockNumber: -1 })
            .limit(limit)
            .lean();
    },

    /**
     * Get unprocessed events for a worker
     */
    async getUnprocessedEvents(limit = 100) {
        return this.find({ processed: false })
            .sort({ blockNumber: 1 })
            .limit(limit)
            .lean();
    },

    /**
     * Mark events as processed
     */
    async markAsProcessed(eventIds, error = null) {
        const updateData = {
            processed: true,
            processedAt: new Date()
        };

        if (error) {
            updateData.processingError = error;
        }

        return this.updateMany(
            { _id: { $in: eventIds } },
            { $set: updateData }
        );
    },

    /**
     * Get the last indexed block for a contract
     */
    async getLastIndexedBlock(contractName, chainId = 137) {
        const lastEvent = await this.findOne({ contractName, chainId })
            .sort({ blockNumber: -1 })
            .select('blockNumber')
            .lean();

        return lastEvent?.blockNumber || 0;
    },

    /**
     * Get event statistics
     */
    async getStats(chainId = 137) {
        return this.aggregate([
            { $match: { chainId } },
            {
                $group: {
                    _id: {
                        contract: '$contractName',
                        event: '$eventName'
                    },
                    count: { $sum: 1 },
                    lastBlock: { $max: '$blockNumber' },
                    firstBlock: { $min: '$blockNumber' }
                }
            },
            {
                $group: {
                    _id: '$_id.contract',
                    events: {
                        $push: {
                            name: '$_id.event',
                            count: '$count',
                            lastBlock: '$lastBlock'
                        }
                    },
                    totalEvents: { $sum: '$count' }
                }
            }
        ]);
    }
};

// Instance methods
indexedEventSchema.methods = {
    /**
     * Get human-readable event description
     */
    getDescription() {
        const descriptions = {
            Transfer: `Transfer of ${this.decodedArgs.amount || 'tokens'} from ${this.decodedArgs.from} to ${this.decodedArgs.to}`,
            PostCreated: `New post created by ${this.decodedArgs.user}`,
            VoteSubmitted: `Vote on proposal ${this.decodedArgs.proposalId}`,
            Staked: `Staked ${this.decodedArgs.amount} tokens`,
            RewardClaimed: `Claimed rewards: ${this.decodedArgs.amount}`
        };

        return descriptions[this.eventName] || `${this.eventName} event`;
    }
};

// Pre-save hook to extract common args
indexedEventSchema.pre('save', function (next) {
    if (this.args && !this.decodedArgs.from) {
        // Auto-extract common patterns from args
        const args = this.args;

        if (args.from) this.decodedArgs.from = args.from.toLowerCase();
        if (args.to) this.decodedArgs.to = args.to.toLowerCase();
        if (args.user) this.decodedArgs.user = args.user.toLowerCase();
        if (args.owner) this.decodedArgs.user = args.owner.toLowerCase();
        if (args.sender) this.decodedArgs.from = args.sender.toLowerCase();
        if (args.recipient) this.decodedArgs.to = args.recipient.toLowerCase();
        if (args.tokenId) this.decodedArgs.tokenId = args.tokenId.toString();
        if (args.amount) this.decodedArgs.amount = args.amount.toString();
        if (args.value) this.decodedArgs.amount = args.value.toString();
        if (args.proposalId) this.decodedArgs.proposalId = args.proposalId.toString();
        if (args.postId) this.decodedArgs.postId = args.postId.toString();
    }
    next();
});

module.exports = mongoose.model('IndexedEvent', indexedEventSchema);
