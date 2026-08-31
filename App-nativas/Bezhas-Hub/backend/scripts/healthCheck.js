#!/usr/bin/env node

/**
 * Automated Health Check Script
 * 
 * Ejecuta checks automáticos cada N minutos y envía alertas si algo falla.
 * Ideal para correr como cron job o con PM2.
 * 
 * Usage:
 *   node backend/scripts/healthCheck.js
 *   
 * Cron (cada 5 minutos):
 *   */5 * * * * /usr/bin / node / path / to / backend / scripts / healthCheck.js >> /var/log / bezhas - health.log 2 >& 1
    */

require('dotenv').config({ path: './backend/.env' });
const { ethers } = require('ethers');
const { getEventListener } = require('../services/revenueEventListener');
const { notificationService } = require('../services/notificationService');
const axios = require('axios');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    const timestamp = new Date().toISOString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Track failures for alerting
const healthState = {
    consecutiveFailures: 0,
    lastSuccessfulCheck: new Date(),
    alertSent: false
};

async function checkRPCConnection() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
        const blockNumber = await provider.getBlockNumber();

        if (blockNumber > 0) {
            log(`✓ RPC Connection: OK (Block ${blockNumber})`, 'green');
            return { status: 'ok', blockNumber };
        }

        throw new Error('Invalid block number');
    } catch (error) {
        log(`✗ RPC Connection: FAILED - ${error.message}`, 'red');
        return { status: 'failed', error: error.message };
    }
}

async function checkContractStatus() {
    try {
        const listener = getEventListener();
        await listener.initialize();
        const stats = await listener.getStats();

        log(`✓ Contract Status: OK`, 'green');
        log(`  Total Volume: $${ethers.formatUnits(stats.totalVolume, 6)}`, 'blue');
        log(`  Total Fees: $${ethers.formatUnits(stats.totalFees, 6)}`, 'blue');
        log(`  Total Swaps: ${stats.totalSwaps.toString()}`, 'blue');

        await listener.stop();

        return {
            status: 'ok',
            stats: {
                totalVolume: stats.totalVolume.toString(),
                totalFees: stats.totalFees.toString(),
                totalSwaps: stats.totalSwaps.toString()
            }
        };
    } catch (error) {
        log(`✗ Contract Status: FAILED - ${error.message}`, 'red');
        return { status: 'failed', error: error.message };
    }
}

async function checkMonitorProcess() {
    try {
        // Check if monitoring process is running (PM2)
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);

        const monitor = processes.find(p => p.name === 'revenue-monitor');

        if (monitor && monitor.pm2_env.status === 'online') {
            const uptime = Math.floor((Date.now() - monitor.pm2_env.pm_uptime) / 1000);
            log(`✓ Monitor Process: OK (Uptime: ${uptime}s)`, 'green');
            return { status: 'ok', uptime };
        }

        throw new Error('Monitor process not running');
    } catch (error) {
        log(`✗ Monitor Process: FAILED - ${error.message}`, 'red');
        return { status: 'failed', error: error.message };
    }
}

async function checkAPIEndpoint() {
    try {
        const apiUrl = process.env.API_URL || 'http://localhost:5000';
        const response = await axios.get(`${apiUrl}/api/monitoring/health`, {
            timeout: 5000
        });

        if (response.data.status === 'healthy') {
            log(`✓ API Endpoint: OK`, 'green');
            return { status: 'ok', data: response.data };
        }

        throw new Error(`API unhealthy: ${response.data.status}`);
    } catch (error) {
        log(`✗ API Endpoint: FAILED - ${error.message}`, 'red');
        return { status: 'failed', error: error.message };
    }
}

async function checkDiskSpace() {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const { stdout } = await execAsync('df -h /');
        const lines = stdout.split('\n');
        const dataLine = lines[1];
        const parts = dataLine.split(/\s+/);
        const usagePercent = parseInt(parts[4]);

        if (usagePercent < 90) {
            log(`✓ Disk Space: OK (${usagePercent}% used)`, 'green');
            return { status: 'ok', usage: usagePercent };
        } else if (usagePercent < 95) {
            log(`⚠ Disk Space: WARNING (${usagePercent}% used)`, 'yellow');
            return { status: 'warning', usage: usagePercent };
        }

        throw new Error(`Disk space critical: ${usagePercent}% used`);
    } catch (error) {
        log(`✗ Disk Space: FAILED - ${error.message}`, 'red');
        return { status: 'failed', error: error.message };
    }
}

