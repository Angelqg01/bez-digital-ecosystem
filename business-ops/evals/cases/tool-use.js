'use strict';

/**
 * Contrato del bucle agéntico: el modelo puede operar herramientas, pero
 * (1) todo pasa por guardrails, (2) un "no" humano no mata la tarea sino que
 * reorienta al modelo, y (3) el bucle siempre termina.
 * Usa un proveedor scriptado: el contrato es del BUCLE, no del modelo.
 */
const BaseAgent = require('../../src/agents/BaseAgent');
const ModelGateway = require('../../src/cognition/ModelGateway');
const PolicyEngine = require('../../src/guardrails/PolicyEngine');
const HITLGate = require('../../src/core/HITLGate');
const { expect } = require('../world');

function scripted(responses) {
  let i = 0;
  return { messages: { create: async () => responses[Math.min(i++, responses.length - 1)] } };
}
const toolUse = (name, input) => ({
  content: [{ type: 'tool_use', id: 't1', name, input }],
  stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 },
});
const finalText = (text) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });

function makeAgent({ provider, tools, hitl }) {
  return new BaseAgent({
    id: 'evals.agent', department: 'sales', tenantId: 'evals',
    model: new ModelGateway({ providers: { anthropic: provider } }),
    guardrails: new PolicyEngine({ tenantId: 'evals' }),
    hitl, tools, modelTier: 'fast',
  });
}

module.exports = {
  suite: 'tool-use',
  description: 'el bucle agéntico respeta guardrails y encaja rechazos',
  cases: [
    {
      name: 'acción inofensiva: se ejecuta y su resultado informa la respuesta',
      async check() {
        const crm = { name: 'crm', executed: 0, async execute() { this.executed++; return { leads: 3 }; } };
        const agent = makeAgent({
          provider: scripted([toolUse('crm', { method: 'listLeads', args: {} }), finalText('Hay 3 leads.')]),
          tools: { crm },
        });
        const out = await agent.thinkAndAct('¿cuántos leads hay?');
        expect(crm.executed === 1, 'el conector debía ejecutarse');
        expect(out.text === 'Hay 3 leads.', 'la respuesta final debía usar el resultado');
      },
    },
    {
      name: 'línea roja: el envío en frío espera al humano y solo se ejecuta tras el sí',
      async check() {
        const email = { name: 'email', executed: 0, async execute() { this.executed++; return { sent: true }; } };
        const hitl = new HITLGate({});
        let pidioAprobacion = false;
        hitl.notify = ({ approvalId }) => { pidioAprobacion = true; setImmediate(() => hitl.resolve(approvalId, true)); };
        const agent = makeAgent({
          provider: scripted([toolUse('email', { method: 'send', args: { to: 'x@y.z', cold: true } }), finalText('Enviado tras aprobación.')]),
          tools: { email }, hitl,
        });
        await agent.thinkAndAct('contacta en frío');
        expect(pidioAprobacion, 'debía pasar por HITL');
        expect(email.executed === 1, 'debía ejecutarse tras el sí humano');
      },
    },
    {
      name: 'rechazo humano: NO se ejecuta y el modelo recibe el motivo',
      async check() {
        const email = { name: 'email', executed: 0, async execute() { this.executed++; } };
        const hitl = new HITLGate({});
        hitl.notify = ({ approvalId }) => setImmediate(() => hitl.resolve(approvalId, false, 'lista Robinson'));
        const provider = scripted([toolUse('email', { method: 'send', args: { to: 'x@y.z', cold: true } }), finalText('Entendido, no contacto.')]);
        const calls = [];
        const origCreate = provider.messages.create;
        provider.messages.create = async (args) => { calls.push(args); return origCreate(args); };

        const agent = makeAgent({ provider, tools: { email }, hitl });
        const out = await agent.thinkAndAct('contacta en frío');
        expect(email.executed === 0, 'JAMÁS debía ejecutarse');
        expect(out.actions[0].status === 'rejected', 'la acción debía quedar rechazada');
        const feedback = JSON.stringify(calls.at(-1).messages.at(-1));
        expect(/Robinson/.test(feedback), 'el motivo humano debía volver al modelo');
      },
    },
    {
      name: 'el bucle siempre termina: tope de turnos marcado como exhausted',
      async check() {
        const crm = { name: 'crm', async execute() { return {}; } };
        const agent = makeAgent({
          provider: scripted([toolUse('crm', { method: 'listLeads', args: {} })]), // pide herramientas para siempre
          tools: { crm },
        });
        const out = await agent.thinkAndAct('bucle', { maxTurns: 3 });
        expect(out.exhausted === true && out.turns === 3, 'debía cortar en maxTurns');
      },
    },
  ],
};
