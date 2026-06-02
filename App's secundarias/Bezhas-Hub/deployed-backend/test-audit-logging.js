/**
 * ============================================================================
 * TEST AUDIT LOGGING SYSTEM
 * ============================================================================
 * 
 * Script para verificar que el sistema de audit logging funciona correctamente
 */

const { audit, logger } = require('./middleware/auditLogger');
const path = require('path');
const fs = require('fs');

console.log('\n🔍 Testing Audit Logging System...\n');

// 1. Test logger básico
logger.info('Sistema de logging iniciado');
logger.warn('Este es un warning de prueba');
logger.error('Este es un error de prueba');

// 2. Test audit.auth
console.log('✓ Testing audit.auth...');
audit.auth('LOGIN_SUCCESS', 'user123', {
    ip: '192.168.1.1',
    method: 'wallet',
    wallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
});

audit.auth('LOGIN_FAILED', 'user456', {
    ip: '192.168.1.2',
    reason: 'Invalid signature'
});

// 3. Test audit.admin
console.log('✓ Testing audit.admin...');
audit.admin('USER_BANNED', 'admin001', 'user789', {
    reason: 'Spam violation',
    duration: '7 days'
});

audit.admin('CONFIG_UPDATED', 'admin002', 'server', {
    setting: 'rate_limit',
    oldValue: 100,
    newValue: 150
});

// 4. Test audit.transaction
console.log('✓ Testing audit.transaction...');
audit.transaction('STAKE', 'user123', 1000, '0xabc123...', {
    poolId: 5,
    poolName: 'BeZhas Pool #5'
});

audit.transaction('UNSTAKE', 'user456', 500, '0xdef456...', {
    poolId: 3,
    rewards: 50
});

// 5. Test audit.dao
console.log('✓ Testing audit.dao...');
audit.dao('PROPOSAL_CREATED', 'user123', 'prop001', {
    title: 'Increase staking rewards',
    requiredVotes: 1000
});

audit.dao('VOTE_CAST', 'user456', 'prop001', {
    vote: 'yes',
    votingPower: 500
});

// 6. Test audit.chat
console.log('✓ Testing audit.chat...');
audit.chat('MESSAGE_SENT', 'user123', 5, {
    modelUsed: 'gpt-4',
    messageLength: 150
});

audit.chat('CREDITS_PURCHASED', 'user456', 0, {
    creditsBought: 100,
    amount: 10,
    currency: 'MATIC'
});

// 7. Test audit.security
console.log('✓ Testing audit.security...');
audit.security('RATE_LIMIT_EXCEEDED', 'high', {
    userId: 'user789',
    endpoint: '/api/chat',
    attempts: 150,
    limit: 100
});

audit.security('INVALID_JWT', 'medium', {
    token: 'eyJ...(truncated)',
    ip: '192.168.1.5',
    reason: 'Token expired'
});

audit.security('SQL_INJECTION_ATTEMPT', 'critical', {
    ip: '192.168.1.10',
    payload: "SELECT * FROM users; DROP TABLE--",
    endpoint: '/api/search'
});

// 8. Test audit.accessDenied
console.log('✓ Testing audit.accessDenied...');
audit.accessDenied('/admin/users', 'user123', 'Not an admin', {
    attemptedAction: 'View user list'
});

// 9. Test audit.configChange
console.log('✓ Testing audit.configChange...');
audit.configChange(
    'MAX_STAKE_AMOUNT',
    10000,
    15000,
    'admin001',
    { reason: 'Community vote passed' }
);

console.log('\n✅ Audit logging tests completed!\n');

// Verificar archivos de log
const logsDir = path.join(__dirname, 'logs');

setTimeout(() => {
    console.log('📁 Checking log files...\n');

    try {
        const files = fs.readdirSync(logsDir);

        files.forEach(file => {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);
            console.log(`  ✓ ${file} - ${stats.size} bytes`);
        });

        console.log('\n📋 Sample from combined.log:\n');
        const combinedLog = path.join(logsDir, 'combined.log');

        if (fs.existsSync(combinedLog)) {
            const content = fs.readFileSync(combinedLog, 'utf-8');
            const lines = content.trim().split('\n');

            // Mostrar últimas 5 líneas
            const lastLines = lines.slice(-5);
            lastLines.forEach(line => {
                try {
                    const parsed = JSON.parse(line);
                    console.log(`  ${parsed.timestamp} [${parsed.level}] ${parsed.message || parsed.action || 'LOG'}`);
                } catch (e) {
                    console.log(`  ${line.substring(0, 80)}...`);
                }
            });
        }

        console.log('\n🎉 All systems operational!\n');
    } catch (error) {
        console.error('❌ Error checking logs:', error.message);
    }
}, 1000);
