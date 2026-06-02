/**
 * Bezhas-Hub — Control Plane Blockchain Service
 * ═══════════════════════════════════════════════════════════════
 *
 * EXCLUSIVE functions for the Hub Control Plane.
 * These capabilities do NOT exist in any other SubApp.
 *
 * Control Plane responsibilities:
 *   1. Ecosystem Observability — Aggregated read-only view of all deployed contracts
 *   2. SSO / Auth on-chain    — IdentityRegistry + AuthenticationManager for cross-app auth
 *   3. Billing / Subscription — VIP subscription state reading on-chain
 *   4. App Switcher metadata  — Resolve contract catalog for each SubApp sector
 *   5. Developer Console      — ABI catalog, deployment info, contract health checks
 *
 * DOES NOT:
 *   - Handle wallet transfers (→ bez-wallet)
 *   - Handle gas operations (→ gas-tank-manager)
 *   - Handle NFT minting (→ BZ Prestige / BZ PureScan)
 *   - Handle staking (→ bez-wallet)
 *   - Handle DEX/swaps (→ BZ Sphere)
 *   - Handle energy/VPP (→ bez-energy)
 *
 * @version 1.0.0
 * @see OWNERSHIP_MATRIX.yaml in hub-control-plane-migration/01-inventory/
 */

import { BeZhasClient, BEZ_COIN_V1_ADDRESS, PRODUCTION_CHAINS } from '../../_shared/bezhas-blockchain-client.js';

let _client = null;

function getClient() {
  if (!_client) {
    _client = new BeZhasClient({
      apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
      chainId: parseInt(import.meta.env.VITE_CHAIN_ID || '31337'),
    });
  }
  return _client;
}

// ═══════════════════════════════════════════════════════════════
//  1. ECOSYSTEM OBSERVABILITY
//     Aggregated read-only view across all sectors
// ═══════════════════════════════════════════════════════════════

/**
 * Get ecosystem-wide contract catalog from the API Gateway.
 * Returns the total count of contracts by sector, deployment status, etc.
 * This is a Hub-exclusive function — SubApps only see their own sector.
 */
export const getEcosystemCatalog = async () => {
  try {
    return await getClient().getCatalog();
  } catch (err) {
    console.warn('[Hub] Catalog unavailable:', err.message);
    return { totalContracts: 0, totalDeployed: 0, bySector: {}, contracts: {} };
  }
};

/**
 * Get BEZ token ecosystem info (supply, name, decimals).
 * Uses the correct token based on chain (v1 on BSC, v2 on dev).
 */
export const getEcosystemTokenInfo = async () => {
  try {
    return await getClient().getBEZInfo();
  } catch (err) {
    console.warn('[Hub] Token info unavailable:', err.message);
    return {
      name: 'BEZ-Coin',
      symbol: 'BEZ',
      decimals: 18,
      totalSupply: '3000000000',
      version: getClient().bezTokenName,
      productionAddress: BEZ_COIN_V1_ADDRESS,
    };
  }
};

/**
 * Load all contracts for a specific sector (for the App Switcher detail view).
 * The Hub can load ANY sector to show aggregated observability.
 */
export const getSectorContracts = async (sector) => {
  try {
    return await getClient().loadSectorContracts(sector);
  } catch (err) {
    console.warn(`[Hub] Sector '${sector}' load failed:`, err.message);
    return { sector, count: 0, deployed: 0, contracts: [] };
  }
};

/**
 * Check blockchain connectivity and chain info.
 */
