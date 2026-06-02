console.log('Test: Loading ws...');
const WebSocket = require('ws');
console.log('✅ ws loaded');

console.log('Test: Loading pino...');
const pino = require('pino');
console.log('✅ pino loaded');

console.log('Test: Creating pino logger...');
const logger = pino({ level: 'info' });
console.log('✅ Logger created');

console.log('Test: Logging a message...');
logger.info('Test message');
console.log('✅ Logged');

console.log('✅ All tests passed!');
setTimeout(() => {
    console.log('Exiting after 2s...');
    process.exit(0);
}, 2000);
