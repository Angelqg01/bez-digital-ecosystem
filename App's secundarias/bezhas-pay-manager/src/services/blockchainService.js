/**
 * BeZhas Pay Manager — Blockchain Service Layer
 * 
 * Payment gateway: BEZ transfers, Paymaster sponsorship, and
 * transaction processing via smart contracts.
 * 
 * Contracts:
 *   - BeZhasPayment     → Payment processing contract
 *   - Paymaster          → Gas sponsorship
 *   - BEZCoin/BEZCoinV2  → Token operations
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

/** Check if a payment can be gas-sponsored */
export const checkSponsorship = async (userAddress, amount) => {
  try {
    return await getClient().read('Paymaster', 'isSponsoredOperation', ['payment', userAddress]);
  } catch {
    return false;
  }
};

/** Get BEZ balance */
export const getBEZBalance = async (address) => getClient().getBEZBalance(address);

/** Get payment details */
export const getPaymentStatus = async (paymentId) => {
  try {
    return await getClient().read('BeZhasPayment', 'getPayment', [paymentId]);
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════
//  WRITE OPERATIONS
// ═══════════════════════════════════════════

/** Execute a BEZ payment */
export const processPayment = async (recipient, amount, reference) => {
  const { ethers } = await import('ethers');
  return getClient().write('BeZhasPayment', 'processPayment', [
    recipient, ethers.parseEther(String(amount)), reference || '0x',
  ]);
};

/** Direct BEZ transfer */
export const transferBEZ = async (to, amount) => {
  return getClient().transferBEZ(to, amount);
};

/** Approve BEZ spending */
export const approveBEZ = async (spender, amount) => {
  return getClient().approveBEZ(spender, amount);
};

export const connectWallet = async () => getClient().connectWallet();
export const pingBlockchain = async () => getClient().ping();

export const payBlockchain = {
  checkSponsorship, getBEZBalance, getPaymentStatus,
  processPayment, transferBEZ, approveBEZ,
  connectWallet, pingBlockchain,
};
export default payBlockchain;
