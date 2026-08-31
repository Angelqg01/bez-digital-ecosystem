/**
 * Event Listener Service - Revenue Stream Native
 * 
 * Listens to blockchain events in real-time and triggers service delivery
 * Monitors:
 * - AutoSwapExecuted: When a swap completes
 * - PlatformFeeCollected: When fees are collected
 * 
 * Actions:
 * - Deliver services (NFT minting, subscription activation, etc.)
 * - Send notifications (email, Discord, Slack)
 * - Update database records
 * - Track revenue metrics
 */

const { ethers } = require('ethers');
const EventEmitter = require('events');

class RevenueEventListener extends EventEmitter {
    constructor(config = {}) {
        super();

        this.config = {
            rpcUrl: config.rpcUrl || process.env.POLYGON_RPC_URL,
            contractAddress: config.contractAddress || process.env.BEZ_LIQUIDITY_RAMP_ADDRESS,
            reconnectDelay: config.reconnectDelay || 5000,
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
            ...config
        };

        this.provider = null;
        this.contract = null;
        this.isListening = false;
        this.reconnectAttempts = 0;

        this.contractABI = [
            'event AutoSwapExecuted(address indexed user, uint256 amountIn, uint256 bezReceived, string serviceId)',
            'event PlatformFeeCollected(address indexed user, uint256 feeAmount, string serviceId)',
            'event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)',
            'event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps)'
        ];
    }

