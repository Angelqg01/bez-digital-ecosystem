'use strict';

/**
 * Contrato del perfil de negocio (BeZhas): la identidad y las reglas del tenant
 * gobiernan a los agentes. Cuentas vetadas nunca se contactan; el primer
 * contacto en frío nunca esquiva la aprobación humana; el preámbulo en frío
 * prohíbe la jerga cripto y los enlaces de pago (regla de la "Tubería de Cristal").
 */
const BusinessProfile = require('../../src/platform/BusinessProfile');
const OutreachAgent = require('../../src/agents/sales/OutreachAgent');
const ModelGateway = require('../../src/cognition/ModelGateway');
const PolicyEngine = require('../../src/guardrails/PolicyEngine');
const HITLGate = require('../../src/core/HITLGate');
const EventBus = require('../../src/core/EventBus');
const { expect } = require('../world');

const bezhas = BusinessProfile.fromFile('bezhas');

function outreach(tools, hitl) {
  return new OutreachAgent({
    tenantId: 'bezhas', department: 'sales',
    model: new ModelGateway({ providers: {} }),
    guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
    bus: new EventBus('bezhas'), business: bezhas, tools, hitl,
  });
}

module.exports = {
  suite: 'business',
  description: 'el perfil del tenant gobierna identidad, vetos y lenguaje',
  cases: [
    {
      name: 'cuentas excluidas (Iberdrola, Santander, Acuerdo V1) nunca se contactan',
      async check() {
        expect(bezhas.isExcluded({ company: 'Iberdrola' }), 'Iberdrola debe estar vetada');
        expect(bezhas.isExcluded({ company: 'Banco Santander' }), 'Santander debe estar vetada');
        expect(bezhas.isExcluded({ company: 'X', tags: ['Partner Confirmado'] }), 'partner confirmado vetado');
        expect(!bezhas.isExcluded({ company: 'Puerto de Sines' }), 'un puerto normal no está vetado');
      },
    },
    {
      name: 'una cuenta excluida se bloquea en el agente: ni se redacta ni se envía',
      async check() {
        const email = { name: 'email', sent: 0, async execute() { this.sent++; return { sent: true }; } };
        const out = await outreach({ email }, new HITLGate({}))
          .run({ type: 'sales:hunt', payload: { lead: { company: 'Iberdrola', email: 'x@iberdrola.es' }, cold: true } });
        expect(out.status === 'blocked', 'debe bloquearse');
        expect(email.sent === 0, 'JAMÁS enviar a una cuenta excluida');
      },
    },
    {
      name: 'el primer contacto en frío siempre pasa por aprobación humana',
      async check() {
        const email = { name: 'email', sent: 0, async execute() { this.sent++; return { sent: true }; } };
        const hitl = new HITLGate({});
        let pidio = false;
        hitl.notify = ({ approvalId }) => { pidio = true; setImmediate(() => hitl.resolve(approvalId, false)); };
        await outreach({ email }, hitl)
          .run({ type: 'sales:hunt', payload: { lead: { company: 'Puerto de Algeciras', email: 'd@apba.es' }, cold: true } });
        expect(pidio, 'el frío debe pedir aprobación');
        expect(email.sent === 0, 'sin sí humano no se envía');
      },
    },
    {
      name: 'el preámbulo en frío prohíbe jerga cripto y enlaces de pago',
      async check() {
        const cold = bezhas.preamble('cold');
        expect(/PROHIBIDO en frío/.test(cold), 'debe declarar la prohibición');
        expect(/cripto/.test(cold), 'debe nombrar la jerga cripto vetada');
        expect(/rentabilidad|ROI|retornos/i.test(cold), 'debe prohibir promesas de rentabilidad');
      },
    },
  ],
};
