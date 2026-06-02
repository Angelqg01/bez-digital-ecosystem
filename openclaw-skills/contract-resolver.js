/**
 * OpenClaw Skills — Contract Resolver
 * 
 * Shared module for all OpenClaw MCP skills to resolve contract addresses
 * and ABIs from the BeZhas deployment system.
 * 
 * Resolution order:
 *   1. Environment variables (CONTRACT_xxx)
 *   2. Deployment file (smart-contracts/deployments/{chainId}.json)
 *   3. SDK registry (sdk/contracts.js)
 *   4. API gateway (http://localhost:3001/api/contracts/abi-public/:name)
 * 
 * Usage:
 *   import { resolveContract, resolveAddress, getContractInstance } from './contract-resolver.js';
 *   const { address, abi } = await resolveContract('CarbonCreditToken');
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──
const CHAIN_ID = parseInt(process.env.BEZHAS_CHAIN_ID || '31337');
const API_URL = process.env.BEZHAS_API_URL || 'http://localhost:3001/api';
const DEPLOYMENTS_DIR = resolve(__dirname, '..', 'smart-contracts', 'deployments');
const ABI_DIR = resolve(__dirname, '..', 'smart-contracts', 'abi');

/**
 * BEZ-Coin (v1) — Currently LIVE in production.
 * BEZCoinV2 is NOT deployed yet; all production services use this address.
 */
const BEZ_COIN_V1_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const BEZ_COIN_V1_CHAIN = 56; // BSC Mainnet

// ── Caches ──
let _deployments = null;
let _manifest = null;
const _abiCache = new Map();
const _addressCache = new Map();

/**
 * Load deployment addresses for the current chain.
 * Falls back to 31337 (local dev) if no file exists for the current chain.
 */
function loadDeployments() {
  if (_deployments) return _deployments;

  // Try current chain first, then fallback to local dev
  const candidates = [
    resolve(DEPLOYMENTS_DIR, `${CHAIN_ID}.json`),
    resolve(DEPLOYMENTS_DIR, '31337.json'),
  ];

  for (const deployFile of candidates) {
    if (existsSync(deployFile)) {
      try {
        _deployments = JSON.parse(readFileSync(deployFile, 'utf-8'));
        return _deployments;
      } catch { /* fallthrough */ }
    }
  }
  _deployments = { core: {}, sectors: {} };
  return _deployments;
}

/**
 * Load ABI manifest.
 */
function loadManifest() {
  if (_manifest) return _manifest;
  const manifestFile = resolve(ABI_DIR, 'manifest.json');
  if (existsSync(manifestFile)) {
    try {
      _manifest = JSON.parse(readFileSync(manifestFile, 'utf-8'));
      return _manifest;
    } catch { /* fallthrough */ }
  }
  _manifest = { contracts: {} };
  return _manifest;
}

/**
 * Resolve the deployed address for a contract.
 * @param {string} contractName
 * @returns {string|null} Address or null
 */
export function resolveAddress(contractName) {
  if (_addressCache.has(contractName)) return _addressCache.get(contractName);

  // 1. Environment variable override
  const envKey = `CONTRACT_${contractName.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '')}`;
  if (process.env[envKey]) {
    _addressCache.set(contractName, process.env[envKey]);
    return process.env[envKey];
  }

  // 2. Deployment file
  const d = loadDeployments();
  // Check core
  if (d.core?.[contractName]) {
    _addressCache.set(contractName, d.core[contractName]);
    return d.core[contractName];
  }
  // Check sectors
  for (const sector of Object.values(d.sectors || {})) {
    if (sector[contractName]) {
      _addressCache.set(contractName, sector[contractName]);
      return sector[contractName];
    }
  }
  // Check wallet
  if (d.wallet?.[contractName]) {
    _addressCache.set(contractName, d.wallet[contractName]);
    return d.wallet[contractName];
  }

  return null;
}

/**
 * Load ABI for a contract from the clean ABI directory.
 * @param {string} contractName
 * @returns {Array|null} ABI array or null
 */
export function loadABI(contractName) {
  if (_abiCache.has(contractName)) return _abiCache.get(contractName);

  const abiFile = resolve(ABI_DIR, `${contractName}.json`);
  if (existsSync(abiFile)) {
    try {
      const raw = JSON.parse(readFileSync(abiFile, 'utf-8'));
      const abi = raw.abi || null;
      if (abi) _abiCache.set(contractName, abi);
      return abi;
    } catch { /* fallthrough */ }
  }
  return null;
}

/**
 * Resolve both address and ABI for a contract.
 * @param {string} contractName
 * @returns {{ address: string|null, abi: Array|null, deployed: boolean }}
 */
export function resolveContract(contractName) {
  const address = resolveAddress(contractName);
  const abi = loadABI(contractName);
  return { address, abi, deployed: !!address };
}

/**
 * Resolve multiple contracts at once (for a sector or skill).
 * @param {string[]} contractNames
 * @returns {Object<string, { address, abi, deployed }>}
 */
export function resolveContracts(contractNames) {
  const result = {};
  for (const name of contractNames) {
    result[name] = resolveContract(name);
  }
  return result;
}

/**
 * Get all contracts for a specific sector.
 * @param {string} sector
 * @returns {Object<string, { address, abi, deployed }>}
 */
export function getSectorContracts(sector) {
  const manifest = loadManifest();
  const names = Object.entries(manifest.contracts || {})
    .filter(([, info]) => info.sector === sector)
    .map(([name]) => name);
  return resolveContracts(names);
}

/**
 * Build a formatted contracts map for MCP tool responses.
 * @param {Object} contracts - Output from resolveContracts()
 * @returns {Object} { name: address } map (only deployed contracts)
 */
export function buildContractMap(contracts) {
  const map = {};
  for (const [name, info] of Object.entries(contracts)) {
    map[name] = info.address || `[NOT_DEPLOYED]`;
  }
  return map;
}

/**
 * Get the active BEZ token address for the current chain.
 * Production: BEZ-Coin v1 (0xEcBa...A8) on BSC
 * Dev/Local:  BEZCoinV2 from deployment file
 * 
 * @returns {{ address: string, version: string, chain: number }}
 */
export function getBEZTokenAddress() {
  // Production chains use BEZ-Coin v1
  if (CHAIN_ID === 56 || CHAIN_ID === 97) { // BSC mainnet or testnet
    return {
      address: BEZ_COIN_V1_ADDRESS,
      version: 'v1',
      name: 'BEZCoin',
      chain: CHAIN_ID,
    };
  }

  // Local dev / L2 uses BEZCoinV2
  const v2Address = resolveAddress('BEZCoinV2');
  if (v2Address) {
    return {
      address: v2Address,
      version: 'v2',
      name: 'BEZCoinV2',
      chain: CHAIN_ID,
    };
  }

  // Fallback to v1 if nothing else is available
  return {
    address: BEZ_COIN_V1_ADDRESS,
    version: 'v1',
    name: 'BEZCoin',
    chain: 56,
  };
}

/**
 * Check if we're on a production chain.
 */
export function isProduction() {
  return CHAIN_ID === 56 || CHAIN_ID === 137 || CHAIN_ID === 1;
}

/**
 * Clear all caches (for testing or hot-reload).
 */
export function clearCaches() {
  _deployments = null;
  _manifest = null;
  _abiCache.clear();
  _addressCache.clear();
}

// ── Exported Constants ──
export { BEZ_COIN_V1_ADDRESS, BEZ_COIN_V1_CHAIN, CHAIN_ID };

