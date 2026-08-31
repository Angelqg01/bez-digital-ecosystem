#!/usr/bin/env node
/**
 * Security Sentinel Daemon
 * 
 * Starts the security monitoring system as a background daemon
 * Monitors vulnerabilities every 12 hours and sends alerts
 * 
 * Usage:
 *   npm run start-sentinel     # Start in foreground
 *   npm run start-sentinel &   # Start in background (Unix)
 *   pm2 start scripts/startSentinel.js --name bezhas-security
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG_FILE = path.join(__dirname, 'security-sentinel.log');
const PID_FILE = path.join(__dirname, 'security-sentinel.pid');

// Create log file if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '');
}

console.log('🚀 Starting BeZhas Security Sentinel...\n');
console.log(`📝 Log file: ${LOG_FILE}`);
console.log(`📌 PID file: ${PID_FILE}\n`);

// Start security notifier
const sentinel = spawn('node', [path.join(__dirname, 'securityNotifier.js')], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe']
});

// Save PID
fs.writeFileSync(PID_FILE, sentinel.pid.toString());
console.log(`✅ Security Sentinel started (PID: ${sentinel.pid})\n`);

// Redirect output to log file
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

sentinel.stdout.on('data', (data) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${data}`;
    logStream.write(message);
    process.stdout.write(data);
});

sentinel.stderr.on('data', (data) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ERROR: ${data}`;
    logStream.write(message);
    process.stderr.write(data);
});

sentinel.on('close', (code) => {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] Security Sentinel exited with code ${code}\n`;
    logStream.write(message);
    console.log(message);

    // Clean up PID file
    if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
    }

    logStream.end();
    process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n⚠️  Stopping Security Sentinel...');
    sentinel.kill('SIGTERM');
});

process.on('SIGTERM', () => {
    console.log('\n⚠️  Stopping Security Sentinel...');
    sentinel.kill('SIGTERM');
});

console.log('📊 Monitoring console output... (Press Ctrl+C to stop)\n');
console.log(`${'='.repeat(60)}\n`);
