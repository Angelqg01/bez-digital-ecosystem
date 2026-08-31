/**
 * BZ Genesis — Blockchain Service Layer
 * 
 * Bio-Agent Ecosystem: clinical data, cold chain monitoring, identity.
 * 
 * Contracts:
 *   - HealthRecordSBT         → Soulbound clinical records
 *   - PharmaTracker           → Cold chain pharma tracking
 *   - HealthInsuranceEscrow   → Insurance claims
 *   - AegisSecurityProvider   → Guardian / recovery
 *   - IdentityRegistry        → DID management
 */

import { BeZhasClient } from '../../_shared/bezhas-blockchain-client.js';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new BeZhasClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
      sector: 'health',
    });
  }
  return _client;
}

// ═══════════════════════════════════════════
//  READ OPERATIONS
// ═══════════════════════════════════════════

/** Get patient health record SBT */
export const getHealthRecord = async (tokenId) => {
  try {
    return await getClient().read('HealthRecordSBT', 'getRecord', [tokenId]);
  } catch (err) {
    console.warn('HealthRecordSBT read failed:', err.message);
    return null;
  }
};

/** Get pharma cold chain status */
export const getColdChainStatus = async (shipmentId) => {
  try {
    return await getClient().read('PharmaTracker', 'getShipment', [shipmentId]);
  } catch {
    return null;
  }
};

/** Get insurance claim status */
export const getClaimStatus = async (claimId) => {
  try {
    return await getClient().read('HealthInsuranceEscrow', 'getClaim', [claimId]);
  } catch {
    return null;
  }
};

/** Load all health sector contracts */
export const loadContracts = async () => {
  return getClient().loadSectorContracts();
};

/** Get BEZ balance */
export const getBEZBalance = async (address) => {
  return getClient().getBEZBalance(address);
};

// ═══════════════════════════════════════════
//  WRITE OPERATIONS
// ═══════════════════════════════════════════

/** Mint a new health record SBT */
export const mintHealthRecord = async (patientAddress, recordHash) => {
  return getClient().write('HealthRecordSBT', 'mint', [patientAddress, recordHash]);
};

/** Submit insurance claim */
export const submitClaim = async (policyId, amount, evidenceHash) => {
  const { ethers } = await import('ethers');
  return getClient().write('HealthInsuranceEscrow', 'submitClaim', [
    policyId,
    ethers.parseEther(String(amount)),
    evidenceHash,
  ]);
};

/** Connect wallet */
export const connectWallet = async () => getClient().connectWallet();
export const pingBlockchain = async () => getClient().ping();

export const genesisBlockchain = {
  getHealthRecord, getColdChainStatus, getClaimStatus,
  loadContracts, getBEZBalance, mintHealthRecord,
  submitClaim, connectWallet, pingBlockchain,
};
export default genesisBlockchain;
