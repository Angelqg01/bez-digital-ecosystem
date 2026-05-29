require('dotenv').config({ path: '../.env' });
const { ethers } = require('ethers');
const PaymentPG = require('../models/pg/Payment');
const NotificationPG = require('../models/pg/Notification');
const UserPG = require('../models/pg/User');
const { BeZhasPaymentAddress, BeZhasMarketplaceAddress } = require('../contract-addresses.json');

// Import compiled ABIs
const PaymentABI = require('../abis/BeZhasToken.json'); // Adjust if there's a specific Payment ABI
const MarketplaceABI = require('../abis/BeZhasMarketplace.json');

// Using configuration from .env
const RPC_URL = process.env.POLYGON_RPC_URL || process.env.RPC_URL || 'http://127.0.0.1:8545';
const PAYMENT_CONTRACT_ADDRESS = BeZhasPaymentAddress || process.env.BEZCOIN_ADDRESS;
const MARKETPLACE_CONTRACT_ADDRESS = BeZhasMarketplaceAddress || process.env.BEZHAS_MARKETPLACE_ADDRESS;

class SyncDaemon {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(RPC_URL);
        this.paymentContract = null;
        this.marketplaceContract = null;
        this.isRunning = false;
    }

    async initialize() {
        try {
            console.log(`[SyncDaemon] Connecting to RPC: ${RPC_URL}`);
            const network = await this.provider.getNetwork();
            console.log(`[SyncDaemon] 🌐 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

            if (PAYMENT_CONTRACT_ADDRESS && PaymentABI) {
                this.paymentContract = new ethers.Contract(PAYMENT_CONTRACT_ADDRESS, PaymentABI, this.provider);
                console.log(`[SyncDaemon] ✅ Payment Contract initialized at ${PAYMENT_CONTRACT_ADDRESS}`);
            }

            if (MARKETPLACE_CONTRACT_ADDRESS && MarketplaceABI) {
                this.marketplaceContract = new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, MarketplaceABI, this.provider);
                console.log(`[SyncDaemon] ✅ Marketplace Contract initialized at ${MARKETPLACE_CONTRACT_ADDRESS}`);
            }

        } catch (error) {
            console.error('[SyncDaemon] ❌ Initialization Error:', error);
            process.exit(1);
        }
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[SyncDaemon] 🚀 Web3 Synchronization Daemon is starting...');

        // 1. Listen for Payment Events
        if (this.paymentContract) {
            this.setupPaymentListeners();
        }

        // 2. Listen for Marketplace Events
        if (this.marketplaceContract) {
            this.setupMarketplaceListeners();
        }

        console.log('[SyncDaemon] 🎧 Listening for on-chain events to sync with PostgreSQL DB...');
    }

    setupPaymentListeners() {
        // Universal Ecosystem Sync: PaymentReceived
        // Adapt according to the actual events inside the Payment abi
        try {
            this.paymentContract.on('Transfer', async (from, to, amount, event) => {
                const txHash = event.log.transactionHash;
                const blockNumber = event.log.blockNumber;
                
                console.log(`[SyncDaemon] 💰 Token Transfer Detected: ${from} -> ${to} | Amount: ${ethers.formatUnits(amount, 18)}`);

                // We can register a generic notification for the receiver
                const toUser = await UserPG.findByWallet(to.toLowerCase());
                if (toUser) {
                    await NotificationPG.create({
                        userId: toUser.id,
                        type: 'payment_received',
                        title: 'Pago Recibido On-Chain',
                        message: `Has recibido ${ethers.formatUnits(amount, 18)} tokens en tu wallet.`,
                        metadata: { txHash, blockNumber, amount: amount.toString() }
                    });
                    console.log(`[SyncDaemon] ✅ Notified user ${toUser.username} about the incoming transfer.`);
                }
            });
        } catch (e) {
            console.log('[SyncDaemon] Note: Payment Contract Transfer event not present or error binding listener', e.message);
        }
    }

    setupMarketplaceListeners() {
        // Universal Ecosystem Sync: Product Sold / Purchased
        try {
            this.marketplaceContract.on('ProductSold', async (id, buyer, price, timestamp, event) => {
                const txHash = event.log.transactionHash;
                console.log(`[SyncDaemon] 🛒 Product Sold [ID: ${id}] to ${buyer} for ${ethers.formatEther(price)}`);

                // Register event as notification for the buyer
                const buyerUser = await UserPG.findByWallet(buyer.toLowerCase());
                if (buyerUser) {
                    await NotificationPG.create({
                        userId: buyerUser.id,
                        type: 'purchase_complete',
                        title: 'Compra Confirmada',
                        message: `Tu compra del producto #${id} ha sido confirmada en la blockchain.`,
                        metadata: { txHash, productId: id.toString(), price: price.toString() }
                    });
                }
            });

            this.marketplaceContract.on('VendorStatusUpdated', async (userAddress, status, timestamp, event) => {
                const txHash = event.log.transactionHash;
                console.log(`[SyncDaemon] 👨‍💼 Vendor Status Updated: ${userAddress}`);

                // Direct sync with Postgres
                const user = await UserPG.findByWallet(userAddress.toLowerCase());
                if (user) {
                    await UserPG.update(user.id, {
                        accountType: 'vendor',
                        roles: [...new Set([...user.roles, 'VENDOR'])] // Ensuring unique roles array
                    });
                    
                    await NotificationPG.create({
                        userId: user.id,
                        type: 'account_update',
                        title: 'Cuenta Aprobada como Vendedor',
                        message: 'Tus credenciales de vendedor han sido confirmadas on-chain.',
                        metadata: { txHash }
                    });
                    console.log(`[SyncDaemon] ✅ Promoted ${user.username} to vendor role in PostgreSQL.`);
                }
            });
        } catch (e) {
             console.log('[SyncDaemon] Note: Marketplace Contract events not present or error binding listener', e.message);
        }
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.paymentContract) this.paymentContract.removeAllListeners();
        if (this.marketplaceContract) this.marketplaceContract.removeAllListeners();
        console.log('[SyncDaemon] 🛑 Web3 Synchronization Daemon stopped.');
    }
}

// Auto-start if executed directly
if (require.main === module) {
    const daemon = new SyncDaemon();
    daemon.initialize().then(() => {
        daemon.start();
    }).catch(console.error);
}

module.exports = SyncDaemon;
