/**
 * BeZhas Ecosystem Adapter
 * 
 * Connects the BeZhas Web Platform with the BeZhas Blockchain L2 Ecosystem.
 * Handles unified registration, on-chain event synchronization, and payment notifications.
 */

const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');
const logger = require('../../utils/logger');

class EcosystemAdapter extends BaseAdapter {
    constructor(config = {}) {
        super({
            platformId: 'ecosystem',
            platformName: 'BeZhas Blockchain Ecosystem',
            ...config,
        });

        // Blockchain API URL (L2)
        this.baseUrl = config.baseUrl || process.env.BLOCKCHAIN_API_URL || 'http://localhost:3001/api';
        this.apiKey = config.apiKey || process.env.ECOSYSTEM_BRIDGE_KEY;
    }

    /**
     * Connect to the Blockchain Ecosystem API
     */
    async connect() {
        try {
            logger.info({ platformId: this.platformId }, 'Connecting to BeZhas Blockchain Ecosystem...');

            // Validate connection/API Key if provided
            if (this.apiKey) {
                // In production, we could do a heartbeat check here
                // await axios.get(`${this.baseUrl}/health`, { headers: { 'X-API-KEY': this.apiKey } });
            }

            this.status = 'connected';
            logger.info({ platformId: this.platformId }, '✅ Connected to BeZhas Ecosystem');
            return { success: true };
        } catch (error) {
            this.status = 'error';
            logger.error({ error: error.message, platformId: this.platformId }, 'Failed to connect to BeZhas Ecosystem');
            throw error;
        }
    }

    /**
     * Sync user registration to the Blockchain Ecosystem
     * @param {object} user - User model instance
     */
    async syncUser(user) {
        try {
            logger.info({ userId: user._id, wallet: user.walletAddress }, 'Syncing user to Ecosystem...');

            const payload = {
                username: user.username,
                email: user.email,
                walletAddress: user.walletAddress,
                accountType: user.accountType,
                roles: user.roles,
                source: 'web3-platform'
            };


            // Call Blockchain API to register/sync user
            try {
                await axios.post(`${this.baseUrl}/users/sync`, payload, {
                    headers: { 'X-API-KEY': this.apiKey }
                });
            } catch (err) {
                logger.error({ error: err.message, userId: user._id }, '❌ Error in axios syncUser to Ecosystem');
                throw err;
            }

            logger.info({ userId: user._id }, '✅ User synced to Ecosystem');
            return { success: true };
        } catch (error) {
            logger.error({ error: error.message, userId: user._id }, '❌ Failed to sync user to Ecosystem');
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle incoming events from the Blockchain (via Indexer)
     * @param {object} event - IndexedEvent instance
     */
    async handleBlockchainEvent(event) {
        const IndexedEvent = require('../../models/IndexedEvent.model');
        logger.info({ event: event.eventName, tx: event.transactionHash }, 'Processing Ecosystem Event');

        const { eventName, decodedArgs } = event;

        try {
            switch (eventName) {
                case 'VIPUpgrade':
                case 'SubscriptionActivated':
                    await this.handleVIPSync(decodedArgs);
                    break;
                case 'UserVerified':
                    await this.handleVerificationSync(decodedArgs);
                    break;
                default:
                    logger.debug({ eventName }, 'Event not requiring ecosystem action');
            }
            return { processed: true };
        } catch (error) {
            logger.error({ error: error.message, eventName }, 'Failed to process Ecosystem event');
            return { processed: false, error: error.message };
        }
    }

    /**
     * Sync VIP status from on-chain event
     */
    async handleVIPSync(args) {
        const User = require('../../models/pg/User');
        const { user: walletAddress, tier } = args;
        if (!walletAddress) return;

        const user = await User.findByWallet(walletAddress.toLowerCase());
        if (user) {
            user.isVIP = true;
            user.vipTier = tier || 'PRO';
            await user.save();
            logger.info({ walletAddress, tier }, 'ECO: Updated user VIP status from on-chain event');
        }
    }

    /**
     * Sync Verification status from on-chain event
     */
    async handleVerificationSync(args) {
        const User = require('../../models/pg/User');
        const { user: walletAddress } = args;
        if (!walletAddress) return;

        const user = await User.findByWallet(walletAddress.toLowerCase());
        if (user) {
            if (!user.roles.includes('VERIFIED_BUSINESS')) {
                user.roles.push('VERIFIED_BUSINESS');
                await user.save();
                logger.info({ walletAddress }, 'ECO: Updated user verification from on-chain event');
            }
        }
    }

    /**
     * Notify Ecosystem about a payment settlement
     */
    async notifyPayment(payment) {
        const Payment = require('../../models/Payment.model');
        try {
            const payload = {
                paymentId: payment.paymentId,
                walletAddress: payment.walletAddress,
                amount: payment.bezAmount,
                type: payment.type,
                txHash: payment.txHash,
                timestamp: payment.completedAt
            };


            try {
                await axios.post(`${this.baseUrl}/payments/notify`, payload, {
                    headers: { 'X-API-KEY': this.apiKey }
                });
            } catch (err) {
                logger.warn({ error: err.message }, 'Failed axios notifyPayment to Ecosystem');
                throw err;
            }

            return { success: true };
        } catch (error) {
            logger.warn({ error: error.message }, 'Failed to notify payment to Ecosystem');
            return { success: false };
        }
    }

    // Required by BaseAdapter but not used for this specific internal bridge
    async syncInventory() { return { success: true }; }
    async pushInventory() { return { success: true }; }
    async handleWebhook() { return { success: true }; }
    transformToBeZhasFormat(data) { return data; }
    transformToExternalFormat(data) { return data; }
}

module.exports = EcosystemAdapter;
