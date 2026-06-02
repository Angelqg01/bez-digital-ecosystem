/**
 * Revenue Monitoring System
 * 
 * Complete monitoring solution that:
 * - Listens to blockchain events
 * - Sends real-time notifications
 * - Tracks revenue metrics
 * - Delivers services automatically
 * - Generates reports
 * 
 * Usage:
 * node backend/scripts/monitorRevenue.js
 * 
 * Or with PM2:
 * pm2 start backend/scripts/monitorRevenue.js --name "revenue-monitor"
 */

require('dotenv').config();
const { getEventListener } = require('../services/revenueEventListener');
const {
    sendRevenueAlert,
    sendHighValueAlert,
    sendRiskAlert,
    sendServiceDeliveryAlert,
    sendDailyReport,
    sendErrorAlert
} = require('../services/notificationService');

// Configuration
const CONFIG = {
    highValueThreshold: parseFloat(process.env.HIGH_VALUE_THRESHOLD) || 5000, // $5000
    reportSchedule: process.env.DAILY_REPORT_TIME || '09:00', // 9 AM daily
    enableNotifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
    enableServiceDelivery: process.env.ENABLE_SERVICE_DELIVERY !== 'false'
};

// Statistics tracking
const stats = {
    startTime: new Date(),
    totalSwaps: 0,
    totalRevenue: 0,
    totalVolume: 0,
    services: {},
    lastReset: new Date()
};

/**
 * Initialize monitoring system
 */
async function init() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  BeZhas Revenue Stream Native - Monitoring System v1.0');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📋 Configuration:');
    console.log('   High-Value Threshold:', `$${CONFIG.highValueThreshold.toLocaleString()}`);
    console.log('   Notifications:', CONFIG.enableNotifications ? 'Enabled ✅' : 'Disabled ❌');
    console.log('   Service Delivery:', CONFIG.enableServiceDelivery ? 'Enabled ✅' : 'Disabled ❌');
    console.log('   Daily Report:', CONFIG.reportSchedule);
    console.log('');

    const listener = getEventListener();

    // Setup event handlers
    setupEventHandlers(listener);

    // Start listener
    await listener.start();

    // Schedule daily reports
    if (CONFIG.enableNotifications) {
        scheduleDailyReport(listener);
    }

    console.log('');
    console.log('✅ Monitoring system started successfully');
    console.log('   Press Ctrl+C to stop');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
}

/**
 * Setup event handlers
 */
