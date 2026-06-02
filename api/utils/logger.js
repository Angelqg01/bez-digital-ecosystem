/**
 * Minimal structured logger facade.
 */
const pino = require('pino');

module.exports = pino({ level: process.env.LOG_LEVEL || 'info', name: 'bezhas-api' });
