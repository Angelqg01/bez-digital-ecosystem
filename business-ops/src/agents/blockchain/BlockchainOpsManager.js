'use strict';

const DepartmentManager = require('../DepartmentManager');
const OnChainMonitorAgent = require('./OnChainMonitorAgent');
const ComplianceCheckAgent = require('./ComplianceCheckAgent');
const SlashingWatcherAgent = require('./SlashingWatcherAgent');
const GasOptimizerAgent = require('./GasOptimizerAgent');

/**
 * BlockchainOpsManager — primer departamento nativo de blockchain en OPERANT.
 * De momento solo lee (monitor on-chain); los especialistas que muevan algo
 * (deploys, transferencias) seguirán llegando aquí y siempre pasarán por las
 * líneas rojas crypto_asset_movement / smart_contract_change ya existentes.
 */
class BlockchainOpsManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'blockchain.manager',
      name: 'Blockchain Ops Manager',
      department: 'blockchain',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director de Blockchain Ops: vigilas la cadena, validadores, tesorería y gas. Nunca ejecutas movimientos on-chain por tu cuenta.',
    });

    this.routing = {
      'blockchain:monitor': 'blockchain.onchain-monitor',
      'blockchain:compliance-check': 'blockchain.compliance-check',
      'blockchain:slashing': 'blockchain.slashing-watcher',
      'blockchain:gas': 'blockchain.gas-optimizer',
    };

    const childCtx = { ...ctx, department: 'blockchain' };
    this.registerSpecialist(new OnChainMonitorAgent(childCtx));
    this.registerSpecialist(new ComplianceCheckAgent(childCtx));
    this.registerSpecialist(new SlashingWatcherAgent(childCtx));
    this.registerSpecialist(new GasOptimizerAgent(childCtx));
  }
}

module.exports = BlockchainOpsManager;
