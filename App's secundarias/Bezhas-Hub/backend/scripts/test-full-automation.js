/**
 * ============================================================================
 * BeZhas Full Automation Test (v4)
 * ============================================================================
 */

process.env.PRIMARY_AI_PROVIDER = 'openai';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { bridgeCore } = require('../bridge/core/bridgeCore');
const webhookBlockchainBridge = require('../services/bridge/WebhookBlockchainBridge');
const feedbackLoopService = require('../services/feedback-loop.service');
const fs = require('fs/promises');

// Mock simple
async function runTest() {
    console.log('\n--- 🚀 BeZhas Full Automation Test ---');

    // 1. Init
    await feedbackLoopService.init();
    webhookBlockchainBridge.init();

    // 2. Mock payload (Airbnb Payment)
    const airbnbPayload = {
        id: "AIR-TEST-999",
        listingId: "BZH-REAL-ESTATE-MADRID",
        amount: 350.00,
        currency: "EUR",
        status: "approved"
    };

    console.log(`\n[1] Simulating Webhook from Airbnb...`);
    
    // 3. Process Webhook
    // Forzamos el modo dinámico para probar el aprendizaje
    const result = await bridgeCore.processWebhook('airbnb', 'payment_completed', airbnbPayload);
    
    console.log(`\n[2] Discovery Result:`, result.success ? '✅ OK' : '❌ Failed');
    console.log(`    Mode: ${result.mode}`);
    console.log(`    Platform: ${result.platform}`);

    // 4. Trace the Feedback Loop
    const dateStr = new Date().toISOString().split('T')[0];
    const logPath = path.join(process.cwd(), '_agents/skills/feedback-loop', `daily_${dateStr}.jsonl`);
    
    try {
        const data = await fs.readFile(logPath, 'utf8');
        const lastLog = JSON.parse(data.split('\n').filter(l => l).pop());
        console.log(`\n[3] Feedback Loop Recorded:`);
        console.log(`    Action: ${lastLog.action}`);
        console.log(`    Status: ${lastLog.status}`);
        console.log(`    Solution: ${lastLog.solution}`);
    } catch (e) {
        console.log(`\n[3] Feedback Loop: (File not found or empty yet)`);
    }

    console.log('\n--- ✅ Test Complete ---\n');
    process.exit(0);
}

runTest();
