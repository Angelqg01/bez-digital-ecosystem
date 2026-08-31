/**
 * BZ Prestige — Blockchain Service Layer
 * 
 * Luxury brand authentication, NFT certificates, and royalty tracking.
 * 
 * Contracts:
 *   - LuxuryNFTRegistry     → Authenticate luxury goods with NFC + NFT
 *   - RoyaltyDistributor    → On-chain royalty splits for resale
 *   - BeZhasLogisticsNFT    → Provenance tracking
 */

import { BeZhasClient } from '../../_shared/bezhas-blockchain-client.js';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new BeZhasClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
      sector: 'entertainment',
    });
  }
  return _client;
}

// ═══════════════════════════════════════════
//  READ OPERATIONS
// ═══════════════════════════════════════════

/** Verify product authenticity by NFT token ID */
export const verifyProduct = async (tokenId) => {
  try {
    return await getClient().read('LuxuryNFTRegistry', 'getProductInfo', [tokenId]);
  } catch (err) {
    console.warn('LuxuryNFTRegistry read failed:', err.message);
    return null;
  }
};

/** Get royalty info for a product */
export const getRoyaltyInfo = async (tokenId, salePrice) => {
  try {
    return await getClient().read('RoyaltyDistributor', 'getRoyalty', [tokenId, salePrice]);
  } catch {
    return null;
  }
};

/** Get provenance history */
export const getProvenance = async (tokenId) => {
  try {
    return await getClient().read('BeZhasLogisticsNFT', 'getHistory', [tokenId]);
  } catch {
    return [];
  }
};

/** Load sector contracts */
export const loadContracts = async () => getClient().loadSectorContracts();
export const getBEZBalance = async (address) => getClient().getBEZBalance(address);

// ═══════════════════════════════════════════
//  WRITE OPERATIONS
// ═══════════════════════════════════════════

/** Register a new luxury product NFT */
export const registerProduct = async (brandId, serialNumber, metadataUri) => {
  return getClient().write('LuxuryNFTRegistry', 'registerProduct', [brandId, serialNumber, metadataUri]);
};

/** Transfer ownership (resale) */
export const transferProduct = async (from, to, tokenId) => {
  return getClient().write('LuxuryNFTRegistry', 'safeTransferFrom', [from, to, tokenId]);
};

export const connectWallet = async () => getClient().connectWallet();
export const pingBlockchain = async () => getClient().ping();

export const prestigeBlockchain = {
  verifyProduct, getRoyaltyInfo, getProvenance,
  loadContracts, getBEZBalance, registerProduct,
  transferProduct, connectWallet, pingBlockchain,
};
export default prestigeBlockchain;
