/**
 * BeZhas Universal Bridge - Main Entry Point
 * 
 * This module provides a unified interface for all external platform integrations.
 * 
 * Architecture Overview:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    Universal Bridge Core                        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
 * │  │ Vinted   │  │ Maersk   │  │ Airbnb   │  │ (Future) │        │
 * │  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapters │        │
 * │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
 * │       │             │             │             │               │
 * │       └─────────────┴──────┬──────┴─────────────┘               │
 * │                            │                                    │
 * │                   ┌────────▼────────┐                           │
 * │                   │  Bridge Core    │                           │
 * │                   │  (Event-Driven) │                           │
 * │                   └────────┬────────┘                           │
 * │                            │                                    │
 * │       ┌────────────────────┼────────────────────┐               │
 * │       │                    │                    │               │
 * │  ┌────▼────┐         ┌────▼────┐         ┌────▼────┐           │
 * │  │Webhooks │         │ Sync    │         │  API    │           │
 * │  │ Router  │         │ Jobs    │         │ Routes  │           │
 * │  └─────────┘         └─────────┘         └─────────┘           │
 * │                                                                 │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 * ```javascript
 * const bridge = require('./bridge');
 * 
 * // Initialize bridge
 * await bridge.initialize();
 * 
 * // Register adapters
 * bridge.registerAdapter('vinted', { apiKey: '...' });
 * bridge.registerAdapter('maersk', { consumerKey: '...' });
 * 
 * // Sync inventory
 * await bridge.syncInventory('vinted');
 * ```
 */

// Core
const { bridgeCore, BRIDGE_EVENTS, BRIDGE_STATUS } = require('./core/bridgeCore');

// Adapters
const {
    BaseAdapter,
    VintedAdapter,
    MaerskAdapter,
    AirbnbAdapter,
    createAdapter,
    getAvailableAdapters,
} = require('./adapters');

// Jobs
const syncJobs = require('./jobs/syncJobs');

// Webhooks Router
const webhooksRouter = require('./webhooks/webhooks.routes');

/**
 * Initialize the Universal Bridge system
 * @param {object} config - Configuration options
 */
async function initialize(config = {}) {
    console.log('🌉 Initializing BeZhas Universal Bridge...');

    // Initialize core
    await bridgeCore.initialize();

    // Auto-register adapters based on environment variables
    await autoRegisterAdapters(config);

    // Initialize sync jobs if enabled
    if (config.enableSyncJobs !== false) {
        syncJobs.initializeSyncJobs();
    }

    console.log('✅ Universal Bridge initialized successfully');
    return bridgeCore;
}

/**
 * Auto-register adapters based on available credentials
 */
async function autoRegisterAdapters(config = {}) {
    const adaptersToRegister = [];

    // Vinted
    if (process.env.VINTED_ACCESS_TOKEN || config.vinted?.accessToken) {
        adaptersToRegister.push({
            id: 'vinted',
            config: {
                accessToken: process.env.VINTED_ACCESS_TOKEN,
                userId: process.env.VINTED_USER_ID,
                webhookSecret: process.env.VINTED_WEBHOOK_SECRET,
                ...config.vinted,
            },
        });
    } else {
        // Register in mock mode for development
        adaptersToRegister.push({ id: 'vinted', config: {} });
    }

    // Maersk
    if (process.env.MAERSK_CONSUMER_KEY || config.maersk?.consumerKey) {
        adaptersToRegister.push({
            id: 'maersk',
            config: {
                consumerKey: process.env.MAERSK_CONSUMER_KEY,
                consumerSecret: process.env.MAERSK_CONSUMER_SECRET,
                ...config.maersk,
            },
        });
    } else {
        adaptersToRegister.push({ id: 'maersk', config: {} });
    }

    // Airbnb
    if (process.env.AIRBNB_CLIENT_ID || config.airbnb?.clientId) {
        adaptersToRegister.push({
            id: 'airbnb',
            config: {
                clientId: process.env.AIRBNB_CLIENT_ID,
                clientSecret: process.env.AIRBNB_CLIENT_SECRET,
                ...config.airbnb,
            },
        });
    } else {
        adaptersToRegister.push({ id: 'airbnb', config: {} });
    }

    // Ecosystem Bridge (L2 Sync)
    if (process.env.ECOSYSTEM_BRIDGE_KEY || config.ecosystem?.apiKey) {
        adaptersToRegister.push({
            id: 'ecosystem',
            config: {
                apiKey: process.env.ECOSYSTEM_BRIDGE_KEY,
                baseUrl: process.env.BLOCKCHAIN_API_URL,
                ...config.ecosystem,
            },
        });
    }

    // Register all adapters
    for (const { id, config: adapterConfig } of adaptersToRegister) {
        try {
            const adapter = createAdapter(id, adapterConfig);
            await adapter.connect();
            bridgeCore.registerAdapter(id, adapter);
        } catch (error) {
            console.warn(`⚠️ Failed to register ${id} adapter:`, error.message);
        }
    }
}

/**
 * Convenience method to register an adapter
 * @param {string} platformId - Platform identifier
 * @param {object} config - Adapter configuration
 */
async function registerAdapter(platformId, config = {}) {
    try {
        const adapter = createAdapter(platformId, config);
        await adapter.connect();
        bridgeCore.registerAdapter(platformId, adapter);
        return { success: true, platformId };
    } catch (error) {
        console.error(`Failed to register adapter ${platformId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Sync inventory from a platform
 * @param {string} platformId - Platform identifier
 * @param {object} options - Sync options
 */
async function syncInventory(platformId, options = {}) {
    return bridgeCore.syncInventory(platformId, options);
}

/**
 * Sync all registered platforms
 */
async function syncAll(options = {}) {
    return bridgeCore.syncAllInventory(options);
}

/**
 * Get bridge statistics
 */
function getStats() {
    return bridgeCore.getStats();
}

/**
 * Health check
 */
async function healthCheck() {
    return bridgeCore.healthCheck();
}

/**
 * Shutdown the bridge
 */
async function shutdown() {
    console.log('🌉 Shutting down Universal Bridge...');

    // Stop all sync jobs
    syncJobs.stopAllJobs();

    // Disconnect all adapters
    const adapters = bridgeCore.getAllAdapters();
    for (const [platformId] of adapters) {
        bridgeCore.unregisterAdapter(platformId);
    }

    console.log('👋 Universal Bridge shutdown complete');
}

// Export everything
module.exports = {
    // Main functions
    initialize,
    shutdown,
    registerAdapter,
    syncInventory,
    syncAll,
    getStats,
    healthCheck,

    // Core access
    bridgeCore,
    BRIDGE_EVENTS,
    BRIDGE_STATUS,

    // Adapters
    BaseAdapter,
    VintedAdapter,
    MaerskAdapter,
    AirbnbAdapter,
    createAdapter,
    getAvailableAdapters,

    // Jobs
    syncJobs,

    // Express Router
    webhooksRouter,
};
