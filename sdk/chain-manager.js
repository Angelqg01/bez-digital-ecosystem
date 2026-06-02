/**
 * BeZhas SDK — Chain Manager
 *
 * Provides ethers.js providers and contract instances across all supported chains.
 * Works in Node.js (JsonRpcProvider) and browser (BrowserProvider from wallet).
 *
 * Usage:
 *   const { ChainManager } = require('@bezhas/sdk/chain-manager');
 *   const cm = new ChainManager();
 *
 *   // Read-only provider
 *   const provider = cm.getProvider(137);
 *   const balance = await provider.getBalance('0x...');
 *
 *   // Contract instance (read-only)
 *   const bez = cm.getContractInstance('BEZCoinV2', 'bezhas_l2');
 *   const supply = await bez.totalSupply();
 *
 *   // With signer (Node.js — private key)
 *   const signed = cm.getContractInstance('StakingPool', 2708, privateKey);
 */

'use strict';

const { ethers } = require('ethers');
const { getContract, getChainConfig, resolveChainId, CHAIN_CONFIGS } = require('./contracts');

class ChainManager {
    /**
     * @param {Object} [opts]
     * @param {Object} [opts.rpcOverrides] - { [chainId]: 'https://custom-rpc' }
     * @param {Object} [opts.browserProvider] - ethers.BrowserProvider (from wallet like MetaMask)
     */
    constructor(opts = {}) {
        this._providers = new Map();
        this._rpcOverrides = opts.rpcOverrides || {};
        this._browserProvider = opts.browserProvider || null;
    }

    /**
     * Get a JSON-RPC provider for a chain (cached).
     * @param {string|number} network - Chain ID or alias
     * @returns {ethers.JsonRpcProvider}
     */
    getProvider(network) {
        const chainId = resolveChainId(network);

        if (this._providers.has(chainId)) return this._providers.get(chainId);

        const config = CHAIN_CONFIGS[chainId];
        if (!config) throw new Error(`No config for chain ${chainId}`);

        const rpc = this._rpcOverrides[chainId] || config.rpc;
        const provider = new ethers.JsonRpcProvider(rpc, {
            chainId,
            name: config.name,
        });

        this._providers.set(chainId, provider);
        return provider;
    }

    /**
     * Get a signer for a chain.
     * @param {string|number} network
     * @param {string} [privateKey] - If omitted and browserProvider is set, uses the browser signer
     * @returns {Promise<ethers.Signer>}
     */
    async getSigner(network, privateKey) {
        const chainId = resolveChainId(network);

        if (privateKey) {
            const provider = this.getProvider(chainId);
            return new ethers.Wallet(privateKey, provider);
        }

        if (this._browserProvider) {
            return this._browserProvider.getSigner();
        }

        throw new Error('No private key or browser provider available for signing');
    }

    /**
     * Get a contract instance (read-only or with signer).
     * @param {string} contractName
     * @param {string|number} network
     * @param {string} [privateKey] - Provide for write operations
     * @returns {ethers.Contract|null}
     */
    getContractInstance(contractName, network = 'localhost', privateKey) {
        const info = getContract(contractName, network);
        if (!info || !info.abi) return null;

        const chainId = resolveChainId(network);
        const provider = this.getProvider(chainId);

        if (privateKey) {
            const signer = new ethers.Wallet(privateKey, provider);
            return new ethers.Contract(info.address, info.abi, signer);
        }

        return new ethers.Contract(info.address, info.abi, provider);
    }

    /**
     * Get a contract instance with the browser signer (for dApps).
     * @param {string} contractName
     * @param {string|number} network
     * @returns {Promise<ethers.Contract|null>}
     */
    async getContractWithSigner(contractName, network) {
        const info = getContract(contractName, network);
        if (!info || !info.abi) return null;

        const signer = await this.getSigner(network);
        return new ethers.Contract(info.address, info.abi, signer);
    }

    /**
     * Check if a chain's RPC is reachable.
     * @param {string|number} network
     * @returns {Promise<{ ok: boolean, blockNumber?: number, latencyMs: number }>}
     */
    async healthCheck(network) {
        const start = Date.now();
        try {
            const provider = this.getProvider(network);
            const blockNumber = await provider.getBlockNumber();
            return { ok: true, blockNumber, latencyMs: Date.now() - start };
        } catch (error) {
            return { ok: false, error: error.message, latencyMs: Date.now() - start };
        }
    }

    /**
     * Health check all configured chains.
     * @returns {Promise<Object<number, {ok, blockNumber?, latencyMs}>>}
     */
    async healthCheckAll() {
        const results = {};
        const checks = Object.keys(CHAIN_CONFIGS).map(async (chainId) => {
            results[chainId] = await this.healthCheck(parseInt(chainId));
        });
        await Promise.all(checks);
        return results;
    }
}

module.exports = { ChainManager };
