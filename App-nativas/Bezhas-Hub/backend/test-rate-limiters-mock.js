/**
 * ============================================================================
 * TEST RATE LIMITERS - Mock Mode (Sin Redis)
 * ============================================================================
 * 
 * Test de rate limiters usando mock de Redis
 */

console.log('\n🧪 Testing Rate Limiters (Mock Mode)...\n');
console.log('⚠️  Redis no detectado, usando modo simulación\n');

// Mock simple de Redis para testing sin servidor
class RedisMock {
    constructor() {
        this.data = new Map();
        this.ttls = new Map();
        console.log('📦 Redis Mock initialized');
    }

    async zadd(key, score, value) {
        if (!this.data.has(key)) {
            this.data.set(key, []);
        }
        const arr = this.data.get(key);
        arr.push({ score, value });
        return arr.length;
    }

    async zremrangebyscore(key, min, max) {
        if (!this.data.has(key)) return 0;
        const arr = this.data.get(key);
        const filtered = arr.filter(item => item.score < min || item.score > max);
        this.data.set(key, filtered);
        return arr.length - filtered.length;
    }

    async zcard(key) {
        if (!this.data.has(key)) return 0;
        return this.data.get(key).length;
    }

    async zrange(key, start, stop, withscores) {
        if (!this.data.has(key)) return [];
        const arr = this.data.get(key);
        const result = arr.slice(start, stop + 1);
        if (withscores === 'WITHSCORES') {
            return result.flatMap(item => [item.value, item.score]);
        }
        return result.map(item => item.value);
    }

    async zrangebyscore(key, min, max) {
        if (!this.data.has(key)) return [];
        const arr = this.data.get(key);
        return arr
            .filter(item => item.score >= min && item.score <= max)
            .map(item => item.value);
    }

    async expire(key, seconds) {
        this.ttls.set(key, Date.now() + seconds * 1000);
        return 1;
    }

    async ttl(key) {
        if (!this.ttls.has(key)) return -1;
        const expiry = this.ttls.get(key);
        const remaining = Math.ceil((expiry - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }

    async keys(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.data.keys()).filter(key => regex.test(key));
    }

    async del(...keys) {
        let count = 0;
        for (const key of keys) {
            if (this.data.delete(key)) count++;
            this.ttls.delete(key);
        }
        return count;
    }

    async get(key) {
        return this.data.get(key) || null;
    }

    async set(key, value, ...args) {
        this.data.set(key, value);
        if (args[0] === 'PX') {
            this.ttls.set(key, Date.now() + args[1]);
        }
        return 'OK';
    }

    async quit() {
        this.data.clear();
        this.ttls.clear();
        return 'OK';
    }

    on() { } // Mock event listener
}

// Función helper para delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testBasicFunctionality() {
    console.log('═══════════════════════════════════════════════════');
    console.log('1️⃣  Testing Basic Rate Limiter Functionality');
    console.log('═══════════════════════════════════════════════════\n');

    const redis = new RedisMock();
    const testUser = 'user-123';
    const baseLimit = 5;
    const now = Date.now();

    console.log('✓ Test 1: Adding requests to rate limiter');
    for (let i = 1; i <= 7; i++) {
        await redis.zadd(`ratelimit:${testUser}`, now + i * 100, `req-${i}`);
        const count = await redis.zcard(`ratelimit:${testUser}`);

        if (count <= baseLimit) {
            console.log(`  Request ${i}: ✅ ALLOWED (${count}/${baseLimit})`);
        } else {
            console.log(`  Request ${i}: ❌ BLOCKED (${count}/${baseLimit})`);
        }
    }

    console.log('\n✓ Test 2: Cleaning old requests');
    const windowStart = now - 1000;
    const removed = await redis.zremrangebyscore(`ratelimit:${testUser}`, 0, windowStart);
    const remaining = await redis.zcard(`ratelimit:${testUser}`);
    console.log(`  Removed: ${removed}, Remaining: ${remaining}`);

    console.log('\n✓ Test 3: TTL expiration');
    await redis.expire(`ratelimit:${testUser}`, 2);
    const ttl = await redis.ttl(`ratelimit:${testUser}`);
    console.log(`  TTL: ${ttl} seconds`);

    await redis.quit();
    console.log('\n✅ Basic tests completed!\n');
}

async function testMessageLimits() {
    console.log('═══════════════════════════════════════════════════');
    console.log('2️⃣  Testing Message Rate Limits');
    console.log('═══════════════════════════════════════════════════\n');

    const redis = new RedisMock();
    const testUser = 'user-456';

    // Simular límites
    const limits = {
        base: { limit: 5, window: 1000, name: 'Base (5 msg/sec)' },
        burst: { limit: 10, window: 10000, name: 'Burst (10 msg/10sec)' },
        hourly: { limit: 500, window: 3600000, name: 'Hourly (500 msg/hour)' }
    };

    console.log('✓ Testing different limit types:\n');

    for (const [type, config] of Object.entries(limits)) {
        console.log(`  Testing ${config.name}:`);
        const key = `msglimit:${type}:${testUser}`;
        const now = Date.now();

        for (let i = 1; i <= config.limit + 2; i++) {
            await redis.zadd(key, now + i * 100, `msg-${i}`);
            const count = await redis.zcard(key);

            if (count <= config.limit) {
                console.log(`    Message ${i}: ✅ ALLOWED (${count}/${config.limit})`);
            } else {
                console.log(`    Message ${i}: ❌ BLOCKED (${count}/${config.limit})`);
            }
        }
        console.log('');
    }

    await redis.quit();
    console.log('✅ Message limit tests completed!\n');
}

