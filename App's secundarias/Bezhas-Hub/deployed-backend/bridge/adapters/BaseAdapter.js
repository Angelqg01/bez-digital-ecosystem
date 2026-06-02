/**
 * Base Adapter Class
 * 
 * All platform-specific adapters must extend this base class.
 * This ensures a consistent interface across all integrations.
 */

const EventEmitter = require('events');
const logger = require('../../utils/logger');

/**
 * Abstract Base Adapter
 * 
 * Provides the foundational structure for all platform adapters.
 * Subclasses must implement the abstract methods.
 */
class BaseAdapter extends EventEmitter {
    constructor(config = {}) {
        super();

        this.platformId = config.platformId || 'unknown';
        this.platformName = config.platformName || 'Unknown Platform';
        this.apiKey = config.apiKey || null;
        this.apiSecret = config.apiSecret || null;
        this.baseUrl = config.baseUrl || null;
        this.webhookSecret = config.webhookSecret || null;

        this.status = 'disconnected';
        this.lastSyncTime = null;
        this.syncInProgress = false;
        this.rateLimitRemaining = null;
        this.rateLimitReset = null;

        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            itemsSynced: 0,
            ordersProcessed: 0,
        };
    }

    /**
     * Initialize the adapter (connect to external API)
     * @abstract
     */
    async connect() {
        throw new Error('connect() must be implemented by subclass');
    }

    /**
     * Disconnect from external API
     */
    async disconnect() {
        this.status = 'disconnected';
        logger.info({ platformId: this.platformId }, 'Adapter disconnected');
    }

    /**
     * Sync inventory from external platform to BeZhas
     * @abstract
     * @param {object} options - Sync options
     * @returns {Promise<object>} Sync result
     */
    async syncInventory(options = {}) {
        throw new Error('syncInventory() must be implemented by subclass');
    }

    /**
     * Push inventory from BeZhas to external platform
     * @abstract
     * @param {array} items - Items to push
     * @returns {Promise<object>} Push result
     */
    async pushInventory(items) {
        throw new Error('pushInventory() must be implemented by subclass');
    }

    /**
     * Handle incoming webhook from external platform
     * @abstract
     * @param {string} eventType - Event type
     * @param {object} payload - Webhook payload
     * @returns {Promise<object>} Processing result
     */
    async handleWebhook(eventType, payload) {
        throw new Error('handleWebhook() must be implemented by subclass');
    }

    /**
     * Create an order on the external platform
     * @abstract
     * @param {object} orderData - Order data in BeZhas format
     * @returns {Promise<object>} Created order
     */
    async createOrder(orderData) {
        throw new Error('createOrder() must be implemented by subclass');
    }

    /**
     * Update shipment status
     * @abstract
     * @param {string} trackingNumber - Tracking number
     * @param {object} statusData - Status update
     * @returns {Promise<object>} Update result
     */
    async updateShipment(trackingNumber, statusData) {
        throw new Error('updateShipment() must be implemented by subclass');
    }

    /**
     * Health check for the adapter
     * @returns {Promise<boolean>} true if healthy
     */
    async healthCheck() {
        return this.status === 'connected';
    }

    /**
     * Get adapter status
     */
    getStatus() {
        return this.status;
    }

    /**
     * Get last sync time
     */
    getLastSyncTime() {
        return this.lastSyncTime;
    }

    /**
     * Get adapter statistics
     */
    getStats() {
        return {
            ...this.stats,
            status: this.status,
            lastSyncTime: this.lastSyncTime,
            rateLimitRemaining: this.rateLimitRemaining,
        };
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Transform external item to BeZhas format
     * @abstract
     * @param {object} externalItem - Item from external platform
     * @returns {object} Item in BeZhas format
     */
    transformToBeZhasFormat(externalItem) {
        throw new Error('transformToBeZhasFormat() must be implemented by subclass');
    }

    /**
     * Transform BeZhas item to external format
     * @abstract
     * @param {object} bezhasItem - Item in BeZhas format
     * @returns {object} Item in external platform format
     */
    transformToExternalFormat(bezhasItem) {
        throw new Error('transformToExternalFormat() must be implemented by subclass');
    }

    /**
     * Validate webhook signature
     * @param {object} headers - Request headers
     * @param {string} body - Raw request body
     * @returns {boolean} true if valid
     */
    validateWebhookSignature(headers, body) {
        // Default implementation - subclasses should override
        logger.warn({ platformId: this.platformId }, 'validateWebhookSignature not implemented');
        return true;
    }

    /**
     * Handle rate limiting
     * @param {object} response - API response
     */
    handleRateLimit(response) {
        if (response.headers) {
            this.rateLimitRemaining = response.headers['x-ratelimit-remaining'];
            this.rateLimitReset = response.headers['x-ratelimit-reset'];
        }

        if (this.rateLimitRemaining !== null && parseInt(this.rateLimitRemaining) <= 0) {
            this.status = 'rate_limited';
            logger.warn({ platformId: this.platformId, resetAt: this.rateLimitReset }, 'Rate limited');
        }
    }

    /**
     * Log API request
     */
    logRequest(method, endpoint, success, duration) {
        this.stats.totalRequests++;
        if (success) {
            this.stats.successfulRequests++;
        } else {
            this.stats.failedRequests++;
        }

        logger.debug({
            platformId: this.platformId,
            method,
            endpoint,
            success,
            duration,
        }, 'API Request');
    }
}

module.exports = BaseAdapter;
