/**
 * Debugging script for require error
 */
try {
    console.log('Testing require bridge...');
    const bridge = require('./backend/services/payment-openclaw-bridge');
    console.log('Bridge loaded:', Object.keys(bridge));
} catch (err) {
    console.error('ERROR LOADING BRIDGE:');
    console.error(err);
    if (err.stack) console.error(err.stack);
}
