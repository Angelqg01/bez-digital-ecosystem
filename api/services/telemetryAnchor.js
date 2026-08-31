'use strict';

/**
 * telemetryAnchor — batches signed telemetry and anchors its merkle root on-chain
 * (Phase 4). Closes the loop: hardware-signed physical reading → tamper-evident
 * merkle root → immutable proof in EnergyOracle.sol (dataURI), accruing kWh.
 *
 * The merkle root uses SHA-256 (Node crypto) — it is stored verbatim as the
 * proof's `dataURI` string, so it only needs to be deterministic and verifiable
 * OFF-chain (the contract never recomputes it). This keeps the module free of
 * ethers, so the leaf/merkle logic is unit-testable under jest.
 *
 * Accumulation is fed from the broker sink (accepted + signed payloads only).
 * Anchoring is opt-in (env VPP_ANCHOR_AUTO=true) and best-effort via vppChainBridge.
 *
 * A batch is only anchorable when its kWh delta is > 0 (EnergyOracle.submitProof
 * rejects kWh == 0). A node can legitimately produce readings with no kWh
 * progress — an idle battery, a consumption-only node, a meter that reports
 * cumulative energy sporadically — so those leaves are RETAINED across anchor
 * intervals until the counter advances, rather than discarded: they are accepted
 * and signed evidence, which is the whole point of this module. The buffer is
 * bounded per node (VPP_ANCHOR_MAX_PENDING_LEAVES); on overflow the oldest
 * leaves are dropped, logged, and counted in bezhas_energy_dropped_readings_total.
 */

const crypto = require('crypto');
const { stableStringify } = require('./telemetrySecurity');
const logger = require('../utils/logger');
const { energy: energyMetrics } = require('../middleware/metrics');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Max leaves buffered per node while its batch is not yet anchorable. Read
 * lazily so it stays configurable at runtime (and testable) like the interval.
 */
function maxPendingLeaves() {
  const n = parseInt(process.env.VPP_ANCHOR_MAX_PENDING_LEAVES || '5000', 10);
  return Number.isFinite(n) && n > 0 ? n : 5000;
}

/** Leaf = SHA-256 of the canonical signed payload (includes its `sig`). */
function leafHash(payload) {
  return sha256(Buffer.from(stableStringify(payload), 'utf8'));
}

/**
 * Binary merkle root (SHA-256) over hex leaves. Odd levels duplicate the last
 * node. Returns a `0x`-prefixed hex root, or the zero hash for an empty batch.
 */
function merkleRoot(leaves) {
  if (!leaves.length) return '0x' + '0'.repeat(64);
  let level = leaves.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate last if odd
      next.push(sha256(Buffer.from(a + b, 'hex')));
    }
    level = next;
  }
  return '0x' + level[0];
}

/** Derive a period key from an ISO timestamp (YYYY-MM-DD), or '' if absent. */
function periodOf(ts) { return typeof ts === 'string' && ts.length >= 10 ? ts.slice(0, 10) : ''; }

/** nodeId → { leaves[], energyStart, energyEnd, period, dropped } */
const acc = new Map();

/** Feed one ingest record; only accepted + signed telemetry is accumulated. */
function observe(rec) {
  if (!rec || !rec.accepted || !rec.payload || !rec.payload.sig) return;
  const { nodeId, payload } = rec;
  const m = payload.metrics || {};
  let a = acc.get(nodeId);
  if (!a) { a = { leaves: [], energyStart: null, energyEnd: null, period: periodOf(payload.ts), dropped: 0 }; acc.set(nodeId, a); }
  a.leaves.push(leafHash(payload));
  enforceCap(nodeId, a);
  if (typeof m.energy_kwh === 'number') {
    if (a.energyStart == null) a.energyStart = m.energy_kwh;
    a.energyEnd = m.energy_kwh;
  }
  a.period = periodOf(payload.ts) || a.period;
}

/**
 * Bound the per-node buffer. Only reachable when a node has gone many anchor
 * intervals without kWh progress; the oldest leaves go first so the most recent
 * evidence survives. The kWh window (energyStart/energyEnd) is left untouched —
 * it still describes the energy actually accrued — but the merkle root then
 * covers fewer readings than the period, so the loss is logged, counted, and
 * carried on the batch as `dropped` for whoever audits the proof later.
 */
