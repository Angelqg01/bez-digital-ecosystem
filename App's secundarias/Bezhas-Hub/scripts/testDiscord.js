/**
 * Test Discord Webhook Connection
 * 
 * Quick test script to verify Discord webhook is configured correctly
 * Usage: node scripts/testDiscord.js
 */

const https = require('https');
require('dotenv').config({ path: __dirname + '/.env' });

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

if (!DISCORD_WEBHOOK) {
    console.error('❌ Error: DISCORD_WEBHOOK_URL not found in environment variables');
    console.log('\nPlease add to scripts/.env:');
    console.log('DISCORD_WEBHOOK_URL=https://discord.gg/wrGJzP7tr');
    process.exit(1);
}

console.log('🔍 Testing Discord webhook connection...\n');
console.log(`Webhook URL: ${DISCORD_WEBHOOK.substring(0, 30)}...\n`);

const testEmbed = {
    embeds: [{
        title: '✅ BeZhas Security System - Connection Test',
        description: 'Discord webhook successfully configured and working!',
        color: 0x00FF00, // Green
        fields: [
            {
                name: '🎯 Purpose',
                value: 'This is a test alert from BeZhas Security Monitoring System',
                inline: false
            },
            {
                name: '📅 Timestamp',
                value: new Date().toLocaleString(),
                inline: true
            },
            {
                name: '🖥️ Environment',
                value: process.env.NODE_ENV || 'development',
                inline: true
            },
            {
                name: '📊 Status',
                value: '✅ Operational',
                inline: true
            }
        ],
        footer: {
            text: 'BeZhas Security Monitor v1.0'
        },
        timestamp: new Date().toISOString()
    }]
};

// Parse webhook URL
let webhookUrl;
try {
    // Handle both invite links and webhook URLs
    if (DISCORD_WEBHOOK.includes('discord.gg/')) {
        console.log('⚠️  Warning: This appears to be a Discord invite link, not a webhook URL');
        console.log('\nTo get a webhook URL:');
        console.log('1. Go to Discord Server Settings');
        console.log('2. Click Integrations > Webhooks');
        console.log('3. Create New Webhook');
        console.log('4. Copy Webhook URL (should start with https://discord.com/api/webhooks/...)');
        console.log('\nCurrent URL format is for invites, not webhooks. Exiting...\n');
        process.exit(1);
    }

    webhookUrl = new URL(DISCORD_WEBHOOK);
} catch (err) {
    console.error('❌ Invalid webhook URL format:', err.message);
    process.exit(1);
}

// Send test message
const options = {
    hostname: webhookUrl.hostname,
    path: webhookUrl.pathname + webhookUrl.search,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);

    res.on('end', () => {
        if (res.statusCode === 204) {
            console.log('✅ SUCCESS! Discord webhook is working correctly');
            console.log('📬 Test message sent to Discord channel');
            console.log('\n🎉 Security monitoring system is ready to send alerts!');
        } else if (res.statusCode === 404) {
            console.error('❌ Webhook not found (404)');
            console.log('Please verify the webhook URL is correct');
        } else {
            console.error(`⚠️  Unexpected response: ${res.statusCode}`);
            console.log('Response:', data);
        }
    });
});

req.on('error', (err) => {
    console.error('❌ Connection error:', err.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check internet connection');
    console.log('2. Verify webhook URL is valid');
    console.log('3. Ensure webhook has not been deleted');
});

req.write(JSON.stringify(testEmbed));
req.end();
