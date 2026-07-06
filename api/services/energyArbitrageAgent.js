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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 — production risk controls: shadow mode, € HITL gate, Aegis kill-switch
// ─────────────────────────────────────────────────────────────────────────────

const RISK = {
  // 'shadow' = recommend + log P&L but NEVER actuate (default — validate first).
  // 'live'   = actuate via the signed F5 write-path, with the € HITL gate below.
  mode: process.env.VPP_ARBITRAGE_MODE || 'shadow',
  hitlAboveEur: Number(process.env.VPP_ARBITRAGE_HITL_EUR || 500),       // > this € → human approval
  intervalHours: Number(process.env.VPP_ARBITRAGE_INTERVAL_HOURS || 0.25),
  killSwitchWindowMs: Number(process.env.VPP_ARBITRAGE_KILL_WINDOW_MS || 600000), // 10 min
};

/** Notional € exposure of moving `powerKw` for `hours` at `priceEurMwh`. */
function estimateEur(powerKw, priceEurMwh, hours = RISK.intervalHours) {
  if (!priceEurMwh || !powerKw) return 0;
  return +(((powerKw / 1000) * hours * priceEurMwh)).toFixed(2);
}

/** Kill-switch: refuse to trade on a node with a recent HIGH Aegis anomaly. */
function aegisRecentHigh(nodeId, windowMs = RISK.killSwitchWindowMs) {
  try {
    const aegis = require('./aegisAnomalyEngine');
    const now = Date.now();
    return aegis.recentEvents(100).some(
      (e) => e.node === nodeId && e.severity === 'HIGH' && now - new Date(e.ts).getTime() < windowMs
    );
  } catch { return false; }
}

// Rolling decision log for shadow validation / back-test.
let decisionLog = [];
function record(d) {
  decisionLog.push({
    ts: new Date().toISOString(), strategy: d.strategy, priceEurMwh: d.priceEurMwh,
    socPct: d.socPct, powerKw: d.powerKw, estimatedEur: d.estimatedEur, mode: d.mode,
    dispatched: !!d.dispatched, hitlPending: !!d.hitlPending, blocked: d.blocked || null,
  });
  if (decisionLog.length > 500) decisionLog = decisionLog.slice(-500);
}

function getDecisionLog(limit = 50) { return decisionLog.slice(-limit).reverse(); }

/** Notional P&L over the logged decisions (for shadow-mode validation). */
function getPnlSummary() {
  let chargeCost = 0, dischargeRevenue = 0, charges = 0, discharges = 0, holds = 0;
  for (const d of decisionLog) {
    if (d.strategy === 'CHARGE' || d.strategy === 'MAX_CHARGE') { chargeCost += d.estimatedEur || 0; charges++; }
    else if (d.strategy === 'DISCHARGE_SELL') { dischargeRevenue += d.estimatedEur || 0; discharges++; }
    else holds++;
  }
  return {
    decisions: decisionLog.length, charges, discharges, holds,
    charge_cost_eur: +chargeCost.toFixed(2),
    discharge_revenue_eur: +dischargeRevenue.toFixed(2),
    net_arbitrage_eur: +(dischargeRevenue - chargeCost).toFixed(2),
    note: 'notional estimate for shadow validation, not realised P&L',
  };
}

/**
 * Actuate a decision through the production-safe path:
 *   shadow → recommend only; kill-switch → block; > € threshold → HITL queue;
 *   otherwise → SIGN (controlSecurity) + publishSignedControl (F5) + on-chain audit.
 * Mutates and returns `decision`.
 */
async function dispatchDecision(decision, opts = {}) {
  const mode = opts.mode || RISK.mode;
  const hitlAboveEur = opts.hitlAboveEur != null ? opts.hitlAboveEur : RISK.hitlAboveEur;
  decision.mode = mode;
  decision.dispatched = false;
  decision.onchainTx = null;

  const command = strategyToCommand(decision.strategy);
  decision.command = command;
  if (!command || !(decision.powerKw > 0) || !decision.nodeId) return decision;

  // Kill-switch: never trade on telemetry Aegis flagged as compromised.
  if (aegisRecentHigh(decision.nodeId, opts.killSwitchWindowMs)) {
    decision.blocked = 'aegis_high_anomaly';
    logger.warn('[ENERGY][ARBITRAGE] kill-switch: HIGH Aegis anomaly on %s — holding', decision.nodeId);
    return decision;
  }

  if (mode === 'shadow') { decision.shadow = true; return decision; }

  const jobId = `arb_${Date.now()}_${decision.nodeId}`;
  decision.jobId = jobId;
  const params = { powerKw: decision.powerKw };

  // € HITL gate: large exposure requires a human approval before dispatch.
  if (Math.abs(decision.estimatedEur || 0) > hitlAboveEur) {
    require('./hitlQueue').submit({ jobId, nodeId: decision.nodeId, command, params, requestedBy: 'arbitrage-agent' });
    decision.hitlPending = true;
    logger.warn('[ENERGY][ARBITRAGE] €%s > €%s → HITL pending (job %s)', decision.estimatedEur, hitlAboveEur, jobId);
    return decision;
  }

  // Signed dispatch via the Phase 5 write-path.
  const signed = require('./controlSecurity').signCommand({ jobId, command, params, ts: new Date().toISOString() });
  decision.dispatched = vppBroker.publishSignedControl(decision.nodeId, signed);
  decision.signed = true;
  const onchain = await vppChainBridge.logCommandOnChain(jobId, decision.nodeId, command, params, decision.powerKw);
  decision.onchainTx = onchain && onchain.ok ? onchain.hash : null;
  return decision;
}

/**
 * Evaluate once against live OMIE price + battery telemetry and (optionally)
 * actuate via the production-safe dispatch path.
 * @param {{ capacityKw?:number, cfg?:object, dispatch?:boolean, mode?:string }} opts
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
  decision.estimatedEur = estimateEur(decision.powerKw, priceEurMwh, opts.intervalHours);

  if (opts.dispatch !== false) await dispatchDecision(decision, opts);
  else decision.mode = 'evaluate-only';

  record(decision);
  logger.info('[ENERGY][ARBITRAGE] mode=%s strategy=%s price=%s soc=%s €%s dispatched=%s%s',
    decision.mode, decision.strategy, priceEurMwh, socPct, decision.estimatedEur, decision.dispatched,
    decision.blocked ? ` blocked=${decision.blocked}` : (decision.hitlPending ? ' HITL_PENDING' : ''));
  return decision;
}

let _timer = null;

/** Start the autonomous arbitrage loop (default every 5 min, shadow mode). */
function start(intervalMs = 300000, opts = {}) {
  if (_timer) return _timer;
  logger.info('[ENERGY][ARBITRAGE] loop start mode=%s interval=%dms hitl>€%s',
    opts.mode || RISK.mode, intervalMs, opts.hitlAboveEur != null ? opts.hitlAboveEur : RISK.hitlAboveEur);
  runOnce(opts).catch((e) => logger.warn('[ARBITRAGE] runOnce error: %s', e.message));
  _timer = setInterval(() => runOnce(opts).catch((e) => logger.warn('[ARBITRAGE] runOnce error: %s', e.message)), intervalMs);
  if (_timer.unref) _timer.unref();
  return _timer;
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

function _resetLog() { decisionLog = []; }

module.exports = {
  evaluate, pickBattery, strategyToCommand, estimateEur,
  dispatchDecision, runOnce, start, stop,
  getDecisionLog, getPnlSummary, DEFAULTS, RISK, _resetLog,
};
