const mongoose = require('mongoose');

const billingTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    walletAddress: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['deposit_fiat', 'deposit_bez', 'campaign_charge', 'daily_charge', 'refund', 'adjustment'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        enum: ['EUR', 'BEZ'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['stripe', 'bez-coin', 'manual', 'system']
    },
    stripePaymentIntentId: String,
    blockchainTxHash: String,
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign'
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    errorMessage: String,
    processedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Índices
billingTransactionSchema.index({ userId: 1, createdAt: -1 });
billingTransactionSchema.index({ walletAddress: 1, createdAt: -1 });
billingTransactionSchema.index({ campaignId: 1 });
billingTransactionSchema.index({ status: 1, type: 1 });
billingTransactionSchema.index({ stripePaymentIntentId: 1 });
billingTransactionSchema.index({ blockchainTxHash: 1 });

module.exports = mongoose.model('BillingTransaction', billingTransactionSchema);
