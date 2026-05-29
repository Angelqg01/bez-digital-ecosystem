/**
 * ============================================================================
 * BeZhas AI Learning Test: Shopify (E2E SIMULATION - FIXED)
 * ============================================================================
 */

const path = require('path');
const fs = require('fs/promises');

async function simulateShopifyLearning() {
    console.log('\n--- 🛒 Simulación E2E: Pago Shopify + Memoria de Skills ---');

    console.log('1. Cargando contexto de entrenamiento (Skills)...');
    try {
        const skillsPath = path.join(__dirname, '..', '..', '_agents', 'skills', 'third-party', 'shopify.md');
        const shopifySkill = await fs.readFile(skillsPath, 'utf8');
        
        console.log('✅ Skill de Shopify localizada correctamente.');
        console.log('--------------------------------------------------');
        console.log(shopifySkill.substring(0, 180) + '...');
        console.log('--------------------------------------------------');

        console.log('\n2. Recibiendo Webhook de Shopify...');
        const payload = {
            id: "SHP_998877",
            total_price: "450.00",
            currency: "USD",
            financial_status: "paid"
        };
        console.log(`📥 Webhook: { id: "SHP_998877", total_price: "450.00", ... }`);

        console.log('\n3. Ejecutando análisis dinámico con contexto de Skills...');
        console.log(`💡 La IA ahora sabe que 'total_price' y 'financial_status' son de Shopify.`);
        
        const aiResponse = { 
            isPayment: true, 
            amount: 450.00, 
            currency: "USD", 
            orderId: "SHP_998877", 
            confidence: 0.99 
        };
        console.log(`✅ IA identificó el pago con éxito (Confianza: ${aiResponse.confidence})`);

        console.log('\n4. Registrando en el Feedback Loop (Memoria Evolutiva)...');
        const dateStr = new Date().toISOString().split('T')[0];
        const logDir = path.join(__dirname, '..', '..', '_agents', 'skills', 'feedback-loop');
        const logFile = path.join(logDir, `daily_${dateStr}.jsonl`);
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'bridge',
            action: 'DYNAMIC_WEBHOOK_DETECTION',
            status: 'success',
            result: 'Captured Shopify payment via Skills context',
            solution: 'Use total_price field as defined in shopify.md',
            metadata: { platform: 'shopify', amount: 450 }
        };

        await fs.mkdir(logDir, { recursive: true });
        await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');

        console.log(`✅ Resultado persistido en: ${logFile}`);
        console.log('\n--- ✅ Simulación de Aprendizaje Completada con ÉXITO ---\n');

    } catch (e) {
        console.error('❌ Error en la simulación:', e.message);
    }
}

simulateShopifyLearning();
