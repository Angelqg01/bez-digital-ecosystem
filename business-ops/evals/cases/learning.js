'use strict';

/**
 * Contrato del bucle de aprendizaje: destila señal real (no inventa sin datos),
 * mide la tasa de autonomía y realimenta el playbook al agente.
 */
const LearningEngine = require('../../src/cognition/LearningEngine');
const MemoryManager = require('../../src/cognition/MemoryManager');
const { makeGateway, expect } = require('../world');

module.exports = {
  suite: 'learning',
  description: 'aprender de cada interacción sin inventar',
  cases: [
    {
      name: 'sin datos suficientes no destila playbook',
      async check() {
        const memory = new MemoryManager({ tenantId: 'evals' });
        const eng = new LearningEngine({ memory, model: makeGateway(), tenantId: 'evals' });
        await memory.store({ agentId: 'x', summary: 'uno', outcome: 'ok' });
        const r = await eng.cycle('x');
        expect(r.updated === false, 'con 1 caso no debe destilar');
      },
    },
    {
      name: 'destila, mide la tasa de autonomía y persiste el playbook',
      async check() {
        const memory = new MemoryManager({ tenantId: 'evals' });
        const eng = new LearningEngine({ memory, model: makeGateway(), tenantId: 'evals' });
        for (let i = 0; i < 3; i++) await memory.store({ agentId: 'y', summary: `resuelto ${i}`, outcome: 'ok' });
        await memory.store({ agentId: 'y', summary: 'escalado', outcome: 'escalated' });
        const r = await eng.cycle('y');
        expect(r.updated === true, 'debe destilar con 4 casos');
        expect(r.metrics.tasaAutonomia === 0.75, `tasa esperada 0.75, obtuvo ${r.metrics.tasaAutonomia}`);
        const pb = await eng.getPlaybook('y');
        expect(!!pb, 'el playbook debe quedar persistido');
      },
    },
  ],
};
