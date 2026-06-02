/**
 * BeZhas Agent Runtime — Test Demo
 * Ejecuta una simulación completa del SecurityAgent con Mocks
 * para verificar la lógica funcional sin depender de Redis o Blockchain.
 */

'use strict';

require('dotenv').config({ path: '../.env' });

const AgentManager = require('./core/AgentManager');
const SecurityAgent = require('./agents/SecurityAgent');

// ─────────────────────────────────────────────
// CONFIGURACIÓN MOCK
// ─────────────────────────────────────────────

const config = {
  hitlEnabled: false, // Desactivado para la prueba automática
  hitlTimeoutMs: 5000,
  openclawUrl: 'http://localhost:8080',
  rpcUrl: 'http://localhost:8545',
};

async function runTest() {
  console.log('🧪 Iniciando TEST de Lógica Funcional (Mock Mode)...');

  const manager = new AgentManager(config);

  // 1. Mock de MemoryManager (Redis fallback)
  manager.memory.connect = async () => console.log('[Mock] MemoryManager conectado (In-Memory)');
  manager.memory.disconnect = async () => {};
  const mockStorage = new Map();
  manager.memory.setTask = async (id, task) => mockStorage.set(`task:${id}`, task);
  manager.memory.updateTask = async (id, updates) => {
    const t = mockStorage.get(`task:${id}`) || {};
    mockStorage.set(`task:${id}`, { ...t, ...updates });
  };
  manager.memory.getAgentState = async () => null;
  manager.memory.remember = async (key, val) => mockStorage.set(key, val);

  // 2. Mock de BlockchainConnector
  manager.blockchain.connect = async () => console.log('[Mock] BlockchainConnector conectado (Simulado)');
  manager.blockchain.disconnect = async () => {};
  manager.blockchain.submitAegisReport = async (id, report) => {
    console.log(`[Mock] ⛓️  Reporte AEGIS enviado al contrato para alert ${id}:`, report);
    return { hash: '0xmock_tx_hash' };
  };

  // 3. Mock de AegisConnector
  manager.aegis.start = async () => console.log('[Mock] AegisConnector iniciado (Silencio)');
  manager.aegis.stop = async () => {};

  // 4. Mock de OpenClawConnector (para evitar errores 404 si el engine no está)
  manager.openclaw.complete = async ({ prompt }) => {
    console.log('[Mock] 🧠 LLM procesando prompt...');
    return {
      text: "ANÁLISIS DE SEGURIDAD BEZHAS:\nLa amenaza FLASH_LOAN detectada tiene un score de 0.82. Se recomienda BLOQUEO INMEDIATO ya que compromete el pool de liquidez principal. Impacto: CRÍTICO.",
      summary: "Amenaza de Flash Loan crítica. Recomendación: Bloqueo inmediato.",
      model: "mock-llm-1"
    };
  };
  manager.openclaw.sendNotification = async (msg) => {
    console.log('[Mock] 📱 Notificación enviada:', msg.message);
  };

  // 5. Registrar Agentes
  manager.registerAgent(SecurityAgent, {});

  // 6. Arrancar
  await manager.start();

  console.log('\n[Test] 🚀 Despachando tarea de prueba...');

  const taskId = await manager.dispatch({
    type:     'aegis:alert',
    priority: 'critical',
    source:   'test-suite',
    payload: {
      id:           'test_alert_999',
      threatType:   'REENTRANCY',
      severityLabel:'CRITICAL',
      severity:     3,
      target:       '0xBeZhasContractAddress',
      mlScore:      0.98,
      mlVerdict:    'ANOMALY_CONFIRMED',
      recommended:  'BLOCK_IMMEDIATELY',
      source:       'aegis-ml',
    },
  });

  // Esperar un poco a que el agente procese (es async)
  setTimeout(async () => {
    const finalTask = mockStorage.get(`task:${taskId}`);
    console.log('\n[Test] ✅ Resultado Final de la Tarea:');
    console.log(JSON.stringify(finalTask, null, 2));

    if (finalTask.status === 'completed') {
      console.log('\n✨ TEST EXITOSO: La lógica funcional es correcta.');
    } else {
      console.log('\n❌ TEST FALLIDO: La tarea no se completó correctamente.');
    }

    await manager.stop();
    process.exit(finalTask.status === 'completed' ? 0 : 1);
  }, 3000);
}

runTest().catch(err => {
  console.error('❌ Error fatal en el test:', err);
  process.exit(1);
});
