/**
 * BeZhas Agent Runtime — STRESS TEST
 * Simula una carga masiva de tareas concurrentes con diferentes prioridades.
 */

'use strict';

require('dotenv').config({ path: '../.env' });
const AgentManager = require('./core/AgentManager');
const SecurityAgent = require('./agents/SecurityAgent');
const TradingAgent = require('./agents/TradingAgent');

const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxConcurrentTasks: 10, // Aumentamos concurrencia para el test
};

async function runStressTest() {
  console.log('🚀 Iniciando Prueba de Estrés - BeZhas Agent Runtime\n');

  const manager = new AgentManager(config);

  // MOCK de conectores para el test de estrés (evita fallos de conexión)
  manager.blockchain = { 
    connect: async () => console.log('[Mock] Blockchain conectado'),
    on: () => {}, emit: () => {}, healthCheck: async () => ({ status: 'ok' }),
    stop: async () => {} 
  };
  manager.openclaw = {
    complete: async () => ({ text: 'Stress test result' }),
    checkOllama: async () => ({ available: true }),
    healthCheck: async () => ({ status: 'ok' })
  };

  manager.registerAgent(SecurityAgent, {});
  manager.registerAgent(TradingAgent, {});

  await manager.start();
  console.log('✅ Manager iniciado. Enviando ráfaga de tareas...\n');

  const stats = {
    total: 65,
    sent: 0,
    completed: 0,
    failed: 0,
  };

  const startTime = Date.now();

  // 1. Enviar 50 tareas de seguridad (Normal)
  for (let i = 0; i < 50; i++) {
    manager.dispatch({
      type: 'security:check',
      priority: 'normal',
      payload: { id: `stress_norm_${i}`, target: '0x' + i.toString(16).padStart(40, '0') }
    }).then(() => { stats.completed++; stats.sent++; })
      .catch(() => { stats.failed++; stats.sent++; });
  }

  // 2. Enviar 10 tareas de trading (High)
  for (let i = 0; i < 10; i++) {
    manager.dispatch({
      type: 'trade:analyze',
      priority: 'high',
      payload: { pair: 'BEZ/USDT', amount: 1000 * i }
    }).then(() => { stats.completed++; stats.sent++; })
      .catch(() => { stats.failed++; stats.sent++; });
  }

  // 3. Enviar 5 alertas críticas (Critical)
  for (let i = 0; i < 5; i++) {
    manager.dispatch({
      type: 'aegis:alert',
      priority: 'critical',
      payload: { id: `stress_crit_${i}`, threat: 'REENTRANCY_ATTACK' }
    }).then(() => { stats.completed++; stats.sent++; })
      .catch(() => { stats.failed++; stats.sent++; });
  }

  // Monitorización
  const monitor = setInterval(() => {
    const q = manager.taskQueue.getStatus();
    console.log(`[Status] Procesado: ${stats.sent}/${stats.total} | Cola: ${q.queued} | Ejecutando: ${q.running}`);
    
    if (stats.sent >= stats.total) {
      clearInterval(monitor);
      const duration = (Date.now() - startTime) / 1000;
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║           TEST COMPLETADO                ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log(`║  Total Tareas:   ${stats.total}                      ║`);
      console.log(`║  Completadas:    ${stats.completed}                      ║`);
      console.log(`║  Fallidas:       ${stats.failed}                       ║`);
      console.log(`║  Tiempo Total:   ${duration.toFixed(2)}s                 ║`);
      console.log(`║  Tareas/seg:     ${(stats.total / duration).toFixed(2)}                 ║`);
      console.log('╚══════════════════════════════════════════╝');
      
      manager.stop().then(() => process.exit(0));
    }
  }, 1000);
}

runStressTest().catch(console.error);
