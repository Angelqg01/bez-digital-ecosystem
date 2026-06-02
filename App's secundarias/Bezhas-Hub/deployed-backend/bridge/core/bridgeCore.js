/**
 * BeZhas Universal Bridge - Core Module
 * 
 * This is the centralized bridge controller that manages all external platform
 * integrations through a standardized adapter pattern.
 * 
 * Architecture:
 * - Bridge Core: Handles routing, validation, and logging
 * - Adapters: Platform-specific translators (Vinted, Maersk, etc.)
 * - Webhooks: Inbound event receivers from external platforms
 * - Sync Jobs: Scheduled background synchronization tasks
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

// Bridge event types
const BRIDGE_EVENTS = {
    INVENTORY_SYNCED: 'inventory:synced',
    INVENTORY_SYNC_FAILED: 'inventory:sync_failed',
    ORDER_CREATED: 'order:created',
    ORDER_UPDATED: 'order:updated',
    SHIPMENT_UPDATED: 'shipment:updated',
    PAYMENT_RECEIVED: 'payment:received',
    PAYMENT_FAILED: 'payment:failed',
    WEBHOOK_RECEIVED: 'webhook:received',
    ADAPTER_CONNECTED: 'adapter:connected',
    ADAPTER_DISCONNECTED: 'adapter:disconnected',
    ERROR: 'error',
};

// Bridge status codes
const BRIDGE_STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    SYNCING: 'syncing',
    ERROR: 'error',
    RATE_LIMITED: 'rate_limited',
};

/**
 * Universal Bridge Core Controller
 * 
 * Manages all platform adapters and provides a unified interface
 * for external integrations.
 */
