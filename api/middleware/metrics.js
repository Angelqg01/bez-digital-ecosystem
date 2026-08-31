/**
 * Prometheus metrics middleware for BeZhas API.
 * Exposes default Node.js metrics + custom HTTP request histograms
 * + blockchain event pipeline metrics + VPP/energy domain metrics.
 *
 * Two collection models coexist here, on purpose:
 *
 *   • PULL  — point-in-time values read from the services at scrape time
 *             (event pipeline, telemetry staleness, pending batches, P&L).
 *             Gauges: the current value is the whole truth.
 *
 *   • PUSH  — monotonic event counts incremented by the services as things
 *             happen (telemetry ingested, anomalies, anchors, decisions).
 *             Real Counters, because the in-memory sources are LOSSY: the
 *             Aegis ring buffer keeps 500 events and the arbitrage decision
 *             log keeps 500 decisions, so reading them at scrape time would
 *             produce a value that goes DOWN — which a counter must never do.
 *             Surviving that truncation is precisely why these live here.
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

// Estado del nodo. Es la métrica sobre la que conviene alertar: si esto vale 0
// durante minutos, el indexador está ciego aunque el proceso responda a /health
// con un 200 y el contador de eventos siga quieto sin dar ninguna pista.
const chainReachable = new client.Gauge({
    name: 'bezhas_eventlistener_chain_reachable',
    help: 'Whether the RPC node answered the last liveness probe (1 up, 0 down)',
    registers: [register],
});

const chainReconnectAttempts = new client.Gauge({
    name: 'bezhas_eventlistener_reconnect_attempts',
    help: 'Consecutive reconnection attempts against an unreachable node (0 when healthy)',
    registers: [register],
});

// Suscripciones que no engancharon por un nombre de evento caduco. Debe ser 0:
// cualquier otro valor significa que el indexado tiene huecos silenciosos.
const failedSubscriptions = new client.Gauge({
    name: 'bezhas_eventlistener_failed_subscriptions',
    help: 'Subscriptions skipped because the event name is absent from the ABI',
    registers: [register],
});

// Llamadas a contrato que degradaron a su valor por defecto. Debe ser 0 con la
// cadena sana. Si sube sin que `chain_reachable` baje, es que algún método no
// existe en el ABI — que es como estuvo meses `pendingRewards` devolviendo 0.
const chainCallFailures = new client.Gauge({
    name: 'bezhas_chain_call_failures_total',
    help: 'Contract calls that fell back to a default value instead of returning data',
    labelNames: ['call'],
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

// ── VPP / Energy domain metrics ────────────────────────
// PUSH — incremented by the services (see header note on lossy sources).

const energyTelemetryTotal = new client.Counter({
    name: 'bezhas_energy_telemetry_total',
    help: 'Telemetry payloads ingested from Edge Nodes',
    labelNames: ['node_id', 'signed', 'accepted'],
    registers: [register],
});

const energyAnomaliesTotal = new client.Counter({
    name: 'bezhas_energy_anomalies_total',
    help: 'Aegis anomalies detected on ingested telemetry',
    labelNames: ['node_id', 'type', 'severity'],
    registers: [register],
});

const energyKwhAnchoredTotal = new client.Counter({
    name: 'bezhas_energy_kwh_anchored_total',
    help: 'Cumulative kWh anchored on-chain via EnergyOracle proofs',
    labelNames: ['node_id'],
    registers: [register],
});

const energyAnchorBatchesTotal = new client.Counter({
    name: 'bezhas_energy_anchor_batches_total',
    help: 'Telemetry merkle batches submitted on-chain, by outcome',
    labelNames: ['status'],
    registers: [register],
});

const energyDroppedReadingsTotal = new client.Counter({
    name: 'bezhas_energy_dropped_readings_total',
    help: 'Accepted signed readings discarded before ever being anchored, by reason',
    labelNames: ['node_id', 'reason'],
    registers: [register],
});

const energyAnchorLatency = new client.Histogram({
    name: 'bezhas_energy_anchor_latency_seconds',
    help: 'Time to anchor one telemetry batch on-chain',
    buckets: [0.5, 1, 2.5, 5, 10, 30, 60, 120],
    registers: [register],
});

const energyArbitrageDecisionsTotal = new client.Counter({
    name: 'bezhas_energy_arbitrage_decisions_total',
    help: 'Battery arbitrage decisions taken, by strategy and outcome',
    labelNames: ['strategy', 'outcome'],
    registers: [register],
});

// PULL — set from service state on every scrape.

// Each carries its own collect(): prom-client invokes it on every scrape, so
// the value is computed from live service state at read time. Using collect()
// rather than refreshing from metricsHandler matters — a gauge left un-refreshed
// still SERIALISES, and would report a confident 0 that reads as "no nodes"
// instead of "nobody asked". A stale zero is worse than a missing series.

const energyTelemetryStaleness = new client.Gauge({
    name: 'bezhas_energy_telemetry_staleness_seconds',
    help: 'Seconds since the last accepted reading, per Edge Node',
    labelNames: ['node_id'],
    registers: [register],
    collect() {
        // reset() first: a node that stops existing must stop reporting a
        // staleness frozen at its last value, which would look healthy forever.
        this.reset();
        for (const n of ingestStats().nodes) this.set({ node_id: n.id }, n.ageMs / 1000);
    },
});

const energyNodesKnown = new client.Gauge({
    name: 'bezhas_energy_nodes_known',
    help: 'Edge Nodes that have reported at least one accepted reading',
    registers: [register],
    collect() { this.set(ingestStats().nodes.length); },
});

const energyPendingReadings = new client.Gauge({
    name: 'bezhas_energy_pending_readings',
    help: 'Accepted signed readings buffered and not yet anchored, per node',
    labelNames: ['node_id'],
    registers: [register],
    collect() {
        this.reset();
        let pending = {};
        try { pending = require('../services/telemetryAnchor').pendingCounts(); } catch { /* not loaded */ }
        for (const [nodeId, count] of Object.entries(pending)) this.set({ node_id: nodeId }, count);
    },
});

