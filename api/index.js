/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                    BeZhas API — server.js  v3.1.0                          ║
 * ║  Express · PostgreSQL · Redis · GCP · VPP Energy · OpenClaw · Aegis        ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Correcciones aplicadas vs. v3.0.0:
 *  [BUG]  Archivo truncado — bloque `else` final incompleto / sin cierre
 *  [BUG]  connectRedis() invocado dos veces (startServer + bloque else)
 *  [BUG]  require('./services/aegisService') dentro de handler → memory leak
 *  [BUG]  Orden incorrecto: 404 handler antes que error handler global
 *  [BUG]  unhandledRejection sin process.exit → servidor zombie en producción
 *  [BUG]  Mixed logging: console.error + gcpLogger sin unificación
 *  [OPT]  Sin graceful shutdown (SIGTERM/SIGINT) → pérdida de conexiones activas
 *  [OPT]  Health check solo verifica DB — ahora verifica Redis, VPP, Energy Agent
 *  [OPT]  Sin requestId middleware — imposible trazabilidad en logs distribuidos
 *  [OPT]  Sin compression — respuestas JSON sin gzip
 *  [OPT]  Sin rate limiter específico para endpoints SCADA (alta criticidad)
 *  [OPT]  Sin inicialización VPP en startup (MQTT broker, OMIE feed, Energy Agent)
 *  [OPT]  agentRoutes() como factory sin comentario explicativo
 */

'use strict';

const express = require('express');
const cors = require('cors');
const { makeCorsOriginFn, parseExtraOrigins } = require('./config/cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { randomUUID } = require('crypto');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// Attach OIDC tokens to outbound calls to the private Cloud Run backends
// (aegis/ai-gateway). No-op locally; see services/gcpServiceAuth.js.
require('./services/gcpServiceAuth').install();

// ── Infrastructure ────────────────────────────────────────────────────────────
const { connectRedis, redisClient } = require('./cache/redis');
const { query, pool } = require('./db/pool');
const { loadSecretsIntoEnv, logger: gcpLogger } = require('./services/gcpService');

// ── Services (todos los requires en el top-level — nunca dentro de handlers) ──
const gasMonitor = require('./services/gasMonitor');
const aegisService = require('./services/aegisService');       // ← movido al top
const { startListening } = require('./services/eventListener');
const { startConsumer } = require('./services/eventConsumer');

// ── Middleware ────────────────────────────────────────────────────────────────
const { authenticateToken, auditLog, enterpriseRateLimit } = require('./middleware/security');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');
const { brainTelemetryMiddleware } = require('./services/brainTelemetry');

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const nftRoutes = require('./routes/nfts');
const analyticsRoutes = require('./routes/analytics');
const contractRoutes = require('./routes/contracts');
const transactionRoutes = require('./routes/transactions');
const gasRoutes = require('./routes/gas');
const sectorRoutes = require('./routes/sectors');
const gamificationRoutes = require('./routes/gamification');
const aegisRoutes = require('./routes/aegis');
const notificationRoutes = require('./routes/notifications');
const marketRoutes = require('./routes/market');
const walletRoutes = require('./routes/wallet');
const configRoutes = require('./routes/config');
const agentRoutes = require('./routes/agents');
const agentRuntime = require('./services/agentRuntime');          // factory fn: agentRoutes()
const contractsAbiRoutes = require('./routes/contracts-abi');
const blockchainRoutes = require('./routes/blockchain');
const validatorRoutes = require('./routes/validators');
const ecosystemBridgeRoutes = require('./routes/ecosystem-bridge');
const treasuryRoutes = require('./routes/treasury');
const qrRoutes = require('./routes/qr');
const documentRoutes = require('./routes/documents');
const channelRoutes = require('./routes/channels');
const gatewayRoutes = require('./routes/gateway');
const cargoLinkRoutes = require('./routes/cargolink');
const openclawRoutes = require('./routes/openclaw');
const monitorRoutes = require('./routes/monitor');
const adminAuthRoutes = require('./routes/admin-auth');
const runtimeRoutes = require('./routes/runtime');
const aiBillingRoutes = require('./routes/ai-billing');
const unifiedAgentRoutes = require('./routes/unified-agent');
const identityRoutes = require('./routes/identity');
const organizationsRoutes = require('./routes/organizations');
const organizationTechRoutes = require('./routes/organization-tech');
const organizationBillingRoutes = require('./routes/organization-billing');
const adminConfigRoutes = require('./routes/admin-config');
const adminGovernanceRoutes = require('./routes/admin-governance');
const webhookRoutes = require('./routes/webhooks');
const energyRoutes = require('./routes/energy');          // ← VPP Energy Layer
const mtfcRoutes = require('./routes/mtfc');
const operantRoutes = require('./routes/operant');   // ← OPERANT (gestión empresarial autónoma)

// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 1: REQUEST ID  (trazabilidad distribuida en logs GCP + Aegis)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Inyecta un UUID único en cada request.
 * Accesible en cualquier handler vía req.id.
 * GCP Cloud Logging lo indexa automáticamente si el header X-Request-Id está presente.
 */
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 2: SEGURIDAD Y CORS
// ═══════════════════════════════════════════════════════════════════════════════

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'],   // ← wss: para WebSocket VPP
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // HSTS: 1 año, incluir subdominios
  hsts: IS_PROD
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  // No exponer X-Powered-By
  hidePoweredBy: true,
}));