export const getChainStatus = async () => {
  try {
    const ping = await getClient().ping();
    return {
      ...ping,
      isProduction: PRODUCTION_CHAINS.includes(ping.chainId),
      tokenVersion: getClient().bezTokenName,
      bezCoinV1Address: BEZ_COIN_V1_ADDRESS,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════
//  2. SSO / AUTH ON-CHAIN
//     Cross-app identity verification via IdentityRegistry
// ═══════════════════════════════════════════════════════════════

/**
 * Verify if an address has a registered on-chain identity.
 * Used by the Hub SSO flow to check if user has a DID.
 */
export const verifyIdentity = async (address) => {
  try {
    return await getClient().read('IdentityRegistry', 'isRegistered', [address]);
  } catch {
    // Fallback to API-based auth if contract is not available
    return null;
  }
};

/**
 * Get on-chain identity details for a user (DID, role, etc.)
 */
export const getIdentityInfo = async (address) => {
  try {
    return await getClient().read('IdentityRegistry', 'getIdentity', [address]);
  } catch {
    return null;
  }
};

/**
 * Verify authentication manager permissions for admin operations.
 */
export const checkAdminPermission = async (address, role) => {
  try {
    return await getClient().read('AuthenticationManager', 'hasRole', [role, address]);
  } catch {
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════
//  3. BILLING / SUBSCRIPTION
//     Read VIP status and subscription tiers on-chain
// ═══════════════════════════════════════════════════════════════

/**
 * Check VIP subscription status for a user.
 * The Hub controls billing — SubApps only check the result.
 */
export const getVIPStatus = async (address) => {
  try {
    const result = await getClient().read('BeZhasRewardsCalculator', 'getUserTier', [address]);
    return {
      address,
      tier: result,
      isVIP: Number(result) > 0,
    };
  } catch {
    return { address, tier: 0, isVIP: false };
  }
};

/**
 * Get global rewards/gamification stats for the ecosystem dashboard.
 */
export const getRewardsStats = async () => {
  try {
    const totalRewards = await getClient().read('BeZhasRewardsCalculator', 'totalDistributed', []);
    return { totalRewards: totalRewards.toString() };
  } catch {
    return { totalRewards: '0' };
  }
};

// ═══════════════════════════════════════════════════════════════
//  4. APP SWITCHER
//     Sector-level metadata for navigation between SubApps
// ═══════════════════════════════════════════════════════════════

/**
 * Get the full list of sectors with deployment statistics.
 * Used by the App Switcher to show which SubApps have active contracts.
 */
export const getAppSwitcherData = async () => {
  const catalog = await getEcosystemCatalog();
  const chainStatus = await getChainStatus();

  const sectors = [
    { key: 'energy', name: 'BEZ Energy', icon: '⚡', app: '/bez-energy' },
    { key: 'health', name: 'BZ Genesis', icon: '🧬', app: '/bz-genesis' },
    { key: 'supplychain', name: 'BZ CargoLink', icon: '📦', app: '/bz-cargolink' },
    { key: 'entertainment', name: 'BZ Prestige', icon: '💎', app: '/bz-prestige' },
    { key: 'services', name: 'BZ PureScan', icon: '📷', app: '/bz-purescan' },
    { key: 'finance', name: 'BZ Capital', icon: '💰', app: '/bz-capital' },
    { key: 'core', name: 'BEZ Wallet', icon: '👛', app: '/bez-wallet' },
  ];

  return sectors.map(s => ({
    ...s,
    contractCount: catalog.bySector?.[s.key]?.length || 0,
    deployed: !!catalog.bySector?.[s.key],
    chainConnected: chainStatus.connected,
  }));
};

// ═══════════════════════════════════════════════════════════════
//  5. DEVELOPER CONSOLE
//     ABI browser, deployment viewer, contract health
// ═══════════════════════════════════════════════════════════════

/**
 * Get ABI for a specific contract (Developer Console feature).
 */
export const getContractABI = async (contractName) => {
  return getClient().getContractInfo(contractName);
};

/**
 * List all available contracts with their ABIs.
 * The Developer Console lets developers browse and test contracts.
 */
export const listAllContracts = async () => {
  return getEcosystemCatalog();
};

/**
 * Execute a read-only call to any contract (Developer Console sandbox).
 * Only view/pure functions — no state changes.
 */
export const sandboxRead = async (contractName, method, args = []) => {
  try {
    const result = await getClient().read(contractName, method, args);
    return { success: true, result: result?.toString?.() || result };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════
//  WALLET CONNECTION (delegates to shared client)
// ═══════════════════════════════════════════════════════════════

export const connectWallet = async () => getClient().connectWallet();
export const getBEZBalance = async (address) => getClient().getBEZBalance(address);
export const pingBlockchain = async () => getClient().ping();

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════

export const hubBlockchain = {
  // Observability
  getEcosystemCatalog,
  getEcosystemTokenInfo,
  getSectorContracts,
  getChainStatus,
  // SSO / Auth
  verifyIdentity,
  getIdentityInfo,
  checkAdminPermission,
  // Billing
  getVIPStatus,
  getRewardsStats,
  // App Switcher
  getAppSwitcherData,
  // Developer Console
  getContractABI,
  listAllContracts,
  sandboxRead,
  // Common
  connectWallet,
  getBEZBalance,
  pingBlockchain,
};

export default hubBlockchain;
