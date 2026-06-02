const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    txHash: {
        type: String,
        sparse: true,
        index: true
    },
    type: {
        type: String,
        enum: ['credit_purchase', 'reward', 'transfer', 'payment', 'refund'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        enum: ['BEZ', 'MATIC', 'USD'],
        default: 'BEZ'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    errorMessage: String,
    retryCount: {
        type: Number,
        default: 0
    },
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
transactionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
