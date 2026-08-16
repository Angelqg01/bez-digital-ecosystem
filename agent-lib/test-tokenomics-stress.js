
/**
 * BeZhas Agent Runtime — TOKENOMICS STRESS TEST
 * Simula variaciones bruscas en el ecosistema para probar la detección del Agente.
 */

'use strict';

require('dotenv').config({ path: './.env' });
const AgentManager = require('./core/AgentManager');
const TokenomicsAgent = require('./agents/TokenomicsAgent');

async function runTokenomicsStressTest() {
  console.log('🚀 Iniciando Prueba de Estrés Tokenómico - BeZhas Agent\n');

  // MOCK de conectores
  const mockOpenClaw = { 
    complete: async (p) => ({ text: "Análisis simulado: La caída de participación en staking es un riesgo para la seguridad de la red. Se recomienda aumentar el APY temporalmente." }),
    sendNotification: async (n) => console.log(`[Notification] ${n.level.toUpperCase()}: ${n.message}`)
  };
  const mockBlockchain = { connect: async () => {}, stop: async () => {} };

  const manager = new AgentManager({ redisUrl: 'mock' });
  manager.blockchain = mockBlockchain;
  manager.openclaw = mockOpenClaw;

  // Inicializamos el agente con los mocks
  const agent = new TokenomicsAgent({
    openclaw: mockOpenClaw,
    blockchain: mockBlockchain,
    manager: manager
  });

  // --- SIMULACIÓN DE ESCENARIOS ---
  
  const scenarios = [
    {
      name: "Escenario 1: Salud Normal",
      supply: "1000000",
      tvl: "250000", // 25% staking (Saludable)
    },
    {
      name: "Escenario 2: Caída Crítica de Staking",
      supply: "1000000",
      tvl: "30000", // 3% staking (Alerta Roja)
    },
    {
      name: "Escenario 3: Recuperación Moderada",
      supply: "1000000",
      tvl: "80000",
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- Ejecutando ${scenario.name} ---`);
    
    // Inyectamos datos en el motor del agente
    agent.engine = {
        getTotalSupply: async () => scenario.supply,
        getTVL: async () => scenario.tvl
    };

    // Forzamos la comprobación de anomalías
    await agent.checkAnomalies();
    
    // Esperamos un poco para simular tiempo real
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ Prueba de Estrés Tokenómico finalizada.');
  process.exit(0);
}

runTokenomicsStressTest().catch(console.error);
