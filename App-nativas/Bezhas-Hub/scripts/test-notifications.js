/**
 * Test de sistemas de notificación
 * Discord + Telegram
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const discord = require('../backend/middleware/discordNotifier');
const telegram = require('../backend/middleware/telegramNotifier');

console.log('🧪 Testing Notification Systems\n');
console.log('='.repeat(60));

async function testNotifications() {
    console.log('\n📊 Configuration:');
    console.log('Discord Webhook:', process.env.DISCORD_WEBHOOK_URL ? '✅ Configured' : '❌ Missing');
    console.log('Telegram Bot Token:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Missing');
    console.log('Telegram Chat ID:', process.env.TELEGRAM_SECURITY_CHAT_ID ? '✅ Configured' : '⚠️  Not set (notifications disabled)');

    console.log('\n' + '='.repeat(60));
    console.log('\n🔔 Testing Discord Notifications...\n');

    // Test Discord
    try {
        const discordResult = await discord.notifyMedium(
            'TEST_NOTIFICATION',
            'Sistema de alertas BeZhas - Test de Discord',
            [
                { name: 'Timestamp', value: new Date().toISOString() },
                { name: 'Status', value: 'Funcionando correctamente ✅' }
            ]
        );

        if (discordResult.success) {
            console.log('✅ Discord: Notificación enviada exitosamente');
        } else {
            console.log(`⚠️  Discord: ${discordResult.reason}`);
        }
    } catch (error) {
        console.error('❌ Discord Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📱 Testing Telegram Notifications...\n');

    // Test Telegram
    try {
        const telegramResult = await telegram.testTelegramNotification();

        if (telegramResult.success) {
            console.log('✅ Telegram: Notificación enviada exitosamente');
            console.log(`   Message ID: ${telegramResult.messageId}`);
        } else {
            console.log(`⚠️  Telegram: ${telegramResult.reason}`);
            if (telegramResult.reason === 'no_chat_id') {
                console.log('\n💡 Para habilitar Telegram:');
                console.log('   1. Busca @BeZhasNotificationBot en Telegram');
                console.log('   2. Envía /start');
                console.log('   3. Envía /chatid para obtener tu Chat ID');
                console.log('   4. Agrega TELEGRAM_SECURITY_CHAT_ID="tu_chat_id" al .env');
            }
        }
    } catch (error) {
        console.error('❌ Telegram Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🧪 Probando alertas de pago...\n');

    // Test Payment Success
    try {
        await discord.notifyPaymentSuccess(
            '0x1234...5678',
            100,
            'USD',
            '0xabcd...ef01'
        );

        if (process.env.TELEGRAM_SECURITY_CHAT_ID) {
            await telegram.notifyPaymentSuccess(
                100,
                'USD',
                '0x1234...5678',
                '0xabcd...ef01'
            );
        }

        console.log('✅ Alertas de pago exitoso enviadas');
    } catch (error) {
        console.error('❌ Error en alertas de pago:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✨ Tests completados!\n');

    // Resumen
    console.log('📋 Resumen:');
    console.log(`   Discord: ${process.env.DISCORD_WEBHOOK_URL ? '✅ Activo' : '❌ Inactivo'}`);
    console.log(`   Telegram: ${process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_SECURITY_CHAT_ID ? '✅ Activo' : '⚠️  Configuración incompleta'}`);
    console.log('');
}

testNotifications().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});
