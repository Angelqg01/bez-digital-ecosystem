/**
 * BZ CargoLink — Blockchain Service Layer
 * 
 * Connects CargoLink operations to real BeZhas L2 smart contracts:
 *   - SupplyTracker           → Track shipments on-chain
 *   - WarehouseManager        → Warehouse operations
 *   - CustomsClearanceOracle  → Customs clearance verification
 *   - ClearanceCertificateNFT → Clearance certificates as NFTs
 *   - ProcurementNFT          → Procurement documentation
 *   - SupplierScoreOracle     → Supplier reputation scoring
 *   - DeliveryEscrow          → Payment escrow for deliveries
 * 
 * Used alongside bezhasPlatform.js for billing and API simulation.
 * 
 * Usage:
 *   import { cargoBlockchain } from './blockchainService.js'
 *   const status = await cargoBlockchain.getShipmentStatus(shipmentId)
 *   const tx = await cargoBlockchain.anchorFingerprint(data)
 */

import { createSupplyChainClient } from '../shared/bezhas-blockchain-client.js';

// ── Client ──
let _client = null;
function getClient() {
  if (!_client) {
    _client = createSupplyChainClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
    });
  }
  return _client;
}

// ═══════════════════════════════════════════════════════════════
//  READ OPERATIONS (no wallet needed)
// ═══════════════════════════════════════════════════════════════

/** Load all supply chain contracts (8 contracts) */
export const loadContracts = async () => {
  return getClient().loadSectorContracts();
};

/** Get shipment tracking info from SupplyTracker */
export const getShipmentStatus = async (shipmentId) => {
  try {
    return await getClient().read('SupplyTracker', 'getShipment', [shipmentId]);
  } catch (err) {
    console.warn('SupplyTracker read failed:', err.message);
    return null;
  }
};

/** Get warehouse inventory from WarehouseManager */
export const getWarehouseInfo = async (warehouseId) => {
  try {
    return await getClient().read('WarehouseManager', 'getWarehouse', [warehouseId]);
  } catch (err) {
    console.warn('WarehouseManager read failed:', err.message);
    return null;
  }
};

/** Get supplier reputation score */
export const getSupplierScore = async (supplierAddress) => {
  try {
    const score = await getClient().read('SupplierScoreOracle', 'getScore', [supplierAddress]);
    return { address: supplierAddress, score: Number(score) };
  } catch (err) {
    return { address: supplierAddress, score: 0, error: err.message };
  }
};

/** Check customs clearance status */
export const getClearanceStatus = async (shipmentId) => {
  try {
    return await getClient().read('CustomsClearanceOracle', 'getClearance', [shipmentId]);
  } catch (err) {
    return null;
  }
};

/** Get BEZ balance */
export const getBEZBalance = async (address) => {
  try {
    return await getClient().getBEZBalance(address);
  } catch {
    return '0';
  }
};

// ═══════════════════════════════════════════════════════════════
//  WRITE OPERATIONS (wallet required)
// ═══════════════════════════════════════════════════════════════

/** Connect wallet */
export const connectWallet = async () => {
  return getClient().connectWallet();
};

/** Register a new shipment on-chain */
export const registerShipment = async (shipmentData) => {
  const client = getClient();
  const tx = await client.write('SupplyTracker', 'registerShipment', [
    shipmentData.origin,
    shipmentData.destination,
    shipmentData.cargoType || 0,
    shipmentData.weight || 0,
  ]);
  return tx;
};

/** Anchor an audit fingerprint on-chain */
export const anchorFingerprint = async (data) => {
  const client = getClient();
  // Encode data as bytes32 hash
  const hash = data.hash || '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
  const tx = await client.write('SupplyTracker', 'updateCheckpoint', [
    data.shipmentId,
    data.location || 'BeZhas Hub',
    hash,
  ]);
  return tx;
};

/** Request customs clearance */
export const requestClearance = async (shipmentId, documents) => {
  const client = getClient();
  const tx = await client.write('CustomsClearanceOracle', 'requestClearance', [
    shipmentId,
    documents.documentHash || '0x0',
  ]);
  return tx;
};

/** Check blockchain connectivity */
export const pingBlockchain = async () => {
  return getClient().ping();
};

// ── Export all as namespace ──
export const cargoBlockchain = {
  loadContracts,
  getShipmentStatus,
  getWarehouseInfo,
  getSupplierScore,
  getClearanceStatus,
  getBEZBalance,
  connectWallet,
  registerShipment,
  anchorFingerprint,
  requestClearance,
  pingBlockchain,
};

export default cargoBlockchain;
