const mongoose = require('mongoose');

const daoSettingsSchema = new mongoose.Schema({
    quorumPercentage: {
        type: Number,
        default: 10,
        min: 1,
        max: 100,
    },
    votingPeriodDays: {
        type: Number,
        default: 7,
        min: 1,
        max: 30,
    },
    proposalThreshold: {
        type: Number,
        default: 100000,
        min: 0,
    },
    allowDelegation: {
        type: Boolean,
        default: true,
    },
    maxDelegations: {
        type: Number,
        default: 100,
    },
    rewardPerVote: {
        type: Number,
        default: 10,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('DAOSettings', daoSettingsSchema);
