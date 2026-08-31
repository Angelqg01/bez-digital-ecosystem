/**
 * BeZhas Web3 Events Service
 * Listens to blockchain events and sends them to Aegis for analysis
 */

const { ethers } = require('ethers');
const { addWeb3EventJob } = require('./queue.service');

// Contract addresses and ABIs
const {
    PostAddress,
    PostABI,
    BezhasTokenAddress,
    BezhasTokenABI,
    MarketplaceAddress,
    MarketplaceABI
} = require('../contract-config');

class Web3EventsService {
    constructor() {
        this.provider = null;
        this.contracts = {};
        this.listeners = [];
        this.isInitialized = false;
    }

    /**
     * Initialize Web3 provider and contracts
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️  Web3 Events Service already initialized');
            return;
        }

        try {
            // Setup provider (use env or default to localhost)
            const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Test connection
            await this.provider.getBlockNumber();
            console.log('✅ Connected to blockchain');

            // Initialize contracts
            this.contracts.post = new ethers.Contract(PostAddress, PostABI, this.provider);
            this.contracts.token = new ethers.Contract(BezhasTokenAddress, BezhasTokenABI, this.provider);
            this.contracts.marketplace = new ethers.Contract(MarketplaceAddress, MarketplaceABI, this.provider);

            // Setup event listeners
            this.setupEventListeners();

            this.isInitialized = true;
            console.log('✅ Web3 Events Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Web3 Events Service:', error.message);
            console.warn('⚠️  Blockchain event monitoring disabled');
        }
    }

    /**
     * Setup listeners for smart contract events
     */
    setupEventListeners() {
        if (!this.isInitialized) return;

        // Post Contract Events
        if (this.contracts.post) {
            this.contracts.post.on('PostCreated', async (postId, author, timestamp, event) => {
                console.log(`📝 PostCreated event: ID ${postId}`);

                const tx = await event.getTransaction();
                const receipt = await event.getTransactionReceipt();

                await addWeb3EventJob({
                    contract: 'Post',
                    event: 'PostCreated',
                    postId: postId.toString(),
                    author,
                    timestamp: timestamp.toString(),
                    gasUsed: receipt.gasUsed.toString(),
                    txHash: tx.hash,
                    blockNumber: receipt.blockNumber
                });
            });
        }

        // Token Contract Events
        if (this.contracts.token) {
            // Transfer events
            this.contracts.token.on('Transfer', async (from, to, amount, event) => {
                // Only track significant transfers (> 100 BEZ)
                const amountEther = ethers.formatEther(amount);
                if (parseFloat(amountEther) > 100) {
                    console.log(`💸 Large Transfer: ${amountEther} BEZ`);

                    const receipt = await event.getTransactionReceipt();

                    await addWeb3EventJob({
                        contract: 'BezhasToken',
                        event: 'Transfer',
                        from,
                        to,
                        amount: amountEther,
                        gasUsed: receipt.gasUsed.toString(),
                        txHash: receipt.hash,
                        blockNumber: receipt.blockNumber
                    });
                }
            });
        }

        // Marketplace Events
        if (this.contracts.marketplace) {
            this.contracts.marketplace.on('MarketItemCreated', async (itemId, nftContract, tokenId, seller, price, event) => {
                console.log(`🛒 NFT Listed: Item ${itemId}`);

                const receipt = await event.getTransactionReceipt();

                await addWeb3EventJob({
                    contract: 'Marketplace',
                    event: 'MarketItemCreated',
                    itemId: itemId.toString(),
                    nftContract,
                    tokenId: tokenId.toString(),
                    seller,
                    price: ethers.formatEther(price),
                    gasUsed: receipt.gasUsed.toString(),
                    txHash: receipt.hash,
                    blockNumber: receipt.blockNumber
                });
            });
        }

        console.log('✅ Event listeners configured for all contracts');
    }

    /**
     * Stop all event listeners
     */
    async stopListeners() {
        if (this.contracts.post) {
            this.contracts.post.removeAllListeners();
        }
        if (this.contracts.token) {
            this.contracts.token.removeAllListeners();
        }
        if (this.contracts.marketplace) {
            this.contracts.marketplace.removeAllListeners();
        }

        console.log('✅ All Web3 event listeners stopped');
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            contracts: Object.keys(this.contracts).length,
            provider: this.provider ? 'connected' : 'disconnected'
        };
    }

    /**
     * Get the ethers provider instance
     * @returns {ethers.Provider|null}
     */
    getProvider() {
        // If provider is already initialized, return it
        if (this.provider) {
            return this.provider;
        }

        // Create a fallback provider if not initialized yet
        try {
            const rpcUrl = process.env.RPC_URL || process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            return this.provider;
        } catch (error) {
            console.error('Failed to create provider:', error);
            return null;
        }
    }

    /**
     * Get BezhasToken contract with signer for transactions
     * @returns {Promise<{contract: Contract, signer: Signer}>}
     */
    async getBezhasTokenContract() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (!this.contracts.token) {
            throw new Error('BezhasToken contract not initialized');
        }

        // Get signer from private key (backend wallet)
        const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;

        if (!privateKey) {
            throw new Error('BACKEND_WALLET_PRIVATE_KEY not configured');
        }

        const signer = new ethers.Wallet(privateKey, this.provider);
        const contract = this.contracts.token.connect(signer);

        return { contract, signer };
    }
}

// Singleton instance
const web3EventsService = new Web3EventsService();

// Auto-initialize only if RPC_URL is available AND not explicitly disabled
if (process.env.RPC_URL && process.env.DISABLE_BLOCKCHAIN_LISTENER !== 'true') {
    web3EventsService.initialize().catch(err => {
        console.error('Failed to auto-initialize Web3 Events Service:', err.message);
    });
} else {
    console.log('⚠️  Web3 Events Service disabled (no RPC_URL or explicitly disabled)');
}

module.exports = web3EventsService;
