'use strict';

/**
 * cargoTelemetryAnchor — merkle anchoring of telemetry batches (Fase 7).
 *
 * Instead of pushing every sensor reading on-chain, the batch since the last
 * anchor is consolidated into a sha256 merkle root (sorted pairs) which is
 * anchored on the TelemetryAnchor contract. Any single reading can later be
 * proven against the on-chain root with an inclusion proof — "Ruta sin
 * alteraciones" as a cryptographic statement instead of a promise.
 *
 * On-chain part is best-effort and degrades gracefully (same policy as
 * cargoLinkOnChain): if no signer/contract is configured the root is still
 * computed and stored off-chain with anchored=false.
 *
 * Env: TELEMETRY_ANCHOR_ADDRESS (or deployments/<chainId>.json → supplychain.TelemetryAnchor),
 *      CARGOLINK_OPERATOR_KEY / OPERATOR_PRIVATE_KEY, RPC_URL / BEZHAS_L2_RPC_URL.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');

const ANCHOR_ABI = [
  'function anchorBatch(string bUid, bytes32 merkleRoot, uint64 fromTs, uint64 toTs, uint32 leafCount) external returns (uint256)',
  'function anchorCount(string bUid) external view returns (uint256)',
  'function verify(string bUid, uint256 index, bytes32 leaf, bytes32[] proof) external view returns (bool)',
];

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const sha256Buf = (buf) => crypto.createHash('sha256').update(buf).digest();
const hex = (buf) => `0x${buf.toString('hex')}`;

/** Canonical leaf for one telemetry row — deterministic, re-computable by anyone. */
function leafFor(row) {
  const recordedAt = new Date(row.recorded_at).toISOString();
  const canonical = [
    row.id, row.device_id, row.metric,
    row.value === null ? '' : String(Number(row.value)),
    row.unit || '', row.lat === null ? '' : String(Number(row.lat)),
    row.lng === null ? '' : String(Number(row.lng)),
    row.breach ? '1' : '0', row.event_type || '', recordedAt,
  ].join('|');
  return sha256Buf(Buffer.from(canonical, 'utf8'));
}

/** Sorted-pair sha256 merkle root (matches TelemetryAnchor.verify on-chain). */
function merkleRoot(leaves) {
  if (leaves.length === 0) return null;
  let level = leaves.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
}

function hashPair(a, b) {
  return Buffer.compare(a, b) <= 0
    ? sha256Buf(Buffer.concat([a, b]))
    : sha256Buf(Buffer.concat([b, a]));
}

/** Inclusion proof (list of sibling hashes, sorted-pair scheme). */
function merkleProof(leaves, index) {
  const proof = [];
  let level = leaves.slice();
  let i = index;
  while (level.length > 1) {
    const next = [];
    for (let j = 0; j < level.length; j += 2) {
      const left = level[j];
      const right = j + 1 < level.length ? level[j + 1] : level[j];
      next.push(hashPair(left, right));
    }
    const sibling = i % 2 === 0 ? Math.min(i + 1, level.length - 1) : i - 1;
    proof.push(level[sibling]);
    i = Math.floor(i / 2);
    level = next;
  }
  return proof;
}

function verifyProof(leaf, proof, root) {
  let acc = leaf;
  for (const sibling of proof) acc = hashPair(acc, sibling);
  return Buffer.compare(acc, root) === 0;
}

// ── On-chain (best-effort) ───────────────────────────────────────────────────

function getAnchorAddress() {
  if (process.env.TELEMETRY_ANCHOR_ADDRESS) return process.env.TELEMETRY_ANCHOR_ADDRESS;
  try {
    const chainId = process.env.BEZHAS_CHAIN_ID || process.env.CHAIN_ID || '2708';
    const data = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../smart-contracts/deployments', `${chainId}.json`), 'utf8')
    );
    return (data.supplychain && data.supplychain.TelemetryAnchor) || null;
  } catch {
    return null;
  }
}

function getSigner() {
  const key = process.env.CARGOLINK_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
  const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
  if (!key || !rpc) return null;
  return new ethers.Wallet(key, new ethers.JsonRpcProvider(rpc));
}

async function anchorOnChain({ bUid, root, fromTs, toTs, leafCount }) {
  const address = getAnchorAddress();
  const signer = getSigner();
  if (!address || !signer) return { anchored: false, mode: 'not_configured' };
  try {
    const contract = new ethers.Contract(address, ANCHOR_ABI, signer);
    const tx = await contract.anchorBatch(
      bUid, root,
      Math.floor(new Date(fromTs).getTime() / 1000),
      Math.floor(new Date(toTs).getTime() / 1000),
      leafCount
    );
    const receipt = await tx.wait();
    const network = await signer.provider.getNetwork();
    return { anchored: true, txHash: receipt.hash, chainId: Number(network.chainId) };
  } catch (err) {
    return { anchored: false, mode: 'anchor_failed', error: err.message };
  }
}

// ── API surface ──────────────────────────────────────────────────────────────

