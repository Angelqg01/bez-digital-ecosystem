require('dotenv').config({ path: './backend/.env' });
const { queueValidation, getQueueStats } = require('../backend/services/validationQueue.service');

async function test() {
    console.log('🧪 Testing Validation Queue Connection...');

    // Check if Redis is configured
    if (!process.env.REDIS_URL && (!process.env.REDIS_HOST)) {
        console.warn('⚠️  REDIS_URL or REDIS_HOST not set in .env. Queue might be disabled.');
    }

    try {
        console.log('Add validation job...');
        const result = await queueValidation({
            contentHash: '0x' + Array(64).fill('a').join(''),
            authorAddress: '0x1234567890123456789012345678901234567890',
            contentUri: 'ipfs://QmTest123',
            contentType: 'POST',
            paymentSessionId: 'sess_test_123',
            paymentAmount: '10',
            paymentCurrency: 'BEZ'
        });

        console.log('✅ Job added successfully:', result);

        console.log('Waiting 1s for status...');
        await new Promise(r => setTimeout(r, 1000));

        // Check stats
        try {
            const stats = await getQueueStats();
            console.log('📊 Queue Stats:', stats);
        } catch (e) {
            console.log('Could not get stats (maybe queue is disabled/mocked)');
        }

    } catch (e) {
        console.error('❌ Error testing validation queue:', e.message);
        if (e.message.includes('ECONNREFUSED')) {
            console.log('👉 Hint: Is Redis running? (`docker compose up -d redis`)');
        }
    }
    process.exit(0);
}

test();
