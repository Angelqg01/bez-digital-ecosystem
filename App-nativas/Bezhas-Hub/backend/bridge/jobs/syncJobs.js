/**
 * Sync Jobs - Scheduled Background Synchronization
 * 
 * Handles periodic synchronization tasks with external platforms.
 * Uses node-cron for scheduling.
 */

const cron = require('node-cron');
const logger = require('../../utils/logger');
const { bridgeCore } = require('../core/bridgeCore');

// Job registry
const jobs = new Map();

/**
 * Initialize all sync jobs
 */
function initializeSyncJobs() {
    logger.info('🕐 Initializing Bridge Sync Jobs...');

    // Inventory sync every 15 minutes
    registerJob('inventory-sync', '*/15 * * * *', async () => {
        logger.info('Running scheduled inventory sync...');
        try {
            const results = await bridgeCore.syncAllInventory();
            logger.info({ results }, 'Scheduled inventory sync completed');
        } catch (error) {
            logger.error({ error }, 'Scheduled inventory sync failed');
        }
    });

    // Health check every 5 minutes
    registerJob('health-check', '*/5 * * * *', async () => {
        try {
            const health = await bridgeCore.healthCheck();
            const unhealthy = Object.entries(health).filter(([_, v]) => !v.healthy);

            if (unhealthy.length > 0) {
                logger.warn({ unhealthy }, 'Unhealthy adapters detected');
            }
        } catch (error) {
            logger.error({ error }, 'Health check failed');
        }
    });

    // Daily stats aggregation at midnight
    registerJob('daily-stats', '0 0 * * *', async () => {
        logger.info('Running daily stats aggregation...');
        try {
            const stats = bridgeCore.getStats();
            logger.info({ stats }, 'Daily bridge stats');
            // TODO: Save to database or send to analytics
        } catch (error) {
            logger.error({ error }, 'Daily stats aggregation failed');
        }
    });

    logger.info(`✅ ${jobs.size} sync jobs initialized`);
}

/**
 * Register a new sync job
 * @param {string} jobId - Unique job identifier
 * @param {string} schedule - Cron expression
 * @param {Function} handler - Job handler function
 */
function registerJob(jobId, schedule, handler) {
    if (jobs.has(jobId)) {
        logger.warn({ jobId }, 'Job already exists, replacing...');
        jobs.get(jobId).stop();
    }

    const job = cron.schedule(schedule, handler, {
        scheduled: true,
        timezone: 'UTC',
    });

    jobs.set(jobId, job);
    logger.info({ jobId, schedule }, 'Sync job registered');
}

/**
 * Stop a specific job
 * @param {string} jobId - Job identifier
 */
function stopJob(jobId) {
    if (jobs.has(jobId)) {
        jobs.get(jobId).stop();
        jobs.delete(jobId);
        logger.info({ jobId }, 'Sync job stopped');
    }
}

/**
 * Stop all jobs
 */
function stopAllJobs() {
    for (const [jobId, job] of jobs) {
        job.stop();
        logger.info({ jobId }, 'Sync job stopped');
    }
    jobs.clear();
}

/**
 * Get status of all jobs
 */
function getJobsStatus() {
    const status = {};
    for (const [jobId, job] of jobs) {
        status[jobId] = {
            running: job.running !== false,
        };
    }
    return status;
}

/**
 * Manually trigger a sync for a specific platform
 * @param {string} platformId - Platform identifier
 */
async function triggerSync(platformId) {
    logger.info({ platformId }, 'Manual sync triggered');
    return bridgeCore.syncInventory(platformId);
}

module.exports = {
    initializeSyncJobs,
    registerJob,
    stopJob,
    stopAllJobs,
    getJobsStatus,
    triggerSync,
};
