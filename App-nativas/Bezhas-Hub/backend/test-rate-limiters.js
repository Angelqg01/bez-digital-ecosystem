/**
 * ============================================================================
 * TEST RATE LIMITERS - Advanced & Message Rate Limiters
 * ============================================================================
 * 
 * Script para verificar los rate limiters avanzados
 */

const AdvancedRateLimiter = require('./middleware/advancedRateLimiter');
const MessageRateLimiter = require('./middleware/messageRateLimiter');

console.log('\n🧪 Testing Rate Limiters...\n');

// Función helper para delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testAdvancedRateLimiter() {
    console.log('═══════════════════════════════════════════════════');
    console.log('1️⃣  Testing Advanced Rate Limiter');
    console.log('═══════════════════════════════════════════════════\n');

    const rateLimiter = new AdvancedRateLimiter({
        enabled: true
    });

    // Esperar conexión Redis
    await delay(1000);

    const testUser = 'test-user-123';

    // Test 1: Verificar endpoint limit
    console.log('✓ Test 1: Endpoint Rate Limit (/api/chat/send)');

    for (let i = 1; i <= 7; i++) {
        const limited = await rateLimiter.isRateLimited(testUser, '/api/chat/send');
        console.log(`  Request ${i}: ${limited ? '❌ BLOCKED' : '✅ ALLOWED'}`);

        if (!limited) {
            // Simular request
            const key = `ratelimit:endpoint:/api/chat/send:${testUser}`;
            await rateLimiter.redis.zadd(key, Date.now(), `${Date.now()}-${Math.random()}`);
            await rateLimiter.redis.expire(key, 2);
        }

        await delay(100); // 100ms entre requests
    }

    await delay(1000); // Esperar 1 segundo para reset

    // Test 2: Estadísticas de usuario
    console.log('\n✓ Test 2: User Statistics');
    const stats = await rateLimiter.getUserStats(testUser);
    console.log('  Stats:', JSON.stringify(stats, null, 2));

    // Test 3: Reset de límites
    console.log('\n✓ Test 3: Reset User Limits');
    const resetCount = await rateLimiter.resetUserLimit(testUser);
    console.log(`  Keys deleted: ${resetCount}`);

    await rateLimiter.disconnect();
    console.log('\n✅ Advanced Rate Limiter tests completed!\n');
}

async function testMessageRateLimiter() {
    console.log('═══════════════════════════════════════════════════');
    console.log('2️⃣  Testing Message Rate Limiter');
    console.log('═══════════════════════════════════════════════════\n');

    const msgLimiter = new MessageRateLimiter({
        enabled: true,
        baseLimit: 5,     // 5 msg/sec para testing
        burstLimit: 10    // 10 msg/10sec
    });

    // Esperar conexión Redis
    await delay(1000);

    const testUser = 'test-user-456';

    // Test 1: Base limit (5 msg/sec)
    console.log('✓ Test 1: Base Limit (5 messages/second)');

    for (let i = 1; i <= 7; i++) {
        const result = await msgLimiter.canSendMessage(testUser, 'default', 1);
        console.log(`  Message ${i}: ${result.allowed ? '✅ ALLOWED' : '❌ BLOCKED - ' + result.message}`);
        await delay(150); // 150ms entre mensajes
    }

    // Esperar reset
    await delay(1500);

    // Test 2: Burst limit
    console.log('\n✓ Test 2: Burst Limit (10 messages/10 seconds)');

    for (let i = 1; i <= 12; i++) {
        const result = await msgLimiter.canSendMessage(testUser, 'default', 1);
        console.log(`  Message ${i}: ${result.allowed ? '✅ ALLOWED' : '❌ BLOCKED - ' + result.message}`);
        await delay(100);
    }

    // Test 3: Model-specific limits (GPT-4)
    console.log('\n✓ Test 3: Model Limit (GPT-4 credits)');

    for (let i = 1; i <= 3; i++) {
        const result = await msgLimiter.canSendMessage(testUser, 'gpt-4', 20);
        console.log(`  GPT-4 Request ${i} (20 credits): ${result.allowed ? '✅ ALLOWED' : '❌ BLOCKED - ' + result.message}`);
        await delay(500);
    }

    // Test 4: Estadísticas
    console.log('\n✓ Test 4: User Statistics');
    const stats = await msgLimiter.getUserStats(testUser);
    console.log('  Stats:', JSON.stringify(stats, null, 2));

    // Test 5: Reset
    console.log('\n✓ Test 5: Reset User Limits');
    const resetCount = await msgLimiter.resetUserLimits(testUser, 'admin-test');
    console.log(`  Keys deleted: ${resetCount}`);

    await msgLimiter.disconnect();
    console.log('\n✅ Message Rate Limiter tests completed!\n');
}

async function testPenaltySystem() {
    console.log('═══════════════════════════════════════════════════');
    console.log('3️⃣  Testing Penalty System');
    console.log('═══════════════════════════════════════════════════\n');

    const msgLimiter = new MessageRateLimiter({
        enabled: true,
        baseLimit: 2,     // Límite muy bajo para testing
        penalties: {
            enabled: true,
            threshold: 5,
            penaltyDuration: 5000 // 5 segundos para testing
        }
    });

    await delay(1000);

    const spamUser = 'spam-user-789';

    console.log('✓ Simulating spam behavior...');

    // Enviar muchos mensajes rápidamente
    for (let i = 1; i <= 15; i++) {
        const result = await msgLimiter.canSendMessage(spamUser, 'default', 1);
        if (!result.allowed && result.reason === 'penalty') {
            console.log(`  ⚠️  PENALTY APPLIED after ${i} attempts`);
            console.log(`     Message: ${result.message}`);
            console.log(`     Retry after: ${result.retryAfter}s`);
            break;
        }
        await delay(50);
    }

    // Verificar que está penalizado
    console.log('\n✓ Verifying penalty is active...');
    const result = await msgLimiter.canSendMessage(spamUser, 'default', 1);
    console.log(`  Penalty active: ${!result.allowed && result.reason === 'penalty' ? '✅ YES' : '❌ NO'}`);

    // Esperar que expire
    console.log('\n✓ Waiting for penalty to expire (5 seconds)...');
    await delay(5500);

    const afterPenalty = await msgLimiter.canSendMessage(spamUser, 'default', 1);
    console.log(`  Can send after penalty: ${afterPenalty.allowed ? '✅ YES' : '❌ NO'}`);

    await msgLimiter.resetUserLimits(spamUser, 'admin-test');
    await msgLimiter.disconnect();

    console.log('\n✅ Penalty System tests completed!\n');
}

// Ejecutar todos los tests
(async () => {
    try {
        await testAdvancedRateLimiter();
        await testMessageRateLimiter();
        await testPenaltySystem();

        console.log('═══════════════════════════════════════════════════');
        console.log('🎉 All Rate Limiter Tests Completed Successfully!');
        console.log('═══════════════════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
})();
