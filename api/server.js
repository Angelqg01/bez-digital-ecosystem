/**
 * BeZhas API Server — Express + WebSocket
 * Punto de entrada del servidor REST y WebSocket.
 *
 * Puertos:
 *   REST:      api.bez.digital:3001  (HTTP)
 *   WebSocket: ws.bez.digital:3002   (WS sobre el mismo servidor)
 *
 * Depende de:
 *   AgentManager      (agent-runtime)
 *   TokenomicsEngine  (sdk/tokenomics-engine)
 *   BridgeManager     (sdk/bridge-manager)
 *   BeZhasWebSocketServer (api/websocket)
 */

'use strict';

require('dotenv').config();

const http    = require('http');
const express = require('express');
const cors    = require('cors');

const BeZhasWebSocketServer = require('./websocket');
const agentsRouter          = require('./routes/agents');
const tokenomicsRouter      = require('./routes/tokenomics');
const purescanRouter        = require('./routes/purescan');
const mtfcRouter            = require('./routes/mtfc');
const cargoLinkRouter       = require('./routes/cargolink');

// ─── Configuración ─────────────────────────────────────────────────────────

const PORT     = parseInt(process.env.API_PORT    || '3001');
const WS_PORT  = parseInt(process.env.WS_PORT     || '3002');
const ORIGINS  = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');

// ─── Factory ───────────────────────────────────────────────────────────────

