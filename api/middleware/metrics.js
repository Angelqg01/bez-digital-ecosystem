/**
 * Prometheus metrics middleware for BeZhas API.
 * Exposes default Node.js metrics + custom HTTP request histograms
 * + blockchain event pipeline metrics.
 */
const client = require('prom-client');

// Collect default Node.js metrics (CPU, heap, event-loop, GC)
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'bezhas_api_' });

// ── HTTP request duration histogram ────────────────────
const httpDuration = new client.Histogram({
    name: 'bezhas_api_http_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
});

// ── Active requests gauge ──────────────────────────────
const activeRequests = new client.Gauge({
    name: 'bezhas_api_active_requests',
    help: 'Number of in-flight HTTP requests',
    registers: [register],
});

// ── Total requests counter ─────────────────────────────
const totalRequests = new client.Counter({
    name: 'bezhas_api_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
});

// ── Event Pipeline metrics ─────────────────────────────
const eventsReceived = new client.Gauge({
    name: 'bezhas_events_received_total',
    help: 'Total blockchain events received by the listener',
    registers: [register],
});

const eventsIndexed = new client.Gauge({
    name: 'bezhas_events_indexed_total',
    help: 'Total blockchain events successfully indexed to DB',
    registers: [register],
});

const eventsPublished = new client.Gauge({
    name: 'bezhas_events_published_total',
    help: 'Total blockchain events published to Redis',
    registers: [register],
});

const eventsFailed = new client.Gauge({
    name: 'bezhas_events_failed_total',
    help: 'Total blockchain events that failed processing',
    registers: [register],
});

const eventQueueHighWatermark = new client.Gauge({
    name: 'bezhas_event_queue_high_watermark',
    help: 'Highest queue depth reached by the event listener',
    registers: [register],
});

const listenerActive = new client.Gauge({
    name: 'bezhas_eventlistener_active',
    help: 'Whether the event listener is active (1) or stopped (0)',
    registers: [register],
});

const listenerReconnects = new client.Gauge({
    name: 'bezhas_eventlistener_reconnects_total',
    help: 'Number of RPC provider reconnections',
    registers: [register],
});

const consumerConnected = new client.Gauge({
    name: 'bezhas_consumer_connected',
    help: 'Whether the Redis event consumer is connected (1) or not (0)',
    registers: [register],
});

const consumerSSEClients = new client.Gauge({
    name: 'bezhas_consumer_sse_clients',
    help: 'Current number of SSE clients receiving blockchain events',
    registers: [register],
});

const consumerReconnects = new client.Gauge({
    name: 'bezhas_consumer_reconnects_total',
    help: 'Number of Redis consumer reconnections',
    registers: [register],
});

/**
 * Express middleware — tracks request duration, active count, and totals.
 */
function metricsMiddleware(req, res, next) {
    // Skip measuring the /api/metrics endpoint itself
    if (req.path === '/api/metrics') return next();

    activeRequests.inc();
    const end = httpDuration.startTimer();

    res.on('finish', () => {
        const route = req.route?.path || req.path;
        const labels = { method: req.method, route, status: res.statusCode };
        end(labels);
        totalRequests.inc(labels);
        activeRequests.dec();
    });

    next();
}

/**
 * Handler for GET /api/metrics — returns Prometheus text format.
 * Collects event-pipeline stats dynamically before serialising.
 */
async function metricsHandler(_req, res) {
    try {
        // Lazy-load to avoid circular deps at import time
        const { getListenerStats } = require('../services/eventListener');
        const { getConsumerStats } = require('../services/eventConsumer');

        const ls = getListenerStats();
        const cs = getConsumerStats();

        eventsReceived.set(ls.eventsReceived);
        eventsIndexed.set(ls.eventsIndexed);
        eventsPublished.set(ls.eventsPublished);
        eventsFailed.set(ls.eventsFailed + (cs.eventsReceived - cs.eventsDispatched));
        eventQueueHighWatermark.set(ls.queueHighWatermark);
        listenerActive.set(ls.active ? 1 : 0);
        listenerReconnects.set(ls.reconnects);
        consumerConnected.set(cs.connected ? 1 : 0);
        consumerSSEClients.set(cs.sseListeners);
        consumerReconnects.set(cs.reconnects);
    } catch {
        // Services may not be loaded yet during startup — skip
    }

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, register };
