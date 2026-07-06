'use strict';

/**
 * cargoLinkOnChain — post-commit on-chain anchoring for B-UID lifecycle.
 *
 * After each advanceTransaction() confirms in the DB, this service calls the
 * deployed supplychain contracts (SupplyTracker, CustomsClearanceOracle,
 * DeliveryEscrow) to produce an immutable on-chain record of the transition.
 *
 * If anchoring fails the DB transition is NOT reverted — the anchor result
 * is recorded as { anchored: false, mode: 'anchor_failed' } so the frontend
 * and webhooks still reflect the real lifecycle state.
 *
 * Required env vars (all optional — service degrades gracefully):
 *   CARGOLINK_OPERATOR_KEY — private key of the backend signer (OPERATOR_ROLE)
 *   RPC_URL               — JSON-RPC endpoint for the target chain
 *   SUPPLY_TRACKER_ADDRESS, CUSTOMS_CLEARANCE_ORACLE_ADDRESS, DELIVERY_ESCROW_ADDRESS
 *     OR a deployments/<chainId>.json file in smart-contracts/
 */

const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const { query } = require('../db/pool');

const ABI_DIR = path.resolve(__dirname, '../../smart-contracts/abi');

const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

const BEZ_TOKEN = process.env.BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

const CP_TYPE = {
  ORIGIN: 0,
  WAREHOUSE: 1,
  CUSTOMS: 2,
  PORT: 3,
  DISTRIBUTION: 4,
  DESTINATION: 5,
};

let _provider = null;
let _signer = null;
const _contracts = {};

function loadABI(name) {
  const raw = JSON.parse(fs.readFileSync(path.join(ABI_DIR, `${name}.json`), 'utf8'));
  return raw.abi || raw;
}

function getAddresses() {
  if (process.env.SUPPLY_TRACKER_ADDRESS) {
    return {
      supplyTracker: process.env.SUPPLY_TRACKER_ADDRESS,
      customsClearance: process.env.CUSTOMS_CLEARANCE_ORACLE_ADDRESS || null,
      deliveryEscrow: process.env.DELIVERY_ESCROW_ADDRESS || null,
    };
  }
  try {
    const chainId = process.env.BEZHAS_CHAIN_ID || process.env.CHAIN_ID || '2708';
    const data = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../smart-contracts/deployments', `${chainId}.json`), 'utf8')
    );
    const sc = data.supplychain || {};
    return {
      supplyTracker: sc.SupplyTracker || null,
      customsClearance: sc.CustomsClearanceOracle || null,
      deliveryEscrow: sc.DeliveryEscrow || null,
    };
  } catch {
    return null;
  }
}

function isConfigured() {
  const key = process.env.CARGOLINK_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
  const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
  const addrs = getAddresses();
  return Boolean(key && rpc && addrs?.supplyTracker);
}

function getProvider() {
  if (!_provider) {
    const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
    if (!rpc) return null;
    _provider = new ethers.JsonRpcProvider(rpc);
  }
  return _provider;
}

function getSigner() {
  if (!_signer) {
    const key = process.env.CARGOLINK_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
    const provider = getProvider();
    if (!key || !provider) return null;
    _signer = new ethers.Wallet(key, provider);
  }
  return _signer;
}

function getContract(name, address) {
  if (!address) return null;
  const cacheKey = `${name}_${address}`;
  if (!_contracts[cacheKey]) {
    const signer = getSigner();
    if (!signer) return null;
    _contracts[cacheKey] = new ethers.Contract(address, loadABI(name), signer);
  }
  return _contracts[cacheKey];
}

function contentHash(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(value || {})));
}

function escrowIdFromBuid(bUid) {
  return ethers.keccak256(ethers.toUtf8Bytes(bUid));
}

function getBezToken() {
  const signer = getSigner();
  if (!signer) return null;
  const cacheKey = `ERC20_${BEZ_TOKEN}`;
  if (!_contracts[cacheKey]) {
    _contracts[cacheKey] = new ethers.Contract(BEZ_TOKEN, ERC20_APPROVE_ABI, signer);
  }
  return _contracts[cacheKey];
}

async function getChainShipmentId(bUid) {
  const { rows } = await query(
    `SELECT payload FROM cargolink_transitions
     WHERE b_uid = $1 AND to_status = 'CREATED'
     ORDER BY created_at ASC LIMIT 1`,
    [bUid],
  );
  const id = rows[0]?.payload?.anchor?.chainShipmentId;
  return id != null ? Number(id) : null;
}

async function storeAnchorInTransition(bUid, toStatus, anchor) {
  await query(
    `UPDATE cargolink_transitions
     SET payload = jsonb_set(COALESCE(payload, '{}'), '{anchor}', $1::jsonb)
     WHERE id = (
       SELECT id FROM cargolink_transitions
       WHERE b_uid = $2 AND to_status = $3
       ORDER BY created_at DESC LIMIT 1
     )`,
    [JSON.stringify(anchor), bUid, toStatus],
  );
}

