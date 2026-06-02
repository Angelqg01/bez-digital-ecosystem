/**
 * edge-node-manager — Blockchain Service
 * 
 * Connects the Edge Node Manager to the BeZhas validator infrastructure.
 * Interacts with ValidatorRegistry, EdgeNodeRewards, and L2Sequencer contracts.
 * 
 * Capabilities:
 *   - Register/deregister validator nodes
 *   - Claim edge node rewards
 *   - Read validator status and staking info
 *   - Monitor sequencer rotation
 *   - Read slashing history
 */

import { BeZhasClient } from '../../_shared/bezhas-blockchain-client.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://localhost:8545';
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '31337');

// ── Singleton client ──
let _client = null;

function getClient() {
    if (!_client) {
        _client = new BeZhasClient({ apiUrl: API_URL, rpcUrl: RPC_URL, chainId: CHAIN_ID });
    }
    return _client;
}

// ═══════════════════════════════════════════
//  VALIDATOR REGISTRY — Node registration
// ═══════════════════════════════════════════

/**
 * Register a new validator/edge node.
 * @param {string} nodeAddress - Node's operator address
 * @param {string|number} stakeBEZ - Amount of BEZ to stake
 * @param {object} metadata - { name, type, location, protocol }
 * @returns {Promise<{txHash: string}>}
 */
export async function registerValidatorNode(nodeAddress, stakeBEZ, metadata = {}) {
    const client = getClient();

    try {
        // First approve staking amount
        const { ethers } = await import('ethers');
        const stakeWei = ethers.parseEther(String(stakeBEZ));

        // Get ValidatorRegistry address for approval
        const registry = await client.getContractInfo('ValidatorRegistry');
        if (registry?.address) {
            await client.approveBEZ(registry.address, stakeBEZ);
        }

        const result = await client.writeContract(
            'ValidatorRegistry',
            'registerValidator',
            [nodeAddress, stakeWei]
        );

        return {
            txHash: result.hash,
            status: 'registered',
            nodeAddress,
            stake: stakeBEZ,
            metadata,
        };
    } catch (err) {
        console.warn('[edge-node] Registration failed:', err.message);
        return {
            txHash: null,
            status: 'mock',
            nodeAddress,
            stake: stakeBEZ,
            error: err.message,
        };
    }
}

/**
 * Deregister a validator node and unstake.
 * @param {string} nodeAddress
 */
export async function deregisterNode(nodeAddress) {
    const client = getClient();

    try {
        const result = await client.writeContract(
            'ValidatorRegistry',
            'deregisterValidator',
            [nodeAddress]
        );
        return { txHash: result.hash, status: 'deregistered' };
    } catch (err) {
        throw new Error(`Deregistration failed: ${err.message}`);
    }
}

/**
 * Get validator info for an address.
 */
export async function getValidatorInfo(address) {
    const client = getClient();

    try {
        const [isValidator, staked, tier] = await Promise.all([
            client.readContract('ValidatorRegistry', 'isValidator', [address]).catch(() => false),
            client.readContract('ValidatorRegistry', 'getStake', [address]).catch(() => 0n),
            client.readContract('ValidatorRegistry', 'getValidatorTier', [address]).catch(() => 0),
        ]);

        const { ethers } = await import('ethers');
        return {
            address,
            isValidator: !!isValidator,
            staked: ethers.formatEther(staked),
            tier: Number(tier),
            tierName: ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'][Number(tier)] || 'Unknown',
            source: 'onchain',
        };
    } catch (err) {
        return {
            address,
            isValidator: false,
            staked: '0',
            tier: 0,
            tierName: 'None',
            source: 'fallback',
            error: err.message,
        };
    }
}

// ═══════════════════════════════════════════
//  EDGE NODE REWARDS — Claim and check
// ═══════════════════════════════════════════

/**
 * Get pending rewards for a node operator.
 */
export async function getPendingRewards(address) {
    const client = getClient();

    try {
        const rewards = await client.readContract('EdgeNodeRewards', 'pendingRewards', [address]);
        const { ethers } = await import('ethers');
        return {
            address,
            pendingBEZ: ethers.formatEther(rewards),
            pendingRaw: rewards.toString(),
            source: 'onchain',
        };
    } catch {
        return { address, pendingBEZ: '0.00', source: 'fallback' };
    }
}

/**
 * Claim accumulated edge node rewards.
 */
export async function claimRewards() {
    const client = getClient();

    try {
        const result = await client.writeContract('EdgeNodeRewards', 'claimRewards', []);
        return { txHash: result.hash, status: 'claimed' };
    } catch (err) {
        throw new Error(`Claim failed: ${err.message}`);
    }
}

// ═══════════════════════════════════════════
//  SEQUENCER — Rotation status
// ═══════════════════════════════════════════

/**
 * Get current sequencer info.
 */
export async function getSequencerStatus() {
    const client = getClient();

    try {
        const [current, epoch] = await Promise.all([
            client.readContract('L2Sequencer', 'currentSequencer', []).catch(() => null),
            client.readContract('L2Sequencer', 'currentEpoch', []).catch(() => 0),
        ]);

        return {
            currentSequencer: current,
            epoch: Number(epoch),
            source: 'onchain',
        };
    } catch {
        return {
            currentSequencer: null,
            epoch: 0,
            source: 'fallback',
        };
    }
}

// ═══════════════════════════════════════════
//  SLASHING — History
// ═══════════════════════════════════════════

/**
 * Check if an address has been slashed.
 */
export async function getSlashingInfo(address) {
    const client = getClient();

    try {
        const slashed = await client.readContract('SlashingManager', 'isSlashed', [address]);
        return { address, isSlashed: !!slashed, source: 'onchain' };
    } catch {
        return { address, isSlashed: false, source: 'fallback' };
    }
}

// ═══════════════════════════════════════════
//  NETWORK STATS — Aggregated via API
// ═══════════════════════════════════════════

/**
 * Fetch network statistics from the gateway API.
 */
export async function getNetworkStats(token) {
    try {
        const res = await fetch(`${API_URL}/gateway/v1/nodes/network`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('API unavailable');
        return await res.json();
    } catch {
        // Fallback mock data
        return {
            totalNodes: 5,
            activeNodes: 4,
            totalStaked: '250000',
            networkCapacityKW: 590,
            uptime: 99.7,
            source: 'fallback',
        };
    }
}

// ═══════════════════════════════════════════
//  WALLET CONNECT
// ═══════════════════════════════════════════

export async function connectWallet() {
    const client = getClient();
    return client.connectWallet();
}
