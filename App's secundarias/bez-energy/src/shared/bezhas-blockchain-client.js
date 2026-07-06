/**
 * BeZhas Blockchain Client — Shared SubApp Integration Layer
 * 
 * Universal client for all SubApps to interact with the BeZhas blockchain
 * infrastructure. Provides:
 * 
 *   1. Contract Discovery — Fetches ABI + address from the API gateway
 *   2. Read Operations   — Query contract state (balanceOf, getInfo, etc.)
 *   3. Write Operations  — Send transactions via bez-wallet popup
 *   4. Sector Loader     — Load all contracts for a specific sector
 *   5. Event Listener    — Subscribe to contract events via WebSocket
 * 
 * Usage in a SubApp:
 *   import { BeZhasClient } from '../_shared/bezhas-blockchain-client.js'
 *   const client = new BeZhasClient({ sector: 'energy' })
 *   const contracts = await client.loadSectorContracts()
 *   const balance = await client.read('BEZCoinV2', 'balanceOf', [walletAddress])
 * 
 * @version 2.0.0
 * @requires ethers ^6.0
 */

import { ethers } from 'ethers';

// ── Configuration ──
const DEFAULT_CONFIG = {
  apiBaseUrl: import.meta?.env?.VITE_API_URL || 'http://localhost:3001/api',
  gatewayUrl: import.meta?.env?.VITE_GATEWAY_URL || 'http://localhost:3001/api/gateway/v1',
  apiKey: import.meta?.env?.VITE_BEZHAS_GATEWAY_API_KEY || '',
  rpcUrl: import.meta?.env?.VITE_RPC_URL || 'http://localhost:8545',
  chainId: parseInt(import.meta?.env?.VITE_CHAIN_ID || '31337'),
  walletPopupUrl: import.meta?.env?.VITE_WALLET_URL || 'http://localhost:5174',
  timeout: 15000,
};

/**
 * BEZ Token resolution:
 *   - Production (BSC 56 / BSC Testnet 97): BEZCoin (v1) at 0xEcBa873B...
 *   - Dev / L2 (31337, other): BEZCoinV2
 */
const BEZ_COIN_V1_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const PRODUCTION_CHAINS = [56, 97];

function resolveBEZTokenName(chainId) {
  return PRODUCTION_CHAINS.includes(chainId) ? 'BEZCoin' : 'BEZCoinV2';
}

// ── ABI Cache (in-memory per session) ──
const _abiCache = new Map();
const _addressCache = new Map();
const _contractInstanceCache = new Map();

function getStoredSessionValue(key) {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(key);
}

function setStoredSessionValue(key, value) {
  if (typeof localStorage === 'undefined' || !value) return;
  localStorage.setItem(key, value);
}

/**
 * BeZhasClient — Main integration class for SubApp ↔ Blockchain communication.
 */
