/**
 * routes/wallet.js — Wallet system API routes.
 * 
 * Endpoints for SmartWallet (AA), MultiSig (Enterprise), 
 * Paymaster, Security, and Guardian operations.
 */
const { Router } = require('express');
const { param, body, query: qv, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const walletService = require('../services/walletService');

const router = Router();

// Validation helper
function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return false;
    }
    return true;
}

// ═══════════════════════════════════════════════
//  SMART WALLET (Account Abstraction)
// ═══════════════════════════════════════════════

// Create a new smart wallet
router.post('/create', authenticateToken, [
    body('guardian').optional().isEthereumAddress().withMessage('Invalid guardian address'),
    body('dailyLimit').optional().isFloat({ min: 0 }).withMessage('Invalid daily limit'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const result = await walletService.createSmartWallet(
            req.user.address,
            req.body.guardian,
            req.body.dailyLimit || 0,
            req.body.salt
        );
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create wallet', details: error.message });
    }
});

// Get user's smart wallets
router.get('/my-wallets', authenticateToken, async (req, res) => {
    try {
        const wallets = await walletService.getUserWallets(req.user.address);
        res.json({ wallets });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallets', details: error.message });
    }
});

// Ensure the authenticated profile has a primary FIAT-safe wallet
router.post('/ensure-primary', authenticateToken, async (req, res) => {
    try {
        const safeWallet = await walletService.ensureFiatSafeWalletForUser(req.user.userId, req.body || {});
        res.json({ success: true, safeWallet });
    } catch (error) {
        res.status(500).json({ error: 'Failed to ensure primary safe wallet', details: error.message });
    }
});

// Get authenticated user's primary safe wallet and balance
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const safeWallet = await walletService.ensureFiatSafeWalletForUser(req.user.userId);
        const address = safeWallet.smartWalletAddress || safeWallet.ownerAddress;
        const balance = await walletService.getBalance(address);
        res.json({ success: true, safeWallet, balance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch safe wallet', details: error.message });
    }
});

// Get smart wallet details
router.get('/info/:address', [
    param('address').isEthereumAddress().withMessage('Invalid wallet address'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const info = await walletService.getSmartWalletInfo(req.params.address);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallet info', details: error.message });
    }
});

// Get remaining daily limit
router.get('/daily-limit/:address', [
    param('address').isEthereumAddress().withMessage('Invalid wallet address'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const remaining = await walletService.getRemainingDailyLimit(req.params.address);
        res.json({ remainingDailyLimit: remaining });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch daily limit', details: error.message });
    }
});

// Get full portfolio (EOA + smart wallets)
router.get('/portfolio', authenticateToken, async (req, res) => {
    try {
        const portfolio = await walletService.getWalletPortfolio(req.user.address);
        res.json(portfolio);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch portfolio', details: error.message });
    }
});

// ═══════════════════════════════════════════════
//  MULTI-SIG WALLET (Enterprise)
// ═══════════════════════════════════════════════

router.get('/multisig/:address', [
    param('address').isEthereumAddress().withMessage('Invalid multisig address'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const info = await walletService.getMultiSigInfo(req.params.address);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch multisig info', details: error.message });
    }
});

router.get('/multisig/:address/pending', [
    param('address').isEthereumAddress().withMessage('Invalid multisig address'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const pending = await walletService.getMultiSigPendingTxs(req.params.address);
        res.json({ pendingTransactions: pending });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending txs', details: error.message });
    }
});

// ═══════════════════════════════════════════════
//  PAYMASTER (Gas Sponsorship)
// ═══════════════════════════════════════════════

router.get('/paymaster/:enterprise', authenticateToken, [
    param('enterprise').isEthereumAddress().withMessage('Invalid enterprise address'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const info = await walletService.getPaymasterEnterpriseInfo(req.params.enterprise);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch paymaster info', details: error.message });
    }
});

// ═══════════════════════════════════════════════
//  SECURITY MODULE
// ═══════════════════════════════════════════════

router.get('/security/status', authenticateToken, async (req, res) => {
    try {
        const status = await walletService.getSecurityStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch security status', details: error.message });
    }
});

router.get('/security/audit-log', authenticateToken, [
    qv('count').optional().isInt({ min: 1, max: 100 }).withMessage('Count must be 1-100'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const count = parseInt(req.query.count) || 20;
        const logs = await walletService.getRecentAuditLogs(count);
        res.json({ auditLogs: logs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs', details: error.message });
    }
});

// ═══════════════════════════════════════════════
//  WALLET GUARDIAN (Social Recovery)
// ═══════════════════════════════════════════════

router.get('/guardians/:wallet', [
    param('wallet').isEthereumAddress().withMessage('Invalid wallet address'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const guardians = await walletService.getWalletGuardians(req.params.wallet);
        res.json({ guardians });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch guardians', details: error.message });
    }
});

router.get('/guardian-score/:guardian', [
    param('guardian').isEthereumAddress().withMessage('Invalid guardian address'),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const score = await walletService.getGuardianTrustScore(req.params.guardian);
        res.json({ guardian: req.params.guardian, trustScore: score });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trust score', details: error.message });
    }
});

module.exports = router;
