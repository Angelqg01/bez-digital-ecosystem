'use strict';

/**
 * vppMqttBroker — VPP Edge Node telemetry ingestion over MQTT.
 *
 * Edge Nodes (inverters, batteries, smart meters) publish telemetry to:
 *     bezhas/edge/<nodeId>/telemetry
 * The API dispatches SCADA control commands to:
 *     bezhas/edge/<nodeId>/control
 *
 * Design notes:
 *   - `mqtt` is required lazily inside connect() so this module can ALWAYS be
 *     required even when the dependency is absent (degraded / "mock mode").
 *     This keeps the Cloud Run container booting regardless of broker state.
 *   - Latest telemetry per node is kept in-memory; getLatestTelemetry() returns
 *     a payload shape-compatible with routes/energy.js buildTelemetry(), so the
 *     same frontend works for both real and simulated data.
 *   - connect() only rejects its own promise on failure; index.js already
 *     handles that by falling back to mock mode.
 */

const logger = require('../utils/logger');
const aegis = require('./aegisAnomalyEngine'); // Phase 2 — telemetry anomaly detection
const { energy: energyMetrics } = require('../middleware/metrics');

const TELEMETRY_TOPIC = 'bezhas/edge/+/telemetry';
const controlTopic = (nodeId) => `bezhas/edge/${nodeId}/control`;
const STALE_MS = parseInt(process.env.VPP_TELEMETRY_STALE_MS || '30000', 10);

let client = null;
let connected = false;

/** nodeId -> normalized node object (carries a private _rxAt receive timestamp) */
const store = new Map();

/**
 * Optional persistence sink (Phase 3). Set by index.js to energyTelemetryStore;
 * receives every ingest verdict (accepted or rejected) best-effort. Kept optional
 * so the broker stays requireable + unit-testable with no DB.
 */
let telemetrySink = null;
function setTelemetrySink(fn) { telemetrySink = typeof fn === 'function' ? fn : null; }

function topicNodeId(topic) {
  // bezhas/edge/<nodeId>/telemetry
  const parts = String(topic).split('/');
  return parts.length >= 4 ? parts[2] : null;
}

/**
 * Ingest a telemetry payload for a node. Pure & synchronous — unit-testable
 * without a broker. Returns the stored node object, or null if invalid OR
 * rejected by Aegis (bad signature / replay) — in which case the last known-good
 * reading is preserved.
 *
 * Expected payload:
 *   { type, name, status, protocol, metrics: {...}, ts, seq, keyId, sig }
 */
function ingest(nodeId, payload) {
  if (!nodeId || !payload || typeof payload !== 'object') return null;

  // Phase 2 — Aegis: verify authenticity + integrity before trusting the data.
  const prev = store.get(nodeId);
  const verdict = aegis.evaluate({ nodeId, payload, lastSeq: prev ? prev._seq : null });
  if (verdict.anomalies.length) aegis.record(verdict.anomalies);
  if (!verdict.accept) {
    energyMetrics.telemetry(nodeId, { signed: !!payload.sig, accepted: false });
    logger.warn('[VPP][AEGIS] rejected telemetry for %s: %s', nodeId,
      verdict.anomalies.map((a) => a.type).join(','));
    if (telemetrySink) { try { telemetrySink({ nodeId, payload, verdict, accepted: false }); } catch (_) { /* best-effort */ } }
    return null; // keep last known-good in `store`
  }
  if (payload.sig) aegis.recordPass(nodeId, 'TELEMETRY_VALIDATED', `seq ${payload.seq}`);

  const metrics = payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {};
  const node = {
    id: nodeId,
    type: payload.type || 'UNKNOWN',
    name: payload.name || nodeId,
    status: verdict.status || payload.status || 'ONLINE',
    protocol: payload.protocol || 'MQTT',
    ...metrics,
    _rxAt: Date.now(),
    _seq: typeof payload.seq === 'number' ? payload.seq : (prev ? prev._seq : null),
  };
  store.set(nodeId, node);
  energyMetrics.telemetry(nodeId, { signed: !!payload.sig, accepted: true });
  if (telemetrySink) { try { telemetrySink({ nodeId, payload, verdict, accepted: true }); } catch (_) { /* best-effort */ } }
  return node;
}

function _withStaleness(node) {
  const { _rxAt, _seq, ...rest } = node; // eslint-disable-line no-unused-vars
  const stale = Date.now() - _rxAt > STALE_MS;
  return { ...rest, status: stale ? 'OFFLINE' : rest.status };
}

function _buildGlobal(nodes) {
  let totalOutput = 0;
  let gen = 0;
  let load = 0;
  let gridFreq = null;
  for (const n of nodes) {
    if (typeof n.output_kw === 'number') {
      totalOutput += n.output_kw;
      gen += n.output_kw;
    }
    if (typeof n.consumption_kw === 'number') load += n.consumption_kw;
    if (typeof n.grid_frequency === 'number') gridFreq = n.grid_frequency;
  }
  return {
    net_flow_kw: parseFloat((gen - load).toFixed(2)),
    total_output_kw: parseFloat(totalOutput.toFixed(2)),
    grid_frequency: gridFreq != null ? gridFreq : 50.0,
    self_sufficiency_pct: load > 0 ? parseFloat(Math.min(100, (gen / load) * 100).toFixed(1)) : 100,
  };
}

