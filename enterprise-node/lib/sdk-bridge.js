'use strict';

const path = require('path');

function loadSdk() {
  const sdkPath = process.env.BEZHAS_SDK_PATH || path.resolve(__dirname, '..', '..', 'sdk');
  try {
    return { sdk: require(sdkPath), sdkPath, available: true, error: null };
  } catch (err) {
    return { sdk: null, sdkPath, available: false, error: err.message };
  }
}

function getNetworkName() {
  const chainId = parseInt(process.env.CHAIN_ID || '2708', 10);
  return chainId === 2708 ? 'bezhas_l2' : String(chainId);
}

function getSdkStatus() {
  const loaded = loadSdk();
  const chainId = parseInt(process.env.CHAIN_ID || '2708', 10);
  const rpcUrl = process.env.PUBLIC_RPC_URL || process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545';

  if (!loaded.available) {
    return {
      available: false,
      sdk_path: loaded.sdkPath,
      error: loaded.error,
      chain_id: chainId,
      rpc_url: rpcUrl,
    };
  }

  const sdk = loaded.sdk;
  const contracts = sdk.listContracts ? sdk.listContracts() : [];
  const deployed = sdk.listDeployed ? sdk.listDeployed(getNetworkName()) : [];

  return {
    available: true,
    sdk_path: loaded.sdkPath,
    package: '@bezhas/sdk',
    chain_id: chainId,
    rpc_url: rpcUrl,
    known_contracts: contracts,
    deployed_contracts: deployed,
    exports: Object.keys(sdk).sort(),
  };
}

function getContractsForFrontend() {
  const loaded = loadSdk();
  const chainId = parseInt(process.env.CHAIN_ID || '2708', 10);
  const network = getNetworkName();

  if (!loaded.available || !loaded.sdk.getAddresses) {
    return { chain_id: chainId, contracts: {}, sdk_available: false };
  }

  const addresses = loaded.sdk.getAddresses(network);
  const contracts = {};

  for (const [name, address] of Object.entries(addresses)) {
    let abi = null;
    try {
      abi = loaded.sdk.getABI ? loaded.sdk.getABI(name) : null;
    } catch {
      abi = null;
    }
    contracts[name] = { address, abi };
  }

  return { chain_id: chainId, network, sdk_available: true, contracts };
}

function getFrontendConfig() {
  const chainId = parseInt(process.env.CHAIN_ID || '2708', 10);
  const rpcUrl = process.env.PUBLIC_RPC_URL || 'http://localhost:8545';
  const apiUrl = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4100}`;
  const explorerUrl = process.env.PUBLIC_EXPLORER_URL || 'http://localhost:4000';

  return {
    chain: {
      chain_id: chainId,
      name: process.env.PUBLIC_CHAIN_NAME || 'BeZhas L2',
      rpc_url: rpcUrl,
      explorer_url: explorerUrl,
      native_currency: {
        name: 'BEZ',
        symbol: 'BEZ',
        decimals: 18,
      },
    },
    api: {
      base_url: apiUrl,
      health: `${apiUrl}/health`,
      network_stats: `${apiUrl}/network/stats`,
      tokenomics_snapshot: `${apiUrl}/tokenomics/snapshot`,
      events: `${apiUrl}/events`,
      hooks: `${apiUrl}/hooks`,
    },
    sdk: getSdkStatus(),
  };
}

module.exports = {
  loadSdk,
  getSdkStatus,
  getContractsForFrontend,
  getFrontendConfig,
};