const energyArbitragePnl = new client.Gauge({
    name: 'bezhas_energy_arbitrage_pnl_eur',
    help: 'Notional arbitrage P&L over logged decisions (shadow validation, not realised)',
    labelNames: ['kind'],
    registers: [register],
    collect() {
        let pnl = null;
        try { pnl = require('../services/energyArbitrageAgent').getPnlSummary(); } catch { /* not loaded */ }
        if (!pnl) return; // leave the series absent rather than assert a false 0
        this.set({ kind: 'charge_cost' }, pnl.charge_cost_eur);
        this.set({ kind: 'discharge_revenue' }, pnl.discharge_revenue_eur);
        this.set({ kind: 'net' }, pnl.net_arbitrage_eur);
    },
});

/** Broker ingest state, or an empty shape when the broker is not loaded. */
function ingestStats() {
    try { return require('../services/vppMqttBroker').getIngestStats(); }
    catch { return { nodes: [] }; }
}

/**
 * Handles the services push into. Exported so the services can require this
 * module directly; keeping them here means the registry stays the single
 * source of truth for what the API exposes.
 */
const energy = {
    telemetry(nodeId, { signed, accepted }) {
        energyTelemetryTotal.inc({
            node_id: nodeId,
            signed: signed ? 'true' : 'false',
            accepted: accepted ? 'true' : 'false',
        });
    },
    anomaly(nodeId, type, severity) {
        energyAnomaliesTotal.inc({ node_id: nodeId, type, severity });
    },
    anchored(nodeId, kWh, seconds, ok) {
        energyAnchorBatchesTotal.inc({ status: ok ? 'ok' : 'failed' });
        if (typeof seconds === 'number') energyAnchorLatency.observe(seconds);
        // Only successful anchors move the kWh counter: a failed submission
        // anchored nothing, and this number has to survive an audit.
        if (ok && kWh > 0) energyKwhAnchoredTotal.inc({ node_id: nodeId }, kWh);
    },
    // Evidence loss. The pending gauge shows what is still buffered; this shows
    // what will never be anchored, so a silent discard cannot happen unnoticed.
    dropped(nodeId, reason, count = 1) {
        energyDroppedReadingsTotal.inc({ node_id: nodeId, reason }, count);
    },
    arbitrage(strategy, outcome) {
        energyArbitrageDecisionsTotal.inc({ strategy, outcome });
    },
};

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
        chainReachable.set(ls.chainReachable === true ? 1 : 0);
        chainReconnectAttempts.set(ls.reconnectAttempts || 0);
        failedSubscriptions.set((ls.failedSubscriptions || []).length);

        const { getChainCallFailures } = require('../utils/chainCall');
        for (const [call, v] of Object.entries(getChainCallFailures())) {
            chainCallFailures.set({ call }, v.count);
        }
        consumerConnected.set(cs.connected ? 1 : 0);
        consumerSSEClients.set(cs.sseListeners);
        consumerReconnects.set(cs.reconnects);
    } catch {
        // Services may not be loaded yet during startup — skip
    }

    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, register, energy };
