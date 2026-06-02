const mongoose = require('mongoose');

const daoVoteSchema = new mongoose.Schema({
    proposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DAOProposal',
        required: true,
    },
    voter: {
        type: String,
        required: true,
        lowercase: true,
    },
    support: {
        type: Boolean,
        required: true,
    },
    votingPower: {
        type: Number,
        required: true,
        min: 0,
    },
    reason: {
        type: String,
    },
}, {
    timestamps: true,
});

// Índice único para evitar votos duplicados
daoVoteSchema.index({ proposalId: 1, voter: 1 }, { unique: true });

module.exports = mongoose.model('DAOVote', daoVoteSchema);
