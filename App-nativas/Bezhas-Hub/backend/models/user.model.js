const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // Identity
    username: { type: String, trim: true },
    email: {
        type: String,
        unique: true,
        sparse: true, // Allows null (for wallet-only users initially)
        lowercase: true,
        trim: true
    },
    password: { type: String, select: false }, // Hashed password, excluded by default
    walletAddress: {
        type: String,
        unique: true,
        sparse: true, // Allows null (for email-only users initially)
        lowercase: true,
        trim: true
    },

    // Account Type & Profile
    accountType: {
        type: String,
        enum: ['individual', 'freelancer', 'company'],
        default: 'individual'
    },
    profileImage: { type: String },
    coverImage: { type: String },
    bio: { type: String },

    // Commercial / Business Profile
    companyName: { type: String, trim: true },
    taxId: { type: String, trim: true }, // VAT/RFC/CIF
    industry: {
        type: String,
        enum: ['Logistics', 'Retail', 'Real Estate', 'Finance', 'Technology', 'Healthcare', 'Manufacturing', 'Other'],
    },
    companySize: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '200+']
    },
    website: { type: String, trim: true },
    primaryContactRole: { type: String, trim: true }, // CEO, CTO, Manager, etc.
    expectedVolume: {
        type: String,
        enum: ['<10k', '10k-50k', '50k+']
    },
    interestedServices: [{
        type: String,
        enum: ['Payments', 'RWA Tokenization', 'Logistics', 'DeFi/Yield']
    }],

    // Contact Info
    phone: { type: String, trim: true },
    phoneHash: { type: String, index: true }, // Local hash of phone for privacy-first friend matching
    emailHash: { type: String, index: true }, // Local hash of email for privacy-first friend matching
    address: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },

    // Wallet linking metadata
    walletLinkedAt: { type: Date, default: null }, // Set when email user links a wallet via link-wallet endpoint

    // System & Verification
    roles: {
        type: [String],
        default: ['USER'],
        enum: ['USER', 'ADMIN', 'DEVELOPER', 'VERIFIED_BUSINESS', 'HUMAN_RESOURCES']
    },
    isEmailVerified: { type: Boolean, default: false },
    isWalletVerified: { type: Boolean, default: false },

    // 2FA Security
    is2FAEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    backupCodes: [{ type: String, select: false }],

    // External Auth Providers
    googleId: { type: String, unique: true, sparse: true },
    facebookId: { type: String, unique: true, sparse: true },
    githubId: { type: String, unique: true, sparse: true },
    twitterId: { type: String, unique: true, sparse: true },
    linkedinId: { type: String, unique: true, sparse: true },

    // Affiliate System
    affiliate: {
        referralCode: { type: String, unique: true },
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        registeredWithCode: { type: String },
        earnings: { type: Number, default: 0 }
    },

    // Legacy/Compatibility Fields (to match previous mock structure if needed)
    isVIP: { type: Boolean, default: false },
    subscription: { type: String, default: 'FREE' },
    vipTier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', null], default: null },
    contactSync: {
        hasSynced: { type: Boolean, default: false },
        lastSync: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for polite searching
UserSchema.index({ username: 'text', companyName: 'text' });

module.exports = mongoose.model('User', UserSchema);