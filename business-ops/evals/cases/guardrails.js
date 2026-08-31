'use strict';

/**
 * Contrato de las líneas rojas — el que protege legalmente el producto:
 * mover dinero, contratar/despedir, publicar, contactar en frío y borrar
 * archivos NUNCA se ejecutan solos, y ningún override puede relajarlos.
 */
const PolicyEngine = require('../../src/guardrails/PolicyEngine');
const { categoryForToolCall } = require('../../src/cognition/toolCatalog');
const { expect } = require('../world');

function evaluate(action, overrides = {}) {
  const pe = new PolicyEngine({ tenantId: 'evals', overrides });
  return pe.evaluate({ agentId: 'evals.agent', action });
}

module.exports = {
  suite: 'guardrails',
  description: 'líneas rojas intocables y overrides que solo endurecen',
  cases: [
    {
      name: 'mover dinero → aprobación humana, siempre',
      async check() {
        const v = evaluate({ category: 'payment', amount: 10 });
        expect(!v.allowed && v.requiresApproval, 'payment debe requerir humano');
      },
    },
    {
      name: 'contratar/despedir → aprobación humana',
      async check() {
        const v = evaluate({ category: 'employment', method: 'hire' });
        expect(!v.allowed && v.requiresApproval, 'employment debe requerir humano');
      },
    },
    {
      name: 'primer contacto en frío → aprobación humana (aunque sea 1 destinatario)',
      async check() {
        const v = evaluate({ category: 'outbound', cold: true, recipientCount: 1 });
        expect(!v.allowed && v.requiresApproval, 'cold outreach debe requerir humano');
      },
    },
    {
      name: 'email a cliente existente (no frío) → permitido',
      async check() {
        const v = evaluate({ category: 'outbound', cold: false, recipientCount: 1 });
        expect(v.allowed, 'el seguimiento a cliente existente no debe frenarse');
      },
    },
    {
      name: 'envío masivo (>50) → aprobación humana aunque no sea frío',
      async check() {
        const v = evaluate({ category: 'outbound', cold: false, recipientCount: 200 });
        expect(!v.allowed && v.requiresApproval, 'masivo debe requerir humano');
      },
    },
    {
      name: 'borrar/mover archivos → aprobación humana; leer/escribir → permitido',
      async check() {
        const rm = evaluate({ category: 'filesystem', method: 'remove' });
        const rd = evaluate({ category: 'filesystem', method: 'read' });
        expect(!rm.allowed && rm.requiresApproval, 'remove es irreversible');
        expect(rd.allowed, 'leer no debe frenarse');
      },
    },
    {
      name: 'ningún override relaja una línea roja',
      async check() {
        // Ni siquiera un override explícito sobre payment cambia el veredicto.
        const v = evaluate({ category: 'payment' }, { payment: 'always_approve' });
        expect(!v.allowed && v.requiresApproval, 'la línea roja se evalúa antes que el override');
      },
    },
    {
      name: 'override del tenant endurece: block corta una categoría normal',
      async check() {
        const v = evaluate({ category: 'crm', method: 'upsertLead' }, { crm: 'block' });
        expect(!v.allowed && !v.requiresApproval, 'block debe prohibir sin preguntar');
      },
    },
    {
      name: 'el mapeo del tool-use lleva stripe.transfer a la línea roja de dinero',
      async check() {
        const action = { tool: 'stripe', method: 'transfer', ...categoryForToolCall('stripe', 'transfer', {}) };
        const v = evaluate(action);
        expect(!v.allowed && v.requiresApproval, 'una transferencia pedida por el modelo debe requerir humano');
      },
    },
    {
      name: 'el mapeo del tool-use deja pasar lo inofensivo (crm.listLeads)',
      async check() {
        const action = { tool: 'crm', method: 'listLeads', ...categoryForToolCall('crm', 'listLeads', {}) };
        const v = evaluate(action);
        expect(v.allowed, 'consultar el CRM no debe frenarse');
      },
    },
    {
      name: 'transferir BEZ-Coin / tesorería / staking → aprobación humana, siempre',
      async check() {
        const transfer = evaluate({ tool: 'blockchain', method: 'transfer', category: 'crypto_transfer' });
        const stake = evaluate({ tool: 'blockchain', method: 'stake' });
        const treasury = evaluate({ category: 'treasury_movement' });
        expect(!transfer.allowed && transfer.requiresApproval, 'transferir cripto debe requerir humano');
        expect(!stake.allowed && stake.requiresApproval, 'staking debe requerir humano');
        expect(!treasury.allowed && treasury.requiresApproval, 'mover tesorería debe requerir humano');
      },
    },
    {
      name: 'desplegar/actualizar/pausar un smart contract → aprobación humana, siempre',
      async check() {
        const deploy = evaluate({ tool: 'blockchain', method: 'deploy' });
        const upgrade = evaluate({ tool: 'blockchain', method: 'upgrade' });
        const admin = evaluate({ category: 'contract_admin', method: 'grantRole' });
        expect(!deploy.allowed && deploy.requiresApproval, 'deploy debe requerir humano');
        expect(!upgrade.allowed && upgrade.requiresApproval, 'upgrade debe requerir humano');
        expect(!admin.allowed && admin.requiresApproval, 'cambiar roles/admin debe requerir humano');
      },
    },
    {
      name: 'ningún override relaja las líneas rojas on-chain',
      async check() {
        const v = evaluate({ tool: 'blockchain', method: 'transfer', category: 'crypto_transfer' }, { crypto_transfer: 'always_approve' });
        expect(!v.allowed && v.requiresApproval, 'la línea roja se evalúa antes que el override');
      },
    },
    {
      name: 'firmar un contrato (legal.contract-review) → aprobación humana, siempre',
      async check() {
        const v = evaluate({ category: 'signature', tool: 'esign', method: 'sign', args: { document: 'texto...' } });
        expect(!v.allowed && v.requiresApproval, 'firmar un contrato debe requerir humano');
      },
    },
    {
      name: 'contacto en frío a un inversor (fundraising.investor-outreach) → misma línea roja que ventas',
      async check() {
        const v = evaluate({ category: 'outbound', cold: true, tool: 'email', method: 'send', recipientCount: 1 });
        expect(!v.allowed && v.requiresApproval, 'el contacto en frío a un fondo/VC debe requerir humano igual que en ventas');
      },
    },
    {
      name: 'dispersión de BEZ-Coin tras un pago de Stripe → aprobación humana, siempre',
      async check() {
        // Mismo shape que TokenDisbursementAgent.act(): categoría crypto_transfer,
        // tool blockchain. Ni el importe ni la wallet cambian el veredicto.
        const v = evaluate({ category: 'crypto_transfer', tool: 'blockchain', method: 'transfer', args: { to: '0xabc', amount: 133333.33 } });
        expect(!v.allowed && v.requiresApproval, 'la venta de BEZ-Coin nunca se transfiere sin humano');
      },
    },
  ],
};