function enforceCap(nodeId, a) {
  const cap = maxPendingLeaves();
  if (a.leaves.length <= cap) return;
  const n = a.leaves.length - cap;
  a.leaves.splice(0, n);
  a.dropped += n;
  if (a.dropped === n || a.dropped % 1000 < n) { // first drop, then every ~1000
    logger.warn('[VPP][ANCHOR] node=%s pending buffer full (cap=%d), dropped %d unanchored readings (total=%d)', nodeId, cap, n, a.dropped);
  }
  energyMetrics.dropped(nodeId, 'pending_overflow', n);
}

/** Build the pending batch for a node, or null if nothing pending.
 *  Consumes (clears) the accumulator unless `consume: false` is passed. */
function buildBatch(nodeId, { consume = true } = {}) {
  const a = acc.get(nodeId);
  if (!a || !a.leaves.length) return null;
  const kWh = a.energyStart != null && a.energyEnd != null ? Math.max(0, a.energyEnd - a.energyStart) : 0;
  const batch = { nodeId, root: merkleRoot(a.leaves), count: a.leaves.length, kWh: Math.round(kWh), period: a.period || 'unknown', dropped: a.dropped };
  if (consume) acc.delete(nodeId);
  return batch;
}

function pendingNodes() { return [...acc.keys()]; }

/** nodeId → buffered leaf count, for the Prometheus pending gauge. */
function pendingCounts() {
  const out = {};
  for (const [nodeId, a] of acc.entries()) out[nodeId] = a.leaves.length;
  return out;
}

/**
 * Anchor all pending batches on-chain via the bridge (best-effort).
 * @param {object} bridge  vppChainBridge (or a stub in tests)
 * @param {string} account beneficiary address the kWh accrue to
 * @returns {Promise<Array>} anchor results
 */
async function anchorPending(bridge, account) {
  if (!bridge || !bridge.isOracleEnabled || !bridge.isOracleEnabled()) return [];
  const results = [];
  for (const nodeId of pendingNodes()) {
    const batch = buildBatch(nodeId, { consume: false });
    if (!batch) continue;
    if (batch.kWh <= 0) {
      // submitProof requires kWh > 0, so there is nothing to accredit yet — but
      // that is not a reason to throw away signed evidence. Keep the leaves
      // buffered; they anchor with the next interval that shows kWh progress.
      logger.debug('[VPP][ANCHOR] node=%s deferred: no kWh progress, %d readings still pending', nodeId, batch.count);
      continue;
    }
    // Consume BEFORE awaiting the chain: readings that arrive mid-anchor must
    // start a fresh batch instead of being cleared by this one.
    acc.delete(nodeId);
    await bridge.registerNodeOnChain(nodeId, account); // idempotent best-effort
    const proofId = `${nodeId}:${batch.period}:${batch.root.slice(0, 18)}`;
    const t0 = Date.now();
    const r = await bridge.anchorTelemetryOnChain(proofId, nodeId, account, batch.kWh, batch.period, batch.root);
    const ok = !!(r && r.ok);
    energyMetrics.anchored(nodeId, batch.kWh, (Date.now() - t0) / 1000, ok);
    results.push({ ...batch, proofId, tx: r && r.hash, ok });
    if (ok) logger.info('[VPP][ANCHOR] node=%s kWh=%d root=%s tx=%s', nodeId, batch.kWh, batch.root.slice(0, 18), r.hash);
    else logger.warn('[VPP][ANCHOR] node=%s anchor FAILED, %d readings not anchored root=%s', nodeId, batch.count, batch.root.slice(0, 18));
  }
  return results;
}

// ── Auto-anchor timer (opt-in) ──
let timer = null;
function start(bridge, account, intervalMs = parseInt(process.env.VPP_ANCHOR_INTERVAL_MS || '900000', 10)) {
  if (timer || String(process.env.VPP_ANCHOR_AUTO).toLowerCase() !== 'true') return false;
  timer = setInterval(() => { anchorPending(bridge, account).catch((e) => logger.warn('[VPP][ANCHOR] %s', e.message)); }, intervalMs);
  if (timer.unref) timer.unref();
  logger.info('[VPP][ANCHOR] auto-anchor started (every %dms)', intervalMs);
  return true;
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

function _reset() { acc.clear(); stop(); }

module.exports = { leafHash, merkleRoot, periodOf, observe, buildBatch, pendingNodes, pendingCounts, anchorPending, start, stop, _reset };
