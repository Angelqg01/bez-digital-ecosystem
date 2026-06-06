'use strict';

/**
 * energyArbitrageAgent — autonomous battery arbitrage for the BeZhas VPP.
 *
 * Closes the loop:  real OMIE price (energyFeedService)
 *                 + battery telemetry (vppMqttBroker)
 *                 → decision (charge / discharge / hold)
 *                 → SCADA dispatch over MQTT (vppMqttBroker.publishControl).
 *
 * `evaluate()` is a pure, deterministic decision function (unit-testable).
 * Battery SoC limits prevent over-charge / deep-discharge.
 */

const logger = require('../utils/logger');
const energyFeed = require('./energyFeedService');
const vppBroker = require('./vppMqttBroker');
const vppChainBridge = require('./vppChainBridge');

const DEFAULTS = {
  chargeBelowEurMwh: 30,    // charge when price is below this
  dischargeAboveEurMwh: 80, // sell when price is above this
  negativeEurMwh: -5,       // below this → absorb at max power (get paid)
  minSocPct: 20,            // never discharge below this
  maxSocPct: 95,            // never charge above this
  maxPowerKw: 500,
};

/**
 * Pure arbitrage decision.
 * @param {{ priceEurMwh:number, socPct:number, capacityKw?:number, cfg?:object }} input
 * @returns {{ strategy:string, powerKw:number, reason:string }}
 *   strategy ∈ MAX_CHARGE | CHARGE | DISCHARGE_SELL | HOLD
 */
function evaluate({ priceEurMwh, socPct, capacityKw, cfg = {} } = {}) {
  const c = { ...DEFAULTS, ...cfg };
  const power = capacityKw || c.maxPowerKw;

  if (priceEurMwh == null || socPct == null) {
    return { strategy: 'HOLD', powerKw: 0, reason: 'insufficient data (price or SoC missing)' };
  }

  if (priceEurMwh < c.negativeEurMwh) {
    if (socPct >= c.maxSocPct) return { strategy: 'HOLD', powerKw: 0, reason: `negative price but battery full (${socPct}%)` };
    return { strategy: 'MAX_CHARGE', powerKw: power, reason: `negative price ${priceEurMwh} EUR/MWh — absorb at max power` };
  }

  if (priceEurMwh < c.chargeBelowEurMwh) {
    if (socPct >= c.maxSocPct) return { strategy: 'HOLD', powerKw: 0, reason: `cheap (${priceEurMwh}) but battery full (${socPct}%)` };
    return { strategy: 'CHARGE', powerKw: power, reason: `price ${priceEurMwh} < ${c.chargeBelowEurMwh} EUR/MWh — charge` };
  }

  if (priceEurMwh > c.dischargeAboveEurMwh) {
    if (socPct <= c.minSocPct) return { strategy: 'HOLD', powerKw: 0, reason: `expensive (${priceEurMwh}) but battery low (${socPct}%)` };
    return { strategy: 'DISCHARGE_SELL', powerKw: power, reason: `price ${priceEurMwh} > ${c.dischargeAboveEurMwh} EUR/MWh — discharge & sell` };
  }

  return { strategy: 'HOLD', powerKw: 0, reason: `price ${priceEurMwh} within hold band` };
}

/** First BATTERY node in a telemetry payload, or null. */
function pickBattery(telemetry) {
  if (!telemetry || !Array.isArray(telemetry.nodes)) return null;
  return telemetry.nodes.find((n) => n.type === 'BATTERY') || null;
}

/** Map an arbitrage strategy to a SCADA command (null = no actuation). */
function strategyToCommand(strategy) {
  switch (strategy) {
    case 'MAX_CHARGE':
    case 'CHARGE': return 'CHARGE_BATTERY';
    case 'DISCHARGE_SELL': return 'DISCHARGE_BATTERY';
    default: return null;
  }
}

/**
 * Evaluate once against live OMIE price + battery telemetry and (optionally)
 * dispatch the resulting SCADA command over MQTT.
 * @param {{ capacityKw?:number, cfg?:object, dispatch?:boolean }} opts
 */
async function runOnce(opts = {}) {
  const omie = await energyFeed.getOmiePrice();
  const telemetry = vppBroker.getLatestTelemetry();
  const battery = pickBattery(telemetry);

  const priceEurMwh = omie ? omie.price_eur_mwh : null;
  const socPct = battery && battery.soc_pct != null ? battery.soc_pct : null;

  const decision = evaluate({ priceEurMwh, socPct, capacityKw: opts.capacityKw, cfg: opts.cfg });
  decision.priceEurMwh = priceEurMwh;
  decision.socPct = socPct;
  decision.nodeId = battery ? battery.id : null;
  decision.priceSource = omie ? omie.source : 'none';

  const command = strategyToCommand(decision.strategy);
  decision.dispatched = false;
  decision.onchainTx = null;
  if (command && decision.powerKw > 0 && decision.nodeId && opts.dispatch !== false) {
    decision.command = command;
    decision.dispatched = vppBroker.publishControl(decision.nodeId, command, { powerKw: decision.powerKw });
    // Best-effort immutable audit on BeZhasVPP.sol (null when bridge unconfigured).
    const jobId = `arb_${Date.now()}_${decision.nodeId}`;
    const onchain = await vppChainBridge.logCommandOnChain(jobId, decision.nodeId, command, { powerKw: decision.powerKw }, decision.powerKw);
    decision.onchainTx = onchain && onchain.ok ? onchain.hash : null;
  }

  logger.info('[ENERGY][ARBITRAGE] strategy=%s price=%s soc=%s dispatched=%s',
    decision.strategy, priceEurMwh, socPct, decision.dispatched);
  return decision;
}

let _timer = null;

/** Start the autonomous arbitrage loop (default every 5 min). */
function start(intervalMs = 300000, opts = {}) {
  if (_timer) return _timer;
  runOnce(opts).catch((e) => logger.warn('[ARBITRAGE] runOnce error: %s', e.message));
  _timer = setInterval(() => runOnce(opts).catch((e) => logger.warn('[ARBITRAGE] runOnce error: %s', e.message)), intervalMs);
  return _timer;
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { evaluate, pickBattery, strategyToCommand, runOnce, start, stop, DEFAULTS };
