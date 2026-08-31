// Simple Backend Starter for Debugging
// This script will catch any initialization errors and log them

console.log('='.repeat(60));
console.log('Starting Backend Initialization...');
console.log('='.repeat(60));

const logPath = require('path').join(__dirname, 'backend_debug.log');
const fs = require('fs');

// Create a log file
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

// Override console.log to write to file
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    const message = args.join(' ');
    logStream.write(`[LOG] ${new Date().toISOString()} - ${message}\n`);
    originalLog.apply(console, args);
};

console.error = function(...args) {
    const message = args.join(' ');
    logStream.write(`[ERROR] ${new Date().toISOString()} - ${message}\n`);
    originalError.apply(console, args);
};

console.log('Log file created at:', logPath);
console.log('Loading dotenv...');

try {
    require('dotenv').config();
    console.log('✅ dotenv loaded');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('PORT:', process.env.PORT);
    console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
    console.log('SUPER_ADMIN_WALLETS:', process.env.SUPER_ADMIN_WALLETS ? 'SET' : 'NOT SET');
} catch (error) {
    console.error('❌ Error loading dotenv:', error.message);
    process.exit(1);
}

console.log('\nStarting server.js...');
try {
    require('./server.js');
} catch (error) {
    console.error('❌ FATAL ERROR starting server:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}