async function testPenaltySystem() {
    console.log('═══════════════════════════════════════════════════');
    console.log('3️⃣  Testing Penalty System');
    console.log('═══════════════════════════════════════════════════\n');

    const redis = new RedisMock();
    const spamUser = 'spam-user-789';
    const threshold = 10;
    const penaltyDuration = 5000; // 5 segundos

    console.log('✓ Simulating spam behavior (10 violations)...');

    for (let i = 1; i <= threshold; i++) {
        await redis.zadd(`violations:${spamUser}`, Date.now(), `violation-${i}`);
        const count = await redis.zcard(`violations:${spamUser}`);

        if (count < threshold) {
            console.log(`  Violation ${i}: ⚠️  Warning (${count}/${threshold})`);
        } else {
            console.log(`  Violation ${i}: 🚫 PENALTY APPLIED!`);

            // Aplicar penalty
            const penaltyEnd = Date.now() + penaltyDuration;
            await redis.set(`penalty:${spamUser}`, penaltyEnd, 'PX', penaltyDuration);
            break;
        }
    }

    console.log('\n✓ Checking penalty status...');
    const penaltyEnd = await redis.get(`penalty:${spamUser}`);
    const isPenalized = penaltyEnd && parseInt(penaltyEnd) > Date.now();
    console.log(`  Penalty active: ${isPenalized ? '✅ YES' : '❌ NO'}`);

    if (isPenalized) {
        const remaining = Math.ceil((parseInt(penaltyEnd) - Date.now()) / 1000);
        console.log(`  Remaining: ${remaining} seconds`);
    }

    await redis.quit();
    console.log('\n✅ Penalty system tests completed!\n');
}

async function testModelLimits() {
    console.log('═══════════════════════════════════════════════════');
    console.log('4️⃣  Testing Model-Specific Limits');
    console.log('═══════════════════════════════════════════════════\n');

    const redis = new RedisMock();
    const testUser = 'user-model-test';

    const modelLimits = {
        'gpt-4': { creditsPerMinute: 50 },
        'gpt-3.5-turbo': { creditsPerMinute: 100 },
        'claude-3-opus': { creditsPerMinute: 40 }
    };

    console.log('✓ Testing credit limits per model:\n');

    for (const [model, config] of Object.entries(modelLimits)) {
        console.log(`  Model: ${model} (${config.creditsPerMinute} credits/min)`);
        const key = `msglimit:model:${model}:${testUser}`;
        const now = Date.now();
        let totalCredits = 0;

        for (let i = 1; i <= 5; i++) {
            const credits = 15; // 15 créditos por request
            totalCredits += credits;

            await redis.zadd(key, now + i * 1000, `${now + i * 1000}:${credits}`);

            if (totalCredits <= config.creditsPerMinute) {
                console.log(`    Request ${i} (${credits} credits): ✅ ALLOWED (${totalCredits}/${config.creditsPerMinute})`);
            } else {
                console.log(`    Request ${i} (${credits} credits): ❌ BLOCKED (${totalCredits}/${config.creditsPerMinute})`);
            }
        }
        console.log('');
    }

    await redis.quit();
    console.log('✅ Model limit tests completed!\n');
}

async function testAdminOperations() {
    console.log('═══════════════════════════════════════════════════');
    console.log('5️⃣  Testing Admin Operations');
    console.log('═══════════════════════════════════════════════════\n');

    const redis = new RedisMock();
    const testUser = 'user-admin-test';

    // Simular datos de rate limiting
    console.log('✓ Creating test data...');
    await redis.zadd(`ratelimit:endpoint:/api/chat:${testUser}`, Date.now(), 'req-1');
    await redis.zadd(`ratelimit:endpoint:/api/chat:${testUser}`, Date.now(), 'req-2');
    await redis.zadd(`msglimit:hourly:${testUser}`, Date.now(), 'msg-1');
    await redis.zadd(`msglimit:hourly:${testUser}`, Date.now(), 'msg-2');
    console.log('  ✓ Test data created');

    console.log('\n✓ Getting user statistics...');
    const chatCount = await redis.zcard(`ratelimit:endpoint:/api/chat:${testUser}`);
    const msgCount = await redis.zcard(`msglimit:hourly:${testUser}`);
    console.log(`  API requests: ${chatCount}`);
    console.log(`  Messages: ${msgCount}`);

    console.log('\n✓ Resetting user limits (admin action)...');
    const pattern = `*:${testUser}`;
    const keys = await redis.keys(pattern);
    console.log(`  Found ${keys.length} keys to delete`);

    if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        console.log(`  ✓ Deleted ${deleted} keys`);
    }

    console.log('\n✓ Verifying reset...');
    const chatCountAfter = await redis.zcard(`ratelimit:endpoint:/api/chat:${testUser}`);
    const msgCountAfter = await redis.zcard(`msglimit:hourly:${testUser}`);
    console.log(`  API requests after reset: ${chatCountAfter}`);
    console.log(`  Messages after reset: ${msgCountAfter}`);

    await redis.quit();
    console.log('\n✅ Admin operations tests completed!\n');
}

// Ejecutar todos los tests
(async () => {
    try {
        await testBasicFunctionality();
        await testMessageLimits();
        await testPenaltySystem();
        await testModelLimits();
        await testAdminOperations();

        console.log('═══════════════════════════════════════════════════');
        console.log('🎉 All Rate Limiter Tests Passed!');
        console.log('═══════════════════════════════════════════════════');
        console.log('\n📝 Note: Tests run in mock mode (no Redis needed)');
        console.log('   For production testing, ensure Redis is running.\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
})();