async function checkMemoryUsage() {
    try {
        const used = process.memoryUsage();
        const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
        const usagePercent = Math.round((heapUsedMB / heapTotalMB) * 100);

        if (usagePercent < 80) {
            log(`✓ Memory Usage: OK (${heapUsedMB}MB / ${heapTotalMB}MB)`, 'green');
            return { status: 'ok', heapUsedMB, heapTotalMB };
        } else if (usagePercent < 90) {
            log(`⚠ Memory Usage: WARNING (${heapUsedMB}MB / ${heapTotalMB}MB)`, 'yellow');
            return { status: 'warning', heapUsedMB, heapTotalMB };
        }

        throw new Error(`Memory usage critical: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    } catch (error) {
        log(`✗ Memory Usage: FAILED - ${error.message}`, 'red');
        return { status: 'failed', error: error.message };
    }
}

async function checkRecentActivity() {
    try {
        const listener = getEventListener();
        await listener.initialize();

        const events = await listener.queryHistoricalEvents(
            'PlatformFeeCollected',
            -1000, // Last 1000 blocks (~30 minutes)
            'latest'
        );

        const recentEvents = events.filter(e => {
            const blockTime = Date.now() - (1000 * 60 * 30); // 30 min ago
            return e.blockNumber > blockTime;
        });

        log(`✓ Recent Activity: ${recentEvents.length} events in last 30 min`, 'green');

        await listener.stop();

        return { status: 'ok', eventCount: recentEvents.length };
    } catch (error) {
        log(`✗ Recent Activity: FAILED - ${error.message}`, 'red');
        return { status: 'failed', error: error.message };
    }
}

async function sendHealthAlert(results) {
    const failedChecks = Object.entries(results)
        .filter(([_, result]) => result.status === 'failed')
        .map(([check, result]) => ({ check, error: result.error }));

    if (failedChecks.length === 0) return;

    const alertMessage = {
        title: '🚨 Health Check Failed',
        description: `${failedChecks.length} check(s) failed`,
        color: 0xef4444,
        fields: failedChecks.map(({ check, error }) => ({
            name: check,
            value: error || 'Unknown error'
        })),
        footer: `Health check at ${new Date().toISOString()}`
    };

    try {
        await notificationService.sendAlert(alertMessage, ['discord', 'slack']);
        log('✓ Alert sent to notification channels', 'cyan');
    } catch (error) {
        log(`✗ Failed to send alert: ${error.message}`, 'red');
    }
}

async function runHealthChecks() {
    log('═══════════════════════════════════════════════════════════', 'cyan');
    log('  BeZhas Revenue Stream - Health Check', 'cyan');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    const results = {
        rpcConnection: await checkRPCConnection(),
        contractStatus: await checkContractStatus(),
        monitorProcess: await checkMonitorProcess(),
        apiEndpoint: await checkAPIEndpoint(),
        diskSpace: await checkDiskSpace(),
        memoryUsage: await checkMemoryUsage(),
        recentActivity: await checkRecentActivity()
    };

    // Count failures
    const failedCount = Object.values(results).filter(r => r.status === 'failed').length;
    const warningCount = Object.values(results).filter(r => r.status === 'warning').length;
    const okCount = Object.values(results).filter(r => r.status === 'ok').length;

    log('───────────────────────────────────────────────────────────', 'cyan');
    log(`Summary: ${okCount} OK | ${warningCount} Warning | ${failedCount} Failed`, failedCount > 0 ? 'red' : 'green');
    log('═══════════════════════════════════════════════════════════', 'cyan');

    // Alert logic
    if (failedCount > 0) {
        healthState.consecutiveFailures++;

        // Send alert after 2 consecutive failures (10 minutes)
        if (healthState.consecutiveFailures >= 2 && !healthState.alertSent) {
            log('⚠ Multiple consecutive failures detected. Sending alert...', 'yellow');
            await sendHealthAlert(results);
            healthState.alertSent = true;
        }
    } else {
        // Reset on success
        if (healthState.alertSent) {
            // Send recovery notification
            await notificationService.sendDiscord({
                title: '✅ System Recovered',
                description: 'All health checks passing',
                color: 0x10b981
            });
            log('✓ Recovery notification sent', 'green');
        }

        healthState.consecutiveFailures = 0;
        healthState.alertSent = false;
        healthState.lastSuccessfulCheck = new Date();
    }

    // Exit with appropriate code
    process.exit(failedCount > 0 ? 1 : 0);
}

// Run checks
runHealthChecks().catch(error => {
    log(`\n✗ Health check failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
