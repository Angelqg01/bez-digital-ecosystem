/**
 * Cross-Chain Bridge Service
 * 
 * Handles bridge operations between Polygon, Arbitrum, and zkSync
 * Implements relayer logic for completing cross-chain transfers
 */

const { ethers } = require('ethers');
const EventEmitter = require('events');
const logger = require('../utils/logger');

// Chain configurations
const CHAIN_CONFIG = {
    // Mainnets
    137: {
        name: 'Polygon',
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        explorer: 'https://polygonscan.com',
        nativeCurrency: 'MATIC',
        confirmations: 256,
        isTestnet: false
    },
    42161: {
        name: 'Arbitrum One',
        rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        explorer: 'https://arbiscan.io',
        nativeCurrency: 'ETH',
        confirmations: 64,
        isTestnet: false
    },
    324: {
        name: 'zkSync Era',
        rpcUrl: process.env.ZKSYNC_RPC_URL || 'https://mainnet.era.zksync.io',
        explorer: 'https://explorer.zksync.io',
        nativeCurrency: 'ETH',
        confirmations: 32,
        isTestnet: false
    },
    // Testnets
    80002: {
        name: 'Polygon Amoy',
        rpcUrl: process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
        explorer: 'https://amoy.polygonscan.com',
        nativeCurrency: 'MATIC',
        confirmations: 12,
        isTestnet: true
    },
    421614: {
        name: 'Arbitrum Sepolia',
        rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
        explorer: 'https://sepolia.arbiscan.io',
        nativeCurrency: 'ETH',
        confirmations: 12,
        isTestnet: true
    },
    300: {
        name: 'zkSync Sepolia',
        rpcUrl: process.env.ZKSYNC_SEPOLIA_RPC_URL || 'https://sepolia.era.zksync.dev',
        explorer: 'https://sepolia.explorer.zksync.io',
        nativeCurrency: 'ETH',
        confirmations: 12,
        isTestnet: true
    }
};

// Bridge ABI (minimal for interaction)
const BRIDGE_ABI = [
    'event BridgeInitiated(bytes32 indexed messageId, address indexed sender, address indexed recipient, uint256 amount, uint256 sourceChain, uint256 destinationChain, uint256 timestamp)',
    'event BridgeCompleted(bytes32 indexed messageId, address indexed recipient, uint256 amount, uint256 sourceChain)',
    'function completeBridge(bytes32 messageId, address recipient, uint256 amount, uint256 sourceChain, bytes signature) external',
    'function getBridgeRequest(bytes32 messageId) external view returns (tuple(address sender, address recipient, uint256 amount, uint256 sourceChain, uint256 destinationChain, uint256 timestamp, bool processed, bool cancelled))',
    'function processedMessages(bytes32) external view returns (bool)',
    'function getBridgeStats() external view returns (uint256 totalLocked, uint256 todayBridged, uint256 remainingLimit, uint256 currentNonce)',
    'function getRemainingDailyLimit() external view returns (uint256)',
    'function trustedRemotes(uint256) external view returns (address)',
    'function supportedChains(uint256) external view returns (bool)'
];

class CrossChainBridgeService extends EventEmitter {
    constructor() {
        super();
        this.providers = new Map();
        this.contracts = new Map();
        this.bridgeAddresses = new Map();
        this.relayerWallet = null;
        this.isInitialized = false;
        this.pendingTransfers = new Map();
        this.processedTransfers = new Set();

        // Statistics
        this.stats = {
            totalBridged: BigInt(0),
            successfulTransfers: 0,
            failedTransfers: 0,
            pendingTransfers: 0,
            lastActivity: null
        };
    }

    /**
     * Initialize the bridge service
     */
    async initialize() {
        try {
            logger.info('🌉 Initializing Cross-Chain Bridge Service...');

            // Initialize relayer wallet
            const privateKey = process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
            if (!privateKey) {
                logger.warn('⚠️ No relayer private key configured - bridge will be read-only');
            }

            // Initialize providers for each chain
            for (const [chainId, config] of Object.entries(CHAIN_CONFIG)) {
                try {
                    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
                    await provider.getNetwork(); // Test connection
                    this.providers.set(Number(chainId), provider);
                    logger.info(`✅ Connected to ${config.name} (${chainId})`);
                } catch (error) {
                    logger.warn(`⚠️ Failed to connect to ${config.name}: ${error.message}`);
                }
            }

            // Initialize contracts with bridge addresses from env
            await this._initializeBridgeContracts();

            // Initialize relayer wallet if private key available
            if (privateKey) {
                this.relayerWallet = new ethers.Wallet(privateKey);
                logger.info(`✅ Relayer wallet initialized: ${this.relayerWallet.address}`);
            }

            // Start event listeners
            this._startEventListeners();

            this.isInitialized = true;
            logger.info('✅ Cross-Chain Bridge Service initialized');

            return { success: true };
        } catch (error) {
            logger.error({ error }, 'Failed to initialize Cross-Chain Bridge Service');
            throw error;
        }
    }

