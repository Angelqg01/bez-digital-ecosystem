/**
 * BeZhas Agent Runtime — Entry Point
 *
 * MODO DESARROLLO (Opción 1):
 *   1. Asegúrate de que Ollama esté corriendo: `ollama serve`
 *   2. `node agent-runtime/index.js`
 *
 * MODO PRODUCCIÓN (Opción 3 — TODO al terminar la plataforma):
 *   Migrar a Docker Compose con GPU passthrough RTX 4090.
 */

'use strict';

require('dotenv').config({ path: '../.env' });

const AgentManager = require('./AgentManager');
const SecurityAgent = require('./agents/SecurityAgent');
const TradingAgent  = require('./agents/TradingAgent');
const WorkflowAgent = require('./agents/WorkflowAgent');
const TokenomicsAgent = require('./agents/TokenomicsAgent');
const TokenomicsConnector = require('./connectors/TokenomicsConnector');

// ─────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────

const config = {
  // Blockchain
  rpcUrl:                  process.env.RPC_URL                  || 'http://localhost:8545',
  wsUrl:                   process.env.WS_URL                   || 'ws://localhost:8545',
  openClawAgentAddress:    process.env.OPENCLAW_AGENT_ADDRESS   || null,
  aegisProviderAddress:    process.env.AEGIS_PROVIDER_ADDRESS   || null,
  workflowRegistryAddress: process.env.WORKFLOW_REGISTRY_ADDRESS || null,
  privateKey:              process.env.AGENT_PRIVATE_KEY        || null,

  // Redis (ya corre en Docker)
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // OpenClaw Engine Python
  openclawUrl: process.env.OPENCLAW_URL || 'http://localhost:8080',

  // HITL
  hitlEnabled:     process.env.HITL_ENABLED !== 'false',
  hitlTimeoutMs:   parseInt(process.env.HITL_TIMEOUT_MS || '60000'),
  hitlCallbackUrl: process.env.HITL_CALLBACK_URL || 'http://localhost:3001/api/hitl',

  // Concurrencia
  maxConcurrentTasks: parseInt(process.env.MAX_CONCURRENT_TASKS || '5'),
};

// ─────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────

async function checkOllamaReady() {
  /**
   * Opción 1: Ollama corre como daemon manual antes de este proceso.
   * Verificamos que esté disponible antes de arrancar.
   */
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).map(m => m.name);
      console.log(`[Startup] 🦙 Ollama disponible en ${ollamaUrl}`);
      console.log(`[Startup]    Modelos cargados: ${models.join(', ') || '(ninguno — ejecuta: ollama pull llama3.2)'}`);
      return true;
    }
  } catch {
    console.warn('[Startup] ⚠️  Ollama no disponible en', ollamaUrl);
    console.warn('[Startup]    El Agent Runtime usará APIs externas como LLM principal.');
    console.warn('[Startup]    Para activar fallback local: ollama serve');
  }
  return false;
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       BeZhas Agent Runtime v1.0.0                ║');
  console.log('║       D:\\BeZhas-Blockchain\\agent-runtime          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // 1. Verificar Ollama (Opción 1 — desarrollo)
  await checkOllamaReady();

  // 2. Crear AgentManager
  const manager = new AgentManager(config);

  // 3. Registrar agentes
  manager.registerAgent(SecurityAgent, {});
  manager.registerAgent(TradingAgent,  {});
  manager.registerAgent(WorkflowAgent, {});

  const tokenomicsConnector = new TokenomicsConnector({
    wsUrl:          config.wsUrl,
    bezAddress:     process.env.BEZ_TOKEN_ADDRESS,
    stakingAddress: process.env.STAKING_POOL_ADDRESS,
  });

  manager.registerAgent(TokenomicsAgent, { connector: tokenomicsConnector });

  // 4. Arrancar runtime
  await manager.start();

  // 5. Health report inicial
  const health = manager.registry.healthReport();
  console.log(`\n[Startup] ✅ ${health.total} agentes activos (${health.idle} idle)`);
  console.log('[Startup] 🔗 Escuchando eventos on-chain...');
  console.log('[Startup] 🛡️  AEGIS monitoring activo');
  console.log(`[Startup] 👤 HITL: ${config.hitlEnabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
  console.log('');

  // 6. Manejo de cierre limpio
  const shutdown = async (signal) => {
    console.log(`\n[Shutdown] ${signal} recibido. Cerrando gracefully...`);
    await manager.stop();
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // 7. Exponer manager globalmente para tests/scripts externos
  global.beZhasRuntime = manager;

  // ── DEMO: enviar tarea de prueba en modo dev ─────────
  if (process.env.NODE_ENV === 'development' || process.env.DEMO_TASK === 'true') {
    setTimeout(async () => {
      console.log('\n[Demo] 🧪 Enviando tarea de prueba al SecurityAgent...');
      await manager.dispatch({
        type:     'aegis:alert',
        priority: 'high',
        source:   'demo',
        payload: {
          id:           'demo_threat_001',
          threatType:   'FLASH_LOAN',
          severityLabel:'HIGH',
          severity:     2,
          target:       '0x1234567890123456789012345678901234567890',
          mlScore:      0.82,
          mlVerdict:    'ANOMALY_CONFIRMED',
          recommended:  'REQUIRE_APPROVAL',
          source:       'demo',
        },
      });
    }, 2000);
  }
}

main().catch(err => {
  console.error('[Startup] ❌ Error fatal al arrancar:', err.message);
  console.error(err.stack);
  process.exit(1);
});
