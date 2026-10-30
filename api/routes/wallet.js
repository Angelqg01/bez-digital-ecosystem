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

// 503 si el contrato no está desplegado en la cadena (ver contractService); 500 para cualquier otro fallo.
function sendError(res, error, message) {
    if (error?.code === 'CONTRACT_NOT_DEPLOYED') {
        return res.status(503).json({ error: message, code: error.code, details: error.message });
    }
    return res.status(500).json({ error: message, details: error.message });
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
        sendError(res, error, 'Failed to create wallet');
    }
});

// Get user's smart wallets
router.get('/my-wallets', authenticateToken, async (req, res) => {
    try {
        const wallets = await walletService.getUserWallets(req.user.address);
        res.json({ wallets });
    } catch (error) {
        sendError(res, error, 'Failed to fetch wallets');
    }
});

// Ensure the authenticated profile has a primary FIAT-safe wallet
router.post('/ensure-primary', authenticateToken, async (req, res) => {
    try {
        const safeWallet = await walletService.ensureFiatSafeWalletForUser(req.user.userId, req.body || {});
        res.json({ success: true, safeWallet });
    } catch (error) {
        sendError(res, error, 'Failed to ensure primary safe wallet');
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
        sendError(res, error, 'Failed to fetch safe wallet');
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
        sendError(res, error, 'Failed to fetch wallet info');
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
        sendError(res, error, 'Failed to fetch daily limit');
    }
});

// Get full portfolio (EOA + smart wallets)
router.get('/portfolio', authenticateToken, async (req, res) => {
    try {
        const portfolio = await walletService.getWalletPortfolio(req.user.address);
        res.json(portfolio);
    } catch (error) {
        sendError(res, error, 'Failed to fetch portfolio');
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
        sendError(res, error, 'Failed to fetch multisig info');
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
        sendError(res, error, 'Failed to fetch pending txs');
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
        sendError(res, error, 'Failed to fetch paymaster info');
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
        sendError(res, error, 'Failed to fetch security status');
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
        sendError(res, error, 'Failed to fetch audit logs');
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
        sendError(res, error, 'Failed to fetch guardians');
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
        sendError(res, error, 'Failed to fetch trust score');
    }
});

module.exports = router;