class UniversalBridgeCore extends EventEmitter {
    constructor() {
        super();
        this.adapters = new Map();
        this.webhookHandlers = new Map();
        this.syncJobs = new Map();
        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastSyncTime: null,
            activeConnections: 0,
        };
        this.initialized = false;
    }

    /**
     * Initialize the bridge core
     */
    async initialize() {
        if (this.initialized) {
            logger.warn('Bridge Core already initialized');
            return;
        }

        logger.info('🌉 Initializing Universal Bridge Core...');

        // Setup error handling
        this.on(BRIDGE_EVENTS.ERROR, (error, context) => {
            logger.error({ error, context }, 'Bridge Core Error');
            this.stats.failedSyncs++;
        });

        this.initialized = true;
        logger.info('✅ Universal Bridge Core initialized');
    }

    /**
     * Register a platform adapter
     * @param {string} platformId - Unique platform identifier
     * @param {BaseAdapter} adapter - Adapter instance
     */
    registerAdapter(platformId, adapter) {
        if (this.adapters.has(platformId)) {
            logger.warn({ platformId }, 'Adapter already registered, replacing...');
        }

        this.adapters.set(platformId, adapter);
        this.stats.activeConnections = this.adapters.size;

        // Bind adapter events to bridge events
        adapter.on('sync_complete', (data) => {
            this.emit(BRIDGE_EVENTS.INVENTORY_SYNCED, { platformId, ...data });
            this.stats.successfulSyncs++;
            this.stats.totalSyncs++;
            this.stats.lastSyncTime = new Date();
        });

        adapter.on('sync_error', (error) => {
            this.emit(BRIDGE_EVENTS.INVENTORY_SYNC_FAILED, { platformId, error });
            this.stats.failedSyncs++;
            this.stats.totalSyncs++;
        });

        adapter.on('order_created', (data) => {
            this.emit(BRIDGE_EVENTS.ORDER_CREATED, { platformId, ...data });
        });

        adapter.on('shipment_updated', (data) => {
            this.emit(BRIDGE_EVENTS.SHIPMENT_UPDATED, { platformId, ...data });
        });

        this.emit(BRIDGE_EVENTS.ADAPTER_CONNECTED, { platformId });
        logger.info({ platformId }, '🔌 Adapter registered');
    }

    /**
     * Unregister a platform adapter
     * @param {string} platformId - Platform identifier
     */
    unregisterAdapter(platformId) {
        if (this.adapters.has(platformId)) {
            const adapter = this.adapters.get(platformId);
            adapter.disconnect?.();
            this.adapters.delete(platformId);
            this.stats.activeConnections = this.adapters.size;
            this.emit(BRIDGE_EVENTS.ADAPTER_DISCONNECTED, { platformId });
            logger.info({ platformId }, '🔌 Adapter unregistered');
        }
    }

    /**
     * Get an adapter by platform ID
     * @param {string} platformId - Platform identifier
     * @returns {BaseAdapter|null}
     */
    getAdapter(platformId) {
        return this.adapters.get(platformId) || null;
    }

    /**
     * Get all registered adapters
     * @returns {Map}
     */
    getAllAdapters() {
        return this.adapters;
    }

    /**
     * Sync inventory from a specific platform
     * @param {string} platformId - Platform identifier
     * @param {object} options - Sync options
     */
    async syncInventory(platformId, options = {}) {
        const adapter = this.getAdapter(platformId);
        if (!adapter) {
            throw new Error(`Adapter not found for platform: ${platformId}`);
        }

        logger.info({ platformId, options }, '📦 Starting inventory sync');
        return adapter.syncInventory(options);
    }

    /**
     * Sync inventory from all registered platforms
     * @param {object} options - Sync options
     */
    async syncAllInventory(options = {}) {
        const results = [];

        for (const [platformId, adapter] of this.adapters) {
            try {
                const result = await adapter.syncInventory(options);
                results.push({ platformId, success: true, result });
            } catch (error) {
                results.push({ platformId, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Process an incoming webhook
     * @param {string} platformId - Platform identifier
     * @param {string} eventType - Event type
     * @param {object} payload - Webhook payload
     */
    async processWebhook(platformId, eventType, payload) {
        const adapter = this.getAdapter(platformId);
        if (!adapter) {
            logger.warn({ platformId }, 'Webhook received for unregistered platform');
            throw new Error(`Adapter not found for platform: ${platformId}`);
        }

        this.emit(BRIDGE_EVENTS.WEBHOOK_RECEIVED, { platformId, eventType });
        return adapter.handleWebhook(eventType, payload);
    }

    /**
     * Create an order across platforms
     * @param {string} platformId - Target platform
     * @param {object} orderData - Order data in BeZhas format
     */
    async createOrder(platformId, orderData) {
        const adapter = this.getAdapter(platformId);
        if (!adapter) {
            throw new Error(`Adapter not found for platform: ${platformId}`);
        }

        return adapter.createOrder(orderData);
    }

    /**
     * Update shipment status
     * @param {string} platformId - Platform identifier
     * @param {string} trackingNumber - Tracking number
     * @param {object} statusData - Status update data
     */
    async updateShipment(platformId, trackingNumber, statusData) {
        const adapter = this.getAdapter(platformId);
        if (!adapter) {
            throw new Error(`Adapter not found for platform: ${platformId}`);
        }

        return adapter.updateShipment(trackingNumber, statusData);
    }

    /**
     * Get bridge statistics
     */
    getStats() {
        const adapterStats = {};
        for (const [platformId, adapter] of this.adapters) {
            adapterStats[platformId] = {
                status: adapter.getStatus?.() || BRIDGE_STATUS.CONNECTED,
                lastSync: adapter.getLastSyncTime?.() || null,
            };
        }

        return {
            ...this.stats,
            adapters: adapterStats,
            timestamp: new Date(),
        };
    }

    /**
     * Health check for all adapters
     */
    async healthCheck() {
        const results = {};

        for (const [platformId, adapter] of this.adapters) {
            try {
                const healthy = await adapter.healthCheck?.();
                results[platformId] = { healthy: healthy !== false, status: BRIDGE_STATUS.CONNECTED };
            } catch (error) {
                results[platformId] = { healthy: false, status: BRIDGE_STATUS.ERROR, error: error.message };
            }
        }

        return results;
    }
}

// Export singleton instance
const bridgeCore = new UniversalBridgeCore();

module.exports = {
    bridgeCore,
    UniversalBridgeCore,
    BRIDGE_EVENTS,
    BRIDGE_STATUS,
};
