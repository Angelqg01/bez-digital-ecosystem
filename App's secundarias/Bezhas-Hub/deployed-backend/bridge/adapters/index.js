/**
 * Bridge Adapters Index
 * 
 * Central export for all platform adapters.
 */

const BaseAdapter = require('./BaseAdapter');
const VintedAdapter = require('./VintedAdapter');
const MaerskAdapter = require('./MaerskAdapter');
const AirbnbAdapter = require('./AirbnbAdapter');

// Adapter registry for dynamic loading
const ADAPTER_REGISTRY = {
    vinted: VintedAdapter,
    maersk: MaerskAdapter,
    airbnb: AirbnbAdapter,
    // Future adapters will be added here:
    // ebay: EbayAdapter,
    // amazon: AmazonAdapter,
    // fedex: FedexAdapter,
    // dhl: DHLAdapter,
    // stripe: StripeAdapter,
    // paypal: PaypalAdapter,
};

/**
 * Factory function to create adapter instances
 * @param {string} platformId - Platform identifier
 * @param {object} config - Adapter configuration
 * @returns {BaseAdapter} Configured adapter instance
 */
function createAdapter(platformId, config = {}) {
    const AdapterClass = ADAPTER_REGISTRY[platformId.toLowerCase()];

    if (!AdapterClass) {
        throw new Error(`Unknown adapter: ${platformId}. Available: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`);
    }

    return new AdapterClass(config);
}

/**
 * Get list of available adapters
 * @returns {string[]} List of adapter IDs
 */
function getAvailableAdapters() {
    return Object.keys(ADAPTER_REGISTRY);
}

module.exports = {
    // Base class
    BaseAdapter,

    // Specific adapters
    VintedAdapter,
    MaerskAdapter,
    AirbnbAdapter,

    // Factory and registry
    createAdapter,
    getAvailableAdapters,
    ADAPTER_REGISTRY,
};
