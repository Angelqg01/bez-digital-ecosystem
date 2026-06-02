const mongoose = require('mongoose');

const advertiserProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    walletAddress: {
        type: String,
        required: true
    },
    businessType: {
        type: String,
        enum: ['nft-project', 'content-creator', 'defi-dapp', 'web3-service', 'store', 'other'],
        required: true
    },
    projectName: {
        type: String,
        required: true,
        trim: true
    },
    country: {
        type: String,
        trim: true
    },
    website: {
        type: String,
        trim: true
    },
    businessGoals: [{
        type: String,
        enum: ['sell-nfts', 'drive-traffic', 'get-followers', 'brand-awareness', 'token-promotion', 'community-growth', 'app-installs', 'video-views']
    }],
    companyDetails: {
        description: String,
        logoUrl: String,
        industry: String,
        teamSize: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    suspensionReason: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índices
advertiserProfileSchema.index({ walletAddress: 1 });
advertiserProfileSchema.index({ isActive: 1, isSuspended: 1 });

module.exports = mongoose.model('AdvertiserProfile', advertiserProfileSchema);
