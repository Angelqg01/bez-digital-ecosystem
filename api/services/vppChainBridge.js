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

function _init() {
  if (_contract) return _contract;
  if (!ethers) return null;
  const rpc = process.env.VPP_RPC_URL || process.env.BEZHAS_L2_RPC_URL;
  const pk = process.env.VPP_OPERATOR_PK;
  const addr = process.env.BEZHAS_VPP_ADDRESS;
  if (!rpc || !pk || !addr) return null; // unconfigured → disabled

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  // NonceManager tracks the nonce locally so rapid sequential txs don't race a
  // stale getTransactionCount result (ethers caches that call briefly).
  const signer = new ethers.NonceManager(wallet);
  _contract = new ethers.Contract(addr, VPP_ABI, signer);
  return _contract;
}

function isEnabled() {
  return !!_init();
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

/** Test helper — drop the cached contract (e.g. after changing env). */
function _reset() { _contract = null; }

module.exports = {
  toBytes32,
  hashParams,
  isEnabled,
  enrollAssetOnChain,
  logCommandOnChain,
  flexibilityOf,
  VPP_ABI,
  _reset,
};
