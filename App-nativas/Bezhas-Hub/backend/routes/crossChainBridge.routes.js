/**
 * Cross-Chain Bridge API Routes
 * 
 * Endpoints for cross-chain token transfers between Polygon, Arbitrum, and zkSync
 */

const express = require('express');
const router = express.Router();
const { crossChainBridgeService, CHAIN_CONFIG } = require('../services/crossChainBridge.service');
const { protect: verifyToken } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// Rate limiting for bridge endpoints
const bridgeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: { error: 'Too many requests, please try again later' }
});

router.use(bridgeLimiter);

/**
 * GET /api/v1/crosschain/status
 * Get overall bridge status
 */
router.get('/status', async (req, res) => {
    try {
        const stats = crossChainBridgeService.getStats();
        const chainsStatus = await crossChainBridgeService.getAllChainsStatus();

        res.json({
            success: true,
            service: 'BeZhas Cross-Chain Bridge',
            version: '1.0.0',
            status: stats.isInitialized ? 'operational' : 'initializing',
            stats,
            chains: chainsStatus,
            supportedNetworks: Object.entries(CHAIN_CONFIG).map(([id, config]) => ({
                chainId: Number(id),
                name: config.name,
                isTestnet: config.isTestnet,
                explorer: config.explorer
            })),
            timestamp: new Date()
        });
    } catch (error) {
        logger.error({ error }, 'CrossChain Bridge status error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/crosschain/chains
 * Get all supported chains
 */
router.get('/chains', (req, res) => {
    try {
        const chains = crossChainBridgeService.getAllChainConfigs();
        const stats = crossChainBridgeService.getStats();

        res.json({
            success: true,
            chains: Object.entries(chains).map(([id, config]) => ({
                chainId: Number(id),
                ...config,
                isConnected: stats.connectedChains.includes(Number(id)),
                hasBridgeContract: stats.configuredBridges.includes(Number(id))
            }))
        });
    } catch (error) {
        logger.error({ error }, 'Get chains error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/crosschain/chain/:chainId
 * Get specific chain status
 */
router.get('/chain/:chainId', async (req, res) => {
    try {
        const chainId = parseInt(req.params.chainId);

        if (!CHAIN_CONFIG[chainId]) {
            return res.status(404).json({
                success: false,
                error: 'Chain not supported'
            });
        }

        const status = await crossChainBridgeService.getBridgeStatus(chainId);
        const config = crossChainBridgeService.getChainConfig(chainId);

        res.json({
            success: true,
            chain: {
                ...config,
                chainId,
                ...status
            }
        });
    } catch (error) {
        logger.error({ error, chainId: req.params.chainId }, 'Get chain status error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/crosschain/transfer/:messageId
 * Get transfer status
 */
router.get('/transfer/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;

        if (!messageId || messageId.length !== 66) {
            return res.status(400).json({
                success: false,
                error: 'Invalid message ID format'
            });
        }

        const status = await crossChainBridgeService.getTransferStatus(messageId);

        res.json({
            success: true,
            transfer: status
        });
    } catch (error) {
        logger.error({ error, messageId: req.params.messageId }, 'Get transfer status error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/crosschain/estimate
 * Estimate bridge fee
 */
router.post('/estimate', async (req, res) => {
    try {
        const { sourceChain, destinationChain, amount } = req.body;

        if (!sourceChain || !destinationChain || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sourceChain, destinationChain, amount'
            });
        }

        const estimate = await crossChainBridgeService.estimateBridgeFee(
            sourceChain,
            destinationChain,
            amount
        );

        res.json({
            success: true,
            estimate,
            sourceChain: CHAIN_CONFIG[sourceChain]?.name,
            destinationChain: CHAIN_CONFIG[destinationChain]?.name
        });
    } catch (error) {
        logger.error({ error }, 'Estimate fee error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/crosschain/pending
 * Get pending transfers (requires auth)
 */
router.get('/pending', verifyToken, async (req, res) => {
    try {
        const stats = crossChainBridgeService.getStats();

        res.json({
            success: true,
            pendingCount: stats.pendingTransfersCount,
            message: 'Detailed pending list available in admin dashboard'
        });
    } catch (error) {
        logger.error({ error }, 'Get pending transfers error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/crosschain/relay/:messageId
 * Manually relay a transfer (admin only)
 */
router.post('/relay/:messageId', verifyToken, async (req, res) => {
    try {
        // Check admin role
        if (!req.user?.isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { messageId } = req.params;
        const result = await crossChainBridgeService.relayTransfer(messageId);

        res.json({
            success: true,
            message: 'Relay initiated',
            transfer: result
        });
    } catch (error) {
        logger.error({ error, messageId: req.params.messageId }, 'Relay transfer error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/crosschain/routes
 * Get available bridge routes
 */
router.get('/routes', (req, res) => {
    try {
        const mainnets = [137, 42161, 324];
        const testnets = [80002, 421614, 300];

        const generateRoutes = (chains) => {
            const routes = [];
            for (const from of chains) {
                for (const to of chains) {
                    if (from !== to) {
                        routes.push({
                            from: {
                                chainId: from,
                                name: CHAIN_CONFIG[from]?.name
                            },
                            to: {
                                chainId: to,
                                name: CHAIN_CONFIG[to]?.name
                            }
                        });
                    }
                }
            }
            return routes;
        };

        res.json({
            success: true,
            mainnetRoutes: generateRoutes(mainnets),
            testnetRoutes: generateRoutes(testnets),
            note: 'Cross-network bridging (mainnet ↔ testnet) is not supported'
        });
    } catch (error) {
        logger.error({ error }, 'Get routes error');
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/crosschain/history
 * Get bridge history for authenticated user
 */
router.get('/history', verifyToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const userAddress = req.user?.walletAddress;

        if (!userAddress) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address not found'
            });
        }

        // For now, return placeholder - would integrate with database
        res.json({
            success: true,
            history: [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 0
            },
            message: 'Historical data requires database integration'
        });
    } catch (error) {
        logger.error({ error }, 'Get history error');
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
