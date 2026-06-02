const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Treasury Configuration Schema
const treasuryConfigSchema = new mongoose.Schema({
    // Wallet addresses
    treasuryWalletAddress: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^0x[a-fA-F0-9]{40}$/.test(v);
            },
            message: 'Invalid Ethereum address'
        }
    },

    // Bank account info (encrypted)
    bankAccount: {
        accountName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        bankName: { type: String, required: true },
        swiftCode: String,
        iban: String,
        routingNumber: String,
        country: { type: String, required: true }
    },

    // PayPal/Stripe for fiat on-ramp
    paymentProcessors: {
        stripe: {
            enabled: { type: Boolean, default: false },
            accountId: String,
            publishableKey: String
        },
        paypal: {
            enabled: { type: Boolean, default: false },
            email: String,
            merchantId: String
        }
    },

    // Treasury stats (auto-updated)
    stats: {
        totalEthReceived: { type: Number, default: 0 },
        totalEthWithdrawn: { type: Number, default: 0 },
        totalTokensSold: { type: Number, default: 0 },
        totalFiatReceived: { type: Number, default: 0 },
        lastUpdated: { type: Date, default: Date.now }
    },

    // Withdrawal limits
    limits: {
        dailyEthLimit: { type: Number, default: 10 }, // ETH
        monthlyEthLimit: { type: Number, default: 100 }, // ETH
        requireMultiSig: { type: Boolean, default: true },
        minSignatures: { type: Number, default: 2 }
    },

    // Authorized signers for multi-sig
    authorizedSigners: [{
        address: String,
        name: String,
        email: String,
        role: { type: String, enum: ['admin', 'treasurer', 'operator'] },
        addedAt: { type: Date, default: Date.now }
    }],

    // Audit log
    auditLog: [{
        action: String,
        performedBy: String,
        timestamp: { type: Date, default: Date.now },
        details: mongoose.Schema.Types.Mixed
    }],

    updatedAt: { type: Date, default: Date.now },
    updatedBy: String
}, { timestamps: true });

const TreasuryConfig = mongoose.model('TreasuryConfig', treasuryConfigSchema);

// Withdrawal Request Schema
const withdrawalRequestSchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['ETH', 'BEZ', 'USD'], required: true },
    destination: {
        type: { type: String, enum: ['wallet', 'bank'], required: true },
        address: String, // For wallet
        bankAccount: mongoose.Schema.Types.Mixed // For bank
    },
    requestedBy: { type: String, required: true },
    reason: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed', 'failed'],
        default: 'pending'
    },
    signatures: [{
        signer: String,
        signedAt: Date,
        signature: String
    }],
    requiredSignatures: { type: Number, default: 2 },
    txHash: String, // Blockchain transaction hash
    completedAt: Date,
    notes: String
}, { timestamps: true });

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

// ==================== ROUTES ====================

// Get treasury configuration
router.get('/config', async (req, res) => {
    try {
        let config = await TreasuryConfig.findOne();

        if (!config) {
            // Create default config
            config = new TreasuryConfig({
                treasuryWalletAddress: '0x0000000000000000000000000000000000000000',
                bankAccount: {
                    accountName: 'BeZhas Treasury',
                    accountNumber: '****',
                    bankName: 'Not configured',
                    country: 'US'
                }
            });
            await config.save();
        }

        // Don't send sensitive bank info to frontend
        const safeConfig = {
            ...config.toObject(),
            bankAccount: {
                accountName: config.bankAccount.accountName,
                accountNumber: config.bankAccount.accountNumber.replace(/\d(?=\d{4})/g, '*'),
                bankName: config.bankAccount.bankName,
                country: config.bankAccount.country
            }
        };

        res.json(safeConfig);
    } catch (error) {
        console.error('Error fetching treasury config:', error);
        res.status(500).json({ error: 'Failed to fetch treasury configuration' });
    }
});

// Update treasury configuration (admin only)
router.put('/config', async (req, res) => {
    try {
        const {
            treasuryWalletAddress,
            bankAccount,
            paymentProcessors,
            limits,
            authorizedSigners
        } = req.body;

        let config = await TreasuryConfig.findOne();

        if (!config) {
            config = new TreasuryConfig();
        }

        if (treasuryWalletAddress) config.treasuryWalletAddress = treasuryWalletAddress;
        if (bankAccount) config.bankAccount = { ...config.bankAccount, ...bankAccount };
        if (paymentProcessors) config.paymentProcessors = { ...config.paymentProcessors, ...paymentProcessors };
        if (limits) config.limits = { ...config.limits, ...limits };
        if (authorizedSigners) config.authorizedSigners = authorizedSigners;

        config.updatedBy = req.user?.address || 'admin';
        config.updatedAt = new Date();

        // Add to audit log
        config.auditLog.push({
            action: 'UPDATE_CONFIG',
            performedBy: req.user?.address || 'admin',
            details: { changes: req.body }
        });

        await config.save();

        res.json({ message: 'Treasury configuration updated successfully', config });
    } catch (error) {
        console.error('Error updating treasury config:', error);
        res.status(500).json({ error: 'Failed to update treasury configuration' });
    }
});