async function anchorCreated(tx, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  const receiver = ethers.ZeroAddress;
  const hash = contentHash(tx.cargo);
  const weight = BigInt(tx.cargo?.weight || 0);

  const receipt = await (await tracker.createShipment(receiver, hash, weight)).wait();

  const parsed = receipt.logs
    .map((log) => { try { return tracker.interface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === 'ShipmentCreated');
  const chainShipmentId = parsed ? Number(parsed.args.shipmentId) : null;

  const result = {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };

  // If the transaction carries an escrow, lock funds in DeliveryEscrow.
  const escrowAmount = Number(tx.escrow_amount_bez || 0);
  if (escrowAmount > 0 && addresses.deliveryEscrow) {
    try {
      const escrow = await anchorEscrowCreation(tx, addresses);
      result.escrow = escrow;
    } catch (err) {
      result.escrow = { anchored: false, mode: 'escrow_failed', error: err.message };
    }
  }

  return result;
}

async function anchorEscrowCreation(tx, addresses) {
  const escrowContract = getContract('DeliveryEscrow', addresses.deliveryEscrow);
  const bezToken = getBezToken();
  if (!escrowContract || !bezToken) return { anchored: false, mode: 'no_contract' };

  const escrowId = escrowIdFromBuid(tx.b_uid);
  const amount = ethers.parseUnits(String(tx.escrow_amount_bez), 18);
  const seller = ethers.ZeroAddress;
  const memo = `BZ CargoLink escrow for ${tx.b_uid}`;

  // Approve BEZ transfer to the escrow contract.
  const allowance = await bezToken.allowance(await getSigner().getAddress(), addresses.deliveryEscrow);
  if (allowance < amount) {
    await (await bezToken.approve(addresses.deliveryEscrow, amount)).wait();
  }

  const receipt = await (
    await escrowContract.createEscrow(escrowId, seller, amount, memo)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.deliveryEscrow,
    escrowId,
    mode: 'escrow_locked',
  };
}

async function anchorCustomsCleared(tx, payload, addresses) {
  const oracle = getContract('CustomsClearanceOracle', addresses.customsClearance);
  if (!oracle) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const input = payload?.input || {};
  const hsCode = ethers.encodeBytes32String((input.hsCode || '0000.00').slice(0, 31));
  const cargoValue = BigInt(Math.round((input.declaredValue || tx.cargo?.value || 0) * 100));
  const duaHash = contentHash(payload);

  const receipt = await (
    await oracle.requestClearance(chainShipmentId, hsCode, cargoValue, 'BZCargoLink', duaHash)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.customsClearance,
    chainShipmentId,
    mode: 'anchored',
  };
}

async function anchorCheckpoint(tx, cpType, payload, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const input = payload?.input || {};
  const locationHash = contentHash({ location: input.location || input.port || tx.origin });
  const temperature = BigInt(Math.round((input.temperature || 0) * 100));

  const receipt = await (
    await tracker.recordCheckpoint(chainShipmentId, cpType, locationHash, temperature)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };
}

async function anchorMarkInTransit(tx, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const receipt = await (await tracker.markInTransit(chainShipmentId)).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };
}

async function anchorDelivery(tx, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const receipt = await (await tracker.confirmDelivery(chainShipmentId)).wait();

  const result = {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };

  // If the transaction had escrow LOCKED, release funds to the seller.
  if (tx.escrow_status === 'LOCKED' && addresses.deliveryEscrow) {
    try {
      const escrow = await anchorEscrowRelease(tx, addresses);
      result.escrow = escrow;
    } catch (err) {
      result.escrow = { anchored: false, mode: 'escrow_release_failed', error: err.message };
    }
  }

  return result;
}

async function anchorEscrowRelease(tx, addresses) {
  const escrowContract = getContract('DeliveryEscrow', addresses.deliveryEscrow);
  if (!escrowContract) return { anchored: false, mode: 'no_contract' };

  const escrowId = escrowIdFromBuid(tx.b_uid);
  const evidenceHash = contentHash({ bUid: tx.b_uid, status: 'DELIVERED', at: tx.updated_at });

  const receipt = await (
    await escrowContract.validateAndRelease(escrowId, evidenceHash)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.deliveryEscrow,
    escrowId,
    mode: 'escrow_released',
  };
}

/**
 * Post-commit hook: anchor a lifecycle transition on-chain.
 *
 * @param {object} tx             — the transaction row AFTER the DB update
 * @param {string} toStatus       — the status it just transitioned TO
 * @param {object} transitionPayload — { input, validation } stored in the transition
 * @returns {{ anchored, txHash?, contract?, chainShipmentId?, mode, error? }}
 */
async function anchorTransition(tx, toStatus, transitionPayload) {
  if (!isConfigured()) {
    return { anchored: false, mode: 'not_configured' };
  }

  const addresses = getAddresses();
  if (!addresses) return { anchored: false, mode: 'no_addresses' };

  let result;
  try {
    switch (toStatus) {
      case 'CREATED':
        result = await anchorCreated(tx, addresses);
        break;
      case 'CUSTOMS_CLEARED':
        result = await anchorCustomsCleared(tx, transitionPayload, addresses);
        break;
      case 'STOWED':
        result = await anchorCheckpoint(tx, CP_TYPE.WAREHOUSE, transitionPayload, addresses);
        break;
      case 'DEPARTED':
        result = await anchorCheckpoint(tx, CP_TYPE.PORT, transitionPayload, addresses);
        break;
      case 'IN_TRANSIT':
        result = await anchorMarkInTransit(tx, addresses);
        break;
      case 'DELIVERED':
        result = await anchorDelivery(tx, addresses);
        break;
      default:
        return { anchored: false, mode: 'unknown_status' };
    }
  } catch (err) {
    result = { anchored: false, mode: 'anchor_failed', error: err.message };
  }

  try {
    await storeAnchorInTransition(tx.b_uid, toStatus, result);
  } catch {
    // Storing the anchor record is best-effort; don't mask the real result.
  }

  return result;
}

module.exports = {
  isConfigured,
  anchorTransition,
  getChainShipmentId,
  getAddresses,
  CP_TYPE,
};
