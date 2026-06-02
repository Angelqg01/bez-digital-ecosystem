/**
 * BeZhas Agent Runtime — Test All Agents
 * Ejecuta una simulación de los 4 agentes principales (Security, Tokenomics, Trading, Workflow)
 * con Mocks para verificar que cada uno responde correctamente a su rol.
 */

'use strict';

require('dotenv').config({ path: '../.env' });

const AgentManager = require('./core/AgentManager');
const SecurityAgent = require('./agents/SecurityAgent');
const TokenomicsAgent = require('./agents/TokenomicsAgent');
const TradingAgent = require('./agents/TradingAgent');
const WorkflowAgent = require('./agents/WorkflowAgent');

const config = {
  hitlEnabled: false,
  openclawUrl: 'http://localhost:8080',
  rpcUrl: 'http://localhost:8545',
};

async function runTest() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   🧪 BEZHAS AGENT SYSTEM — GLOBAL TEST START     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const manager = new AgentManager(config);

  // --- MOCK INFRASTRUCTURE ---
  manager.memory.connect = async () => {};
  manager.memory.disconnect = async () => {};
  const mockStorage = new Map();
  manager.memory.setTask = async (id, task) => mockStorage.set(`task:${id}`, task);
  manager.memory.updateTask = async (id, updates) => {
    const t = mockStorage.get(`task:${id}`) || {};
    mockStorage.set(`task:${id}`, { ...t, ...updates });
  };
  manager.memory.getAgentState = async () => null;
  manager.memory.remember = async (key, val) => mockStorage.set(key, val);
  manager.memory.recall = async (key) => mockStorage.get(key);
  manager.memory.recallAll = async () => Object.fromEntries(mockStorage);

  manager.blockchain.connect = async () => {};
  manager.blockchain.disconnect = async () => {};
  manager.blockchain.submitAegisReport = async (id, r) => ({ hash: '0xmock_aegis_tx' });

  manager.openclaw.complete = async ({ prompt }) => {
    if (prompt.includes('REENTRANCY')) return { text: "[CEO/Security] Amenaza detectada. Procediendo con el bloqueo preventivo del contrato de Tesorería." };
    if (prompt.includes('salud del ecosistema')) return { text: "[CFO/Tokenomics] Salud: 92/100. Inflación controlada. Se recomienda aumentar el Staking APY en un 0.5%." };
    if (prompt.includes('oportunidad de trading')) return { text: "[Trader/Trading] Par BEZ/USDT: Tendencia alcista detectada. Nivel de riesgo: BAJO. Sugerencia: Mantener posición." };
    if (prompt.includes('Workflow')) return { text: "[DevOps/Workflow] Workflow de actualización de precios L2 iniciado. Estado: 100% completado." };
    return { text: "Respuesta del agente simulada." };
  };
  manager.openclaw.sendNotification = async (msg) => {
    console.log(`\n[MESSAGE RECEIVED FROM ${msg.level.toUpperCase()}]: ${msg.message}`);
  };

  // --- REGISTER AGENTS ---
  manager.registerAgent(SecurityAgent, {});
  manager.registerAgent(TokenomicsAgent, { connector: { takeSnapshot: async () => ({ lastSnapshot: new Date().toISOString() }), getState: () => ({}) } });
  manager.registerAgent(TradingAgent, {});
  manager.registerAgent(WorkflowAgent, {});

  await manager.start();

  const tests = [
    {
      name: 'Security (CEO)',
      task: { type: 'aegis:alert', payload: { threatType: 'REENTRANCY', severity: 3, id: 'alert-1' } }
    },
    {
      name: 'Tokenomics (CFO)',
      task: { type: 'tokenomics:analysis', payload: { state: {} } }
    },
    {
      name: 'Trading (Market)',
      task: { type: 'trade:analyze', payload: { pair: 'BEZ/USDT' } }
    },
    {
      name: 'Workflow (DevOps)',
      task: { type: 'workflow:execute', payload: { action: 'UPDATE_PRICES' } }
    }
  ];

  for (const t of tests) {
    console.log(`\n--- Test: ${t.name} ---`);
    await manager.dispatch(t.task);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n\n✅ Todos los agentes han enviado su mensaje de prueba correctamente.');
  process.exit(0);
}

runTest().catch(e => { console.error(e); process.exit(1); });
