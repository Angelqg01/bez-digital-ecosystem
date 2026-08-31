/**
 * BZ PureScan API Client — Edge AI + Blockchain Integration
 *
 * Architecture:
 *   Layer 1: Camera/Sensor input
 *   Layer 2: Edge AI Inference (YOLOv8-S) → API
 *   Layer 3: Semantic Reasoning (Gemini 2.0 Flash) → API
 *   Layer 4: Blockchain Sync → BeZhas L2 (real contract calls)
 *
 * Food safety contracts:
 *   - QualityEscrow         — Escrow for quality-verified batches
 *   - BeZhasLogisticsNFT    — DPP (Digital Product Passport) NFTs
 *   - PharmaTracker         — Supply chain pharma tracking
 *   - AgriSupplyChain       — Agricultural supply chain
 */

import axios from 'axios';
import { BeZhasClient } from '../../_shared/bezhas-blockchain-client.js';

// ── Configuration ──
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: `${GATEWAY_URL}/purescan`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Blockchain Client ──
let _client = null;
function getClient() {
  if (!_client) {
    _client = new BeZhasClient({
      apiBaseUrl: GATEWAY_URL,
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
    });
  }
  return _client;
}

// ═══════════════════════════════════════════════════════════════
//  LAYER 2: EDGE AI INFERENCE
// ═══════════════════════════════════════════════════════════════

export const runEdgeInference = async (imageBlob) => {
  const formData = new FormData();
  formData.append('image', imageBlob);
  const response = await api.post('/inference', formData, {
    timeout: 10000,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// ═══════════════════════════════════════════════════════════════
//  LAYER 3: SEMANTIC REASONING (GEMINI)
// ═══════════════════════════════════════════════════════════════

export const analyzeWithGemini = async (scanData) => {
  const response = await api.post('/analyze', scanData, { timeout: 10000 });
  return response.data;
};

// ═══════════════════════════════════════════════════════════════
//  LAYER 4: BLOCKCHAIN SYNC (Real contract calls)
// ═══════════════════════════════════════════════════════════════

export const syncToBlockchain = async (dppData) => {
  try {
    const client = getClient();

    let walletAddress;
    try {
      walletAddress = await client.getAddress();
    } catch {
      const { address } = await client.connectWallet();
      walletAddress = address;
    }

    const metadataUri = `ipfs://dpp-${Date.now()}-${JSON.stringify(dppData).length}`;

    const tx = await client.write('BeZhasLogisticsNFT', 'safeMint', [
      walletAddress,
      metadataUri,
    ]);

    const receipt = await tx.wait();

    return {
      success: true,
      transaction: {
        hash: receipt.hash,
        from: walletAddress,
        to: receipt.to,
        block: receipt.blockNumber,
        timestamp: Date.now(),
        gas_used: receipt.gasUsed?.toString() || '0',
        status: 'CONFIRMED',
        token_id: `DPP-${Date.now()}`,
      },
    };
  } catch (walletError) {
    // Fallback: REST API (real backend endpoint, not a mock)
    const response = await api.post('/blockchain/sync', dppData, { timeout: 15000 });
    return response.data;
  }
};

export const getBEZBalance = async (address) => {
  return getClient().getBEZBalance(address);
};

export const connectWallet = async () => {
  return getClient().connectWallet();
};

export const getBlockchainStatus = async () => {
  return getClient().ping();
};

// ═══════════════════════════════════════════════════════════════
//  REST API METHODS
// ═══════════════════════════════════════════════════════════════

export const getInventory = async (filters = {}) => {
  const response = await api.get('/inventory', { params: filters });
  return response.data;
};

export const getScanHistory = async (limit = 10) => {
  const response = await api.get(`/scans?limit=${limit}`);
  return response.data;
};

export const getDIDProfile = async () => {
  const response = await api.get('/profile/did');
  return response.data;
};

export const submitFeedback = async (scanId, feedbackData) => {
  const response = await api.post(`/scans/${scanId}/feedback`, feedbackData);
  return response.data;
};

export const updateProfile = async (profileData) => {
  const response = await api.put('/profile', profileData);
  return response.data;
};

export const getAnalytics = async (timeframe = '7d') => {
  const response = await api.get(`/analytics?timeframe=${timeframe}`);
  return response.data;
};

export default api;
