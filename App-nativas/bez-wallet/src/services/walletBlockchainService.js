/**
 * bez-wallet — Blockchain Service
 * 
 * Integrates bez-wallet with the BeZhas blockchain infrastructure.
 * Uses the shared BeZhasClient for contract interactions.
 * 
 * Capabilities:
 *   - SmartWallet deployment via SmartWalletFactory
 *   - BEZ balance & transfers
 *   - Paymaster gas sponsorship
 *   - Identity registration
 *   - Transaction history from on-chain events
 */

import { BeZhasClient, createWalletClient } from '../../_shared/bezhas-blockchain-client.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ── Singleton client ──
let _client = null;

function getClient() {
    if (!_client) {
        _client = createWalletClient();
    }
    return _client;
}

// ═══════════════════════════════════════════
//  WALLET FACTORY — Deploy new smart wallets
// ═══════════════════════════════════════════

/**
 * Deploy a new SmartWallet for a user via the SmartWalletFactory contract.
 * @param {string} ownerAddress - Wallet owner's address
 * @param {string} guardianAddress - Guardian for recovery (optional, defaults to owner)
 * @param {number} dailyLimitBEZ - Daily spending limit in BEZ (default: 1000)
 * @returns {Promise<{txHash: string, walletAddress: string}>}
 */
export async function deploySmartWallet(ownerAddress, guardianAddress, dailyLimitBEZ = 1000) {
    const client = getClient();

    try {
        const factory = await client.getContract('SmartWalletFactory');
        if (!factory) throw new Error('SmartWalletFactory contract not available');

        const { ethers } = await import('ethers');
        const dailyLimit = ethers.parseEther(String(dailyLimitBEZ));
        const guardian = guardianAddress || ownerAddress;

        const result = await client.writeContract(
            'SmartWalletFactory',
            'createWallet',
            [ownerAddress, guardian, dailyLimit]
        );

        return {
            txHash: result.hash,
            status: 'deployed',
            owner: ownerAddress,
            guardian,
            dailyLimit: dailyLimitBEZ,
        };
    } catch (err) {
        console.warn('[bez-wallet] SmartWallet deploy failed, returning mock:', err.message);
        return {
            txHash: '0x' + 'f'.repeat(64),
            status: 'mock',
            owner: ownerAddress,
            dailyLimit: dailyLimitBEZ,
            error: err.message,
        };
    }
}

// ═══════════════════════════════════════════
//  BEZ TOKEN — Balance, transfer, approve
// ═══════════════════════════════════════════

/**
 * Get BEZ token balance for an address.
 * @param {string} address
 * @returns {Promise<{balance: string, balanceRaw: string, symbol: string}>}
 */
export async function getBEZBalance(address) {
    const client = getClient();

    try {
        const result = await client.readContract('BEZCoinV2', 'balanceOf', [address]);
        const { ethers } = await import('ethers');
        const decimals = await client.readContract('BEZCoinV2', 'decimals', []);
        return {
            balance: ethers.formatUnits(result, decimals),
            balanceRaw: result.toString(),
            symbol: 'BEZ',
            address,
        };
    } catch (err) {
        console.warn('[bez-wallet] Balance fetch failed:', err.message);
        return {
            balance: '0.00',
            balanceRaw: '0',
            symbol: 'BEZ',
            address,
            source: 'fallback',
        };
    }
}

/**
 * Transfer BEZ tokens from connected wallet.
 * @param {string} to - Recipient address
 * @param {string|number} amount - Amount in BEZ
 * @returns {Promise<{txHash: string}>}
 */
export async function transferBEZ(to, amount) {
    const client = getClient();

    try {
        const result = await client.transferBEZ(to, amount);
        return { txHash: result.hash, status: 'sent', to, amount };
    } catch (err) {
        console.warn('[bez-wallet] Transfer failed:', err.message);
        throw new Error(`Transfer failed: ${err.message}`);
    }
}

/**
 * Approve BEZ spending by a spender contract (e.g., Paymaster, StakingPool).
 * @param {string} spender - Address of the spender contract
 * @param {string|number} amount - Amount to approve in BEZ
 */
export async function approveBEZ(spender, amount) {
    const client = getClient();
    return client.approveBEZ(spender, amount);
}

// ═══════════════════════════════════════════
//  PAYMASTER — Gas sponsorship
// ═══════════════════════════════════════════

/**
 * Check if an address is eligible for gas sponsorship.
 */
export async function checkPaymasterEligibility(address) {
    const client = getClient();

    try {
        const result = await client.readContract('Paymaster', 'isSponsored', [address]);
        return { eligible: !!result, address };
    } catch {
        return { eligible: false, address, source: 'fallback' };
    }
}

/**
 * Deposit BEZ to the Paymaster for gas sponsorship.
 * @param {string|number} amount - BEZ amount to deposit
 */
export async function depositToPaymaster(amount) {
    const client = getClient();

    try {
        const result = await client.writeContract('Paymaster', 'deposit', [], {
            value: amount,
        });
        return { txHash: result.hash, status: 'deposited' };
    } catch (err) {
        throw new Error(`Paymaster deposit failed: ${err.message}`);
    }
}

// ═══════════════════════════════════════════
//  IDENTITY — DID registration
// ═══════════════════════════════════════════

/**
 * Register a decentralized identity for the connected wallet.
 * @param {string} identityHash - IPFS CID or hash of identity document
 */
export async function registerIdentity(identityHash) {
    const client = getClient();

    try {
        const result = await client.writeContract(
            'IdentityRegistry',
            'register',
            [identityHash]
        );
        return { txHash: result.hash, status: 'registered' };
    } catch (err) {
        console.warn('[bez-wallet] Identity registration failed:', err.message);
        return { status: 'mock', identityHash, error: err.message };
    }
}

/**
 * Check if an address has a registered identity.
 */
export async function checkIdentity(address) {
    const client = getClient();

    try {
        const result = await client.readContract('IdentityRegistry', 'isRegistered', [address]);
        return { registered: !!result, address };
    } catch {
        return { registered: false, address, source: 'fallback' };
    }
}

// ═══════════════════════════════════════════
//  WALLET CONNECT — Shared client wrapper
// ═══════════════════════════════════════════

export async function connectWallet() {
    const client = getClient();
    return client.connectWallet();
}

export function isConnected() {
    const client = getClient();
    return client.isConnected();
}

// ═══════════════════════════════════════════
//  GATEWAY API — Payment & history via REST
// ═══════════════════════════════════════════

/**
 * Initiate a BEZ purchase via the gateway.
 */
export async function buyBEZ(walletAddress, amountUSD, paymentMethod, token) {
    const res = await fetch(`${API_URL}/gateway/v1/payments/buy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Api-Key': import.meta.env.VITE_API_KEY || '',
        },
        body: JSON.stringify({ walletAddress, amountUSD, paymentMethod }),
    });
    return res.json();
}

/**
 * Fetch payment history for an address.
 */
export async function getPaymentHistory(address, token, limit = 50) {
    const res = await fetch(`${API_URL}/gateway/v1/payments/history/${address}?limit=${limit}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Api-Key': import.meta.env.VITE_API_KEY || '',
        },
    });
    return res.json();
}

/**
 * Fetch available Stripe payment links.
 */
export async function getStripeLinks(token) {
    const res = await fetch(`${API_URL}/gateway/v1/payments/stripe-links`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Api-Key': import.meta.env.VITE_API_KEY || '',
        },
    });
    return res.json();
}
