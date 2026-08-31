console.log('=== Test 1: Load ws module ===');
const WebSocket = require('ws');
console.log('✅ ws loaded');

console.log('\n=== Test 2: Load jwt ===');
const jwt = require('jsonwebtoken');
console.log('✅ jwt loaded');

console.log('\n=== Test 3: Load ethers ===');
const { ethers } = require('ethers');
console.log('✅ ethers loaded');

console.log('\n=== Test 4: Load pino ===');
const pino = require('pino');
console.log('✅ pino loaded');

console.log('\n=== Test 5: Create pino logger ===');
const logger = pino({ level: 'info' });
console.log('✅ logger created');

console.log('\n=== Test 6: Load WebSocketServer class (with timeout) ===');

// Set a timeout to detect hanging
const timeoutId = setTimeout(() => {
    console.error('❌ TIMEOUT: websocket-server.js took more than 5 seconds to load');
    process.exit(1);
}, 5000);

try {
    console.log('Attempting to require ./websocket-server...');
    const wsModule = require('./websocket-server');
    clearTimeout(timeoutId);
    console.log('✅ websocket-server loaded successfully!');
    console.log('Exported keys:', Object.keys(wsModule));

    // Exit successfully after 1 second
    setTimeout(() => {
        console.log('\n✅ All tests passed!');
        process.exit(0);
    }, 1000);
} catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ Error loading websocket-server:', error.message);
    console.error(error.stack);
    process.exit(1);
}
