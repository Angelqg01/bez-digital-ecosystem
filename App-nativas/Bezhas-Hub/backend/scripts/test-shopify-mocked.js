/**
 * ============================================================================
 * BeZhas AI Learning Test: Shopify (MOCKED)
 * ============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Mock de Mongoose antes de cargar el bridge
const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
    if (request.includes('mongoose') || request.includes('models/')) {
        return {
            Schema: function() {},
            model: function() { return { create: async () => ({}) }; },
            create: async () => ({})
        };
    }
    return originalLoad.apply(this, arguments);
};

const { bridgeCore } = require('../bridge/core/bridgeCore');
const feedbackLoopService = require('../services/feedback-loop.service');
const fs = require('fs/promises');

async function testShopifyLearningMocked() {
    console.log('\n--- 🛒 Simulando Pago Shopify (IA con Memoria de Skills) ---');

    await feedbackLoopService.init();

    const shopifyPayload = {
        id: "SHP_99_PAY",
        total_price: "299.00",
        currency: "USD",
        financial_status: "paid",
        customer: { id: "CUST_001" }
    };

    console.log(`📥 Webhook Shopify Mockeado Recibido...`);

    // El sistema debe usar la Skill d:/.../_agents/skills/third-party/shopify.md
    const result = await bridgeCore.processDynamicWebhook(shopifyPayload, 'shopify');

    console.log('\n--- 🧠 Análisis de la IA ---');
    console.log(JSON.stringify(result, null, 2));

    const dateStr = new Date().toISOString().split('T')[0];
    const logPath = path.join(process.cwd(), '_agents/skills/feedback-loop', `daily_${dateStr}.jsonl`);
    
    try {
        const data = await fs.readFile(logPath, 'utf8');
        const lastLine = data.split('\n').filter(Boolean).pop();
        const log = JSON.parse(lastLine);

        console.log('\n--- 📝 Resultado en Feedback Loop ---');
        console.log(`   Estado: ${log.status}`);
        console.log(`   Acción: ${log.action}`);
        console.log(`   Solución IA: ${log.solution}`);
    } catch (e) {
        console.log('\n❌ No se pudo validar el log del feedback loop.');
    }

    console.log('\n--- ✅ Test Finalizado sin dependencias de DB ---\n');
    process.exit(0);
}

testShopifyLearningMocked();
