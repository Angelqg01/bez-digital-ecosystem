const mongoose = require('mongoose');

const treasuryTransactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['deposit', 'withdrawal', 'reward', 'fee'],
        required: true,
    },
    token: {
        type: String,
        required: true,
        uppercase: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    from: {
        type: String,
    },
    to: {
        type: String,
    },
    txHash: {
        type: String,
    },
    proposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DAOProposal',
    },
    description: {
        type: String,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed',
    },
}, {
    timestamps: true,
});

// Índices
treasuryTransactionSchema.index({ createdAt: -1 });
treasuryTransactionSchema.index({ type: 1 });
treasuryTransactionSchema.index({ token: 1 });

module.exports = mongoose.model('TreasuryTransaction', treasuryTransactionSchema);