/**
 * Latest telemetry for all known nodes, or null if no data has been received
 * (caller falls back to simulated buildTelemetry()).
 */
function getLatestTelemetry() {
  if (store.size === 0) return null;
  const nodes = [...store.values()].map(_withStaleness);
  return {
    timestamp: new Date().toISOString(),
    global: _buildGlobal(nodes),
    nodes,
  };
}

function getNodeTelemetry(nodeId) {
  const node = store.get(nodeId);
  if (!node) return null;
  const n = _withStaleness(node);
  return {
    timestamp: new Date().toISOString(),
    global: _buildGlobal([n]),
    nodes: [n],
  };
}

function isConnected() {
  return connected;
}

/**
 * Per-node receive ages, for the Prometheus staleness gauge. Exposes `_rxAt`
 * as an age rather than the raw timestamp so callers cannot accidentally
 * treat a clock difference as freshness.
 */
function getIngestStats() {
  const now = Date.now();
  return {
    connected,
    staleAfterMs: STALE_MS,
    nodes: [...store.entries()].map(([id, n]) => ({ id, ageMs: now - n._rxAt })),
  };
}

/**
 * Connect to the MQTT broker and subscribe to Edge Node telemetry.
 * Resolves on first successful connection; rejects if the dependency is missing
 * or the initial connection fails within the timeout.
 */
function connect(opts = {}) {
  return new Promise((resolve, reject) => {
    let mqtt;
    try {
      mqtt = require('mqtt'); // lazy — absence => mock mode (index.js handles it)
    } catch (err) {
      return reject(new Error(`mqtt dependency not installed: ${err.message}`));
    }

    const {
      brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      username,
      password,
      clientId = `bezhas-api-${Date.now()}`,
      reconnectPeriod = 5000,
      connectTimeoutMs = 10000,
    } = opts;

    client = mqtt.connect(brokerUrl, { username, password, clientId, reconnectPeriod, connectTimeout: connectTimeoutMs });

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`MQTT connect timeout after ${connectTimeoutMs}ms`));
      }
    }, connectTimeoutMs);

    client.on('connect', () => {
      connected = true;
      client.subscribe(TELEMETRY_TOPIC, (err) => {
        if (err) logger.warn('[VPP] telemetry subscribe failed: %s', err.message);
        else logger.info('[VPP] subscribed to %s', TELEMETRY_TOPIC);
      });
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(client);
      }
    });

    client.on('reconnect', () => logger.info('[VPP] MQTT reconnecting...'));
    client.on('close', () => { connected = false; });
    client.on('error', (err) => {
      logger.warn('[VPP] MQTT error: %s', err.message);
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    client.on('message', (topic, message) => {
      const nodeId = topicNodeId(topic);
      if (!nodeId) return;
      try {
        ingest(nodeId, JSON.parse(message.toString()));
      } catch (err) {
        logger.warn('[VPP] bad telemetry payload on %s: %s', topic, err.message);
      }
    });
  });
}

/**
 * Publish a SCADA control command to an Edge Node. Returns true if published,
 * false when the broker is unavailable (caller treats as mock dispatch).
 */
function publishControl(nodeId, command, params = {}) {
  if (!client || !connected) return false;
  try {
    client.publish(controlTopic(nodeId), JSON.stringify({ command, params, ts: new Date().toISOString() }));
    return true;
  } catch (err) {
    logger.warn('[VPP] control publish failed for %s: %s', nodeId, err.message);
    return false;
  }
}

/**
 * Publish a pre-built, backend-SIGNED control command (Phase 5). The Edge verifies
 * the signature before moving any hardware. Returns true if published.
 */
function publishSignedControl(nodeId, signedCommand) {
  if (!client || !connected) return false;
  try {
    client.publish(controlTopic(nodeId), JSON.stringify(signedCommand), { qos: 2 });
    return true;
  } catch (err) {
    logger.warn('[VPP] signed control publish failed for %s: %s', nodeId, err.message);
    return false;
  }
}

async function disconnect() {
  if (client) {
    await new Promise((res) => client.end(false, {}, res));
    client = null;
    connected = false;
  }
}

/** Test helper — clear in-memory state. */
function _reset() {
  store.clear();
  connected = false;
  telemetrySink = null;
}

module.exports = {
  connect,
  disconnect,
  ingest,
  getLatestTelemetry,
  getNodeTelemetry,
  publishControl,
  publishSignedControl,
  isConnected,
  getIngestStats,
  setTelemetrySink,
  TELEMETRY_TOPIC,
  controlTopic,
  _reset,
};