async function createApiServer(manager, engine = null, bridgeMgr = null) {
  const app = express();

  // ── Middleware ─────────────────────────────────────────────────────────
  app.use(cors({ origin: ORIGINS, credentials: true }));
  // verify: keep exact bytes for inbound HMAC (CargoLink /v1/ingest/:providerId)
  app.use(express.json({ limit: '2mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use(express.urlencoded({ extended: true }));

  // Request logger
  app.use((req, _res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // ── HTTP Server (para REST + WS compartiendo mismo puerto) ────────────
  const httpServer = http.createServer(app);

  // ── WebSocket Server ──────────────────────────────────────────────────
  const wss = new BeZhasWebSocketServer(httpServer, manager);
  wss.startPing();

  // Exponer WSS al manager para que los agentes puedan broadcastear
  if (manager) manager._wss = wss;

  // ── Routes ────────────────────────────────────────────────────────────
  app.use('/api',             agentsRouter(manager, wss));
  app.use('/api/tokenomics',  tokenomicsRouter(manager, engine, bridgeMgr, wss));
  app.use('/api/purescan',    purescanRouter(manager));
  app.use('/api/mtfc',        mtfcRouter);
  app.use('/api/cargolink',   cargoLinkRouter);

  // ── Root ──────────────────────────────────────────────────────────────
  app.get('/', (_req, res) => res.json({
    name:    'BeZhas API',
    version: '1.0.0',
    status:  'running',
    endpoints: [
      'GET  /api/health',
      'GET  /api/status',
      'GET  /api/agents',
      'POST /api/tasks',
      'GET  /api/hitl/pending',
      'POST /api/hitl/approve/:taskId',
      'POST /api/hitl/reject/:taskId',
      'GET  /api/aegis/alerts',
      'GET  /api/tokenomics/snapshot',
      'GET  /api/tokenomics/staking',
      'GET  /api/tokenomics/farming/pools',
      'GET  /api/tokenomics/bridge/routes',
      'GET  /api/tokenomics/governance/stats',
      'POST /api/tokenomics/compliance/check',
      'GET  /api/tokenomics/user/:address',
      'GET  /api/mtfc/manifest',
      'POST /api/mtfc/evaluate',
      'POST /api/mtfc/batch',
      'POST /api/mtfc/estimate',
    ],
    ws: {
      rooms: ['/agent-runtime', '/tokenomics', '/aegis', '/compliance'],
    },
  }));

  // ── 404 ────────────────────────────────────────────────────────────────
  app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.path}` }));

  // ── Error handler ─────────────────────────────────────────────────────
  app.use((err, _req, res, _next) => {
    console.error('[API] Error:', err.message);
    res.status(500).json({ error: err.message });
  });

  return { app, httpServer, wss };
}

// ─── Arranque standalone (cuando se llama directamente) ────────────────────

async function start() {
  console.log('\n[API] 🚀 Iniciando BeZhas API Server...\n');

  // Importar dependencias del runtime
  const AgentManager   = require('../agent-runtime/AgentManager');
  const SecurityAgent  = require('../agent-runtime/agents/SecurityAgent');
  const TradingAgent   = require('../agent-runtime/agents/TradingAgent');
  const WorkflowAgent  = require('../agent-runtime/agents/WorkflowAgent');
  const ComplianceAgent= require('../agent-runtime/agents/ComplianceAgent');
  const TokenomicsAgent= require('../agent-runtime/agents/TokenomicsAgent');
  const TokenomicsConnector = require('../agent-runtime/connectors/TokenomicsConnector');

  // Config
  const config = {
    rpcUrl:      process.env.RPC_URL     || 'http://localhost:8545',
    wsUrl:       process.env.WS_URL      || 'ws://localhost:8546',
    redisUrl:    process.env.REDIS_URL   || 'redis://localhost:6379',
    openclawUrl: process.env.OPENCLAW_URL|| 'http://localhost:8080',
    hitlEnabled: process.env.HITL_ENABLED !== 'false',
    hitlCallbackUrl: process.env.HITL_CALLBACK_URL || 'http://localhost:3001/api/hitl',
    // Contratos
    bezAddress:        process.env.BEZ_TOKEN_ADDRESS,
    stakingAddress:    process.env.STAKING_POOL_ADDRESS,
    farmingAddress:    process.env.FARMING_POOL_ADDRESS,
    validatorsAddress: process.env.VALIDATOR_REGISTRY_ADDRESS,
    slashingAddress:   process.env.SLASHING_MANAGER_ADDRESS,
    openClawAgentAddress:    process.env.OPENCLAW_AGENT_ADDRESS,
    aegisProviderAddress:    process.env.AEGIS_PROVIDER_ADDRESS,
    workflowRegistryAddress: process.env.WORKFLOW_REGISTRY_ADDRESS,
  };

  // Agent Manager
  const manager = new AgentManager(config);
  manager.registerAgent(SecurityAgent,   {});
  manager.registerAgent(TradingAgent,    {});
  manager.registerAgent(WorkflowAgent,   {});
  manager.registerAgent(ComplianceAgent, {});

  // Tokenomics Connector + Agent
  const tc = new TokenomicsConnector(config);
  await tc.connect().catch(e => console.warn('[API] TokenomicsConnector:', e.message));

  manager.registerAgent(TokenomicsAgent, { tokenomicsConnector: tc });
  manager._tokenomicsConnector = tc;

  // Arrancar AgentManager
  await manager.start().catch(e => console.warn('[API] AgentManager.start:', e.message));

  // TokenomicsEngine (opcional — requiere contratos en .env)
  let engine = null;
  if (config.bezAddress) {
    try {
      const TokenomicsEngine = require('../sdk/tokenomics-engine');
      engine = await TokenomicsEngine.create(
        config.rpcUrl, config.privateKey, parseInt(process.env.CHAIN_ID || '137'),
        config
      );
      console.log('[API] ✅ TokenomicsEngine conectado');
    } catch (e) {
      console.warn('[API] ⚠️  TokenomicsEngine no disponible:', e.message);
    }
  }

  // BridgeManager (opcional)
  let bridgeMgr = null;
  if (process.env.POLYGON_BRIDGE_ADDRESS || process.env.BNB_BRIDGE_ADDRESS) {
    try {
      const BridgeManager = require('../sdk/bridge-manager');
      bridgeMgr = await BridgeManager.create({ addresses: {
        'polygon-l2': process.env.POLYGON_BRIDGE_ADDRESS,
        'bnb-l2':     process.env.BNB_BRIDGE_ADDRESS,
        'eth-l2':     process.env.ETH_BRIDGE_ADDRESS,
      }});
      console.log('[API] ✅ BridgeManager conectado');
    } catch (e) {
      console.warn('[API] ⚠️  BridgeManager no disponible:', e.message);
    }
  }

  // Crear servidor
  const { httpServer, wss } = await createApiServer(manager, engine, bridgeMgr);

  httpServer.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║  BeZhas API Server v1.0                           ║`);
    console.log(`╠══════════════════════════════════════════════════╣`);
    console.log(`║  REST:      http://localhost:${PORT}                  ║`);
    console.log(`║  WebSocket: ws://localhost:${PORT}/agent-runtime      ║`);
    console.log(`║             ws://localhost:${PORT}/tokenomics          ║`);
    console.log(`║             ws://localhost:${PORT}/aegis               ║`);
    console.log(`║  Docs:      http://localhost:${PORT}/                  ║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);
  });

  // Graceful shutdown
  const shutdown = async (sig) => {
    console.log(`\n[API] ${sig} → cerrando...`);
    await manager.stop();
    await tc.disconnect().catch(() => {});
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Standalone
if (require.main === module) start().catch(e => { console.error(e); process.exit(1); });

module.exports = { createApiServer };