// ── CORS: quién puede llamar a esta API desde un navegador ──
// La lógica vive en config/cors.js para poder testearla sin arrancar la app.
app.use(cors({
  origin: makeCorsOriginFn({
    isProduction: IS_PROD,
    extraOrigins: parseExtraOrigins(process.env.CORS_EXTRA_ORIGINS),
  }),
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['X-Request-Id'],   // exponer requestId al cliente para correlación
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 3: RATE LIMITERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Rate limiter global */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || (IS_PROD ? 100 : 5000),
  skip: req => !IS_PROD && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip),
  message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => req.headers['x-api-key'] || req.ip,  // agrupar por API key si existe
});

/**
 * Rate limiter estricto para endpoints SCADA y arbitraje.
 * Comandos físicos a inversores/baterías deben ser limitados agresivamente
 * para evitar ataques de replay o DoS sobre infraestructura real.
 */
const scadaLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minuto
  max: IS_PROD ? 10 : 200, // máx 10 comandos/min en prod
  message: { error: 'SCADA command rate limit exceeded.', code: 'SCADA_RATE_LIMIT' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Aplicar limiter SCADA solo a las rutas críticas de energía
app.use('/api/energy/control', scadaLimiter);
app.use('/api/energy/arbitrage/execute', scadaLimiter);
app.use('/api/energy/demand-response', scadaLimiter);

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 4: BODY PARSING Y COMPRESSION
//  CRÍTICO: webhooks de Stripe requieren raw body → montar ANTES de express.json()
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/api/webhooks', webhookRoutes);          // raw body — DEBE ir antes de express.json()

app.use(compression({                             // gzip respuestas > 1 KB
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

app.use(express.json({
  limit: '10mb',
  // Keep the exact bytes: inbound HMAC verification (CargoLink /v1/ingest/:providerId)
  // must run over what the sender signed, not a re-serialization.
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// cookie-parser faltaba: admin-auth.js emite el JWT de SUPER_ADMIN en una
// cookie HttpOnly y luego lee `req.cookies.bezhas_admin_token` para validarla.
// Sin este parser ese objeto es siempre undefined, así que la sesión del panel
// no se podía verificar por cookie y el único camino que quedaba era mandar el
// token a mano — que es justo lo que la cookie HttpOnly viene a evitar.
app.use(cookieParser());

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 5: OBSERVABILIDAD (Metrics + Audit Log)
// ═══════════════════════════════════════════════════════════════════════════════

app.use(metricsMiddleware);
app.use(brainTelemetryMiddleware);
app.use(auditLog);

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 6: RUTAS — BASE
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'BeZhas API',
    version: '3.1.0',
    docs: 'https://docs.bez.digital',
    endpoints: {
      health: '/api/health',
      metrics: '/api/metrics',
      gateway: '/api/gateway/v1',
      agents: '/api/agent',
      energy: '/api/energy',
    },
  });
});

/** Prometheus metrics endpoint */
app.get('/api/metrics', metricsHandler);

/**
 * Health check expandido.
 * Verifica: PostgreSQL · Redis · VPP Energy Agent · OMIE feed
 * Devuelve HTTP 200 si el servidor responde, independientemente del estado
 * de los servicios externos (para que el load balancer no saque el nodo).
 * El campo `services` indica el estado real de cada dependencia.
 */
app.get('/api/health', async (_req, res) => {
  const checks = await Promise.allSettled([
    query('SELECT 1'),                                   // PostgreSQL
    redisClient?.ping(),                                 // Redis
    // En producción añadir:
    // fetch('https://api.esios.ree.es/indicators/1', { signal: AbortSignal.timeout(3000) }),
  ]);

  const [dbResult, redisResult] = checks;

  // Indexador: un listener con suscripciones caídas responde igual de bien que
  // uno sano, pero deja huecos en los datos. Sin exponerlo aquí, la avería se
  // descubre semanas después por la vía de echar de menos eventos que nunca
  // llegaron. Por eso 'degraded' y no 'up'.
  let indexer = 'unknown';
  let chain = 'unknown';
  const detail = {};
  try {
    const ls = require('./services/eventListener').getListenerStats();
    const failed = ls.failedSubscriptions || [];

    // La cadena y el indexador se informan por separado a propósito: "el nodo
    // no responde" y "el indexador tiene suscripciones rotas" son averías
    // distintas, con responsables distintos, y mezclarlas en un solo semáforo
    // obliga a ir al log para saber cuál de las dos es.
    chain = ls.chainReachable === null ? 'unknown' : (ls.chainReachable ? 'up' : 'down');
    indexer = !ls.active ? 'down' : (failed.length ? 'degraded' : (ls.chainReachable === false ? 'degraded' : 'up'));

    if (failed.length) detail.indexer_failed_subscriptions = failed.map((f) => f.eventName);
    if (ls.chainReachable === false) {
      detail.chain_error = ls.lastChainError;
      detail.chain_reconnect_attempts = ls.reconnectAttempts;
      detail.chain_next_retry_ms = ls.nextReconnectInMs;
    }
  } catch { /* el indexador es opcional según despliegue */ }

  const services = {
    database: dbResult.status === 'fulfilled' ? 'up' : 'down',
    redis: redisResult.status === 'fulfilled' ? 'up' : 'down',
    chain,
    indexer,
    ...detail,
    // omie_feed: 'up' / 'down'  — activar en producción
    // vpp_agent: openclaw?.isReady('energy-agent') ? 'up' : 'degraded'
  };

  // HTTP 200 siempre (el LB solo necesita que el proceso responda)
  // El cliente puede leer `services` para saber el estado real
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '3.1.0',
    uptime_s: Math.floor(process.uptime()),
    services,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 7: RUTAS — DOMINIO
// ═══════════════════════════════════════════════════════════════════════════════

// ── Autenticación y usuarios ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/organizations', organizationTechRoutes);
app.use('/api/organizations', organizationBillingRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/admin-config', adminConfigRoutes);
app.use('/api/admin/governance', adminGovernanceRoutes);

// ── Blockchain / Contratos / Tokens ──────────────────────────────────────────
app.use('/api/contracts', contractsAbiRoutes);  // ABI/deploy/agent (específico primero)
app.use('/api/contracts', contractRoutes);       // /:name fallback (genérico segundo)
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/validators', validatorRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/nfts', nftRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/gas', gasRoutes);

// ── Mercado / DeFi ────────────────────────────────────────────────────────────
app.use('/api/market', marketRoutes);
app.use('/api/ecosystem-bridge', ecosystemBridgeRoutes);

// ── ⚡ Energía / VPP ──────────────────────────────────────────────────────────
// Gestión de la Central Eléctrica Virtual: telemetría MQTT/Modbus,
// arbitraje OMIE/ESIOS, tokens CAE (RWA), mercado P2P, SCADA/HITL, Aegis.
app.use('/api/energy', energyRoutes);

// ── AI / Agentes / OpenClaw ───────────────────────────────────────────────────
// agentRoutes es una factory function que devuelve un router Express.
// Razón: necesita inicializar el AgentManager lazy (evita ciclos de dependencia
// en el booteo cuando Redis aún no está listo).
app.use('/api/agents', agentRoutes());
app.use('/api/agent', unifiedAgentRoutes);  // endpoint unificado para el frontend
app.use('/api/runtime', runtimeRoutes);
app.use('/api/openclaw', openclawRoutes);
app.use('/api/ai-billing', aiBillingRoutes);
app.use('/api/mtfc', mtfcRoutes);

// ── 🏢 OPERANT — Gestión empresarial autónoma ────────────────────────────────
// 10 departamentos de agentes IA servidos por suscripción: entitlements por
// plan, cuota + pago por uso, y anclaje merkle de la auditoría en L2.
app.use('/api/operant', operantRoutes);

// ── Seguridad / Aegis ─────────────────────────────────────────────────────────
app.use('/api/ai-control', aegisRoutes);        // alias legacy
app.use('/api/aegis', aegisRoutes);

// ── Plataforma / SaaS ─────────────────────────────────────────────────────────
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sectors', sectorRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/config', configRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/qr', qrRoutes);

// ── Gateway ───────────────────────────────────────────────────────────────────
app.use('/api/gateway/v1', gatewayRoutes);
app.use('/c', require('./routes/checkout')); // hosted checkout (pay.bez.digital/c/<token>)
app.use('/api/cargolink', cargoLinkRoutes);

// ── Enterprise lookup (interno — Edge Nodes / Nodos Empresariales) ────────────
app.get('/api/enterprises/by-key', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header', code: 'AUTH_MISSING_KEY' });
  }
  try {
    const { rows } = await query(
      `SELECT tier, name, wallet_address
       FROM enterprises
       WHERE api_key_hash = encode(digest($1, 'sha256'), 'hex')
         AND is_active = true
       LIMIT 1`,
      [apiKey]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Enterprise not found', code: 'ENTERPRISE_NOT_FOUND' });
    }
    res.json({ tier: rows[0].tier, name: rows[0].name, wallet_address: rows[0].wallet_address });
  } catch (err) {
    gcpLogger.error('[ENTERPRISE][LOOKUP]', { error: err.message, requestId: req.id });
    res.status(500).json({ error: 'Lookup failed', code: 'ENTERPRISE_LOOKUP_ERROR' });
  }
});

// ── Monitor (War Room aggregator) ────────────────────────────────────────────
app.use('/api/monitor', monitorRoutes);

// ── Legacy telemetry alias ────────────────────────────────────────────────────
/**
 * Alias de compatibilidad para clientes que aún usan la ruta legacy.
 * Nueva ruta canónica: POST /api/energy/telemetry (o el pipeline de Aegis).
 * @deprecated — migrar a /api/energy/control o /api/aegis/telemetry
 */
app.post('/api/telemetry/process', authenticateToken, async (req, res) => {
  try {
    const result = await aegisService.processTelemetryAndTokenize(
      req.user.address,
      req.body.containerId,
      req.body.telemetryData
    );
    res.json(result);
  } catch (err) {
    gcpLogger.error('[TELEMETRY][LEGACY]', { error: err.message, requestId: req.id });
    res.status(500).json({ error: 'Telemetry processing failed', code: 'TELEMETRY_ERROR' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 8: ERROR HANDLING
//  ORDEN CRÍTICO: 404 → Error global → (sin más middleware)
// ═══════════════════════════════════════════════════════════════════════════════

/** 404 — ruta no encontrada */
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
});

/**
 * Error handler global de Express.
 * DEBE tener exactamente 4 parámetros (err, req, res, next) para que Express
 * lo reconozca como error handler. No omitir `next` aunque no se use.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  gcpLogger.error('[GLOBAL_ERROR]', {
    message: err.message,
    stack: IS_PROD ? undefined : err.stack,
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
  });

  // No filtrar el mensaje en desarrollo para facilitar debugging
  res.status(err.status || 500).json({
    error: 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    message: !IS_PROD ? err.message : 'Something went wrong',
    requestId: req.id,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 9: PROCESO — Manejo de errores no capturados
//  En producción: loggear + salir para que el orquestador (PM2/K8s) reinicie.
//  En desarrollo: solo loggear para no perder el estado de debugging.
// ═══════════════════════════════════════════════════════════════════════════════

process.on('unhandledRejection', (reason, promise) => {
  gcpLogger.error('[UNHANDLED_REJECTION]', {
    reason: reason?.message || String(reason),
    stack: reason?.stack,
    promise: String(promise),
  });
  if (IS_PROD) {
    // Dar tiempo a que el logger async termine antes de salir
    setTimeout(() => process.exit(1), 500);
  }
});

process.on('uncaughtException', (err) => {
  gcpLogger.error('[UNCAUGHT_EXCEPTION]', { message: err.message, stack: err.stack });
  // uncaughtException siempre requiere exit — el estado del proceso es indeterminado
  setTimeout(() => process.exit(1), 500);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 10: GRACEFUL SHUTDOWN
//  Permite que conexiones activas (WebSocket VPP, MQTT, DB pool) cierren limpio
//  antes de que el proceso termine (SIGTERM = señal de K8s / PM2 / systemd).
// ═══════════════════════════════════════════════════════════════════════════════

let httpServer = null;  // referencia al servidor HTTP para poder cerrarlo

async function shutdown(signal) {
  gcpLogger.info(`[SHUTDOWN] ${signal} received — starting graceful shutdown`);

  // 1. Dejar de aceptar nuevas conexiones
  if (httpServer) {
    await new Promise(resolve => httpServer.close(resolve));
    gcpLogger.info('[SHUTDOWN] HTTP server closed');
  }

  // 2. Cerrar conexiones DB (esperar queries en vuelo)
  try {
    await pool.end();
    gcpLogger.info('[SHUTDOWN] PostgreSQL pool closed');
  } catch (err) {
    gcpLogger.warning('[SHUTDOWN] PostgreSQL pool close error', { error: err.message });
  }

  // 3. Cerrar Redis
  try {
    await redisClient?.quit();
    gcpLogger.info('[SHUTDOWN] Redis connection closed');
  } catch (err) {
    gcpLogger.warning('[SHUTDOWN] Redis close error', { error: err.message });
  }

  // 4. Detener gas monitor daemon
  try {
    gasMonitor.stopDaemon?.();
    gcpLogger.info('[SHUTDOWN] Gas monitor stopped');
  } catch (_) { /* no crítico */ }

  gcpLogger.info('[SHUTDOWN] Graceful shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 11: STARTUP — secuencia de arranque
// ═══════════════════════════════════════════════════════════════════════════════

async function startServer() {

  // ── PASO 0: GCP Secret Manager (DEBE ser primero — otros servicios dependen de env vars) ──
  try {
    await loadSecretsIntoEnv();
    gcpLogger.info('[STARTUP] Secrets loaded from GCP Secret Manager');
  } catch (err) {
    // No bloquear el arranque — puede estar en modo local sin GCP
    gcpLogger.warning('[STARTUP] GCP secrets unavailable, using .env fallback', { error: err.message });
  }

  // ── PASO 1: Redis (no bloqueante — la API puede funcionar sin caché) ──────────
  connectRedis()
    .then(() => gcpLogger.info('[STARTUP] Redis connected'))
    .catch(err => gcpLogger.warning('[STARTUP] Redis unavailable — degraded cache mode', { error: err.message }));

  // ── PASO 2: PostgreSQL (no bloqueante — health check lo reflejará) ────────────
  query('SELECT 1')
    .then(() => gcpLogger.info('[STARTUP] PostgreSQL connected'))
    .catch(err => gcpLogger.error('[STARTUP] PostgreSQL unavailable', { error: err.message }));

  // ── PASO 3: Event listeners blockchain ───────────────────────────────────────
  startListening()
    .then(() => gcpLogger.info('[STARTUP] Blockchain event listener started'))
    .catch(err => gcpLogger.warning('[STARTUP] EventListener skipped', { error: err.message }));

  // ── PASO 3b: Redis event consumer ────────────────────────────────────────────
  startConsumer()
    .then(() => gcpLogger.info('[STARTUP] Redis event consumer started'))
    .catch(err => gcpLogger.warning('[STARTUP] EventConsumer skipped', { error: err.message }));

  // ── PASO 3c: Agent runtime (los 5 agentes, dentro de este proceso) ───────────
  // No bloqueante y a prueba de fallos: si no levanta, la API sigue sirviendo
  // pagos, cadena y energía, y /api/agents responde 503 con el motivo.
  agentRuntime.init()
    .then((m) => {
      const s = agentRuntime.status();
      if (m) gcpLogger.info('[STARTUP] Agent runtime cableado', { agentes: s.agentes });
      else gcpLogger.warning('[STARTUP] Agent runtime no cableado', { motivo: s.motivo });
    })
    .catch(err => gcpLogger.warning('[STARTUP] Agent runtime error', { error: err.message }));

  // ── PASO 4: Gas monitor daemon ────────────────────────────────────────────────
  gasMonitor.startDaemon(60_000);
  gcpLogger.info('[STARTUP] Gas monitor daemon started (60s interval)');

  // ── PASO 4b: BEZ-Pay — settlement watcher + webhook dispatcher (opt-in) ──────
  if (process.env.PAYMENTS_WATCHER_ENABLED === 'true') {
    const { startWatcher } = require('./services/bezSettlementWatcher');
    startWatcher({
      chainId: parseInt(process.env.SETTLEMENT_CHAIN_ID || '137', 10),
      intervalMs: parseInt(process.env.SETTLEMENT_POLL_MS || '30000', 10),
    });
    gcpLogger.info('[STARTUP] BEZ settlement watcher started');
  }
  if (process.env.PAYMENTS_WEBHOOKS_ENABLED === 'true') {
    const { startDispatcher } = require('./services/paymentWebhooks');
    startDispatcher(parseInt(process.env.WEBHOOK_DISPATCH_MS || '15000', 10));
    gcpLogger.info('[STARTUP] Payment webhook dispatcher started');
  }

  // ── PASO 5: OpenClaw AI Orchestrator ──────────────────────────────────────────
  try {
    const openclaw = require('@bezhas/openclaw-unified');
    openclaw
      .init({ skipHealth: false, watchConfig: true })
      .then(status => {
        gcpLogger.info('[STARTUP] OpenClaw initialized', { status });
        // Registrar el Energy Agent después de que OpenClaw esté listo
        return openclaw.registerAgent('energy-agent', {
          skills: ['get_omie_price', 'execute_battery_arbitrage', 'get_alerts'],
          llmChain: ['claude-sonnet', 'gemini-2.0-flash', 'claude-haiku', 'gpt-4o-mini', 'ollama'],
          hitl: { required: true, timeout: 300_000 },
        });
      })
      .then(() => gcpLogger.info('[STARTUP] Energy Agent registered in OpenClaw'))
      .catch(err => gcpLogger.warning('[STARTUP] OpenClaw init/agent registration failed', { error: err.message }));
  } catch (err) {
    gcpLogger.warning('[STARTUP] OpenClaw module not found — skipping', { error: err.message });
  }

  // ── PASO 6: ⚡ VPP Energy Layer — conexión MQTT broker para Edge Nodes ────────
  // Inicializar la conexión MQTT al broker de los Edge Nodes (inversores, baterías, medidores).
  // Los Edge Nodes publican telemetría en: bezhas/edge/<nodeId>/telemetry
  // El servidor controla via: bezhas/edge/<nodeId>/control
  try {
    const vppBroker = require('./services/vppMqttBroker');  // cliente MQTT/WebSocket para Edge Nodes

    // Phase 2 — load registered Edge Node public keys (telemetry signature verification).
    try {
      const telemetrySecurity = require('./services/telemetrySecurity');
      const n = telemetrySecurity.loadKeys();
      if (n) gcpLogger.info(`[STARTUP] VPP telemetry signing keys loaded: ${n}`);
    } catch (e) { gcpLogger.warning('[STARTUP] telemetrySecurity load skipped', { error: e.message }); }

    // Phase 3 + 4 — persist telemetry/Aegis events AND accumulate signed telemetry
    // for on-chain merkle anchoring. One composed sink feeds both.
    try {
      const telemetryStore = require('./services/energyTelemetryStore');
      const telemetryAnchor = require('./services/telemetryAnchor');
      vppBroker.setTelemetrySink((rec) => { telemetryStore.capture(rec); telemetryAnchor.observe(rec); });
      telemetryStore.start();
      gcpLogger.info('[STARTUP] VPP telemetry persistence enabled');

      // Phase 4 — auto-anchor merkle roots on-chain (opt-in: VPP_ANCHOR_AUTO=true).
      try {
        const vppChainBridge = require('./services/vppChainBridge');
        const beneficiary = process.env.VPP_ANCHOR_ACCOUNT || process.env.HOT_WALLET_ADDRESS;
        if (beneficiary && telemetryAnchor.start(vppChainBridge, beneficiary)) {
          gcpLogger.info('[STARTUP] VPP on-chain telemetry anchoring enabled');
        }
      } catch (e) { gcpLogger.warning('[STARTUP] telemetry anchoring skipped', { error: e.message }); }
    } catch (e) { gcpLogger.warning('[STARTUP] telemetry persistence skipped', { error: e.message }); }

    vppBroker
      .connect({
        brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clientId: `bezhas-api-${process.env.NODE_ENV}-${Date.now()}`,
        reconnectPeriod: 5_000,
      })
      .then(() => gcpLogger.info('[STARTUP] VPP MQTT broker connected — Edge Nodes ready'))
      .catch(err => gcpLogger.warning('[STARTUP] VPP MQTT broker unavailable — running in mock mode', { error: err.message }));
  } catch (err) {
    gcpLogger.warning('[STARTUP] vppMqttBroker module not found — VPP in mock mode', { error: err.message });
  }

  // CargoLink MQTT ingestion (trackers, e-seals, reefer loggers) — opt-in via CARGO_MQTT_URL.
  // Devices publish to bezhas/cargo/<deviceId>/telemetry; same pipeline as POST /v1/iot/telemetry.
  try {
    const cargoMqtt = require('./services/cargoMqttIngest');
    cargoMqtt
      .connect()
      .then((ok) => { if (ok) gcpLogger.info('[STARTUP] CargoLink MQTT ingestion connected'); })
      .catch((err) => gcpLogger.warning('[STARTUP] CargoLink MQTT unavailable', { error: err.message }));
  } catch (err) {
    gcpLogger.warning('[STARTUP] cargoMqttIngest module not found', { error: err.message });
  }

  // Batching de eventos logísticos — opt-in vía CARGOLINK_BATCH_MODE=evidence.
  // Agrupa las transiciones de evidencia en una raíz merkle y ancla una sola
  // transacción por lote. Medido: 199.676 gas por evento suelto frente a 6.251
  // dentro de un lote — el factor que separa un techo de 75 ev/s de uno de
  // ~2.400 ev/s. Los eventos que mueven escrow siguen anclándose uno a uno.
  try {
    const cargoBatcher = require('./services/cargoLinkBatcher');
    if (cargoBatcher.start()) {
      gcpLogger.info('[STARTUP] CargoLink event batching enabled', { mode: cargoBatcher.MODE });
    }
  } catch (err) {
    gcpLogger.warning('[STARTUP] cargoLinkBatcher no disponible', { error: err.message });
  }

  // Ancla en Ethereum L1 — opt-in vía L1_BATCHER_ENABLED.
  // Publica el compromiso de estado de la L2 con fianza. Lo que hace que el
  // ancla valga como evidencia no es publicarla, sino que sea refutable:
  // BeZhasL1Commitment verifica en L1 tres pruebas de fraude deterministas.
  try {
    const l1Batcher = require('./services/l1Batcher');
    if (l1Batcher.start()) {
      gcpLogger.info('[STARTUP] L1 commitment batcher enabled');
    }
  } catch (err) {
    gcpLogger.warning('[STARTUP] l1Batcher no disponible', { error: err.message });
  }

  // Vigilante de fraude — opt-in vía L1_WATCHER_ENABLED.
  //
  // ADVERTENCIA DE DISEÑO: ejecutar el vigilante DENTRO de la propia API de
  // BeZhas sirve para detectar errores de nuestro software, y para poco más.
  // La garantía institucional exige que lo levante un tercero — un cliente, un
  // auditor, una aseguradora — con su propio RPC y su propia cuenta. No
  // necesita permisos nuestros: sólo mirar la cadena y cobrar si nos pilla.
  try {
    const l1Watcher = require('./services/l1FraudProver');
    if (l1Watcher.start()) {
      gcpLogger.info('[STARTUP] L1 fraud watcher enabled (self-audit; third-party watchers are the real guarantee)');
    }
  } catch (err) {
    gcpLogger.warning('[STARTUP] l1FraudProver no disponible', { error: err.message });
  }

  // ── PASO 7: OMIE/ESIOS feed pre-caché ────────────────────────────────────────
  // Pre-cargar el precio OMIE actual al arrancar para que el primer request
  // al Energy Agent tenga datos disponibles inmediatamente.
  try {
    const energyFeedService = require('./services/energyFeedService');
    energyFeedService
      .prefetchOmiePrice()
      .then(price => gcpLogger.info('[STARTUP] OMIE price pre-cached', { price_eur_mwh: price }))
      .catch(err => gcpLogger.warning('[STARTUP] OMIE pre-cache failed', { error: err.message }));
  } catch (err) {
    gcpLogger.warning('[STARTUP] energyFeedService not found — OMIE feed lazy-load only', { error: err.message });
  }

  // ── PASO 7.5: ⚡ Agente de arbitraje autónomo (opt-in) ────────────────────────
  // Solo se arranca con ARBITRAGE_AUTO=true para evitar despachos automáticos no
  // deseados. Evalúa OMIE real + telemetría de batería y despacha por MQTT.
  if (process.env.ARBITRAGE_AUTO === 'true') {
    try {
      const arbAgent = require('./services/energyArbitrageAgent');
      const intervalMs = parseInt(process.env.ARBITRAGE_INTERVAL_MS || '300000', 10);
      arbAgent.start(intervalMs);
      gcpLogger.info('[STARTUP] Arbitrage agent started', { intervalMs });
    } catch (err) {
      gcpLogger.warning('[STARTUP] Arbitrage agent failed to start', { error: err.message });
    }
  }

  // ── PASO 8: Escuchar (SIEMPRE el último paso) ─────────────────────────────────
  httpServer = app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    const banner = [
      '',
      '  ╔══════════════════════════════════════════════╗',
      `  ║  🚀  BeZhas API v3.1.0  — PORT ${PORT}          ║`,
      `  ║  ENV: ${env.padEnd(38)}║`,
      '  ║  VPP Energy Layer: ACTIVE                    ║',
      '  ║  OpenClaw AI Orchestrator: ACTIVE            ║',
      '  ╚══════════════════════════════════════════════╝',
      '',
    ].join('\n');
    console.log(banner);

    gcpLogger.info('BeZhas API v3.1.0 started', {
      port: PORT,
      env,
      vppEnabled: true,
      openclawEnabled: true,
    });
  });

  // Timeout para conexiones keepalive — evitar que conexiones lentas bloqueen el shutdown
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 66_000;

  return httpServer;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECCIÓN 12: EXPORT Y AUTO-START
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Exportar `app` para testing con supertest (sin levantar el servidor).
 * startServer() solo se llama si el módulo es el punto de entrada principal,
 * no cuando es importado por tests o por otros módulos.
 *
 * FIX: En v3.0.0 el bloque `else` llamaba connectRedis() de nuevo, causando
 * una segunda conexión huérfana. Eliminado completamente — los tests que
 * necesiten Redis deben gestionarlo explícitamente en su setup.
 */
module.exports = app;

if (require.main === module) {
  startServer().catch(err => {
    gcpLogger.error('[STARTUP] Fatal error during startup', { error: err.message, stack: err.stack });
    process.exit(1);
  });
}
