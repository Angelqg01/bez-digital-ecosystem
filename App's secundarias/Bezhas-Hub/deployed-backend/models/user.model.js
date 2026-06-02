/**
 * User Model - now using in-memory database instead of MongoDB
 */

// Use mock models for development
const { User } = require('./mockModels');

module.exports = User;