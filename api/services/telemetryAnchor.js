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
 */

const crypto = require('crypto');
const { stableStringify } = require('./telemetrySecurity');
const logger = require('../utils/logger');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

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

/** nodeId → { leaves[], energyStart, energyEnd, period } */
const acc = new Map();

/** Feed one ingest record; only accepted + signed telemetry is accumulated. */
function observe(rec) {
  if (!rec || !rec.accepted || !rec.payload || !rec.payload.sig) return;
  const { nodeId, payload } = rec;
  const m = payload.metrics || {};
  let a = acc.get(nodeId);
  if (!a) { a = { leaves: [], energyStart: null, energyEnd: null, period: periodOf(payload.ts) }; acc.set(nodeId, a); }
  a.leaves.push(leafHash(payload));
  if (typeof m.energy_kwh === 'number') {
    if (a.energyStart == null) a.energyStart = m.energy_kwh;
    a.energyEnd = m.energy_kwh;
  }
  a.period = periodOf(payload.ts) || a.period;
}

/** Build (and clear) the pending batch for a node, or null if nothing pending. */
function buildBatch(nodeId) {
  const a = acc.get(nodeId);
  if (!a || !a.leaves.length) return null;
  const kWh = a.energyStart != null && a.energyEnd != null ? Math.max(0, a.energyEnd - a.energyStart) : 0;
  const batch = { nodeId, root: merkleRoot(a.leaves), count: a.leaves.length, kWh: Math.round(kWh), period: a.period || 'unknown' };
  acc.delete(nodeId);
  return batch;
}

function pendingNodes() { return [...acc.keys()]; }

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
    const batch = buildBatch(nodeId);
    if (!batch || batch.kWh <= 0) continue; // submitProof requires kWh > 0
    await bridge.registerNodeOnChain(nodeId, account); // idempotent best-effort
    const proofId = `${nodeId}:${batch.period}:${batch.root.slice(0, 18)}`;
    const r = await bridge.anchorTelemetryOnChain(proofId, nodeId, account, batch.kWh, batch.period, batch.root);
    results.push({ ...batch, proofId, tx: r && r.hash, ok: !!(r && r.ok) });
    if (r && r.ok) logger.info('[VPP][ANCHOR] node=%s kWh=%d root=%s tx=%s', nodeId, batch.kWh, batch.root.slice(0, 18), r.hash);
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

module.exports = { leafHash, merkleRoot, periodOf, observe, buildBatch, pendingNodes, anchorPending, start, stop, _reset };
