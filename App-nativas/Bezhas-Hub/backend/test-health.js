#!/usr/bin/env node
/**
 * Simple Health Check Test
 * Tests if the backend server responds correctly to the /health endpoint
 */

const http = require('http');

function testHealth() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/health',
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log('\n✅ HEALTH CHECK PASSED\n');
                    console.log('Status:', json.status);
                    console.log('Uptime:', json.uptime, 'seconds');
                    console.log('Timestamp:', json.timestamp);
                    resolve(json);
                } catch (err) {
                    console.error('\n❌ INVALID RESPONSE FORMAT\n');
                    console.error('Raw response:', data);
                    reject(err);
                }
            });
        });

        req.on('error', (err) => {
            console.error('\n❌ CONNECTION FAILED\n');
            console.error('Error:', err.message);
            reject(err);
        });

        req.on('timeout', () => {
            console.error('\n❌ REQUEST TIMEOUT\n');
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Wait 5 seconds and then test
console.log('⏳ Waiting 5 seconds for server to start...');
setTimeout(async () => {
    try {
        await testHealth();
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
}, 5000);
