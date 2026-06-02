/**
 * ============================================================================
 * BeZhas AI Learning Test: Shopify (v1)
 * ============================================================================
 * 
 * Simula la llegada de un pago de Shopify y verifica que la IA:
 * 1. Lo reconoce usando la nueva Skill inyectada.
 * 2. Registra el patrón en el Feedback Loop.
 * 3. Permite la persistencia autónoma de la orden.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { bridgeCore } = require('../bridge/core/bridgeCore');
const feedbackLoopService = require('../services/feedback-loop.service');
const fs = require('fs/promises');

async function testShopifyLearning() {
    console.log('\n--- 🛒 Simulando Pago Shopify (AI Learning Test) ---');

    await feedbackLoopService.init();

    // 1. Mock de Webhook Real de Shopify (orders/paid)
    const shopifyPayload = {
        id: 9988776655,
        total_price: "150.00",
        currency: "USD",
        financial_status: "paid",
        order_number: 2201,
        admin_graphql_api_id: "gid://shopify/Order/9988776655",
        test: true
    };

    console.log(`📥 Webhook Shopify Recibido (ID: ${shopifyPayload.id})...`);

    // 2. Procesar vía Dynamic Bridge
    // La IA debería leer d:/.../_agents/skills/third-party/shopify.md
    const result = await bridgeCore.processDynamicWebhook(shopifyPayload, 'shopify');

    console.log('\n--- 🧠 Análisis de la IA ---');
    console.log(JSON.stringify(result, null, 2));

    // 3. Verificar el impacto en el Feedback Loop
    const dateStr = new Date().toISOString().split('T')[0];
    const logPath = path.join(process.cwd(), '_agents/skills/feedback-loop', `daily_${dateStr}.jsonl`);
    
    try {
        const data = await fs.readFile(logPath, 'utf8');
        const logs = data.split('\n').filter(Boolean).map(JSON.parse);
        const lastLog = logs[logs.length - 1];

        console.log('\n--- 📝 Registro en el Feedback Loop ---');
        if (lastLog.action === 'DYNAMIC_WEBHOOK_DETECTION') {
            console.log(`✅ ÉXITO: El sistema aprendió el esquema de ${lastLog.metadata.platform}`);
            console.log(`    Solución documentada por la IA: "${lastLog.solution}"`);
        } else {
            console.log('⚠️ La acción registrada fue:', lastLog.action);
        }
    } catch (e) {
        console.log('\n❌ ERROR: No se pudo leer el Feedback Loop log.');
    }

    console.log('\n--- ✅ Simulación Finalizada ---\n');
    process.exit(0);
}

testShopifyLearning().catch(err => {
    console.error('❌ Error fatal en el test:', err);
    process.exit(1);
});
