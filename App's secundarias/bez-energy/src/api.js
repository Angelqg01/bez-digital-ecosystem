/**
 * bez-energy API Client — Unified backend + blockchain integration.
 * 
 * Combines:
 *   1. REST API calls to the BeZhas API Gateway (/api/energy/)
 *   2. Direct blockchain reads via BeZhasClient (sector: energy)
 *   3. Smart contract interactions for VPP, CAE tokens, and P2P energy market
 * 
 * Energy sector contracts available:
 *   - CarbonCreditToken — Carbon credit ERC-20
 *   - P2PEnergyMarket   — Peer-to-peer energy trading
 *   - SolarFarmToken     — Solar farm tokenization (RWA)
 *   - ESGScoreOracle     — ESG scoring oracle
 */

import axios from 'axios';
import { createEnergyClient } from '../../_shared/bezhas-blockchain-client.js';

// ── Configuration ──
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const ENERGY_API = `${API_BASE_URL}/energy`;

// ── Blockchain Client (lazy init) ──
let _blockchainClient = null;

function getBlockchainClient() {
  if (!_blockchainClient) {
    _blockchainClient = createEnergyClient({
      apiBaseUrl: API_BASE_URL,
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
    });
  }
  return _blockchainClient;
}

// ═══════════════════════════════════════════════════════════════
//  REST API CALLS (BeZhas API Gateway)
// ═══════════════════════════════════════════════════════════════

export const getTelemetry = async () => {
  try {
    const response = await axios.get(`${ENERGY_API}/telemetry`);
    return response.data;
  } catch (error) {
    console.error('Error fetching telemetry:', error.message);
    return null;
  }
};

export const getAlerts = async () => {
  try {
    const response = await axios.get(`${ENERGY_API}/alerts`);
    return response.data;
  } catch (error) {
    console.error('Error fetching alerts:', error.message);
    return [];
  }
};

export const getWalletStats = async () => {
  try {
    const response = await axios.get(`${ENERGY_API}/wallet/stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching wallet stats:', error.message);
    return null;
  }
};

export const sendControlCommand = async (nodeId, command, params = {}) => {
  try {
    const response = await axios.post(`${ENERGY_API}/control`, { nodeId, command, params });
    return response.data;
  } catch (error) {
    console.error('Error sending control command:', error.message);
    return { success: false, error: error.message };
  }
};

export const buyEnergyCredit = async (amountBzhs, txHash) => {
  try {
    const response = await axios.post(`${ENERGY_API}/buy-credit`, { amountBzhs, txHash });
    return response.data;
  } catch (error) {
    console.error('Error buying energy credit:', error.message);
    return { success: false, error: error.message };
  }
};

// ═══════════════════════════════════════════════════════════════
//  BLOCKCHAIN OPERATIONS (Direct contract interaction)
// ═══════════════════════════════════════════════════════════════

/**
 * Load all energy sector smart contracts (ABI + addresses).
 * Returns: { sector, count, deployed, contracts: [...] }
 */
export const loadEnergyContracts = async () => {
  return getBlockchainClient().loadSectorContracts('energy');
};

/**
 * Get carbon credit balance for an address.
 * @param {string} address - Wallet address
 * @returns {string} Balance in human-readable format
 */
export const getCarbonCreditBalance = async (address) => {
  try {
    const client = getBlockchainClient();
    const balance = await client.read('CarbonCreditToken', 'balanceOf', [address]);
    return { balance: balance.toString(), formatted: (Number(balance) / 1e18).toFixed(4) };
  } catch (error) {
    console.warn('CarbonCreditToken read failed:', error.message);
    return { balance: '0', formatted: '0.0000' };
  }
};

/**
 * Get ESG score for a facility.
 * @param {string} facilityId - Facility identifier
 * @returns {Object} ESG score data
 */
export const getESGScore = async (facilityId) => {
  try {
    const client = getBlockchainClient();
    const score = await client.read('ESGScoreOracle', 'getScore', [facilityId]);
    return { score: Number(score), facilityId };
  } catch (error) {
    console.warn('ESGScoreOracle read failed:', error.message);
    return { score: 0, facilityId, error: error.message };
  }
};

/**
 * Get BEZ token balance (for energy credit purchases).
 * @param {string} address
 * @returns {string} BEZ balance
 */
export const getBEZBalance = async (address) => {
  try {
    return await getBlockchainClient().getBEZBalance(address);
  } catch {
    return '0';
  }
};

/**
 * Connect wallet and return address.
 */
export const connectWallet = async () => {
  return getBlockchainClient().connectWallet();
};

/**
 * Purchase energy credits by sending BEZ tokens.
 * @param {string} amount - Amount in BEZ
 * @returns {{ hash, wait }} Transaction object
 */
export const purchaseCreditsOnChain = async (amount) => {
  const client = getBlockchainClient();
  // Approve P2PEnergyMarket to spend BEZ
  const { address: marketAddress } = await client.getContractInfo('P2PEnergyMarket');
  await client.approveBEZ(marketAddress, amount);
  // Buy credits
  return client.write('P2PEnergyMarket', 'buyCredits', [
    await client.getAddress(),
    (BigInt(Math.floor(Number(amount) * 1e18))).toString(),
  ]);
};

/**
 * Check blockchain connectivity.
 */
export const pingBlockchain = async () => {
  return getBlockchainClient().ping();
};

export default {
  // REST API
  getTelemetry,
  getAlerts,
  getWalletStats,
  sendControlCommand,
  buyEnergyCredit,
  // Blockchain
  loadEnergyContracts,
  getCarbonCreditBalance,
  getESGScore,
  getBEZBalance,
  connectWallet,
  purchaseCreditsOnChain,
  pingBlockchain,
};