    /**
     * Initialize bridge contracts from environment variables
     */
    async _initializeBridgeContracts() {
        const bridgeAddressEnvs = {
            137: 'BRIDGE_ADDRESS_POLYGON',
            80002: 'BRIDGE_ADDRESS_AMOY',
            42161: 'BRIDGE_ADDRESS_ARBITRUM',
            421614: 'BRIDGE_ADDRESS_ARBITRUM_SEPOLIA',
            324: 'BRIDGE_ADDRESS_ZKSYNC',
            300: 'BRIDGE_ADDRESS_ZKSYNC_SEPOLIA'
        };

        for (const [chainId, envVar] of Object.entries(bridgeAddressEnvs)) {
            const address = process.env[envVar];
            if (address && this.providers.has(Number(chainId))) {
                this.bridgeAddresses.set(Number(chainId), address);
                const contract = new ethers.Contract(
                    address,
                    BRIDGE_ABI,
                    this.providers.get(Number(chainId))
                );
                this.contracts.set(Number(chainId), contract);
                logger.info(`📝 Bridge contract registered on chain ${chainId}: ${address}`);
            }
        }
    }

    /**
     * Start event listeners for bridge events
     */
    _startEventListeners() {
        for (const [chainId, contract] of this.contracts) {
            try {
                // Listen for BridgeInitiated events
                contract.on('BridgeInitiated', async (messageId, sender, recipient, amount, sourceChain, destinationChain, timestamp, event) => {
                    logger.info({
                        messageId,
                        sender,
                        recipient,
                        amount: amount.toString(),
                        sourceChain: sourceChain.toString(),
                        destinationChain: destinationChain.toString()
                    }, `🌉 Bridge initiated on chain ${chainId}`);

                    // Queue for relay
                    this.pendingTransfers.set(messageId, {
                        messageId,
                        sender,
                        recipient,
                        amount,
                        sourceChain: Number(sourceChain),
                        destinationChain: Number(destinationChain),
                        timestamp: Number(timestamp),
                        blockNumber: event.log.blockNumber,
                        status: 'pending'
                    });

                    this.stats.pendingTransfers++;
                    this.emit('bridgeInitiated', { messageId, sender, recipient, amount: amount.toString(), sourceChain, destinationChain });

                    // Auto-relay if configured
                    if (process.env.AUTO_RELAY_BRIDGE === 'true') {
                        await this._processTransfer(messageId);
                    }
                });

                // Listen for BridgeCompleted events
                contract.on('BridgeCompleted', (messageId, recipient, amount, sourceChain) => {
                    logger.info({
                        messageId,
                        recipient,
                        amount: amount.toString(),
                        sourceChain: sourceChain.toString()
                    }, `✅ Bridge completed on chain ${chainId}`);

                    this.processedTransfers.add(messageId);
                    this.pendingTransfers.delete(messageId);
                    this.stats.successfulTransfers++;
                    this.stats.pendingTransfers--;
                    this.stats.totalBridged += amount;
                    this.stats.lastActivity = new Date();

                    this.emit('bridgeCompleted', { messageId, recipient, amount: amount.toString(), sourceChain });
                });

                logger.info(`👂 Listening for events on chain ${chainId}`);
            } catch (error) {
                logger.warn(`Failed to setup listeners for chain ${chainId}: ${error.message}`);
            }
        }
    }

    /**
     * Process a pending transfer (relayer function)
     */
    async _processTransfer(messageId) {
        const transfer = this.pendingTransfers.get(messageId);
        if (!transfer || transfer.status !== 'pending') return;

        try {
            transfer.status = 'processing';

            // Get destination chain contract
            const destContract = this.contracts.get(transfer.destinationChain);
            if (!destContract) {
                throw new Error(`No contract for destination chain ${transfer.destinationChain}`);
            }

            // Wait for confirmations
            const sourceConfig = CHAIN_CONFIG[transfer.sourceChain];
            const provider = this.providers.get(transfer.sourceChain);
            const currentBlock = await provider.getBlockNumber();
            const confirmations = currentBlock - transfer.blockNumber;

            if (confirmations < sourceConfig.confirmations) {
                logger.info(`⏳ Waiting for confirmations: ${confirmations}/${sourceConfig.confirmations}`);
                transfer.status = 'pending';
                return;
            }

            // Generate signature
            const signature = await this._signBridgeMessage(
                messageId,
                transfer.recipient,
                transfer.amount,
                transfer.sourceChain,
                transfer.destinationChain
            );

            // Connect wallet to destination chain
            const destProvider = this.providers.get(transfer.destinationChain);
            const signer = this.relayerWallet.connect(destProvider);
            const contractWithSigner = destContract.connect(signer);

            // Complete bridge on destination
            const tx = await contractWithSigner.completeBridge(
                messageId,
                transfer.recipient,
                transfer.amount,
                transfer.sourceChain,
                signature
            );

            logger.info({ txHash: tx.hash }, `📤 Relay transaction sent`);

            const receipt = await tx.wait();
            logger.info({
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            }, `✅ Bridge transfer relayed successfully`);

            transfer.status = 'completed';
            transfer.relayTxHash = receipt.hash;

        } catch (error) {
            logger.error({ error, messageId }, 'Failed to process transfer');
            transfer.status = 'failed';
            transfer.error = error.message;
            this.stats.failedTransfers++;
        }
    }