/** Rows not yet covered by an anchor for this B-UID, in id order. */
async function pendingRows(bUid) {
  const { rows: last } = await query(
    `SELECT last_reading_id FROM cargolink_telemetry_anchors
      WHERE b_uid = $1 ORDER BY last_reading_id DESC LIMIT 1`,
    [bUid]
  );
  const after = last.length ? last[0].last_reading_id : 0;
  const { rows } = await query(
    `SELECT id, device_id, metric, value, unit, lat, lng, breach, event_type, recorded_at
       FROM cargolink_telemetry WHERE b_uid = $1 AND id > $2 ORDER BY id ASC`,
    [bUid, after]
  );
  return rows;
}

/**
 * Consolidate the pending telemetry of a shipment into a merkle root and
 * anchor it (owner-triggered; a scheduler may call it per stage close).
 */
async function anchorBatch(req, bUid) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!bUid) throw httpError('bUid is required', 400);

  const { rows: txRows } = await query(
    `SELECT b_uid FROM cargolink_transactions WHERE b_uid = $1 AND owner_bezhas_id = $2`,
    [bUid, identity.bezhasId]
  );
  if (!txRows.length) throw httpError(`Transaction ${bUid} not found`, 404);

  const rows = await pendingRows(bUid);
  if (rows.length === 0) throw httpError('No unanchored telemetry for this B-UID', 409);

  const leaves = rows.map(leafFor);
  const root = merkleRoot(leaves);
  const fromTs = rows[0].recorded_at;
  const toTs = rows[rows.length - 1].recorded_at;

  const chain = await anchorOnChain({ bUid, root: hex(root), fromTs, toTs, leafCount: rows.length });

  const { rows: saved } = await query(
    `INSERT INTO cargolink_telemetry_anchors
       (b_uid, merkle_root, leaf_count, first_reading_id, last_reading_id, from_ts, to_ts, anchored, tx_hash, chain_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, b_uid, merkle_root, leaf_count, from_ts, to_ts, anchored, tx_hash, chain_id, created_at`,
    [
      bUid, hex(root), rows.length, rows[0].id, rows[rows.length - 1].id,
      fromTs, toTs, Boolean(chain.anchored), chain.txHash || null, chain.chainId || null,
    ]
  );
  return { success: true, anchor: saved[0], chain };
}

/** List anchors for a shipment. */
async function listAnchors(req, { bUid } = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!bUid) throw httpError('bUid query param is required', 400);
  const { rows } = await query(
    `SELECT a.* FROM cargolink_telemetry_anchors a
       JOIN cargolink_transactions tx ON tx.b_uid = a.b_uid
      WHERE a.b_uid = $1 AND tx.owner_bezhas_id = $2
      ORDER BY a.created_at DESC`,
    [bUid, identity.bezhasId]
  );
  return { success: true, count: rows.length, anchors: rows };
}

/**
 * Inclusion proof for one reading: which anchor covers it, the sibling path
 * and the leaf preimage — verifiable off-chain or via TelemetryAnchor.verify().
 */
async function getProof(req, { bUid, readingId } = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!bUid || !readingId) throw httpError('bUid and readingId query params are required', 400);

  const { rows: anchors } = await query(
    `SELECT a.* FROM cargolink_telemetry_anchors a
       JOIN cargolink_transactions tx ON tx.b_uid = a.b_uid
      WHERE a.b_uid = $1 AND tx.owner_bezhas_id = $2
        AND a.first_reading_id <= $3 AND a.last_reading_id >= $3
      ORDER BY a.created_at ASC LIMIT 1`,
    [bUid, identity.bezhasId, readingId]
  );
  if (!anchors.length) throw httpError('No anchor covers this reading (anchor the batch first)', 404);
  const anchor = anchors[0];

  const { rows } = await query(
    `SELECT id, device_id, metric, value, unit, lat, lng, breach, event_type, recorded_at
       FROM cargolink_telemetry
      WHERE b_uid = $1 AND id >= $2 AND id <= $3 ORDER BY id ASC`,
    [bUid, anchor.first_reading_id, anchor.last_reading_id]
  );
  const index = rows.findIndex((r) => Number(r.id) === Number(readingId));
  if (index === -1) throw httpError('Reading not found in the anchored batch', 404);

  const leaves = rows.map(leafFor);
  const root = merkleRoot(leaves);
  if (hex(root) !== anchor.merkle_root) {
    throw httpError('Recomputed root does not match the stored anchor (data mutated?)', 500);
  }
  const proof = merkleProof(leaves, index);

  return {
    success: true,
    bUid,
    readingId: Number(readingId),
    leaf: hex(leaves[index]),
    proof: proof.map(hex),
    root: anchor.merkle_root,
    anchor: {
      id: anchor.id, anchored: anchor.anchored, txHash: anchor.tx_hash,
      chainId: anchor.chain_id, leafCount: anchor.leaf_count,
      fromTs: anchor.from_ts, toTs: anchor.to_ts,
    },
    verified: verifyProof(leaves[index], proof, root),
  };
}

module.exports = {
  leafFor,
  merkleRoot,
  merkleProof,
  verifyProof,
  anchorBatch,
  listAnchors,
  getProof,
};
