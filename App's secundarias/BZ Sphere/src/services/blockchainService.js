/**
 * BZ Sphere — Blockchain Service Layer
 * 
 * Multi-sector marketplace: vendor management, P2P lending, delivery,
 * arbitration, energy, identity, and industrial modules.
 * 
 * Contracts:
 *   - BeZhasDEX            → Token swaps and liquidity
 *   - DeliveryEscrow        → Payment escrow for deliveries
 *   - GovernanceSystem      → Proposal voting / arbitration
 *   - BeZhasPayment         → Payment processing
 *   - IdentityRegistry      → DID / identity module
 *   - BEZPolygonBridge      → Cross-chain bridge
 *   - StakingPool           → Staking for vendors
 */

import { BeZhasClient } from '../../_shared/bezhas-blockchain-client.js';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new BeZhasClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
    });
  }
  return _client;
}

// ═══════════════════════════════════════════
//  DEX / SWAP
// ═══════════════════════════════════════════

export const getSwapQuote = async (tokenIn, tokenOut, amountIn) => {
  try {
    return await getClient().read('BeZhasDEX', 'getAmountOut', [tokenIn, tokenOut, amountIn]);
  } catch {
    return null;
  }
};

export const executeSwap = async (tokenIn, tokenOut, amountIn, minAmountOut) => {
  return getClient().write('BeZhasDEX', 'swap', [tokenIn, tokenOut, amountIn, minAmountOut]);
};

// ═══════════════════════════════════════════
//  DELIVERY / ESCROW
// ═══════════════════════════════════════════

export const createDeliveryEscrow = async (seller, amount, deliveryDeadline) => {
  const { ethers } = await import('ethers');
  return getClient().write('DeliveryEscrow', 'createEscrow', [
    seller, ethers.parseEther(String(amount)), deliveryDeadline,
  ]);
};

export const confirmDelivery = async (escrowId) => {
  return getClient().write('DeliveryEscrow', 'confirmDelivery', [escrowId]);
};

export const getEscrowStatus = async (escrowId) => {
  try {
    return await getClient().read('DeliveryEscrow', 'getEscrow', [escrowId]);
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════
//  GOVERNANCE / ARBITRATION
// ═══════════════════════════════════════════

export const getProposals = async () => {
  try {
    return await getClient().read('GovernanceSystem', 'getProposalCount', []);
  } catch {
    return 0;
  }
};

export const castVote = async (proposalId, support) => {
  return getClient().write('GovernanceSystem', 'castVote', [proposalId, support]);
};

// ═══════════════════════════════════════════
//  BRIDGE
// ═══════════════════════════════════════════

export const getBridgeLocked = async () => {
  try {
    return await getClient().read('BEZPolygonBridge', 'totalLocked', []);
  } catch {
    return '0';
  }
};

export const initiateBridgeLock = async (amount, targetChainId) => {
  const { ethers } = await import('ethers');
  return getClient().write('BEZPolygonBridge', 'lock', [
    ethers.parseEther(String(amount)), targetChainId,
  ]);
};

// ═══════════════════════════════════════════
//  COMMON
// ═══════════════════════════════════════════

export const getBEZBalance = async (address) => getClient().getBEZBalance(address);
export const connectWallet = async () => getClient().connectWallet();
export const pingBlockchain = async () => getClient().ping();

export const sphereBlockchain = {
  getSwapQuote, executeSwap,
  createDeliveryEscrow, confirmDelivery, getEscrowStatus,
  getProposals, castVote,
  getBridgeLocked, initiateBridgeLock,
  getBEZBalance, connectWallet, pingBlockchain,
};
export default sphereBlockchain;
