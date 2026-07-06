'use strict';

/**
 * energyTelemetryStore — persists VPP telemetry + Aegis events (Phase 3).
 *
 * The broker calls capture() on every ingest (best-effort, non-blocking); rows
 * are queued in memory and flushed in batches so high-frequency telemetry never
 * blocks the MQTT message handler. Reads (history/analytics) back the dashboard's
 * Analytics page and the arbitrage agent's back-test.
 *
 * DB access goes through db/pool.query, but a query fn can be injected for tests
 * (no live Postgres needed to verify the SQL + batching logic).
 */

const logger = require('../utils/logger');

let _queryOverride = null;
function q() { return _queryOverride || require('../db/pool').query; }

const FLUSH_MS = parseInt(process.env.VPP_TELEMETRY_FLUSH_MS || '5000', 10);
const MAX_QUEUE = parseInt(process.env.VPP_TELEMETRY_MAX_QUEUE || '5000', 10);

let telemetryQueue = [];
let eventQueue = [];
let flushTimer = null;

/** Build a telemetry row from an accepted ingest record. */
function telemetryRow(nodeId, payload) {
  const m = (payload && payload.metrics) || {};
  return [
    nodeId,
    payload.ts || new Date().toISOString(),
    payload.type || null,
    payload.status || null,
    num(m.output_kw), num(m.consumption_kw), num(m.voltage_v),
    num(m.grid_frequency), num(m.soc_pct), num(m.temp_c), num(m.energy_kwh),
    JSON.stringify(m),
    typeof payload.seq === 'number' ? payload.seq : null,
    !!payload.sig,
    payload.keyId || null,
  ];
}

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }

/**
 * Queue telemetry + anomaly events for persistence. Sync + cheap — safe to call
 * from the broker's message handler.
 * @param {{nodeId:string, payload:object, verdict:object, accepted:boolean}} rec
 */
function capture(rec) {
  if (!rec || !rec.nodeId) return;
  if (rec.accepted && rec.payload) {
    telemetryQueue.push(telemetryRow(rec.nodeId, rec.payload));
  }
  const anomalies = (rec.verdict && rec.verdict.anomalies) || [];
  for (const a of anomalies) {
    eventQueue.push([a.ts || new Date().toISOString(), rec.nodeId, a.type, a.severity, a.result || 'FAIL', a.message || null]);
  }
  if (rec.accepted && rec.payload && rec.payload.sig) {
    eventQueue.push([new Date().toISOString(), rec.nodeId, 'TELEMETRY_VALIDATED', 'INFO', 'PASS', `seq ${rec.payload.seq}`]);
  }
  // Backpressure guard — drop oldest if a long DB outage fills the queue.
  if (telemetryQueue.length > MAX_QUEUE) telemetryQueue = telemetryQueue.slice(-MAX_QUEUE);
  if (eventQueue.length > MAX_QUEUE) eventQueue = eventQueue.slice(-MAX_QUEUE);
}

const TELEMETRY_COLS = 15;
const EVENT_COLS = 6;

/** Build a multi-row INSERT (parameterized) for a batch of rows. */
function bulkInsert(table, cols, rows, colCount) {
  const values = [];
  const params = [];
  rows.forEach((row, i) => {
    const ph = [];
    for (let c = 0; c < colCount; c++) ph.push(`$${i * colCount + c + 1}`);
    values.push(`(${ph.join(',')})`);
    params.push(...row);
  });
  return { text: `INSERT INTO ${table} (${cols}) VALUES ${values.join(',')}`, params };
}

/** Flush queued rows to the DB in batches. Best-effort. */
async function flush() {
  if (!telemetryQueue.length && !eventQueue.length) return { telemetry: 0, events: 0 };
  const tRows = telemetryQueue; telemetryQueue = [];
  const eRows = eventQueue; eventQueue = [];
  let telemetry = 0; let events = 0;

  try {
    if (tRows.length) {
      const ins = bulkInsert(
        'telemetry_logs',
        'node_id, ts, type, status, output_kw, consumption_kw, voltage_v, grid_frequency, soc_pct, temp_c, energy_kwh, metrics, seq, signed, key_id',
        tRows, TELEMETRY_COLS
      );
      await q()(ins.text, ins.params);
      telemetry = tRows.length;
    }
    if (eRows.length) {
      const ins = bulkInsert('aegis_events', 'ts, node_id, type, severity, result, message', eRows, EVENT_COLS);
      await q()(ins.text, ins.params);
      events = eRows.length;
    }
  } catch (err) {
    logger.warn('[VPP][STORE] flush failed (rows dropped): %s', err.message);
  }
  return { telemetry, events };
}

function start() {
  if (flushTimer) return;
  flushTimer = setInterval(() => { flush().catch(() => {}); }, FLUSH_MS);
  if (flushTimer.unref) flushTimer.unref();
  logger.info('[VPP][STORE] telemetry persistence started (flush every %dms)', FLUSH_MS);
}

function stop() { if (flushTimer) { clearInterval(flushTimer); flushTimer = null; } }

// ── Reads (dashboard analytics + agent back-test) ──

/** Recent telemetry samples for a node. */
async function getHistory(nodeId, { limit = 100, hours = 24 } = {}) {
  const { rows } = await q()(
    `SELECT ts, type, status, output_kw, consumption_kw, voltage_v, grid_frequency, soc_pct, temp_c, energy_kwh, seq, signed
       FROM telemetry_logs
      WHERE node_id = $1 AND ts > NOW() - ($2 || ' hours')::interval
      ORDER BY ts DESC
      LIMIT $3`,
    [nodeId, String(hours), Math.min(limit, 5000)]
  );
  return rows;
}

/** Aggregated analytics over a trailing window. */
async function getAnalytics(nodeId, { hours = 24 } = {}) {
  const { rows } = await q()(
    `SELECT
        COUNT(*)::int                              AS samples,
        ROUND(AVG(output_kw), 3)                   AS avg_output_kw,
        ROUND(MAX(output_kw), 3)                   AS peak_output_kw,
        ROUND(AVG(grid_frequency), 3)              AS avg_frequency,
        MAX(energy_kwh) - MIN(energy_kwh)          AS energy_kwh_delta,
        MIN(ts)                                    AS since,
        MAX(ts)                                    AS until
       FROM telemetry_logs
      WHERE node_id = $1 AND ts > NOW() - ($2 || ' hours')::interval`,
    [nodeId, String(hours)]
  );
  return rows[0] || { samples: 0 };
}

/** Recent persisted Aegis events (audit trail). */
async function getAegisEvents({ limit = 50, hours = 24 } = {}) {
  const { rows } = await q()(
    `SELECT ts, node_id, type, severity, result, message
       FROM aegis_events
      WHERE ts > NOW() - ($1 || ' hours')::interval
      ORDER BY ts DESC LIMIT $2`,
    [String(hours), Math.min(limit, 1000)]
  );
  return rows;
}

// ── Test helpers ──
function __setQueryForTests(fn) { _queryOverride = fn; }
function __queueLengths() { return { telemetry: telemetryQueue.length, events: eventQueue.length }; }
function __reset() { telemetryQueue = []; eventQueue = []; _queryOverride = null; stop(); }

module.exports = {
  capture, flush, start, stop,
  getHistory, getAnalytics, getAegisEvents,
  bulkInsert, telemetryRow,
  __setQueryForTests, __queueLengths, __reset,
};
