'use strict';

/**
 * vppChainBridge — writes the VPP SCADA audit trail to BeZhasVPP.sol on-chain.
 *
 * Bridges off-chain dispatch (MQTT) to the immutable on-chain ledger:
 *   - enrollAssetOnChain()  → register a flexibility asset
 *   - logCommandOnChain()   → audit a dispatched SCADA command + accrue flexibility
 *
 * Fully optional & boot-safe:
 *   - `ethers` is required lazily-tolerant; the signer/contract are built only
 *     when VPP_RPC_URL + VPP_OPERATOR_PK + BEZHAS_VPP_ADDRESS are all set.
 *   - When unconfigured, every method returns null (callers treat as off-chain
 *     mock). The operator private key is read from env and NEVER logged.
 */

const logger = require('../utils/logger');

let ethers = null;
try { ethers = require('ethers'); } catch { /* ethers optional */ }

// Minimal ABI fragment — only what the bridge calls.
const VPP_ABI = [
  'function enrollAsset(bytes32 nodeId, address owner, uint8 kind, uint256 capacityKw)',
  'function logCommand(bytes32 jobId, bytes32 nodeId, string command, bytes32 paramsHash, uint256 energyKwh)',
  'function flexibilityOf(bytes32 nodeId) view returns (uint256)',
];

// EnergyOracle.sol — telemetry proof anchoring (dMRV). dataURI carries the
// signed-telemetry merkle root, making the physical reading immutable on-chain.
const ORACLE_ABI = [
  'function registerNode(bytes32 nodeId, address owner, string nodeType, string location)',
  'function submitProof(bytes32 proofId, bytes32 nodeId, address account, uint8 proofType, uint256 kWh, string period, string dataURI)',
  'function proofs(bytes32) view returns (address account, bytes32 nodeId, uint8 proofType, uint256 kWh, string period, string dataURI, uint64 timestamp, bool exists, bool verified)',
  'function nodes(bytes32) view returns (address owner, string nodeType, string location, bool active, uint64 lastReadingAt)',
  'function isFresh(bytes32 nodeId, uint64 maxAgeSeconds) view returns (bool)',
];

const PROOF_TYPE = { GENERATION: 0, SAVING: 1 };

/** Coerce an id to bytes32: pass through 32-byte hex, else keccak256(utf8). */
function toBytes32(value) {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)) return value;
  return ethers.id(String(value));
}

/** Deterministic keccak256 of the params JSON (proof of the off-chain payload). */
function hashParams(params) {
  return ethers.id(JSON.stringify(params || {}));
}

let _contract = null;
let _oracle = null;
let _signer = null;

/** Build the shared signer (NonceManager) from env, or null if unconfigured. */
function _buildSigner() {
  if (_signer) return _signer;
  if (!ethers) return null;
  const rpc = process.env.VPP_RPC_URL || process.env.BEZHAS_L2_RPC_URL;
  const pk = process.env.VPP_OPERATOR_PK;
  if (!rpc || !pk) return null;
  const provider = new ethers.JsonRpcProvider(rpc);
  // NonceManager tracks the nonce locally so rapid sequential txs don't race a
  // stale getTransactionCount result (ethers caches that call briefly).
  _signer = new ethers.NonceManager(new ethers.Wallet(pk, provider));
  return _signer;
}

function _init() {
  if (_contract) return _contract;
  const signer = _buildSigner();
  const addr = process.env.BEZHAS_VPP_ADDRESS;
  if (!signer || !addr) return null; // unconfigured → disabled
  _contract = new ethers.Contract(addr, VPP_ABI, signer);
  return _contract;
}

/** EnergyOracle contract (telemetry anchoring). Separate address from BeZhasVPP. */
function _initOracle() {
  if (_oracle) return _oracle;
  const signer = _buildSigner();
  const addr = process.env.ENERGY_ORACLE_ADDRESS || process.env.CONTRACT_ENERGY_ORACLE;
  if (!signer || !addr) return null;
  _oracle = new ethers.Contract(addr, ORACLE_ABI, signer);
  return _oracle;
}

function isEnabled() {
  return !!_init();
}

function isOracleEnabled() {
  return !!_initOracle();
}

// Serialize writes from this signer so rapid back-to-back calls never race the
// account nonce (each tx fully mines before the next is built).
let _txLock = Promise.resolve();
function _serialize(task) {
  const result = _txLock.then(task, task);
  _txLock = result.then(() => {}, () => {});
  return result;
}

/** @returns {{ok:boolean, hash?:string, error?:string}|null} null when disabled */
async function enrollAssetOnChain(nodeId, owner, kind, capacityKw) {
  const c = _init();
  if (!c) return null;
  return _serialize(async () => {
    try {
      const tx = await c.enrollAsset(toBytes32(nodeId), owner, Number(kind), BigInt(Math.max(0, Math.floor(capacityKw))));
      await tx.wait();
      logger.info('[VPP][CHAIN] enrollAsset tx=%s', tx.hash);
      return { ok: true, hash: tx.hash };
    } catch (err) {
      logger.warn('[VPP][CHAIN] enrollAsset failed: %s', err.message);
      return { ok: false, error: err.message };
    }
  });
}

