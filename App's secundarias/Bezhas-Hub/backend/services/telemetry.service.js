/**
 * BeZhas Telemetry Service
 * Handles frontend telemetry data collection and processing
 */

const { addTelemetryJob } = require('./queue.service');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class TelemetryService {
    constructor() {
        this.buffer = [];
        this.batchSize = 50; // Process in batches
        this.flushInterval = 10000; // 10 seconds
        this.intervalId = null;
        this.isProcessing = false;

        // Auto-flush every interval
        this.startAutoFlush();
    }

    /**
     * Start auto-flush interval
     */
    startAutoFlush() {
        if (this.intervalId) {
            return; // Already started
        }

        this.intervalId = setInterval(async () => {
            try {
                await this.flush();
            } catch (error) {
                logger.error({ error: error.message }, 'Error in telemetry auto-flush');
            }
        }, this.flushInterval);

        logger.info('Telemetry auto-flush started');
    }

    /**
     * Stop auto-flush interval
     */
    stopAutoFlush() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Telemetry auto-flush stopped');
        }
    }

    /**
     * Add telemetry event to buffer
     * @param {Object} event - Telemetry event data
     */
    async addEvent(event) {
        // Validate required fields
        if (!event || !event.sessionId) {
            throw new Error('Invalid telemetry event: sessionId required');
        }

        // Enrich event with server-side data
        const enrichedEvent = {
            ...event,
            receivedAt: Date.now(),
            serverTimestamp: new Date().toISOString()
        };

        this.buffer.push(enrichedEvent);

        // If buffer reaches batch size, flush immediately
        if (this.buffer.length >= this.batchSize) {
            await this.flush();
        }

        return { status: 'accepted', eventId: enrichedEvent.sessionId };
    }

    /**
     * Process batch of telemetry events
     * @param {Array} events - Array of telemetry events
     */
    async processBatch(events) {
        if (!events || events.length === 0) return;

        try {
            // Send each event to the queue for processing by Aegis
            for (const event of events) {
                await addTelemetryJob(event);
            }

            logger.info({ count: events.length }, 'Processed telemetry batch');
        } catch (error) {
            logger.error({ error: error.message, count: events.length }, 'Error processing telemetry batch');
            throw error;
        }
    }

    /**
     * Flush buffer to queue
     */
    async flush() {
        if (this.buffer.length === 0 || this.isProcessing) {
            return; // Nothing to flush or already processing
        }

        this.isProcessing = true;

        const batch = [...this.buffer];
        this.buffer = [];

        try {
            await this.processBatch(batch);
        } catch (error) {
            logger.error({ error: error.message }, 'Failed to flush telemetry batch');
            // Re-add to buffer for retry
            this.buffer.unshift(...batch);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('Shutting down telemetry service...');

        this.stopAutoFlush();

        // Flush remaining events
        await this.flush();

        logger.info('Telemetry service shutdown complete');
    }

    /**
     * Get telemetry statistics
     */
    getStats() {
        return {
            bufferSize: this.buffer.length,
            batchSize: this.batchSize,
            flushInterval: this.flushInterval,
            isProcessing: this.isProcessing,
            isAutoFlushActive: !!this.intervalId
        };
    }
}

// Singleton instance
const telemetryService = new TelemetryService();

module.exports = telemetryService;