    /**
     * Initialize provider and contract
     */
    async initialize() {
        try {
            console.log('🔌 Initializing blockchain connection...');
            console.log('   RPC:', this.config.rpcUrl);
            console.log('   Contract:', this.config.contractAddress);

            // Create provider
            this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

            // Test connection
            const network = await this.provider.getNetwork();
            console.log('✅ Connected to network:', network.name, '(chainId:', network.chainId.toString() + ')');

            // Create contract instance
            this.contract = new ethers.Contract(
                this.config.contractAddress,
                this.contractABI,
                this.provider
            );

            // Verify contract exists
            const code = await this.provider.getCode(this.config.contractAddress);
            if (code === '0x') {
                throw new Error('Contract not found at specified address');
            }

            console.log('✅ Contract initialized');
            this.reconnectAttempts = 0;

            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Start listening to events
     */
    async start() {
        if (this.isListening) {
            console.warn('⚠️  Event listener already running');
            return;
        }

        if (!this.contract) {
            await this.initialize();
        }

        console.log('🎧 Starting event listener...');
        this.isListening = true;

        // Listen to AutoSwapExecuted
        this.contract.on('AutoSwapExecuted', async (user, amountIn, bezReceived, serviceId, event) => {
            try {
                await this.handleSwapExecuted({
                    user,
                    amountIn,
                    bezReceived,
                    serviceId,
                    transactionHash: event.log.transactionHash,
                    blockNumber: event.log.blockNumber
                });
            } catch (error) {
                console.error('Error handling AutoSwapExecuted:', error);
                this.emit('error', error);
            }
        });

        // Listen to PlatformFeeCollected
        this.contract.on('PlatformFeeCollected', async (user, feeAmount, serviceId, event) => {
            try {
                await this.handleFeeCollected({
                    user,
                    feeAmount,
                    serviceId,
                    transactionHash: event.log.transactionHash,
                    blockNumber: event.log.blockNumber
                });
            } catch (error) {
                console.error('Error handling PlatformFeeCollected:', error);
                this.emit('error', error);
            }
        });

        // Listen to admin events (optional, for monitoring)
        this.contract.on('TreasuryUpdated', (oldTreasury, newTreasury, event) => {
            console.log('🏦 Treasury updated:', oldTreasury, '→', newTreasury);
            this.emit('treasury-updated', { oldTreasury, newTreasury, event });
        });

        this.contract.on('FeeUpdated', (oldFeeBps, newFeeBps, event) => {
            console.log('💰 Fee updated:', oldFeeBps.toString(), 'BPS →', newFeeBps.toString(), 'BPS');
            this.emit('fee-updated', { oldFeeBps: oldFeeBps.toString(), newFeeBps: newFeeBps.toString(), event });
        });

        // Handle provider errors
        this.provider.on('error', (error) => {
            console.error('❌ Provider error:', error);
            this.handleProviderError(error);
        });

        console.log('✅ Event listener started successfully');
        this.emit('started');
    }

    /**
     * Handle AutoSwapExecuted event
     */
    async handleSwapExecuted(data) {
        const { user, amountIn, bezReceived, serviceId, transactionHash, blockNumber } = data;

        const amountUSDC = ethers.formatUnits(amountIn, 6);
        const bezAmount = ethers.formatEther(bezReceived);

        console.log('');
        console.log('✅ Swap Executed:');
        console.log('   User:', user);
        console.log('   Amount In:', amountUSDC, 'USDC');
        console.log('   BEZ Received:', bezAmount, 'BEZ');
        console.log('   Service:', serviceId);
        console.log('   Tx:', transactionHash);
        console.log('   Block:', blockNumber);

        // Emit event for external handlers
        this.emit('swap-executed', {
            user,
            amountUSDC: parseFloat(amountUSDC),
            bezAmount: parseFloat(bezAmount),
            serviceId,
            transactionHash,
            blockNumber,
            timestamp: new Date()
        });

        // Service delivery logic
        await this.deliverService(serviceId, {
            user,
            amountUSDC,
            bezAmount,
            transactionHash
        });
    }

    /**
     * Handle PlatformFeeCollected event
     */
    async handleFeeCollected(data) {
        const { user, feeAmount, serviceId, transactionHash, blockNumber } = data;

        const feeUSDC = ethers.formatUnits(feeAmount, 6);

        console.log('');
        console.log('💰 Fee Collected:');
        console.log('   User:', user);
        console.log('   Fee:', feeUSDC, 'USDC');
        console.log('   Service:', serviceId);
        console.log('   Tx:', transactionHash);

        // Emit event for external handlers
        this.emit('fee-collected', {
            user,
            feeUSDC: parseFloat(feeUSDC),
            serviceId,
            transactionHash,
            blockNumber,
            timestamp: new Date()
        });
    }

    /**
     * Deliver service based on serviceId
     */
    async deliverService(serviceId, data) {
        const { user, transactionHash } = data;

        console.log(`📦 Delivering service: ${serviceId} to ${user}`);

        try {
            switch (serviceId) {
                case 'LIQUIDITY_RAMP':
                    // Just a swap, no additional service
                    console.log('   ℹ️  No additional service required (liquidity swap)');
                    break;

                case 'NFT_PURCHASE':
                    console.log('   🎨 Minting NFT...');
                    this.emit('deliver-nft', { user, transactionHash });
                    break;

                case 'PREMIUM_SUBSCRIPTION':
                    console.log('   ⭐ Activating premium subscription...');
                    this.emit('deliver-subscription', { user, transactionHash });
                    break;

                case 'PRODUCT_PURCHASE':
                    console.log('   📦 Processing product order...');
                    this.emit('deliver-product', { user, transactionHash });
                    break;

                default:
                    console.log(`   ⚠️  Unknown service ID: ${serviceId}`);
                    this.emit('unknown-service', { serviceId, user, transactionHash });
            }

            console.log('   ✅ Service delivery initiated');
        } catch (error) {
            console.error('   ❌ Service delivery failed:', error);
            this.emit('delivery-error', { serviceId, user, error });
        }
    }

    /**
     * Handle provider errors and reconnect
     */
    async handleProviderError(error) {
        console.error('Provider error:', error.message);

        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

            await this.stop();

            setTimeout(async () => {
                try {
                    await this.start();
                } catch (err) {
                    console.error('Reconnection failed:', err);
                }
            }, this.config.reconnectDelay);
        } else {
            console.error('❌ Max reconnection attempts reached. Please restart manually.');
            this.emit('max-reconnects-exceeded');
        }
    }

    /**
     * Stop listening to events
     */
    async stop() {
        if (!this.isListening) {
            return;
        }

        console.log('🛑 Stopping event listener...');
        this.isListening = false;

        if (this.contract) {
            await this.contract.removeAllListeners();
        }

        if (this.provider) {
            await this.provider.removeAllListeners();
        }

        console.log('✅ Event listener stopped');
        this.emit('stopped');
    }

    /**
     * Get current stats from contract
     */
    async getStats() {
        if (!this.contract) {
            throw new Error('Contract not initialized');
        }

        const statsABI = ['function getStats() view returns (uint256, uint256, uint256)'];
        const contractWithStats = new ethers.Contract(
            this.config.contractAddress,
            statsABI,
            this.provider
        );

        const [volume, fees, txCount] = await contractWithStats.getStats();

        return {
            totalVolumeProcessed: ethers.formatUnits(volume, 6),
            totalFeesCollected: ethers.formatUnits(fees, 6),
            totalTransactions: txCount.toString()
        };
    }

    /**
     * Query historical events
     */
    async queryHistoricalEvents(eventName, fromBlock = -10000, toBlock = 'latest') {
        if (!this.contract) {
            throw new Error('Contract not initialized');
        }

        const filter = this.contract.filters[eventName]();
        const events = await this.contract.queryFilter(filter, fromBlock, toBlock);

        return events.map(event => ({
            ...event.args,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber
        }));
    }
}

// Singleton instance
let listener = null;

/**
 * Get or create event listener instance
 */
function getEventListener(config) {
    if (!listener) {
        listener = new RevenueEventListener(config);
    }
    return listener;
}

/**
 * CLI usage
 */
if (require.main === module) {
    const listener = getEventListener();

    // Setup event handlers
    listener.on('swap-executed', (data) => {
        console.log('📊 Swap event received:', data);
        // Here you can:
        // - Save to database
        // - Send webhook
        // - Update analytics
        // - Trigger notifications
    });

    listener.on('fee-collected', (data) => {
        console.log('💵 Fee event received:', data);
        // Here you can:
        // - Update revenue tracking
        // - Send Discord/Slack alert
        // - Update dashboard
    });

    listener.on('deliver-nft', async (data) => {
        console.log('🎨 NFT delivery requested:', data);
        // Implement NFT minting logic here
        // await mintNFT(data.user, data.transactionHash);
    });

    listener.on('deliver-subscription', async (data) => {
        console.log('⭐ Subscription activation requested:', data);
        // Implement subscription logic here
        // await activatePremium(data.user);
    });

    listener.on('error', (error) => {
        console.error('❌ Listener error:', error);
    });

    // Start listening
    listener.start().catch(error => {
        console.error('Failed to start listener:', error);
        process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n👋 Shutting down gracefully...');
        await listener.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n👋 Shutting down gracefully...');
        await listener.stop();
        process.exit(0);
    });
}

module.exports = {
    RevenueEventListener,
    getEventListener
};