/**
 * Audit a dispatched SCADA command on-chain. Best-effort: returns null when
 * disabled, {ok:false} on revert (e.g. asset not enrolled).
 */
async function logCommandOnChain(jobId, nodeId, command, params = {}, energyKwh = 0) {
  const c = _init();
  if (!c) return null;
  return _serialize(async () => {
    try {
      const tx = await c.logCommand(
        toBytes32(jobId),
        toBytes32(nodeId),
        String(command),
        hashParams(params),
        BigInt(Math.max(0, Math.floor(Number(energyKwh) || 0))),
      );
      await tx.wait();
      logger.info('[VPP][CHAIN] logCommand tx=%s job=%s', tx.hash, jobId);
      return { ok: true, hash: tx.hash };
    } catch (err) {
      logger.warn('[VPP][CHAIN] logCommand failed: %s', err.message);
      return { ok: false, error: err.message };
    }
  });
}

async function flexibilityOf(nodeId) {
  const c = _init();
  if (!c) return null;
  try {
    const v = await c.flexibilityOf(toBytes32(nodeId));
    return Number(v);
  } catch (err) {
    logger.warn('[VPP][CHAIN] flexibilityOf failed: %s', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EnergyOracle — anchor signed telemetry on-chain (dMRV)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a VPP node in the oracle (idempotent-ish: reverts if it already
 * exists, which callers treat as already-registered). Requires DEFAULT_ADMIN_ROLE.
 */
async function registerNodeOnChain(nodeId, owner, nodeType = 'SOLAR', location = '') {
  const c = _initOracle();
  if (!c) return null;
  return _serialize(async () => {
    try {
      const tx = await c.registerNode(toBytes32(nodeId), owner, String(nodeType), String(location));
      await tx.wait();
      logger.info('[VPP][ORACLE] registerNode tx=%s node=%s', tx.hash, nodeId);
      return { ok: true, hash: tx.hash };
    } catch (err) {
      // "Node exists" is benign — already registered.
      const already = /Node exists/.test(err.message);
      if (!already) logger.warn('[VPP][ORACLE] registerNode failed: %s', err.message);
      return { ok: already, already, error: already ? undefined : err.message };
    }
  });
}

/**
 * Anchor a batch of signed telemetry on-chain: stores `merkleRoot` as the proof's
 * immutable dataURI alongside the accrued kWh for a period. This makes the
 * physical, hardware-signed reading auditable & tamper-evident on the L2.
 *
 * @param {string} proofId   unique id (hex32 or any string → keccak)
 * @param {string} nodeId
 * @param {string} account   beneficiary address the kWh accrue to
 * @param {number} kWh       integer kWh for the period (generation)
 * @param {string} period    e.g. "2026-06-27"
 * @param {string} merkleRoot keccak merkle root of the signed telemetry batch
 */
async function anchorTelemetryOnChain(proofId, nodeId, account, kWh, period, merkleRoot) {
  const c = _initOracle();
  if (!c) return null;
  return _serialize(async () => {
    try {
      const tx = await c.submitProof(
        toBytes32(proofId),
        toBytes32(nodeId),
        account,
        PROOF_TYPE.GENERATION,
        BigInt(Math.max(0, Math.floor(Number(kWh) || 0))),
        String(period),
        String(merkleRoot),
      );
      await tx.wait();
      logger.info('[VPP][ORACLE] anchorTelemetry tx=%s node=%s kWh=%s', tx.hash, nodeId, kWh);
      return { ok: true, hash: tx.hash };
    } catch (err) {
      logger.warn('[VPP][ORACLE] anchorTelemetry failed: %s', err.message);
      return { ok: false, error: err.message };
    }
  });
}

/** Read back an anchored proof (view) — returns the on-chain dataURI/merkle root. */
async function getProofOnChain(proofId) {
  const c = _initOracle();
  if (!c) return null;
  try {
    const p = await c.proofs(toBytes32(proofId));
    if (!p.exists) return { exists: false };
    return {
      exists: true, verified: p.verified, account: p.account,
      kWh: Number(p.kWh), period: p.period, dataURI: p.dataURI,
      timestamp: Number(p.timestamp),
    };
  } catch (err) {
    logger.warn('[VPP][ORACLE] getProof failed: %s', err.message);
    return null;
  }
}

/** Test helper — drop the cached contracts (e.g. after changing env). */
function _reset() { _contract = null; _oracle = null; _signer = null; }

module.exports = {
  toBytes32,
  hashParams,
  isEnabled,
  isOracleEnabled,
  enrollAssetOnChain,
  logCommandOnChain,
  flexibilityOf,
  registerNodeOnChain,
  anchorTelemetryOnChain,
  getProofOnChain,
  VPP_ABI,
  ORACLE_ABI,
  PROOF_TYPE,
  _reset,
};
