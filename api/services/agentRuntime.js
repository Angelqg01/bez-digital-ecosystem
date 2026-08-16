'use strict';

/**
 * agentRuntime — cableado ÚNICO del AgentManager de `agent-lib`.
 *
 * Antes vivía duplicado en `api/server.js` y en `scripts/wire-agents.js`, y el
 * arranque real (`api/index.js`) no lo hacía en absoluto: montaba
 * `agentRoutes()` sin argumentos, así que los cinco agentes estaban dormidos y
 * todo endpoint que tocara el manager devolvía 500. Ahora el cableado está aquí
 * y lo usan las dos entradas.
 *
 * Reglas de esta pieza:
 *
 *  - **No puede tumbar la API.** Levanta cinco agentes dentro del proceso; si
 *    algo falla (RPC caído, contratos sin configurar, Redis ausente) se anota y
 *    se sigue sin manager. Las rutas lo detectan y responden 503
 *    `RUNTIME_NOT_WIRED` en vez de reventar. La API sirve pagos, cadena y
 *    energía: no puede caerse porque un agente no arranque.
 *
 *  - **Enlace tardío.** `index.js` monta las rutas de forma síncrona, pero el
 *    arranque del runtime es asíncrono. Por eso el manager se guarda aquí y las
 *    rutas lo piden en cada petición, en vez de capturarlo en un cierre al
 *    montar.
 */

const path = require('path');

let manager = null;
let estado = 'no_iniciado';   // no_iniciado | iniciando | listo | fallido
let motivoFallo = null;

/** El manager cableado, o null si no se pudo levantar. */
function getManager() {
  return manager;
}

/** Estado del cableado, para /health y diagnóstico. */
function status() {
  return { estado, motivo: motivoFallo, agentes: manager?.listAgents?.().length ?? 0 };
}

function buildConfig() {
  return {
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    wsUrl: process.env.WS_URL || 'ws://localhost:8546',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    openclawUrl: process.env.OPENCLAW_URL || 'http://localhost:8080',
    hitlEnabled: process.env.HITL_ENABLED !== 'false',
    hitlCallbackUrl: process.env.HITL_CALLBACK_URL || 'http://localhost:3001/api/hitl',
    bezAddress: process.env.BEZ_TOKEN_ADDRESS,
    stakingAddress: process.env.STAKING_POOL_ADDRESS,
    farmingAddress: process.env.FARMING_POOL_ADDRESS,
    validatorsAddress: process.env.VALIDATOR_REGISTRY_ADDRESS,
    slashingAddress: process.env.SLASHING_MANAGER_ADDRESS,
    openClawAgentAddress: process.env.OPENCLAW_AGENT_ADDRESS,
    aegisProviderAddress: process.env.AEGIS_PROVIDER_ADDRESS,
    workflowRegistryAddress: process.env.WORKFLOW_REGISTRY_ADDRESS,
  };
}

/**
 * Cablea y arranca el runtime. Idempotente: llamarlo dos veces no duplica
 * agentes. Nunca lanza — devuelve el manager o null.
 *
 * @param {object} opts
 * @param {boolean} opts.enabled  false lo deja sin cablear a propósito
 */
async function init({ enabled = process.env.AGENT_RUNTIME_ENABLED !== 'false' } = {}) {
  if (estado === 'listo' || estado === 'iniciando') return manager;
  if (!enabled) {
    estado = 'fallido';
    motivoFallo = 'deshabilitado por AGENT_RUNTIME_ENABLED=false';
    return null;
  }

  estado = 'iniciando';
  try {
    const raiz = path.resolve(__dirname, '..', '..', 'agent-lib');
    const AgentManager = require(path.join(raiz, 'AgentManager'));
    const SecurityAgent = require(path.join(raiz, 'agents', 'SecurityAgent'));
    const TradingAgent = require(path.join(raiz, 'agents', 'TradingAgent'));
    const WorkflowAgent = require(path.join(raiz, 'agents', 'WorkflowAgent'));
    const ComplianceAgent = require(path.join(raiz, 'agents', 'ComplianceAgent'));
    const TokenomicsAgent = require(path.join(raiz, 'agents', 'TokenomicsAgent'));
    const TokenomicsConnector = require(path.join(raiz, 'connectors', 'TokenomicsConnector'));

    const config = buildConfig();
    const m = new AgentManager(config);

    m.registerAgent(SecurityAgent, {});
    m.registerAgent(TradingAgent, {});
    m.registerAgent(WorkflowAgent, {});
    m.registerAgent(ComplianceAgent, {});

    // El conector de tokenomics es opcional: sin cadena configurada, el agente
    // se registra igual y trabaja con lo que tenga.
    const tc = new TokenomicsConnector(config);
    await tc.connect().catch(() => {});
    m.registerAgent(TokenomicsAgent, { tokenomicsConnector: tc });
    m._tokenomicsConnector = tc;

    await m.start();

    manager = m;
    estado = 'listo';
    motivoFallo = null;
    return manager;
  } catch (err) {
    estado = 'fallido';
    motivoFallo = err.message;
    manager = null;
    return null;
  }
}

/** Para tests: deja el módulo como recién cargado. */
function _reset() {
  manager = null;
  estado = 'no_iniciado';
  motivoFallo = null;
}

module.exports = { init, getManager, status, _reset };
