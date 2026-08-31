'use strict';

const DepartmentManager = require('../DepartmentManager');
const TreasuryRunwayAgent = require('./TreasuryRunwayAgent');
const TokenomicsAgent = require('./TokenomicsAgent');
const VestingMonitorAgent = require('./VestingMonitorAgent');
const LiquidityWatcherAgent = require('./LiquidityWatcherAgent');

/** TreasuryManager — tesorería y tokenomics on-chain. Solo lee y analiza; mover fondos = TokenDisbursementAgent + HITL. */
class TreasuryManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'treasury.manager',
      name: 'Treasury Manager',
      department: 'treasury',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director de Tesorería/Tokenomics: vigilas el balance del Treasury DAO y la salud del token BEZ-Coin. Nunca mueves fondos por tu cuenta.',
    });

    this.routing = {
      'treasury:runway': 'treasury.runway',
      'treasury:tokenomics': 'treasury.tokenomics',
      'treasury:vesting': 'treasury.vesting-monitor',
      'treasury:liquidity': 'treasury.liquidity-watcher',
    };

    const childCtx = { ...ctx, department: 'treasury' };
    this.registerSpecialist(new TreasuryRunwayAgent(childCtx));
    this.registerSpecialist(new TokenomicsAgent(childCtx));
    this.registerSpecialist(new VestingMonitorAgent(childCtx));
    this.registerSpecialist(new LiquidityWatcherAgent(childCtx));
  }
}

module.exports = TreasuryManager;
