const mongoose = require('mongoose');
const AuditLog = require('./AuditLog.model');

/**
 * GlobalSettings Model - Unified Configuration for Admin Panel
 * 
 * This model stores all platform-wide settings that can be configured
 * from the Admin Panel and are automatically reflected across the frontend.
 */

const globalSettingsSchema = new mongoose.Schema({
    // Singleton pattern - only one document allowed
    _id: {
        type: String,
        default: 'global_settings',
    },

    // ============================================
    // DeFi Configuration
    // ============================================
    defi: {
        enabled: { type: Boolean, default: true },
        swapFeePercent: { type: Number, default: 0.3, min: 0, max: 10 },
        maxSlippage: { type: Number, default: 1, min: 0.1, max: 50 },
        activePools: [{
            name: String,
            address: String,
            enabled: { type: Boolean, default: true },
        }],
        bridgeFeePercent: { type: Number, default: 0.1, min: 0, max: 5 },
        minSwapAmount: { type: Number, default: 1 },
        maxSwapAmount: { type: Number, default: 1000000 },
    },

    // ============================================
    // Fiat Gateway Configuration
    // ============================================
    fiat: {
        enabled: { type: Boolean, default: true },
        providers: {
            stripe: {
                enabled: { type: Boolean, default: true },
                feePercent: { type: Number, default: 2.9 },
            },
            moonpay: {
                enabled: { type: Boolean, default: false },
                feePercent: { type: Number, default: 4.5 },
            },
            bankTransfer: {
                enabled: { type: Boolean, default: true },
                feePercent: { type: Number, default: 1 },
            },
        },
        minPurchaseUSD: { type: Number, default: 10 },
        maxPurchaseUSD: { type: Number, default: 10000 },
        supportedCurrencies: { type: [String], default: ['USD', 'EUR', 'GBP'] },
        kycRequired: { type: Boolean, default: true },
        kycThresholdUSD: { type: Number, default: 1000 },
    },

    // ============================================
    // BEZ Token Configuration
    // ============================================
    token: {
        contractAddress: { type: String, default: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
        symbol: { type: String, default: 'BEZ' },
        decimals: { type: Number, default: 18 },
        totalSupply: { type: String, default: '1000000000' },
        circulatingSupply: { type: String, default: '0' },
        mintingEnabled: { type: Boolean, default: false },
        mintingRules: {
            maxMintPerTx: { type: String, default: '10000' },
            dailyMintLimit: { type: String, default: '100000' },
            allowedMinters: { type: [String], default: [] },
        },
        burningEnabled: { type: Boolean, default: true },
        burnRate: { type: Number, default: 20, min: 0, max: 500 }, // base 10000 (20 = 0.2%)
        treasuryRate: { type: Number, default: 100, min: 0, max: 1000 }, // base 10000 (100 = 1%)
        transferFeePercent: { type: Number, default: 0, min: 0, max: 10 },
    },

    // ============================================
    // Farming/Yield Configuration
    // ============================================
    farming: {
        enabled: { type: Boolean, default: true },
        defaultAPY: { type: Number, default: 15, min: 0, max: 1000 },
        pools: [{
            name: String,
            lpToken: String,
            rewardToken: { type: String, default: 'BEZ' },
            apy: { type: Number, default: 15 },
            lockPeriodDays: { type: Number, default: 0 },
            enabled: { type: Boolean, default: true },
            minDeposit: { type: String, default: '100' },
            maxDeposit: { type: String, default: '1000000' },
        }],
        rewardsPerBlock: { type: String, default: '1' },
        harvestLockHours: { type: Number, default: 24 },
        earlyWithdrawalPenalty: { type: Number, default: 10, min: 0, max: 50 },
    },

    // ============================================
    // Staking Configuration
    // ============================================
    staking: {
        enabled: { type: Boolean, default: true },
        minStakeAmount: { type: String, default: '100' },
        maxStakeAmount: { type: String, default: '10000000' },
        rewardRatePercent: { type: Number, default: 12, min: 0, max: 100 },
        lockPeriods: [{
            days: Number,
            bonusMultiplier: { type: Number, default: 1 },
            enabled: { type: Boolean, default: true },
        }],
        compoundingEnabled: { type: Boolean, default: true },
        compoundFrequencyHours: { type: Number, default: 24 },
        unstakeCooldownHours: { type: Number, default: 48 },
        slashingEnabled: { type: Boolean, default: false },
        slashingPercent: { type: Number, default: 5 },
    },

    // ============================================
    // DAO Governance Configuration
    // ============================================
    dao: {
        enabled: { type: Boolean, default: true },
        quorumPercentage: { type: Number, default: 10, min: 1, max: 100 },
        votingPeriodDays: { type: Number, default: 7, min: 1, max: 30 },
        proposalThreshold: { type: String, default: '100000' },
        executionDelayHours: { type: Number, default: 24 },
        allowDelegation: { type: Boolean, default: true },
        maxDelegations: { type: Number, default: 100 },
        rewardPerVote: { type: String, default: '10' },
        proposalCategories: {
            type: [String],
            default: ['protocol', 'treasury', 'governance', 'community']
        },
        vetoEnabled: { type: Boolean, default: false },
        vetoThreshold: { type: Number, default: 33 },
    },

    // ============================================
    // RWA (Real World Assets) Configuration
    // ============================================
    rwa: {
        enabled: { type: Boolean, default: true },
        minInvestmentUSD: { type: Number, default: 100 },
        maxInvestmentUSD: { type: Number, default: 1000000 },
        platformFeePercent: { type: Number, default: 2.5, min: 0, max: 10 },
        assetCategories: {
            realEstate: { enabled: { type: Boolean, default: true } },
            commodities: { enabled: { type: Boolean, default: true } },
            art: { enabled: { type: Boolean, default: false } },
            collectibles: { enabled: { type: Boolean, default: false } },
        },
        kycRequired: { type: Boolean, default: true },
        accreditedInvestorRequired: { type: Boolean, default: false },
        legalJurisdictions: { type: [String], default: ['US', 'EU', 'UK'] },
        tokenizationStandard: { type: String, default: 'ERC-1155' },
    },

    // ============================================
    // Platform General Settings
    // ============================================
    platform: {
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: 'Platform is under maintenance. Please try again later.' },
        registrationEnabled: { type: Boolean, default: true },
        emailVerificationRequired: { type: Boolean, default: true },
        maxLoginAttempts: { type: Number, default: 5 },
        sessionTimeoutMinutes: { type: Number, default: 60 },
        loggingLevel: { type: String, enum: ['debug', 'info', 'warn', 'error'], default: 'info' },
    },

    // OpenClaw AI Agent Configuration
    openclaw: {
        enabled: { type: Boolean, default: true },
        baseUrl: { type: String, default: 'http://localhost:3001/api/openclaw' },
        apiKey: { type: String, default: 'bzh_3p_openclaw_agent_default_key' },
        plans: {
            starter: {
                platforms: { type: Number, default: 1 },
                rateLimit: { type: Number, default: 1000 },
                webhooksPerHour: { type: Number, default: 5 },
                syncInterval: { type: String, default: '60m' },
                credentialTTL: { type: Number, default: 30 } // days
            },
            pro: {
                platforms: { type: Number, default: 4 },
                rateLimit: { type: Number, default: 10000 },
                webhooksPerHour: { type: Number, default: -1 },
                syncInterval: { type: String, default: '15m' },
                credentialTTL: { type: Number, default: 90 }
            },
            enterprise: {
                platforms: { type: Number, default: 12 },
                rateLimit: { type: Number, default: 100000 },
                webhooksPerHour: { type: Number, default: -1 },
                syncInterval: { type: String, default: '1m' },
                credentialTTL: { type: Number, default: 365 }
            },
            vip: {
                platforms: { type: Number, default: 12 },
                rateLimit: { type: Number, default: -1 }, // -1 = unlimited
                webhooksPerHour: { type: Number, default: -1 },
                syncInterval: { type: String, default: 'live' },
                credentialTTL: { type: Number, default: -1 }
            }
        }
    },

    // Metadata
    lastUpdatedBy: { type: String, default: 'system' },
    version: { type: Number, default: 1 },

}, {
    timestamps: true,
    collection: 'global_settings',
});

