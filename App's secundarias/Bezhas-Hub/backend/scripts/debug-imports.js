try {
    console.log('Testing imports...');
    const logger = require('../utils/logger');
    console.log('✅ Logger loaded');
    const blockchainService = require('../services/blockchain.service');
    console.log('✅ Blockchain service loaded');
    const WebhookBridge = require('../services/bridge/WebhookBlockchainBridge');
    console.log('✅ Webhook Bridge loaded');
    console.log('All imports successful!');
} catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
}
