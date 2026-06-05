
/**
 * BeZhas Agent Runtime — Bootstrap V3 (con API + WebSocket)
 * Cloud Run compatible: HTTP server starts FIRST, then services connect.
 */

'use strict';

require('dotenv').config({ path: '../.env' });

// Attach OIDC tokens to outbound calls to the private aegis / ai-gateway
// backends. No-op locally; see gcpServiceAuth.js. (Cloud Run entrypoint.)
require('./gcpServiceAuth').install();

const AgentManager = require('./AgentManager');
const AgentServer = require('./core/AgentServer');
const TokenomicsAgent = require('./agents/TokenomicsAgent');
const TokenomicsConnector = require('./connectors/TokenomicsConnector');
const SecurityAgent = require('./agents/SecurityAgent');

async function main() {
  const port = parseInt(process.env.PORT, 10) || 3099;

  const manager = new AgentManager({
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  // Registro de Agentes (no requiere conexiones externas)
  manager.registerAgent(SecurityAgent);
  
  const tokenomicsConnector = new TokenomicsConnector({
    wsUrl: process.env.WS_URL || 'ws://localhost:8545',
    bezAddress: process.env.BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    stakingAddress: process.env.STAKING_POOL_ADDRESS,
  });

  manager.registerAgent(TokenomicsAgent, { connector: tokenomicsConnector });

  // ── CLOUD RUN: Arrancar servidor HTTP PRIMERO para que GCP detecte el puerto ──
  const server = new AgentServer(manager, port);
  server.start();
  console.log(`\n🌐 HTTP server listening on port ${port} (Cloud Run health check ready)`);

  // ── Luego intentar conectar servicios de backend (no-bloqueante) ──
  try {
    await manager.start();
    console.log('\n🚀 BeZhas Agent Environment V3 está completamente listo');
  } catch (err) {
    console.warn(`\n⚠️  Manager start parcial (servicios degradados): ${err.message}`);
    console.warn('   El servidor HTTP sigue activo para health checks y API básica.');
  }
}

main().catch((err) => {
  console.error('❌ Fatal bootstrap error:', err);
  process.exit(1);
});
