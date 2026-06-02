/**
 * bez-vision-scan — Blockchain Service Layer
 * 
 * AI vision scanning with on-chain quality verification.
 * 
 * Contracts:
 *   - QualityEscrow       → Quality verification with escrow
 *   - BeZhasLogisticsNFT  → Scan result NFTs for provenance
 */

import { BeZhasClient } from '../../_shared/bezhas-blockchain-client.js';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new BeZhasClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
      sector: 'services',
    });
  }
  return _client;
}

/** Get quality report from escrow */
export const getQualityReport = async (reportId) => {
  try {
    return await getClient().read('QualityEscrow', 'getReport', [reportId]);
  } catch {
    return null;
  }
};

/** Mint a scan result as NFT */
export const mintScanNFT = async (owner, metadataUri) => {
  return getClient().write('BeZhasLogisticsNFT', 'safeMint', [owner, metadataUri]);
};

/** Submit quality verification */
export const submitVerification = async (productId, resultHash, score) => {
  return getClient().write('QualityEscrow', 'submitVerification', [productId, resultHash, score]);
};

export const getBEZBalance = async (address) => getClient().getBEZBalance(address);
export const connectWallet = async () => getClient().connectWallet();
export const pingBlockchain = async () => getClient().ping();

export const visionBlockchain = {
  getQualityReport, mintScanNFT, submitVerification,
  getBEZBalance, connectWallet, pingBlockchain,
};
export default visionBlockchain;
