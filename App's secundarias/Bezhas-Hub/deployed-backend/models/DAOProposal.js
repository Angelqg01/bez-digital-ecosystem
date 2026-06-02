const mongoose = require('mongoose');

const daoProposalSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        enum: ['treasury', 'governance', 'protocol', 'general', 'marketing', 'development'],
        default: 'general',
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'approved', 'rejected', 'executed', 'expired', 'cancelled'],
        default: 'active',
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    endDate: {
        type: Date,
        required: true,
    },
    votesFor: {
        type: Number,
        default: 0,
    },
    votesAgainst: {
        type: Number,
        default: 0,
    },
    actions: [{
        type: {
            type: String,
            enum: ['transfer', 'updateSettings', 'addRole', 'custom'],
        },
        target: String,
        value: String,
        data: mongoose.Schema.Types.Mixed,
    }],
    executedAt: {
        type: Date,
    },
    executedBy: {
        type: String,
    },
}, {
    timestamps: true,
});

// Índices para búsquedas rápidas
daoProposalSchema.index({ status: 1, createdAt: -1 });
daoProposalSchema.index({ creator: 1 });
daoProposalSchema.index({ category: 1 });

module.exports = mongoose.model('DAOProposal', daoProposalSchema);