// Get treasury stats from blockchain
router.get('/stats', async (req, res) => {
    try {
        // This would connect to your smart contract
        // For now, return mock data
        const stats = {
            currentEthBalance: 50.5,
            totalReceived: 100.25,
            totalWithdrawn: 45.75,
            availableBalance: 49.5,
            fees: 1.0,
            tokensSold: 50000,
            ethPrice: 2000, // USD
            bezPrice: 0.001 // ETH
        };

        res.json(stats);
    } catch (error) {
        console.error('Error fetching treasury stats:', error);
        res.status(500).json({ error: 'Failed to fetch treasury stats' });
    }
});

// Get withdrawal requests
router.get('/withdrawals', async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = status ? { status } : {};

        const withdrawals = await WithdrawalRequest.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await WithdrawalRequest.countDocuments(query);

        res.json({
            withdrawals,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        res.status(500).json({ error: 'Failed to fetch withdrawal requests' });
    }
});

// Create withdrawal request
router.post('/withdrawals', async (req, res) => {
    try {
        const { amount, currency, destination, reason } = req.body;

        // Validate amount
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const config = await TreasuryConfig.findOne();

        // Check daily limit
        if (currency === 'ETH' && amount > config.limits.dailyEthLimit) {
            return res.status(400).json({
                error: `Amount exceeds daily limit of ${config.limits.dailyEthLimit} ETH`
            });
        }

        const withdrawal = new WithdrawalRequest({
            amount,
            currency,
            destination,
            reason,
            requestedBy: req.user?.address || 'admin',
            requiredSignatures: config.limits.minSignatures
        });

        await withdrawal.save();

        // Add to audit log
        config.auditLog.push({
            action: 'CREATE_WITHDRAWAL_REQUEST',
            performedBy: req.user?.address || 'admin',
            details: { withdrawalId: withdrawal._id, amount, currency }
        });
        await config.save();

        res.json({ message: 'Withdrawal request created', withdrawal });
    } catch (error) {
        console.error('Error creating withdrawal:', error);
        res.status(500).json({ error: 'Failed to create withdrawal request' });
    }
});

// Sign withdrawal request
router.post('/withdrawals/:id/sign', async (req, res) => {
    try {
        const { id } = req.params;
        const { signature } = req.body;
        const signerAddress = req.user?.address || 'admin';

        const withdrawal = await WithdrawalRequest.findById(id);

        if (!withdrawal) {
            return res.status(404).json({ error: 'Withdrawal not found' });
        }

        if (withdrawal.status !== 'pending') {
            return res.status(400).json({ error: 'Withdrawal not pending' });
        }

        // Check if already signed
        if (withdrawal.signatures.some(s => s.signer === signerAddress)) {
            return res.status(400).json({ error: 'Already signed' });
        }

        withdrawal.signatures.push({
            signer: signerAddress,
            signedAt: new Date(),
            signature
        });

        // Check if enough signatures
        if (withdrawal.signatures.length >= withdrawal.requiredSignatures) {
            withdrawal.status = 'approved';
        }

        await withdrawal.save();

        res.json({ message: 'Withdrawal signed', withdrawal });
    } catch (error) {
        console.error('Error signing withdrawal:', error);
        res.status(500).json({ error: 'Failed to sign withdrawal' });
    }
});

// Execute withdrawal (after approval)
router.post('/withdrawals/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;
        const { txHash } = req.body;

        const withdrawal = await WithdrawalRequest.findById(id);

        if (!withdrawal) {
            return res.status(404).json({ error: 'Withdrawal not found' });
        }

        if (withdrawal.status !== 'approved') {
            return res.status(400).json({ error: 'Withdrawal not approved' });
        }

        withdrawal.status = 'completed';
        withdrawal.txHash = txHash;
        withdrawal.completedAt = new Date();

        await withdrawal.save();

        // Update treasury stats
        const config = await TreasuryConfig.findOne();
        if (withdrawal.currency === 'ETH') {
            config.stats.totalEthWithdrawn += withdrawal.amount;
            config.stats.lastUpdated = new Date();
        }

        config.auditLog.push({
            action: 'EXECUTE_WITHDRAWAL',
            performedBy: req.user?.address || 'admin',
            details: { withdrawalId: id, txHash }
        });

        await config.save();

        res.json({ message: 'Withdrawal executed', withdrawal });
    } catch (error) {
        console.error('Error executing withdrawal:', error);
        res.status(500).json({ error: 'Failed to execute withdrawal' });
    }
});

// Get audit log
router.get('/audit-log', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        const config = await TreasuryConfig.findOne();

        if (!config) {
            return res.json({ logs: [], total: 0 });
        }

        const logs = config.auditLog
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice((page - 1) * limit, page * limit);

        res.json({
            logs,
            total: config.auditLog.length,
            page: parseInt(page),
            pages: Math.ceil(config.auditLog.length / limit)
        });
    } catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

module.exports = router;
