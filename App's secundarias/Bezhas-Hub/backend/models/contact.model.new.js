/**
 * Contact Model - now using in-memory database instead of MongoDB
 */

// Use mock models for development
const { Contact } = require('./mockModels');

module.exports = Contact;