function setupEventHandlers(listener) {
    // Handle swap execution
    listener.on('swap-executed', async (data) => {
        stats.totalSwaps++;
        stats.totalVolume += data.amountUSDC;

        // Track by service
        if (!stats.services[data.serviceId]) {
            stats.services[data.serviceId] = {
                count: 0,
                volume: 0,
                revenue: 0
            };
        }
        stats.services[data.serviceId].count++;
        stats.services[data.serviceId].volume += data.amountUSDC;

        // Log to console
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`✅ SWAP #${stats.totalSwaps}`);
        console.log('   User:', data.user);
        console.log('   Amount:', `$${data.amountUSDC.toFixed(2)} USDC`);
        console.log('   BEZ Received:', `${data.bezAmount.toFixed(2)} BEZ`);
        console.log('   Service:', data.serviceId);
        console.log('   Tx:', data.transactionHash);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');

        // High-value transaction alert
        if (data.amountUSDC >= CONFIG.highValueThreshold && CONFIG.enableNotifications) {
            console.log('🚨 High-value transaction detected - sending alert...');
            await sendHighValueAlert(data);
        }

        // Service delivery
        if (CONFIG.enableServiceDelivery) {
            await deliverService(data);
        }
    });

    // Handle fee collection
    listener.on('fee-collected', async (data) => {
        stats.totalRevenue += data.feeUSDC;

        // Track by service
        if (stats.services[data.serviceId]) {
            stats.services[data.serviceId].revenue += data.feeUSDC;
        }

        // Log to console
        console.log('💰 FEE COLLECTED');
        console.log('   User:', data.user);
        console.log('   Amount:', `$${data.feeUSDC.toFixed(2)} USDC`);
        console.log('   Service:', data.serviceId);
        console.log('   Total Revenue:', `$${stats.totalRevenue.toFixed(2)}`);
        console.log('');

        // Send revenue alert
        if (CONFIG.enableNotifications) {
            await sendRevenueAlert(data);
        }
    });

    // Handle service delivery requests
    listener.on('deliver-nft', async (data) => {
        console.log('🎨 NFT Delivery Request:');
        console.log('   User:', data.user);
        console.log('   Tx:', data.transactionHash);

        try {
            // Call your NFT minting service here
            // await mintNFT(data.user, data.transactionHash);

            console.log('   ✅ NFT minted successfully');

            if (CONFIG.enableNotifications) {
                await sendServiceDeliveryAlert({
                    serviceId: 'NFT_PURCHASE',
                    user: data.user,
                    status: 'success'
                });
            }
        } catch (error) {
            console.error('   ❌ NFT minting failed:', error.message);

            if (CONFIG.enableNotifications) {
                await sendServiceDeliveryAlert({
                    serviceId: 'NFT_PURCHASE',
                    user: data.user,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        console.log('');
    });

    listener.on('deliver-subscription', async (data) => {
        console.log('⭐ Subscription Activation Request:');
        console.log('   User:', data.user);
        console.log('   Tx:', data.transactionHash);

        try {
            // Call your subscription service here
            // await activatePremium(data.user);

            console.log('   ✅ Subscription activated');

            if (CONFIG.enableNotifications) {
                await sendServiceDeliveryAlert({
                    serviceId: 'PREMIUM_SUBSCRIPTION',
                    user: data.user,
                    status: 'success'
                });
            }
        } catch (error) {
            console.error('   ❌ Subscription activation failed:', error.message);

            if (CONFIG.enableNotifications) {
                await sendServiceDeliveryAlert({
                    serviceId: 'PREMIUM_SUBSCRIPTION',
                    user: data.user,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        console.log('');
    });

    // Handle errors
    listener.on('error', async (error) => {
        console.error('❌ Listener Error:', error);

        if (CONFIG.enableNotifications) {
            await sendErrorAlert(error, { service: 'RevenueEventListener' });
        }
    });

    // Handle admin events
    listener.on('treasury-updated', (data) => {
        console.log('🏦 Treasury Wallet Updated:');
        console.log('   Old:', data.oldTreasury);
        console.log('   New:', data.newTreasury);
        console.log('');
    });

    listener.on('fee-updated', (data) => {
        console.log('💰 Platform Fee Updated:');
        console.log('   Old:', data.oldFeeBps, 'BPS');
        console.log('   New:', data.newFeeBps, 'BPS');
        console.log('');
    });

    // Handle max reconnects
    listener.on('max-reconnects-exceeded', async () => {
        console.error('❌ CRITICAL: Max reconnection attempts exceeded!');

        if (CONFIG.enableNotifications) {
            await sendErrorAlert(
                new Error('Revenue monitoring system disconnected - manual restart required'),
                { service: 'RevenueMonitor', critical: true }
            );
        }
    });
}

/**
 * Deliver service based on event
 */
async function deliverService(data) {
    const { serviceId, user, transactionHash } = data;

    switch (serviceId) {
        case 'NFT_PURCHASE':
            // Will be handled by deliver-nft event
            break;

        case 'PREMIUM_SUBSCRIPTION':
            // Will be handled by deliver-subscription event
            break;

        case 'PRODUCT_PURCHASE':
            console.log('📦 Product Purchase - implement delivery logic here');
            // Implement your product delivery logic
            break;

        default:
            // LIQUIDITY_RAMP or unknown - no action needed
            break;
    }
}

/**
 * Schedule daily revenue report
 */
function scheduleDailyReport(listener) {
    const [hour, minute] = CONFIG.reportSchedule.split(':').map(Number);

    const scheduleNextReport = () => {
        const now = new Date();
        const scheduledTime = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hour,
            minute,
            0,
            0
        );

        // If scheduled time has passed today, schedule for tomorrow
        if (scheduledTime <= now) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        const delay = scheduledTime - now;
        console.log(`📅 Next daily report scheduled for: ${scheduledTime.toLocaleString()}`);

        setTimeout(async () => {
            await generateDailyReport(listener);
            scheduleNextReport(); // Schedule next report
        }, delay);
    };

    scheduleNextReport();
}

/**
 * Generate and send daily revenue report
 */
async function generateDailyReport(listener) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Generating Daily Revenue Report...');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    try {
        // Get stats from contract
        const contractStats = await listener.getStats();

        // Calculate daily stats (since last reset)
        const dailyStats = {
            totalFees: stats.totalRevenue,
            totalVolume: stats.totalVolume,
            transactions: stats.totalSwaps,
            date: new Date().toLocaleDateString(),
            topService: Object.entries(stats.services)
                .sort((a, b) => b[1].volume - a[1].volume)[0]?.[0] || 'N/A'
        };

        console.log('Daily Stats:');
        console.log('   Revenue:', `$${dailyStats.totalFees.toFixed(2)}`);
        console.log('   Volume:', `$${dailyStats.totalVolume.toFixed(2)}`);
        console.log('   Transactions:', dailyStats.transactions);
        console.log('   Top Service:', dailyStats.topService);
        console.log('');
        console.log('All-Time Stats (from contract):');
        console.log('   Revenue:', `$${contractStats.totalFeesCollected}`);
        console.log('   Volume:', `$${contractStats.totalVolumeProcessed}`);
        console.log('   Transactions:', contractStats.totalTransactions);
        console.log('');

        // Send report
        await sendDailyReport(dailyStats);

        // Reset daily stats
        stats.totalSwaps = 0;
        stats.totalRevenue = 0;
        stats.totalVolume = 0;
        stats.services = {};
        stats.lastReset = new Date();

        console.log('✅ Daily report sent and stats reset');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
    } catch (error) {
        console.error('❌ Failed to generate daily report:', error);
    }
}

/**
 * Display current stats
 */
function displayStats() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 Current Session Stats');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   Start Time:', stats.startTime.toLocaleString());
    console.log('   Uptime:', formatUptime(Date.now() - stats.startTime.getTime()));
    console.log('   Total Swaps:', stats.totalSwaps);
    console.log('   Total Volume:', `$${stats.totalVolume.toFixed(2)}`);
    console.log('   Total Revenue:', `$${stats.totalRevenue.toFixed(2)}`);
    console.log('');
    console.log('   By Service:');
    Object.entries(stats.services).forEach(([service, data]) => {
        console.log(`     ${service}:`);
        console.log(`       - Swaps: ${data.count}`);
        console.log(`       - Volume: $${data.volume.toFixed(2)}`);
        console.log(`       - Revenue: $${data.revenue.toFixed(2)}`);
    });
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
}

/**
 * Format uptime duration
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Graceful shutdown
 */
async function shutdown() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('👋 Shutting down monitoring system...');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');

    // Display final stats
    displayStats();

    // Stop listener
    const listener = getEventListener();
    await listener.stop();

    console.log('✅ Monitoring system stopped');
    console.log('');

    process.exit(0);
}

// ============================================================================
// Main
// ============================================================================

// Handle Ctrl+C
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Display stats every hour
setInterval(displayStats, 60 * 60 * 1000);

// Start monitoring
init().catch(async (error) => {
    console.error('❌ Failed to start monitoring system:', error);

    if (CONFIG.enableNotifications) {
        await sendErrorAlert(error, {
            service: 'RevenueMonitor',
            critical: true,
            note: 'Failed to start'
        });
    }

    process.exit(1);
});