export class BeZhasClient {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.provider = null;
    this.signer = null;
    this.sector = config.sector || null;
    this._sectorContracts = null;
    this.bezTokenName = resolveBEZTokenName(this.config.chainId);
    this.accessToken = config.accessToken || getStoredSessionValue('bezhas_access_token') || getStoredSessionValue('bezhas-jwt') || null;
    this.refreshToken = config.refreshToken || getStoredSessionValue('bezhas_refresh_token') || null;
  }

  async gatewayFetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.config.apiKey ? { 'x-api-key': this.config.apiKey } : {}),
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...(options.headers || {}),
    };
    const response = await fetch(`${this.config.gatewayUrl}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Gateway error ${response.status}`);
    return data;
  }

  setSession({ accessToken, refreshToken }) {
    this.accessToken = accessToken || this.accessToken;
    this.refreshToken = refreshToken || this.refreshToken;
    setStoredSessionValue('bezhas_access_token', this.accessToken);
    setStoredSessionValue('bezhas_refresh_token', this.refreshToken);
  }

  async fiatLogin({ email, password, appOrigin = 'app' }) {
    const result = await this.gatewayFetch('/sso/fiat/login', {
      method: 'POST',
      body: { email, password, appOrigin },
      headers: {},
    });
    this.setSession(result);
    return result;
  }

  async fiatRegister({ email, password, username, appOrigin = 'app' }) {
    const result = await this.gatewayFetch('/sso/fiat/register', {
      method: 'POST',
      body: { email, password, username, appOrigin },
      headers: {},
    });
    this.setSession(result);
    return result;
  }

  async getPrimarySafeWallet() {
    return this.gatewayFetch('/wallet/me');
  }

  async buyBEZWithFiat({ amountUSD, paymentMethod = 'card', stripeUseCase = 'token_purchase', email }) {
    return this.gatewayFetch('/payments/buy', {
      method: 'POST',
      body: { amountUSD, paymentMethod, stripeUseCase, email },
    });
  }

  async getPaymentTokenomics({ amountUSD = 100, priceUSD = 0.10 } = {}) {
    const qs = new URLSearchParams({ amountUSD: String(amountUSD), priceUSD: String(priceUSD) });
    return this.gatewayFetch(`/payments/tokenomics?${qs}`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROVIDER & WALLET
  // ═══════════════════════════════════════════════════════════════

  /** Get JSON-RPC provider (read-only) */
  getProvider() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    }
    return this.provider;
  }

  /** Connect MetaMask or injected wallet */
  async connectWallet() {
    if (!window.ethereum) {
      throw new Error('No Web3 wallet detected. Install MetaMask or use bez-wallet.');
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    
    // Ensure correct chain
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== this.config.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + this.config.chainId.toString(16) }],
        });
      } catch (switchError) {
        // Chain not added, try adding it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + this.config.chainId.toString(16),
              chainName: 'BeZhas L2',
              rpcUrls: [this.config.rpcUrl],
              nativeCurrency: { name: 'BEZ', symbol: 'BEZ', decimals: 18 },
            }],
          });
        }
      }
    }

    this.signer = await provider.getSigner();
    this.provider = provider;
    return {
      address: await this.signer.getAddress(),
      chainId: this.config.chainId,
    };
  }

  /** Get connected wallet address */
  async getAddress() {
    if (!this.signer) throw new Error('Wallet not connected. Call connectWallet() first.');
    return this.signer.getAddress();
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONTRACT DISCOVERY (via API)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch ABI + address for a contract from the API gateway.
   * Results are cached per session.
   * @param {string} contractName
   * @returns {{ abi: Array, address: string|null, deployed: boolean }}
   */
  async getContractInfo(contractName) {
    const cacheKey = contractName;
    if (_abiCache.has(cacheKey)) {
      return { abi: _abiCache.get(cacheKey), address: _addressCache.get(cacheKey), deployed: !!_addressCache.get(cacheKey) };
    }

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/contracts/abi-public/${contractName}`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Contract '${contractName}' not found (${response.status})`);
      }

      const { data } = await response.json();
      _abiCache.set(cacheKey, data.abi);
      _addressCache.set(cacheKey, data.address);
      return { abi: data.abi, address: data.address, deployed: data.deployed };
    } catch (err) {
      console.warn(`[BeZhasClient] API unavailable for ${contractName}, trying local fallback...`);
      return { abi: null, address: null, deployed: false };
    }
  }

  /**
   * Load all contracts for a specific sector.
   * @param {string} [sector] - Defaults to the sector set in constructor
   * @returns {Array<{ name, abi, address, deployed }>}
   */
  async loadSectorContracts(sector) {
    const s = sector || this.sector;
    if (!s) throw new Error('No sector specified. Pass sector in constructor or as argument.');

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/contracts/sector/${s}`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) throw new Error(`Sector '${s}' not found`);
      const { data } = await response.json();

      // Cache individual contracts
      for (const contract of data.contracts) {
        _abiCache.set(contract.name, contract.abi);
        _addressCache.set(contract.name, contract.address);
      }

      this._sectorContracts = data.contracts;
      return data;
    } catch (err) {
      console.warn(`[BeZhasClient] Failed to load sector '${s}':`, err.message);
      return { sector: s, count: 0, deployed: 0, contracts: [] };
    }
  }

  /**
   * Fetch the full contract catalog (all 88 contracts, no ABIs).
   * @returns {{ totalContracts, totalDeployed, bySector, contracts }}
   */
  async getCatalog() {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/contracts/catalog`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });
      if (!response.ok) throw new Error('Catalog unavailable');
      const { data } = await response.json();
      return data;
    } catch (err) {
      console.warn('[BeZhasClient] Catalog unavailable:', err.message);
      return { totalContracts: 0, totalDeployed: 0, bySector: {}, contracts: {} };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONTRACT INTERACTION (Read/Write)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get an ethers.Contract instance for read-only calls.
   * @param {string} contractName
   * @returns {ethers.Contract}
   */
  async getContract(contractName) {
    const key = `${contractName}:read`;
    if (_contractInstanceCache.has(key)) return _contractInstanceCache.get(key);

    const { abi, address } = await this.getContractInfo(contractName);
    if (!abi || !address) throw new Error(`Contract '${contractName}' not available (missing ABI or address)`);

    const contract = new ethers.Contract(address, abi, this.getProvider());
    _contractInstanceCache.set(key, contract);
    return contract;
  }

  /**
   * Get an ethers.Contract instance with signer for write operations.
   * @param {string} contractName
   * @returns {ethers.Contract}
   */
  async getSignedContract(contractName) {
    if (!this.signer) throw new Error('Wallet not connected');
    const { abi, address } = await this.getContractInfo(contractName);
    if (!abi || !address) throw new Error(`Contract '${contractName}' not available`);
    return new ethers.Contract(address, abi, this.signer);
  }

  /**
   * Read from a contract (view/pure function call).
   * @param {string} contractName
   * @param {string} method
   * @param {Array} args
   * @returns {any} The return value from the contract
   */
  async read(contractName, method, args = []) {
    const contract = await this.getContract(contractName);
    if (!contract[method]) throw new Error(`Method '${method}' not found on ${contractName}`);
    return contract[method](...args);
  }

  /**
   * Write to a contract (sends a transaction via connected wallet).
   * @param {string} contractName
   * @param {string} method
   * @param {Array} args
   * @param {Object} [overrides] - ethers tx overrides (value, gasLimit, etc.)
   * @returns {{ hash: string, wait: Function }}
   */
  async write(contractName, method, args = [], overrides = {}) {
    const contract = await this.getSignedContract(contractName);
    if (!contract[method]) throw new Error(`Method '${method}' not found on ${contractName}`);
    const tx = await contract[method](...args, overrides);
    return tx;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONVENIENCE METHODS
  // ═══════════════════════════════════════════════════════════════

  /** Get BEZ token balance for an address (auto-resolves v1/v2 by chain) */
  async getBEZBalance(address) {
    try {
      const balance = await this.read(this.bezTokenName, 'balanceOf', [address]);
      return ethers.formatEther(balance);
    } catch (err) {
      // If BEZCoinV2 is not found, try BEZCoin (v1)
      if (this.bezTokenName === 'BEZCoinV2') {
        try {
          const balance = await this.read('BEZCoin', 'balanceOf', [address]);
          return ethers.formatEther(balance);
        } catch { /* fallthrough */ }
      }
      throw err;
    }
  }

  /** Get BEZ token info (name, symbol, decimals, totalSupply) */
  async getBEZInfo() {
    const contract = await this.getContract(this.bezTokenName);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(), contract.symbol(), contract.decimals(), contract.totalSupply(),
    ]);
    return { name, symbol, decimals: Number(decimals), totalSupply: ethers.formatEther(totalSupply), version: this.bezTokenName };
  }

  /** Transfer BEZ tokens */
  async transferBEZ(to, amount) {
    return this.write(this.bezTokenName, 'transfer', [to, ethers.parseEther(String(amount))]);
  }

  /** Approve BEZ spending for a contract */
  async approveBEZ(spender, amount) {
    return this.write(this.bezTokenName, 'approve', [spender, ethers.parseEther(String(amount))]);
  }

  /** Check chain connectivity */
  async ping() {
    try {
      const provider = this.getProvider();
      const [blockNumber, network] = await Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork(),
      ]);
      return {
        connected: true,
        chainId: Number(network.chainId),
        blockNumber,
        rpcUrl: this.config.rpcUrl,
      };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  /** Clear all caches (after a new deploy) */
  clearCache() {
    _abiCache.clear();
    _addressCache.clear();
    _contractInstanceCache.clear();
    this._sectorContracts = null;
  }
}

// ── Sector-specific client factories ──

/** Create a client pre-configured for the energy sector */
export const createEnergyClient = (config = {}) =>
  new BeZhasClient({ ...config, sector: 'energy' });

/** Create a client pre-configured for supply chain */
export const createSupplyChainClient = (config = {}) =>
  new BeZhasClient({ ...config, sector: 'supplychain' });

/** Create a client pre-configured for health */
export const createHealthClient = (config = {}) =>
  new BeZhasClient({ ...config, sector: 'health' });

/** Create a client pre-configured for finance */
export const createFinanceClient = (config = {}) =>
  new BeZhasClient({ ...config, sector: 'finance' });

/** Create a client pre-configured for the wallet SubApp */
export const createWalletClient = (config = {}) =>
  new BeZhasClient({ ...config, sector: 'core' });

/** Create a client pre-configured for legal */
export const createLegalClient = (config = {}) =>
  new BeZhasClient({ ...config, sector: 'legal' });

// ── Constants (for SubApps that need direct token reference) ──
export { BEZ_COIN_V1_ADDRESS, PRODUCTION_CHAINS };

// ── Default export ──
export default BeZhasClient;
