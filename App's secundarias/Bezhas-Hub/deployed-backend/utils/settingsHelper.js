/**
 * @fileoverview GlobalSettings Helper - Utility for accessing platform configuration
 * @description Provides cached access to GlobalSettings with fallback defaults
 * 
 * Usage:
 *   const settingsHelper = require('./utils/settingsHelper');
 *   const farmingAPY = await settingsHelper.get('farming.defaultAPY');
 *   const defiConfig = await settingsHelper.getSection('defi');
 */

const GlobalSettings = require('../models/GlobalSettings.model');

// Cache for settings to reduce DB calls
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Default values for all configuration sections
 * Used as fallback when DB is unavailable
 */
const DEFAULT_SETTINGS = {
    defi: {
        enabled: true,
        swapFeePercent: 0.3,
        maxSlippage: 1,
        bridgeFeePercent: 0.1,
        minSwapAmount: 1,
        maxSwapAmount: 1000000,
    },
    fiat: {
        enabled: true,
        providers: {
            stripe: { enabled: true, feePercent: 2.9 },
            moonpay: { enabled: false, feePercent: 4.5 },
            bankTransfer: { enabled: true, feePercent: 1 },
        },
        minPurchaseUSD: 10,
        maxPurchaseUSD: 10000,
        supportedCurrencies: ['USD', 'EUR', 'GBP'],
        kycRequired: true,
        kycThresholdUSD: 1000,
    },
    token: {
        contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        symbol: 'BEZ',
        decimals: 18,
        totalSupply: '1000000000',
        circulatingSupply: '0',
        mintingEnabled: false,
        burningEnabled: true,
        transferFeePercent: 0,
    },
    farming: {
        enabled: true,
        defaultAPY: 15,
        rewardsPerBlock: '1',
        harvestLockHours: 24,
        earlyWithdrawalPenalty: 10,
    },
    staking: {
        enabled: true,
        minStakeAmount: '100',
        maxStakeAmount: '10000000',
        rewardRatePercent: 12,
        compoundingEnabled: true,
        compoundFrequencyHours: 24,
        unstakeCooldownHours: 48,
        slashingEnabled: false,
        slashingPercent: 5,
    },
    dao: {
        enabled: true,
        quorumPercentage: 10,
        votingPeriodDays: 7,
        proposalThreshold: '100000',
        executionDelayHours: 24,
        allowDelegation: true,
        maxDelegations: 100,
        rewardPerVote: '10',
        vetoEnabled: false,
        vetoThreshold: 33,
    },
    rwa: {
        enabled: true,
        minInvestmentUSD: 100,
        maxInvestmentUSD: 1000000,
        platformFeePercent: 2.5,
        kycRequired: true,
        accreditedInvestorRequired: false,
    },
    platform: {
        maintenanceMode: false,
        maintenanceMessage: 'Platform is under maintenance. Please try again later.',
        registrationEnabled: true,
        emailVerificationRequired: true,
        maxLoginAttempts: 5,
        sessionTimeoutMinutes: 60,
        loggingLevel: 'info',
    },
    adRewards: {
        enabled: true,
        userSharePercent: 40,
        platformSharePercent: 60,
        creatorSharePercent: 25,
        viewerSharePercent: 20,
        admobRewardedRate: 0.10,
        adsenseCPM: 2.50,
        adsenseCPC: 0.15,
        directSponsorView: 0.20,
        directSponsorClick: 0.50,
    },
};

/**
 * Get nested property from object using dot notation
 * @param {object} obj - Source object
 * @param {string} path - Dot notation path (e.g., 'farming.defaultAPY')
 * @returns {any} Value at path or undefined
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Get all settings from database with caching
 * @returns {Promise<object>} Settings object
 */
async function getAllSettings() {
    const now = Date.now();

    // Return cached settings if still valid
    if (settingsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return settingsCache;
    }

    try {
        const settings = await GlobalSettings.getSettings();
        settingsCache = settings.toObject ? settings.toObject() : settings;
        cacheTimestamp = now;
        return settingsCache;
    } catch (error) {
        console.warn('⚠️ Failed to fetch GlobalSettings from DB, using defaults:', error.message);
        return DEFAULT_SETTINGS;
    }
}

/**
 * Get a specific setting value by path
 * @param {string} path - Dot notation path (e.g., 'farming.defaultAPY')
 * @param {any} fallback - Fallback value if not found
 * @returns {Promise<any>} Setting value
 * 
 * @example
 * const apy = await settingsHelper.get('farming.defaultAPY'); // 15
 * const fee = await settingsHelper.get('defi.swapFeePercent', 0.5); // 0.3 or 0.5 fallback
 */
