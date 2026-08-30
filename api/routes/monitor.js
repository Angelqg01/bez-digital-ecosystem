'use strict';

const { Router } = require('express');
const { query } = require('../db/pool');
const { redisClient } = require('../cache/redis');
const { getListenerStats } = require('../services/eventListener');
const { getConsumerStats } = require('../services/eventConsumer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = Router();

const WATCHDOG_STATUS_PATH = path.resolve(__dirname, '../../scripts/status/subapp-status.json');

// Full URLs (not base+path) — each external target has its own real shape,
// concatenating a shared base was guessing at paths that don't match reality.
const BRAIN_SUMMARY_URL = process.env.MONITOR_BRAIN_URL || 'http://localhost:4007/telemetry/summary';
const AEGIS_HEALTH_URL = process.env.MONITOR_AEGIS_HEALTH_URL || 'http://localhost:8001/aegis/v1/health';
const PROMETHEUS_TARGETS_URL = process.env.MONITOR_PROMETHEUS_URL || 'http://localhost:9090/api/v1/targets';

// Opt-in shared-secret gate. Unset (dev default) = open. Once /monitor moved
// outside the cookie-authenticated /dashboard tree so the kiosk can load it
// without a login, this is the only thing standing between the public
// internet and named enterprises' gas balances / Aegis payload / Brain
// token usage — set it before exposing this past a trusted LAN.
const ACCESS_TOKEN = process.env.MONITOR_ACCESS_TOKEN || null;
const { IS_PRODUCTION } = require('../config/secrets');

if (!ACCESS_TOKEN && IS_PRODUCTION) {
  console.warn('[MONITOR] MONITOR_ACCESS_TOKEN no configurado — /api/monitor queda CERRADO en producción.');
}

/** Comparación en tiempo constante: un `===` filtra el token carácter a carácter. */
function tokenMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function checkAccess(req, res, next) {
  // Falla cerrado. Antes, no configurar el token dejaba abierto un endpoint que
  // expone saldos de gas de empresas nombradas, payload de Aegis y consumo de
  // tokens: la ausencia de configuración no puede significar "acceso libre".
  if (!ACCESS_TOKEN) {
    if (IS_PRODUCTION) {
      return res.status(503).json({ error: 'Monitor disabled: MONITOR_ACCESS_TOKEN not configured', code: 'MONITOR_TOKEN_UNSET' });
    }
    return next();
  }
  const provided = req.headers['x-monitor-token'] || req.query.token;
  if (tokenMatches(provided, ACCESS_TOKEN)) return next();
  return res.status(401).json({ error: 'Unauthorized', code: 'MONITOR_TOKEN_REQUIRED' });
}

async function safeFetch(url, timeoutMs = 3000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

/** true/false, never relies on Promise.allSettled auto-resolving a falsy non-promise as "up". */
async function pingRedis() {
  if (!redisClient) return false;
  try {
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}

async function getBlockchainSnapshot() {
  try {
    const { getProvider } = require('../services/contractService');
    const provider = getProvider();
    const [blockNumber, feeData, network] = await Promise.allSettled([
      provider.getBlockNumber(),
      provider.getFeeData(),
      provider.getNetwork(),
    ]);
    return {
      block_number: blockNumber.status === 'fulfilled' ? Number(blockNumber.value) : null,
      gas_price_gwei: feeData.status === 'fulfilled' && feeData.value.gasPrice != null
        ? parseFloat((Number(feeData.value.gasPrice) / 1e9).toFixed(2))
        : null,
      chain_id: network.status === 'fulfilled' ? Number(network.value.chainId) : null,
    };
  } catch {
    return null; // provider not configured
  }
}

router.get('/overview', checkAccess, async (_req, res) => {
  const started = Date.now();

  // Single fan-out — every independent lookup runs concurrently so total
  // latency is bounded by the slowest one, not the sum of all of them.
  // Matters on an 8s auto-refresh screen: a sequential waterfall here used
  // to add each service's latency on top of the last.
  const [
    dbCheck, redisUp, brainData, aegisData, prometheusTargets,
    gasBalances, aiLogsActivity, blockchain,
  ] = await Promise.allSettled([
    query('SELECT 1'),
    pingRedis(),
    safeFetch(BRAIN_SUMMARY_URL),
    safeFetch(AEGIS_HEALTH_URL),
    safeFetch(PROMETHEUS_TARGETS_URL),
    query(
      `SELECT e.name, gb.balance_bez, gb.updated_at
       FROM gas_balances gb JOIN enterprises e ON gb.enterprise_id = e.id
       ORDER BY gb.balance_bez ASC LIMIT 10`
    ).catch(() => null), // table may not exist in every environment
    query(
      `SELECT module, COUNT(*)::int AS actions_24h,
              COUNT(CASE WHEN severity = 'critical' THEN 1 END)::int AS alerts_24h,
              MAX(created_at) AS last_action
       FROM ai_logs
       WHERE created_at > NOW() - INTERVAL '24 hours'
       GROUP BY module
       ORDER BY actions_24h DESC
       LIMIT 8`
    ).catch(() => null),
    getBlockchainSnapshot(),
  ]);

  // ── API health ──
  const apiHealth = {
    status: 'up',
    version: '3.1.0',
    uptime_s: Math.floor(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / 1048576),
    services: {
      database: dbCheck.status === 'fulfilled' ? 'up' : 'down',
      redis: redisUp.status === 'fulfilled' && redisUp.value ? 'up' : 'down',
    },
  };

  // ── Event pipeline (blockchain events) ──
  let eventPipeline = null;
  try {
    const ls = getListenerStats();
    const cs = getConsumerStats();
    eventPipeline = {
      listener_active: ls.active,
      events_received: ls.eventsReceived,
      events_indexed: ls.eventsIndexed,
      events_published: ls.eventsPublished,
      events_failed: ls.eventsFailed,
      queue_watermark: ls.queueHighWatermark,
      reconnects: ls.reconnects,
      last_event_at: ls.lastEventAt,
      // Suscripciones que no engancharon por un nombre de evento caduco.
      // Debe estar vacío; si no, el indexado tiene huecos silenciosos.
      failed_subscriptions: ls.failedSubscriptions || [],
      // Estado de la conexión con el nodo. Sin esto, "0 eventos recibidos" se
      // lee igual estando la cadena parada que estando el nodo caído.
      chain_reachable: ls.chainReachable,
      chain_last_error: ls.lastChainError,
      chain_last_error_at: ls.lastChainErrorAt,
      reconnect_attempts: ls.reconnectAttempts,
      next_reconnect_in_ms: ls.nextReconnectInMs,
      consumer_connected: cs.connected,
      sse_clients: cs.sseListeners,
    };
  } catch { /* services not loaded */ }

  // ── Apps Nativas watchdog ──
  const watchdog = safeReadJson(WATCHDOG_STATUS_PATH);
  let nativeApps = null;
  if (watchdog) {
    nativeApps = {
      timestamp: watchdog.timestamp,
      summary: watchdog.summary,
      apps: (watchdog.apps || []).map(a => ({
        name: a.name,
        status: a.status,
        latency_ms: a.latencyMs,
        http_status: a.httpStatus,
        failures: a.consecutiveFailures,
      })),
    };
  }

  // ── Docker / Infra (Prometheus targets) ──
  const promData = prometheusTargets.status === 'fulfilled' ? prometheusTargets.value : null;
  const docker = promData?.data?.activeTargets
    ? promData.data.activeTargets.map(t => ({
        job: t.labels?.job,
        instance: t.labels?.instance,
        health: t.health,
        last_scrape: t.lastScrape,
        scrape_duration_s: parseFloat(t.lastScrapeDuration) || 0,
      }))
    : null;

  res.json({
    timestamp: new Date().toISOString(),
    collected_ms: Date.now() - started,
    api: apiHealth,
    blockchain: blockchain.status === 'fulfilled' ? blockchain.value : null,
    event_pipeline: eventPipeline,
    native_apps: nativeApps,
    brain: brainData.status === 'fulfilled' ? brainData.value : null,
    aegis: aegisData.status === 'fulfilled' ? aegisData.value : null,
    docker,
    gas_balances: gasBalances.status === 'fulfilled' ? gasBalances.value?.rows ?? null : null,
    agent_activity: aiLogsActivity.status === 'fulfilled' ? aiLogsActivity.value?.rows ?? null : null,
  });
});

module.exports = router;
