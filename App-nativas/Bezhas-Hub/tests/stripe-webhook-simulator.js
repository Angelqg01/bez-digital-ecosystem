/**
 * Stripe Webhook Simulator
 * Simula eventos de webhooks de Stripe para testing local
 */

const axios = require('axios');
const crypto = require('crypto');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/stripe/webhook';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

console.log('🎯 Stripe Webhook Simulator\n');
console.log(`Webhook URL: ${WEBHOOK_URL}`);
console.log(`Webhook Secret: ${WEBHOOK_SECRET}\n`);

// ==================================================
// EVENTOS DE PRUEBA
// ==================================================

const testEvents = {
    // 1. Subscripción creada
    subscription_created: {
        id: 'evt_test_webhook_created',
        type: 'customer.subscription.created',
        data: {
            object: {
                id: 'sub_test_12345',
                customer: 'cus_test_67890',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_bronze',
                            product: 'prod_vip_bronze'
                        }
                    }]
                },
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
                metadata: {
                    userId: 'user_test_123',
                    tier: 'bronze'
                }
            }
        }
    },

    // 2. Pago exitoso
    payment_succeeded: {
        id: 'evt_test_webhook_payment_ok',
        type: 'invoice.payment_succeeded',
        data: {
            object: {
                id: 'in_test_invoice',
                customer: 'cus_test_67890',
                subscription: 'sub_test_12345',
                amount_paid: 999,
                currency: 'usd',
                status: 'paid',
                metadata: {
                    userId: 'user_test_123'
                }
            }
        }
    },

    // 3. Pago fallido
    payment_failed: {
        id: 'evt_test_webhook_payment_fail',
        type: 'invoice.payment_failed',
        data: {
            object: {
                id: 'in_test_invoice_fail',
                customer: 'cus_test_67890',
                subscription: 'sub_test_12345',
                amount_due: 999,
                currency: 'usd',
                status: 'open',
                attempt_count: 1,
                metadata: {
                    userId: 'user_test_123'
                }
            }
        }
    },

    // 4. Subscripción actualizada
    subscription_updated: {
        id: 'evt_test_webhook_updated',
        type: 'customer.subscription.updated',
        data: {
            object: {
                id: 'sub_test_12345',
                customer: 'cus_test_67890',
                status: 'active',
                items: {
                    data: [{
                        price: {
                            id: 'price_silver',
                            product: 'prod_vip_silver'
                        }
                    }]
                },
                current_period_start: Math.floor(Date.now() / 1000),
                current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
                metadata: {
                    userId: 'user_test_123',
                    tier: 'silver'
                }
            }
        }
    },

    // 5. Subscripción cancelada
    subscription_deleted: {
        id: 'evt_test_webhook_deleted',
        type: 'customer.subscription.deleted',
        data: {
            object: {
                id: 'sub_test_12345',
                customer: 'cus_test_67890',
                status: 'canceled',
                canceled_at: Math.floor(Date.now() / 1000),
                metadata: {
                    userId: 'user_test_123'
                }
            }
        }
    }
};

// ==================================================
// GENERADOR DE FIRMA STRIPE
// ==================================================

function generateStripeSignature(payload, secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;

    const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

    return {
        header: `t=${timestamp},v1=${signature}`,
        timestamp
    };
}

// ==================================================
// ENVIAR WEBHOOK
// ==================================================

async function sendWebhook(eventType) {
    const event = testEvents[eventType];

    if (!event) {
        console.error(`❌ Evento no encontrado: ${eventType}`);
        console.log('\nEventos disponibles:');
        Object.keys(testEvents).forEach(key => {
            console.log(`  - ${key}`);
        });
        return false;
    }

    console.log(`\n📤 Enviando webhook: ${event.type}`);
    console.log(`   Event ID: ${event.id}`);

    const payload = JSON.stringify(event);
    const { header, timestamp } = generateStripeSignature(payload, WEBHOOK_SECRET);

    try {
        const response = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': header
            }
        });

        console.log(`✅ Webhook enviado exitosamente`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response:`, response.data);
        return true;

    } catch (error) {
        console.log(`❌ Error al enviar webhook`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Message: ${error.response.data?.message || error.response.data}`);
        } else {
            console.log(`   Error: ${error.message}`);
        }
        return false;
    }
}

// ==================================================
// SIMULACIÓN COMPLETA
// ==================================================

async function simulateCompleteFlow() {
    console.log('\n🎬 Simulando flujo completo de subscripción VIP...\n');
    console.log('='.repeat(60));

    let results = {
        passed: 0,
        failed: 0
    };

    // 1. Crear subscripción
    console.log('\n1️⃣  PASO 1: Crear subscripción');
    const step1 = await sendWebhook('subscription_created');
    if (step1) results.passed++; else results.failed++;
    await sleep(2000);

    // 2. Primer pago exitoso
    console.log('\n2️⃣  PASO 2: Primer pago exitoso');
    const step2 = await sendWebhook('payment_succeeded');
    if (step2) results.passed++; else results.failed++;
    await sleep(2000);

    // 3. Actualizar a tier superior
    console.log('\n3️⃣  PASO 3: Actualizar a tier superior (Bronze → Silver)');
    const step3 = await sendWebhook('subscription_updated');
    if (step3) results.passed++; else results.failed++;
    await sleep(2000);

    // 4. Simular pago fallido
    console.log('\n4️⃣  PASO 4: Simular pago fallido');
    const step4 = await sendWebhook('payment_failed');
    if (step4) results.passed++; else results.failed++;
    await sleep(2000);

    // 5. Cancelar subscripción
    console.log('\n5️⃣  PASO 5: Cancelar subscripción');
    const step5 = await sendWebhook('subscription_deleted');
    if (step5) results.passed++; else results.failed++;

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('RESUMEN DE SIMULACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Exitosos: ${results.passed}/5`);
    console.log(`❌ Fallidos: ${results.failed}/5`);
    console.log('='.repeat(60));

    return results.failed === 0;
}

// Helper para pausas
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================================================
// CLI
// ==================================================

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
    console.log('\n📖 Uso:');
    console.log('  node stripe-webhook-simulator.js <evento>');
    console.log('  node stripe-webhook-simulator.js flow\n');
    console.log('Eventos disponibles:');
    Object.keys(testEvents).forEach(key => {
        console.log(`  - ${key}: ${testEvents[key].type}`);
    });
    console.log('  - flow: Simula el flujo completo\n');
    process.exit(0);
}

if (command === 'flow') {
    simulateCompleteFlow()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('\n❌ Error fatal:', error.message);
            process.exit(1);
        });
} else {
    sendWebhook(command)
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('\n❌ Error fatal:', error.message);
            process.exit(1);
        });
}
