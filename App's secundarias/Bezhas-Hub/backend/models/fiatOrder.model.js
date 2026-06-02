const mongoose = require('mongoose');

/**
 * FiatOrder Model
 * Tracks bank transfer orders for BEZ token purchases
 * 
 * Status Flow: PENDING -> APPROVED -> COMPLETED
 * or PENDING -> REJECTED
 */
const FiatOrderSchema = new mongoose.Schema({
    // User Information
    userWallet: {
        type: String,
        required: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: props => `${props.value} is not a valid Ethereum address!`
        }
    },

    userEmail: {
        type: String,
        required: false, // Optional if user provides it
        lowercase: true
    },

    // Payment Information
    fiatAmount: {
        type: Number,
        required: true,
        min: [1, 'Minimum amount is 1 EUR']
    },

    fiatCurrency: {
        type: String,
        default: 'EUR',
        enum: ['EUR']
    },

    bezAmount: {
        type: Number,
        required: true // Calculated at creation time
    },

    exchangeRate: {
        type: Number,
        required: true // BEZ price in EUR at time of order
    },

    // Reference & Tracking
    referenceCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        // Format: BEZ-ABC123 (last 6 chars of wallet)
        index: true
    },

    bankTransferProof: {
        type: String, // URL to uploaded receipt image (optional)
        required: false
    },

    // Order Status
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'],
        default: 'PENDING',
        index: true
    },

    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
    }],

    // Blockchain Transaction
    txHash: {
        type: String,
        required: false, // Only filled when COMPLETED
        index: true
    },

    blockNumber: {
        type: Number,
        required: false
    },

    // Admin Notes
    adminNotes: {
        type: String,
        required: false
    },

    processedBy: {
        type: String, // Admin wallet or system identifier
        required: false
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    approvedAt: {
        type: Date,
        required: false
    },

    completedAt: {
        type: Date,
        required: false
    },

    rejectedAt: {
        type: Date,
        required: false
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for better query performance
FiatOrderSchema.index({ userWallet: 1, createdAt: -1 });
FiatOrderSchema.index({ status: 1, createdAt: -1 });
FiatOrderSchema.index({ referenceCode: 1 });

// Virtual for explorer URL
FiatOrderSchema.virtual('explorerUrl').get(function () {
    if (!this.txHash) return null;
    return `https://amoy.polygonscan.com/tx/${this.txHash}`;
});

// Methods
FiatOrderSchema.methods.approve = function (adminId) {
    this.status = 'APPROVED';
    this.approvedAt = new Date();
    this.processedBy = adminId;
    this.statusHistory.push({
        status: 'APPROVED',
        timestamp: new Date(),
        note: `Approved by ${adminId}`
    });
    return this.save();
};

FiatOrderSchema.methods.complete = function (txHash, blockNumber) {
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.txHash = txHash;
    this.blockNumber = blockNumber;
    this.statusHistory.push({
        status: 'COMPLETED',
        timestamp: new Date(),
        note: `Tokens dispersed. TX: ${txHash}`
    });
    return this.save();
};

FiatOrderSchema.methods.reject = function (reason, adminId) {
    this.status = 'REJECTED';
    this.rejectedAt = new Date();
    this.processedBy = adminId;
    this.adminNotes = reason;
    this.statusHistory.push({
        status: 'REJECTED',
        timestamp: new Date(),
        note: reason
    });
    return this.save();
};

// Static Methods
FiatOrderSchema.statics.getPendingOrders = function () {
    return this.find({ status: 'PENDING' }).sort({ createdAt: 1 });
};

FiatOrderSchema.statics.getOrdersByWallet = function (walletAddress) {
    return this.find({ userWallet: walletAddress.toLowerCase() }).sort({ createdAt: -1 });
};

FiatOrderSchema.statics.getOrderByReference = function (referenceCode) {
    return this.findOne({ referenceCode: referenceCode.toUpperCase() });
};

FiatOrderSchema.statics.generateReferenceCode = function (walletAddress) {
    // BEZ-ABC123 (last 6 chars of wallet in uppercase)
    return `BEZ-${walletAddress.slice(-6).toUpperCase()}`;
};

// Pre-save hook to add to status history
FiatOrderSchema.pre('save', function (next) {
    if (this.isModified('status') && !this.isNew) {
        this.statusHistory.push({
            status: this.status,
            timestamp: new Date()
        });
    }
    next();
});

module.exports = mongoose.model('FiatOrder', FiatOrderSchema);