    /**
     * Sign a bridge message for relay
     */
    async _signBridgeMessage(messageId, recipient, amount, sourceChain, destinationChain) {
        if (!this.relayerWallet) {
            throw new Error('Relayer wallet not initialized');
        }

        const messageHash = ethers.solidityPackedKeccak256(
            ['bytes32', 'address', 'uint256', 'uint256', 'uint256'],
            [messageId, recipient, amount, sourceChain, destinationChain]
        );

        const signature = await this.relayerWallet.signMessage(ethers.getBytes(messageHash));
        return signature;
    }

    // ============================================
    // Public API Methods
    // ============================================

    /**
     * Get bridge status for a specific chain
     */
    async getBridgeStatus(chainId) {
        const contract = this.contracts.get(chainId);
        if (!contract) {
            return { error: 'Chain not supported or not configured' };
        }

        try {
            const stats = await contract.getBridgeStats();
            const remainingLimit = await contract.getRemainingDailyLimit();

            return {
                chainId,
                chainName: CHAIN_CONFIG[chainId]?.name,
                totalLocked: stats.totalLocked.toString(),
                todayBridged: stats.todayBridged.toString(),
                remainingLimit: remainingLimit.toString(),
                currentNonce: stats.currentNonce.toString(),
                isActive: true
            };
        } catch (error) {
            return {
                chainId,
                chainName: CHAIN_CONFIG[chainId]?.name,
                error: error.message,
                isActive: false
            };
        }
    }

    /**
     * Get all supported chains status
     */
    async getAllChainsStatus() {
        const statuses = [];
        for (const chainId of this.contracts.keys()) {
            const status = await this.getBridgeStatus(chainId);
            statuses.push(status);
        }
        return statuses;
    }

    /**
     * Get transfer status
     */
    async getTransferStatus(messageId) {
        // Check pending
        if (this.pendingTransfers.has(messageId)) {
            return { status: 'pending', ...this.pendingTransfers.get(messageId) };
        }

        // Check processed
        if (this.processedTransfers.has(messageId)) {
            return { status: 'completed', messageId };
        }

        // Check on-chain
        for (const [chainId, contract] of this.contracts) {
            try {
                const request = await contract.getBridgeRequest(messageId);
                if (request.sender !== ethers.ZeroAddress) {
                    return {
                        status: request.processed ? 'completed' : (request.cancelled ? 'cancelled' : 'pending'),
                        ...request,
                        chainId
                    };
                }
            } catch (error) {
                // Continue checking other chains
            }
        }

        return { status: 'not_found', messageId };
    }

    /**
     * Manually relay a transfer
     */
    async relayTransfer(messageId) {
        if (!this.relayerWallet) {
            throw new Error('Relayer not configured');
        }

        if (!this.pendingTransfers.has(messageId)) {
            throw new Error('Transfer not found in pending queue');
        }

        await this._processTransfer(messageId);
        return this.pendingTransfers.get(messageId);
    }

    /**
     * Get service statistics
     */
    getStats() {
        return {
            ...this.stats,
            totalBridged: this.stats.totalBridged.toString(),
            connectedChains: Array.from(this.providers.keys()),
            configuredBridges: Array.from(this.contracts.keys()),
            pendingTransfersCount: this.pendingTransfers.size,
            isInitialized: this.isInitialized,
            hasRelayer: !!this.relayerWallet
        };
    }

    /**
     * Get chain configuration
     */
    getChainConfig(chainId) {
        return CHAIN_CONFIG[chainId] || null;
    }

    /**
     * Get all chain configurations
     */
    getAllChainConfigs() {
        return CHAIN_CONFIG;
    }

    /**
     * Estimate bridge fee
     */
    async estimateBridgeFee(sourceChain, destinationChain, amount) {
        const destConfig = CHAIN_CONFIG[destinationChain];
        if (!destConfig) {
            throw new Error('Destination chain not supported');
        }

        // Base fee + gas estimation
        const baseFee = ethers.parseEther('0.001');
        const gasEstimate = ethers.parseEther('0.0005'); // Approximate gas cost

        return {
            baseFee: baseFee.toString(),
            gasEstimate: gasEstimate.toString(),
            totalFee: (baseFee + gasEstimate).toString(),
            currency: CHAIN_CONFIG[sourceChain]?.nativeCurrency || 'ETH'
        };
    }

    /**
     * Shutdown service
     */
    async shutdown() {
        logger.info('🌉 Shutting down Cross-Chain Bridge Service...');

        // Remove all event listeners
        for (const contract of this.contracts.values()) {
            contract.removeAllListeners();
        }

        // Clear data
        this.providers.clear();
        this.contracts.clear();
        this.pendingTransfers.clear();
        this.isInitialized = false;

        logger.info('👋 Cross-Chain Bridge Service shutdown complete');
    }
}

// Singleton instance
const crossChainBridgeService = new CrossChainBridgeService();

module.exports = {
    crossChainBridgeService,
    CrossChainBridgeService,
    CHAIN_CONFIG
};
