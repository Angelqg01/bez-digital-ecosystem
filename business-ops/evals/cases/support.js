'use strict';

/**
 * Contrato del vertical de Soporte:
 *  1. Con KB que fundamenta → resuelve solo, sin humano.
 *  2. Urgente/enfadado → SIEMPRE escala al humano.
 *  3. Sin fundamento en la KB → escala (no inventa).
 * El 3 es el contrato anti-alucinación: romperlo es peor que no responder.
 */
const KnowledgeBase = require('../../src/platform/KnowledgeBase');
const SupportManager = require('../../src/agents/support/SupportManager');
const MemoryManager = require('../../src/cognition/MemoryManager');
const PolicyEngine = require('../../src/guardrails/PolicyEngine');
const EventBus = require('../../src/core/EventBus');
const { makeGateway, expect } = require('../world');

function buildSupport() {
  const tenantId = 'evals';
  const knowledgeBase = new KnowledgeBase({ tenantId });
  const bus = new EventBus(tenantId);
  const manager = new SupportManager({
    tenantId,
    model: makeGateway(),
    memory: new MemoryManager({ tenantId }),
    guardrails: new PolicyEngine({ tenantId, plan: 'pro' }),
    knowledgeBase,
    bus,
  });
  return { manager, knowledgeBase, bus };
}

module.exports = {
  suite: 'support',
  description: 'resolver con fundamento, escalar sin él',
  cases: [
    {
      name: 'pregunta cubierta por la KB → resuelve sin humano',
      async check() {
        const { manager, knowledgeBase } = buildSupport();
        await knowledgeBase.ingest({
          title: 'Restablecer contraseña',
          body: 'Ve a Ajustes > Seguridad > Restablecer contraseña. El enlace del email caduca en 30 minutos.',
          tags: ['cuenta', 'contraseña'],
        });
        const out = await manager.run({ type: 'support:ticket', payload: { text: '¿Cómo restablezco mi contraseña?', customerId: 'e1' } });
        expect(out.kb.grounded === true, 'la KB debía fundamentar la respuesta');
        expect(out.resolution.escalate === false, 'no debía escalar');
        expect(out.outcome === 'ok', `outcome esperado ok, obtuvo ${out.outcome}`);
      },
    },
    {
      name: 'cliente urgente y enfadado → escala al humano',
      async check() {
        const { manager, bus } = buildSupport();
        const escalados = [];
        bus.on('support:escalated', (e) => escalados.push(e));
        const out = await manager.run({ type: 'support:ticket', payload: { text: '¡Es URGENTE, nada funciona y estoy harto!', customerId: 'e2' } });
        expect(out.resolution.escalate === true, 'debía escalar');
        expect(out.escalation?.status === 'pending_human', 'debía quedar pendiente de humano');
        expect(escalados.length === 1, 'debía notificar el escalado por el bus');
      },
    },
    {
      name: 'sin fundamento en la KB → escala, no inventa',
      async check() {
        const { manager } = buildSupport(); // KB vacía
        const out = await manager.run({ type: 'support:ticket', payload: { text: '¿Tenéis integración con SAP R/3?', customerId: 'e3' } });
        expect(out.kb.grounded === false, 'no había fundamento');
        expect(out.resolution.escalate === true, 'sin fundamento debe escalar SIEMPRE');
      },
    },
    {
      name: 'la KB no mezcla temas: pregunta de facturación no se responde con artículo de notificaciones',
      async check() {
        const { manager, knowledgeBase } = buildSupport();
        await knowledgeBase.ingest({ title: 'Configurar notificaciones', body: 'Activa el correo en Ajustes > Notificaciones.', tags: ['email'] });
        const out = await manager.run({ type: 'support:ticket', payload: { text: '¿Cuándo se emite mi factura mensual del contrato?', customerId: 'e4' } });
        expect(out.resolution.escalate === true, 'artículo irrelevante no debe contar como fundamento');
      },
    },
  ],
};
