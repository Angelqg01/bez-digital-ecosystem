'use strict';

/**
 * Standalone demo of the autonomous arbitrage agent against LIVE OMIE price.
 * Seeds a battery telemetry reading, evaluates, and prints the decision
 * (dispatch disabled — no broker required).
 *
 *   node scripts/verify-arbitrage-agent.js
 */

const vppBroker = require('../services/vppMqttBroker');
const agent = require('../services/energyArbitrageAgent');

(async () => {
  // Seed a battery telemetry reading (as if an Edge Node had published it).
  const soc = Number(process.env.SIM_SOC || 55);
  vppBroker.ingest('n4', { type: 'BATTERY', name: 'BESS Unit 1', metrics: { soc_pct: soc, output_kw: 0 } });

  const decision = await agent.runOnce({ dispatch: false });

  console.log('Arbitrage decision (live OMIE + seeded SoC):');
  console.log(JSON.stringify({
    strategy: decision.strategy,
    powerKw: decision.powerKw,
    priceEurMwh: decision.priceEurMwh,
    priceSource: decision.priceSource,
    socPct: decision.socPct,
    nodeId: decision.nodeId,
    reason: decision.reason,
  }, null, 2));

  process.exit(0);
})().catch((err) => { console.error('verify failed:', err.message); process.exit(1); });
