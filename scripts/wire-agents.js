/**
 * BeZhas — wire-agents.js (Sprint 4 — versión final)
 * Arranca y conecta TODO el ecosistema BeZhas:
 *
 *   Agent Runtime
 *     ├── SecurityAgent   (AEGIS + HITL)
 *     ├── TradingAgent    (HITL obligatorio)
 *     ├── WorkflowAgent   (WorkflowRegistry.sol)
 *     ├── ComplianceAgent (MiCA · DAC8 · Modelo720 · AEAT · AML)  ← nuevo S4
 *     └── TokenomicsAgent (monitor tokenomics + LLM analysis)      ← nuevo S4
 *
 *   Connectors
 *     ├── BlockchainConnector  (WS op-geth)
 *     ├── AegisConnector       (polling on-chain)
 *     ├── OpenClawConnector    (Python engine + Ollama fallback)
 *     └── TokenomicsConnector  (WS events + snapshots)             ← nuevo S4
 *
 *   Channels
 *     ├── TelegramChannel  (long-polling bot)
 *     ├── ChannelRouter    (intent → agente)
 *     └── HITLHandler      (HTTP :3099)
 *
 *   API Server (Express + WebSocket)                               ← nuevo S4
 *     ├── REST :3001  → /api/*
 *     └── WS   :3001  → /agent-runtime · /tokenomics · /aegis · /compliance
 *
 * DESARROLLO (Opción 1): ollama serve → node scripts/wire-agents.js
 * PRODUCCIÓN (futuro Opción 3): Docker Compose + RTX 4090 GPU passthrough
 */

'use strict';

require('dotenv').config();
const http = require('http');

// ── Runtime ────────────────────────────────────────────────────────────────
const AgentManager        = require('../agent-runtime/AgentManager');
const SecurityAgent       = require('../agent-runtime/agents/SecurityAgent');
const TradingAgent        = require('../agent-runtime/agents/TradingAgent');
const WorkflowAgent       = require('../agent-runtime/agents/WorkflowAgent');
const ComplianceAgent     = require('../agent-runtime/agents/ComplianceAgent');
const TokenomicsAgent     = require('../agent-runtime/agents/TokenomicsAgent');
const TokenomicsConnector = require('../agent-runtime/connectors/TokenomicsConnector');

// ── Channels ───────────────────────────────────────────────────────────────
const TelegramChannel = require('../openclaw/channels/TelegramChannel');
const ChannelRouter   = require('../openclaw/channels/ChannelRouter');
const HITLHandler     = require('../openclaw/channels/HITLHandler');

// ── API Server ─────────────────────────────────────────────────────────────
const { createApiServer } = require('../api/server');

// ─── CONFIG ────────────────────────────────────────────────────────────────

const config = {
  // Blockchain L2
  rpcUrl:                  process.env.RPC_URL                   || 'http://localhost:8545',
  wsUrl:                   process.env.WS_URL                    || 'ws://localhost:8546',
  openClawAgentAddress:    process.env.OPENCLAW_AGENT_ADDRESS    || null,
  aegisProviderAddress:    process.env.AEGIS_PROVIDER_ADDRESS    || null,
  workflowRegistryAddress: process.env.WORKFLOW_REGISTRY_ADDRESS || null,
  privateKey:              process.env.AGENT_PRIVATE_KEY         || null,

  // Contratos tokenómicos
  bezAddress:        process.env.BEZ_TOKEN_ADDRESS,
  stakingAddress:    process.env.STAKING_POOL_ADDRESS,
  farmingAddress:    process.env.FARMING_POOL_ADDRESS,
  validatorsAddress: process.env.VALIDATOR_REGISTRY_ADDRESS,
  slashingAddress:   process.env.SLASHING_MANAGER_ADDRESS,
  paymentsAddress:   process.env.PAYMENTS_ADDRESS,
  polygonBridge:     process.env.POLYGON_BRIDGE_ADDRESS,
  bnbBridge:         process.env.BNB_BRIDGE_ADDRESS,

  // Servicios
  redisUrl:     process.env.REDIS_URL     || 'redis://localhost:6379',
  openclawUrl:  process.env.OPENCLAW_URL  || 'http://localhost:8080',

  // HITL
  hitlEnabled:     process.env.HITL_ENABLED !== 'false',
  hitlTimeoutMs:   parseInt(process.env.HITL_TIMEOUT_MS || '60000'),
  hitlCallbackUrl: process.env.HITL_CALLBACK_URL || 'http://localhost:3001/api/hitl',

  // API
  apiPort: parseInt(process.env.API_PORT || '3001'),

  // Telegram
  telegramToken:        process.env.TELEGRAM_BOT_TOKEN,
  telegramAllowedUsers: process.env.TELEGRAM_ALLOWED_USERS || '',
  telegramChatIds:      process.env.TELEGRAM_CHAT_IDS      || '',
};