// Ensure only one document exists
globalSettingsSchema.statics.getSettings = async function () {
    let settings = await this.findById('global_settings');
    if (!settings) {
        settings = await this.create({ _id: 'global_settings' });
    }
    return settings;
};

// Update settings with validation and audit logging
globalSettingsSchema.statics.updateSettings = async function (updates, adminId, metadata = {}) {
    const settings = await this.getSettings();
    const previousState = settings.toObject();

    // Determine the primary section being updated (for logging)
    const updatedSections = Object.keys(updates);
    const primarySection = updatedSections.length === 1 ? updatedSections[0] : 'multiple';

    // Deep merge updates
    updatedSections.forEach(key => {
        if (typeof updates[key] === 'object' && !Array.isArray(updates[key])) {
            settings[key] = { ...settings[key]?.toObject?.() || settings[key], ...updates[key] };
        } else {
            settings[key] = updates[key];
        }
    });

    settings.lastUpdatedBy = adminId || 'admin';
    settings.version += 1;

    await settings.save();

    // Create Audit Log entry
    await AuditLog.log({
        user: mongoose.isValidObjectId(adminId) ? adminId : null,
        performedBy: adminId,
        action: 'UPDATE_GLOBAL_SETTINGS',
        resource: 'global_settings',
        resourceId: 'global_settings',
        section: primarySection,
        previousState: previousState,
        newState: settings.toObject(),
        metadata: {
            ipAddress: metadata.ip,
            userAgent: metadata.userAgent,
            method: metadata.method,
            path: metadata.path
        }
    });

    return settings;
};

/**
 * Rollback settings to a previous state from an AuditLog
 * @param {string} auditLogId - ID of the audit log entry to rollback to
 * @param {string} adminId - Admin performing the rollback
 * @returns {Promise<object>} Restored settings
 */
globalSettingsSchema.statics.rollback = async function (auditLogId, adminId) {
    const log = await AuditLog.findById(auditLogId);
    if (!log || !log.previousState) {
        throw new Error('Audit log not found or contains no previous state');
    }

    const settings = await this.getSettings();
    const currentState = settings.toObject();

    // Restore previous state (excluding protected fields)
    const stateToRestore = { ...log.previousState };
    delete stateToRestore._id;
    delete stateToRestore.createdAt;
    delete stateToRestore.updatedAt;
    delete stateToRestore.__v;
    
    // Update settings document
    Object.keys(stateToRestore).forEach(key => {
        settings[key] = stateToRestore[key];
    });

    settings.lastUpdatedBy = adminId || 'admin';
    settings.version += 1;

    await settings.save();

    // Log the rollback action itself
    await AuditLog.log({
        user: mongoose.isValidObjectId(adminId) ? adminId : null,
        performedBy: adminId,
        action: 'ROLLBACK_GLOBAL_SETTINGS',
        resource: 'global_settings',
        resourceId: 'global_settings',
        section: 'rollback',
        previousState: currentState,
        newState: settings.toObject(),
        metadata: {
            referencedAuditLog: auditLogId,
            rolledBackFromVersion: currentState.version,
            rolledBackToVersion: log.previousState.version
        }
    });

    return settings;
};

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
