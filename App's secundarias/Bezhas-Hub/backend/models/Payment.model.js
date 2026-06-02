const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    // Stripe Info
    paymentIntentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    sessionId: {
        type: String,
        index: true
    },
    stripeCustomerId: {
        type: String,
        index: true
    },

    // User Info
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    walletAddress: {
        type: String,
        required: true,
        index: true
    },
    email: {
        type: String,
        lowercase: true
    },

    // Payment Details
    type: {
        type: String,
        enum: ['token_purchase', 'vip_subscription', 'nft_purchase', 'donation', 'ad_credit'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
        default: 'pending',
        index: true
    },

    // Amounts
    fiatAmount: {
        type: Number,
        required: true
    },
    fiatCurrency: {
        type: String,
        default: 'usd',
        uppercase: true
    },
    bezAmount: {
        type: Number  // Amount of BEZ tokens purchased/distributed
    },
    exchangeRate: {
        type: Number  // BEZ/Fiat rate at time of purchase
    },

    // Blockchain Transaction
    txHash: {
        type: String,
        index: true
    },
    blockNumber: {
        type: Number
    },
    networkChainId: {
        type: Number,
        default: 80002  // Amoy testnet
    },
    gasUsed: {
        type: String  // Wei
    },

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed  // Flexible for any additional data
    },

    // Error Tracking
    errorMessage: String,
    retryCount: {
        type: Number,
        default: 0
    },
    lastRetryAt: Date,

    // Distribution Details (Burn + Treasury + User split)
    distribution: {
        userAmount: Number,      // BEZ sent to user
        burnAmount: Number,      // BEZ sent to burn address
        treasuryAmount: Number,  // BEZ sent to treasury
        userTxHash: String,
        burnTxHash: String,
        treasuryTxHash: String
    },

    // Timestamps
    paidAt: Date,
    distributedAt: Date,
    completedAt: Date

}, {
    timestamps: true  // Adds createdAt and updatedAt
});

// Indexes for common queries
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ walletAddress: 1, createdAt: -1 });
paymentSchema.index({ type: 1, status: 1 });

// Virtual for explorer URL
paymentSchema.virtual('explorerUrl').get(function () {
    if (!this.txHash) return null;

    const explorers = {
        80002: 'https://amoy.polygonscan.com/tx/',  // Amoy
        137: 'https://polygonscan.com/tx/',          // Polygon Mainnet
        1: 'https://etherscan.io/tx/'                // Ethereum Mainnet
    };

    const baseUrl = explorers[this.networkChainId] || explorers[80002];
    return `${baseUrl}${this.txHash}`;
});

// Instance method to mark as completed
paymentSchema.methods.markCompleted = async function (txHash, blockNumber, gasUsed) {
    this.status = 'completed';
    this.txHash = txHash;
    this.blockNumber = blockNumber;
    this.gasUsed = gasUsed;
    this.distributedAt = new Date();
    this.completedAt = new Date();
    return this.save();
};

// Instance method to mark as failed
paymentSchema.methods.markFailed = async function (errorMessage) {
    this.status = 'failed';
    this.errorMessage = errorMessage;
    this.lastRetryAt = new Date();
    this.retryCount += 1;
    return this.save();
};

// Static method to get payment statistics
paymentSchema.statics.getStats = async function (startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    $lte: endDate || new Date()
                }
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalFiat: { $sum: '$fiatAmount' },
                totalBez: { $sum: '$bezAmount' }
            }
        }
    ]);
};

module.exports = mongoose.model('Payment', paymentSchema);
