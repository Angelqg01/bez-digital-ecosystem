/**
 * AffiliateEvent Model - now using in-memory database instead of MongoDB
 */

// Use mock models for development
const { AffiliateEvent } = require('./mockModels');

module.exports = AffiliateEvent;