async function get(path, fallback = undefined) {
    try {
        const settings = await getAllSettings();
        const value = getNestedValue(settings, path);

        if (value !== undefined) {
            return value;
        }

        // Try default settings
        const defaultValue = getNestedValue(DEFAULT_SETTINGS, path);
        return defaultValue !== undefined ? defaultValue : fallback;
    } catch (error) {
        console.error('Error getting setting:', path, error.message);
        const defaultValue = getNestedValue(DEFAULT_SETTINGS, path);
        return defaultValue !== undefined ? defaultValue : fallback;
    }
}

/**
 * Get an entire configuration section
 * @param {string} section - Section name (defi, fiat, token, farming, staking, dao, rwa, platform)
 * @returns {Promise<object>} Section configuration
 * 
 * @example
 * const farmingConfig = await settingsHelper.getSection('farming');
 * // { enabled: true, defaultAPY: 15, rewardsPerBlock: '1', ... }
 */
async function getSection(section) {
    try {
        const settings = await getAllSettings();
        return settings[section] || DEFAULT_SETTINGS[section] || {};
    } catch (error) {
        console.error('Error getting section:', section, error.message);
        return DEFAULT_SETTINGS[section] || {};
    }
}

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature path (e.g., 'defi', 'farming', 'dao')
 * @returns {Promise<boolean>} Whether feature is enabled
 * 
 * @example
 * if (await settingsHelper.isEnabled('farming')) { ... }
 */
async function isEnabled(feature) {
    const value = await get(`${feature}.enabled`, true);
    return Boolean(value);
}

/**
 * Check if platform is in maintenance mode
 * @returns {Promise<boolean>} Maintenance mode status
 */
async function isMaintenanceMode() {
    return await get('platform.maintenanceMode', false);
}

/**
 * Get DeFi configuration
 * @returns {Promise<object>} DeFi settings
 */
async function getDefiConfig() {
    return await getSection('defi');
}

/**
 * Get Fiat Gateway configuration
 * @returns {Promise<object>} Fiat settings
 */
async function getFiatConfig() {
    return await getSection('fiat');
}

/**
 * Get Token configuration
 * @returns {Promise<object>} Token settings
 */
async function getTokenConfig() {
    return await getSection('token');
}

/**
 * Get Farming/Yield configuration
 * @returns {Promise<object>} Farming settings
 */
async function getFarmingConfig() {
    return await getSection('farming');
}

/**
 * Get Staking configuration
 * @returns {Promise<object>} Staking settings
 */
async function getStakingConfig() {
    return await getSection('staking');
}

/**
 * Get DAO/Governance configuration
 * @returns {Promise<object>} DAO settings
 */
async function getDaoConfig() {
    return await getSection('dao');
}

/**
 * Get RWA configuration
 * @returns {Promise<object>} RWA settings
 */
async function getRwaConfig() {
    return await getSection('rwa');
}

/**
 * Get Platform configuration
 * @returns {Promise<object>} Platform settings
 */
async function getPlatformConfig() {
    return await getSection('platform');
}

/**
 * Get Ad Rewards configuration
 * @returns {Promise<object>} Ad Rewards settings
 */
async function getAdRewardsConfig() {
    return await getSection('adRewards');
}

/**
 * Invalidate cache (call after settings update)
 */
function invalidateCache() {
    settingsCache = null;
    cacheTimestamp = 0;
}

/**
 * Get cache status (for debugging)
 * @returns {object} Cache info
 */
function getCacheStatus() {
    return {
        hasCachedData: settingsCache !== null,
        cacheAge: settingsCache ? Date.now() - cacheTimestamp : null,
        cacheTTL: CACHE_TTL_MS,
        isExpired: settingsCache ? (Date.now() - cacheTimestamp) >= CACHE_TTL_MS : true,
    };
}

module.exports = {
    // Core methods
    get,
    getSection,
    getAllSettings,
    isEnabled,
    isMaintenanceMode,

    // Convenience methods for sections
    getDefiConfig,
    getFiatConfig,
    getTokenConfig,
    getFarmingConfig,
    getStakingConfig,
    getDaoConfig,
    getRwaConfig,
    getPlatformConfig,
    getAdRewardsConfig,

    // Cache management
    invalidateCache,
    getCacheStatus,

    // Constants
    DEFAULT_SETTINGS,
};
