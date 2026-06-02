/**
 * Gas Tank Manager — Blockchain Service Layer
 * 
 * Connects gas tank operations to the BeZhas Paymaster system.
 * Manages gas sponsorship, balance top-ups, and usage analytics.
 * 
 * Contracts:
 *   - Paymaster          → Gas sponsorship checks and deposits
 *   - BEZCoin/BEZCoinV2  → Token balance and approval
 *   - StakingPool        → Deposit BEZ to earn gas credits
 */

import { BeZhasClient, BEZ_COIN_V1_ADDRESS } from '../../_shared/bezhas-blockchain-client.js';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new BeZhasClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
      sector: 'core',
    });
  }
  return _client;
}

// ═══════════════════════════════════════════
//  READ OPERATIONS
// ═══════════════════════════════════════════

/** Get Paymaster gas balance for a user */
export const getGasBalance = async (address) => {
  try {
    return await getClient().read('Paymaster', 'getGasBalance', [address]);
  } catch (err) {
    console.warn('Paymaster read failed:', err.message);
    return null;
  }
};

/** Check if an operation is gas-sponsored */
export const isSponsoredOperation = async (operation, userAddress) => {
  try {
    return await getClient().read('Paymaster', 'isSponsoredOperation', [operation, userAddress]);
  } catch {
    return false;
  }
};

/** Get BEZ token balance */
export const getBEZBalance = async (address) => {
  return getClient().getBEZBalance(address);
};

/** Get gas tank analytics from gateway */
export const getGasAnalytics = async (token) => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const res = await fetch(`${apiUrl}/gateway/v1/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed');
    return await res.json();
  } catch {
    return { balance: '0', gasCredits: '0' };
  }
};

// ═══════════════════════════════════════════
//  WRITE OPERATIONS
// ═══════════════════════════════════════════

/** Deposit BEZ to get gas credits */
export const depositGas = async (amount) => {
  const client = getClient();
  const { ethers } = await import('ethers');
  const parsedAmount = ethers.parseEther(String(amount));
  
  // Approve Paymaster to spend BEZ
  const paymasterInfo = await client.getContractInfo('Paymaster');
  await client.write(client.bezTokenName, 'approve', [paymasterInfo.address, parsedAmount]);
  
  // Deposit
  return client.write('Paymaster', 'deposit', [parsedAmount]);
};

/** Connect wallet */
export const connectWallet = async () => {
  return getClient().connectWallet();
};

/** Check chain connectivity */
export const pingBlockchain = async () => {
  return getClient().ping();
};

export const gasTankBlockchain = {
  getGasBalance,
  isSponsoredOperation,
  getBEZBalance,
  getGasAnalytics,
  depositGas,
  connectWallet,
  pingBlockchain,
};

export default gasTankBlockchain;