// ─── PREFLIGHT ─────────────────────────────────────────────────────────────

async function preflight() {
  console.log('\n[Wire] 🔍 Preflight checks...\n');

  // Ollama (Opción 1 — desarrollo)
  try {
    const res  = await fetch('http://localhost:11434/api/tags', { signal:AbortSignal.timeout(2000) });
    const data = await res.json();
    const mdls = (data.models || []).map(m => m.name);
    console.log(`[Wire] ✅ Ollama: ${mdls.join(', ') || '(sin modelos — ejecuta: ollama pull llama3.2)'}`);
  } catch {
    console.warn('[Wire] ⚠️  Ollama no disponible — usando APIs externas como LLM principal');
    console.warn('[Wire]    Para activar: ollama serve');
  }

  // Redis
  try {
    const { createClient } = require('redis');
    const rc = createClient({ url: config.redisUrl });
    await rc.connect(); await rc.ping(); await rc.quit();
    console.log('[Wire] ✅ Redis:', config.redisUrl);
  } catch (e) {
    console.error('[Wire] ❌ Redis no disponible:', e.message);
    console.error('[Wire]    Asegúrate de que docker-compose está corriendo');
    process.exit(1);
  }

  // Contratos configurados
  const contractsConfigured = [
    ['BEZ Token',        config.bezAddress],
    ['StakingPool',      config.stakingAddress],
    ['OpenClaw Agent',   config.openClawAgentAddress],
    ['AEGIS Provider',   config.aegisProviderAddress],
  ];
  for (const [name, addr] of contractsConfigured) {
    if (addr) console.log(`[Wire] ✅ ${name}: ${addr.slice(0,10)}...`);
    else      console.warn(`[Wire] ⚠️  ${name}: no configurado en .env (usando mock)`);
  }

  // Telegram
  if (!config.telegramToken) console.warn('[Wire] ⚠️  TELEGRAM_BOT_TOKEN no configurado — canal Telegram desactivado');
  else                        console.log('[Wire] ✅ Telegram token configurado');

  console.log('');
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     BeZhas — Sistema Completo v1.0 (Sprint 4)            ║');
  console.log('║     Runtime + Telegram + API + WS + Compliance           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  await preflight();

  // ── 1. TOKENOMICS CONNECTOR ───────────────────────────────────────────────
  console.log('[Wire] 📊 Iniciando TokenomicsConnector...');
  const tc = new TokenomicsConnector(config);
  await tc.connect().catch(e => console.warn('[Wire] TokenomicsConnector degraded:', e.message));

  // ── 2. AGENT MANAGER ─────────────────────────────────────────────────────
  console.log('[Wire] 🚀 Iniciando Agent Runtime...');
  const manager = new AgentManager(config);
  manager._tokenomicsConnector = tc;

  manager.registerAgent(SecurityAgent,   {});
  manager.registerAgent(TradingAgent,    {});
  manager.registerAgent(WorkflowAgent,   {});
  manager.registerAgent(ComplianceAgent, {});
  manager.registerAgent(TokenomicsAgent, { tokenomicsConnector: tc });

  await manager.start();

  // Inicializar TokenomicsAgent con suscripciones
  await manager.getAgent('tokenomics-agent')
    ?.initialize()
    ?.catch(e => console.warn('[Wire] TokenomicsAgent.initialize:', e.message));

  console.log('[Wire] ✅ 5 agentes activos\n');

  // ── 3. API SERVER (Express + WebSocket) ───────────────────────────────────
  console.log('[Wire] 🌐 Iniciando API Server...');

  let engine    = null;
  let bridgeMgr = null;

  // TokenomicsEngine (si hay contratos configurados)
  if (config.bezAddress) {
    try {
      const TokenomicsEngine = require('../sdk/tokenomics-engine');
      engine = await TokenomicsEngine.create(
        config.rpcUrl, config.privateKey,
        parseInt(process.env.CHAIN_ID || '137'), config
      );
      console.log('[Wire] ✅ TokenomicsEngine conectado');
    } catch (e) {
      console.warn('[Wire] ⚠️  TokenomicsEngine no disponible:', e.message);
    }
  }

  // BridgeManager
  if (config.polygonBridge || config.bnbBridge) {
    try {
      const BridgeManager = require('../sdk/bridge-manager');
      bridgeMgr = await BridgeManager.create({
        addresses: {
          'polygon-l2': config.polygonBridge,
          'bnb-l2':     config.bnbBridge,
        },
      });
      console.log('[Wire] ✅ BridgeManager conectado');
    } catch (e) {
      console.warn('[Wire] ⚠️  BridgeManager no disponible:', e.message);
    }
  }

  const { httpServer, wss } = await createApiServer(manager, engine, bridgeMgr);
  manager._wss = wss;

  await new Promise(resolve => httpServer.listen(config.apiPort, resolve));
  console.log(`[Wire] ✅ API Server: http://localhost:${config.apiPort}`);
  console.log(`[Wire] ✅ WebSocket:  ws://localhost:${config.apiPort}/agent-runtime\n`);

  // ── 4. TELEGRAM CHANNEL ───────────────────────────────────────────────────
  let telegram = null;
  let router   = null;
  let hitl     = null;

  if (config.telegramToken) {
    console.log('[Wire] 🤖 Iniciando canal Telegram...');
    telegram = new TelegramChannel({
      token:        config.telegramToken,
      allowedUsers: config.telegramAllowedUsers,
      chatIds:      config.telegramChatIds,
    });
    manager._telegram = telegram;
    router = new ChannelRouter(manager, telegram);

    // HITL Handler
    hitl = new HITLHandler(router, manager, { port: 3099 });
    await hitl.start();
    console.log('[Wire] ✅ HITL Handler: :3099');

    // Wire WS → HITL broadcast
    const origReq = manager.openclaw?.sendHITLRequest?.bind(manager.openclaw);
    if (origReq && manager.openclaw) {
      manager.openclaw.sendHITLRequest = async (payload) => {
        try { await origReq(payload); } catch { /* fallback */ }
        wss?.broadcastHITL(payload.task_id, payload.context);
        return router.sendHITLToTelegram(payload.task_id, payload.context);
      };
    }

    // Wire manager events → broadcast/notify
    manager.on('task:completed', ({ task }) => {
      if (task.source !== 'telegram') {
        wss?.broadcastCompliance({ taskId: task.id, type: task.type, status: 'completed' });
      }
    });

    manager.aegis?.on('threat:critical', async (threat) => {
      await router.broadcast(
        `🚨 *ALERTA CRÍTICA AEGIS*\nTipo: \`${threat.threatType}\`\nScore: ${(threat.mlScore*100).toFixed(0)}%`,
        'critical'
      );
    });

    tc.on('anomaly:detected', async (anomaly) => {
      await router.broadcast(
        `⚠️ *Anomalía tokenómica*\nTipo: ${anomaly.type}\nSeveridad: ${anomaly.severity}`,
        anomaly.severity === 'critical' ? 'critical' : 'warning'
      );
    });

    await telegram.start(router);
    console.log('[Wire] ✅ Telegram bot activo\n');
  }

  // ── 5. RESUMEN ───────────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                SISTEMA BEZHAS ACTIVO                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  🤖 Agentes:    SecurityAgent, TradingAgent, Workflow    ║`);
  console.log(`║                 ComplianceAgent, TokenomicsAgent         ║`);
  console.log(`║  🛡️  AEGIS:     Polling on-chain activo                  ║`);
  console.log(`║  📊 Tokenomics: Snapshots cada 60s                       ║`);
  console.log(`║  🌐 REST API:   http://localhost:${config.apiPort}              ║`);
  console.log(`║  🔌 WebSocket:  ws://localhost:${config.apiPort}/...            ║`);
  console.log(`║  💬 Telegram:   ${telegram ? 'ACTIVO' : 'DESACTIVADO'}                          ║`);
  console.log(`║  👤 HITL:       ${hitl ? 'ACTIVO (:3099)' : 'DESACTIVADO'}                  ║`);
  console.log(`║  🦙 Ollama:     localhost:11434 (Opción 1 desarrollo)    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // ── 6. GRACEFUL SHUTDOWN ─────────────────────────────────────────────────
  const shutdown = async (sig) => {
    console.log(`\n[Wire] ${sig} → cerrando gracefully...`);
    if (telegram) await telegram.stop().catch(() => {});
    if (hitl)     await hitl.stop().catch(() => {});
    await manager.stop().catch(() => {});
    await tc.disconnect().catch(() => {});
    httpServer.close(() => {
      console.log('[Wire] 👋 Sistema cerrado correctamente');
      process.exit(0);
    });
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', err => console.error('[Wire] Uncaught:', err));
  process.on('unhandledRejection', err => console.error('[Wire] Unhandled:', err));
}

main().catch(err => {
  console.error('[Wire] ❌ Error fatal:', err.message);
  process.exit(1);
});
