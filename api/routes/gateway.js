/**
 * routes/gateway.js — BeZhas Unified Gateway
 * 
 * Central entry point for all cross-app API calls.
 * External apps (DeFi, App, Web3) authenticate via API key + optional JWT,
 * then access Core services through scoped endpoints.
 * 
 * Route groups:
 *   /api/gateway/v1/sso/*        — SSO login, refresh, logout
 *   /api/gateway/v1/wallet/*     — Wallet balances, transfers
 *   /api/gateway/v1/staking/*    — Staking positions, stake/unstake
 *   /api/gateway/v1/farming/*    — LP farming positions
 *   /api/gateway/v1/governance/* — Proposals, voting
 *   /api/gateway/v1/bridge/*     — Cross-chain bridge operations
 *   /api/gateway/v1/treasury/*   — DAO treasury data
 *   /api/gateway/v1/token/*      — Token info, balances, distribution
 *   /api/gateway/v1/contracts/*  — Contract ABIs, addresses, calls
 *   /api/gateway/v1/subscription/* — Plan, quote, SubApp entitlements
 *   /api/gateway/v1/webhooks/*   — Outbound signed payment events (register, deliveries, retry)
 */
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticateGateway, requireScope, authenticateSSOToken } = require('../middleware/gateway-auth');
const ssoService = require('../services/ssoService');
const walletService = require('../services/walletService');
const contractService = require('../services/contractService');
const { query } = require('../db/pool');
const bcrypt = require('bcryptjs');
const { STRIPE_PAYMENT_LINKS, getStripePaymentLink } = require('../config/stripe-payment-links');
const { BANK_TRANSFER_DETAILS, buildBankTransferInstructions } = require('../config/bank-transfer-details');
const { TOKENOMICS_FEE, calculateFeeBreakdown } = require('../config/tokenomics');
const { PLANS, CORE_SUBAPPS, ACTIVATABLE_SUBAPPS, calculateSubscription } = require('../config/plans');
const { settlePayment, refundPayment } = require('../services/paymentSettlement');
const complianceGate = require('../services/complianceGate');
const paymentWebhooks = require('../services/paymentWebhooks');
const { TREASURY: SETTLEMENT_TREASURY } = require('../services/bezSettlementWatcher');
const logger = require('pino')({ level: 'info', name: 'gateway' });

const router = Router();

// BEZ Token resolution: v1 (LIVE on BSC) vs v2 (not deployed)
const BEZ_COIN_V1_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const PRODUCTION_CHAINS = [56, 97];
const PLATFORM_FEE_BPS = TOKENOMICS_FEE.platformFeeBps;
function resolveBEZToken(chainId) {
    return PRODUCTION_CHAINS.includes(chainId) ? 'BEZCoin' : 'BEZCoinV2';
}

async function resolvePrimaryWallet(req, explicitAddress) {
    if (explicitAddress) return explicitAddress;
    if (!req.user?.userId) return null;
    const safeWallet = await walletService.ensureFiatSafeWalletForUser(req.user.userId);
    return safeWallet.smartWalletAddress || safeWallet.ownerAddress;
}

/**
 * Rebuild the /payments/buy response from a stored order row so an
 * Idempotency-Key retry returns the SAME order (never a duplicate).
 */
function buildBuyReplayResponse(row) {
    let meta = {};
    try { meta = JSON.parse(row.note) || {}; } catch (_) { /* note may be null */ }
    const stripeLink = meta.provider === 'stripe_payment_link'
        ? getStripePaymentLink(meta.stripeUseCase || 'token_purchase')
        : null;
    const bankTransfer = meta.provider === 'bank_transfer';
    return {
        success: true,
        idempotent: true,
        paymentId: row.id,
        status: row.status,
        provider: meta.provider || row.payment_method,
        checkoutUrl: stripeLink?.url,
        bankTransfer: bankTransfer ? buildBankTransferInstructions(`BEZ-${row.id}`) : undefined,
        walletAddress: row.wallet_address,
        amountUSD: parseFloat(row.amount_usd),
        platformFeeUSD: parseFloat(row.platform_fee_usd),
        platformFeeBps: PLATFORM_FEE_BPS,
        stripeUseCase: stripeLink?.id,
        stripeLabel: stripeLink?.label,
        nextAction: stripeLink
            ? 'redirect_to_checkout'
            : bankTransfer
                ? 'display_bank_transfer_instructions'
                : 'await_payment_confirmation',
    };
}

const requirePaymentSettlementKey = (req, res, next) => {
    const key = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY || (process.env.NODE_ENV !== 'production' ? 'dev-internal-key' : null);
    if (!expected || !key || key !== expected) {
        return res.status(401).json({ error: 'Internal settlement auth required' });
    }
    next();
};

// Validation helper
const validate = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return false;
    }
    return true;
};

async function buildUnsignedContractTx(contractName, method, args = [], value = '0', chainId) {
    const { ethers } = require('ethers');
    const address = await contractService.getContractAddress(contractName, chainId);
    if (!address) return null;
    const abi = contractService.loadABI(contractName);
    const iface = new ethers.Interface(abi);
    return {
        to: address,
        data: iface.encodeFunctionData(method, args),
        value,
        chainId: chainId || parseInt(process.env.BEZHAS_CHAIN_ID || '31337'),
        contract: contractName,
        method,
    };
}

// ═══════════════════════════════════════════════════════════
//  SSO — Single Sign-On (no API key required, only wallet signature)
// ═══════════════════════════════════════════════════════════

/**
 * POST /sso/login — Wallet-based login that returns cross-app JWT.
 */
router.post('/sso/login', [
    body('walletAddress').isEthereumAddress(),
    body('signature').isLength({ min: 1 }),
    body('message').isLength({ min: 1 }),
    body('appOrigin').isIn(['core', 'defi', 'app', 'web3']),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { ethers } = require('ethers');
        const { walletAddress, signature, message, appOrigin } = req.body;

        // Verify wallet signature
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
            return res.status(401).json({ error: 'Invalid wallet signature' });
        }

        // Issue SSO tokens
        const result = await ssoService.issueToken({ walletAddress, appOrigin });
        logger.info({ walletAddress, appOrigin }, 'SSO login successful');
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error({ error: error.message }, 'SSO login failed');
        res.status(500).json({ error: 'Login failed' });
    }
});

router.post('/sso/fiat/register', [
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('username').optional().isLength({ min: 3, max: 40 }),
    body('appOrigin').isIn(['core', 'defi', 'app', 'web3']),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const crypto = require('crypto');
        const email = String(req.body.email).trim().toLowerCase();
        const provisionalAddress = `0x${crypto.createHash('sha256').update(`fiat:${email}:${Date.now()}`).digest('hex').slice(0, 40)}`;
        const passwordHash = await bcrypt.hash(req.body.password, 12);

        const { rows } = await query(
            `INSERT INTO users (wallet_address, primary_wallet_address, username, email, password_hash,
                                auth_type, custody_mode, last_login)
             VALUES ($1, $1, $2, $3, $4, 'fiat', 'managed', NOW())
             RETURNING id`,
            [provisionalAddress.toLowerCase(), req.body.username || null, email, passwordHash]
        );

        const safeWallet = await walletService.ensureFiatSafeWalletForUser(rows[0].id);
        const result = await ssoService.issueToken({
            walletAddress: safeWallet.ownerAddress,
            appOrigin: req.body.appOrigin,
        });

        res.status(201).json({ success: true, ...result, safeWallet });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Email already registered' });
        logger.error({ error: error.message }, 'FIAT SSO registration failed');
        res.status(500).json({ error: 'FIAT registration failed' });
    }
});

router.post('/sso/fiat/login', [
    body('email').isEmail(),
    body('password').isLength({ min: 1 }),
    body('appOrigin').isIn(['core', 'defi', 'app', 'web3']),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const email = String(req.body.email).trim().toLowerCase();
        const { rows } = await query(
            `SELECT id, password_hash
             FROM users
             WHERE LOWER(email) = $1 AND auth_type IN ('fiat', 'hybrid')
             LIMIT 1`,
            [email]
        );
        if (rows.length === 0 || !rows[0].password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const ok = await bcrypt.compare(req.body.password, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

        const safeWallet = await walletService.ensureFiatSafeWalletForUser(rows[0].id);
        const result = await ssoService.issueToken({
            walletAddress: safeWallet.ownerAddress,
            appOrigin: req.body.appOrigin,
        });

        res.json({ success: true, ...result, safeWallet });
    } catch (error) {
        logger.error({ error: error.message }, 'FIAT SSO login failed');
        res.status(500).json({ error: 'FIAT login failed' });
    }
});

/**
 * POST /sso/refresh — Refresh SSO token (supports cross-app navigation).
 */
router.post('/sso/refresh', [
    body('refreshToken').isLength({ min: 1 }),
    body('appOrigin').optional().isIn(['core', 'defi', 'app', 'web3']),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const result = await ssoService.refreshToken(req.body.refreshToken, req.body.appOrigin);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

/**
 * POST /sso/logout — Revoke all sessions for the user.
 */
router.post('/sso/logout', authenticateSSOToken, async (req, res) => {
    try {
        await ssoService.revokeAllSessions(req.user.userId);
        res.json({ success: true, message: 'All sessions revoked' });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

/**
 * GET /sso/me — Get current user info from SSO token.
 */
router.get('/sso/me', authenticateSSOToken, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT id, wallet_address, username, email, role, avatar_url, created_at, last_login
             FROM users WHERE id = $1`,
            [req.user.userId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, user: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ═══════════════════════════════════════════════════════════
//  WALLET — Balance, transfers, history
// ═══════════════════════════════════════════════════════════

router.get('/wallet/balance/:address', authenticateGateway, requireScope('wallet'), async (req, res) => {
    try {
        const balance = await walletService.getBalance(req.params.address);
        res.json({ success: true, ...balance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

router.get('/wallet/me', authenticateGateway, requireScope('wallet'), async (req, res) => {
    try {
        if (!req.user?.userId) {
            return res.status(400).json({ error: 'User JWT required for /wallet/me' });
        }
        const safeWallet = await walletService.ensureFiatSafeWalletForUser(req.user.userId);
        const address = safeWallet.smartWalletAddress || safeWallet.ownerAddress;
        const balance = await walletService.getBalance(address);
        res.json({ success: true, safeWallet, balance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get user wallet', message: error.message });
    }
});

router.get('/wallet/history/:address', authenticateGateway, requireScope('wallet'), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const offset = parseInt(req.query.offset) || 0;
        const { rows } = await query(
            `SELECT tx_hash, from_address, to_address, value_wei, status, created_at
             FROM transactions
             WHERE from_address = $1 OR to_address = $1
             ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
            [req.params.address.toLowerCase(), limit, offset]
        );
        res.json({ success: true, transactions: rows, limit, offset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get transaction history' });
    }
});

// ═══════════════════════════════════════════════════════════
//  STAKING — Positions, stake, unstake, rewards
// ═══════════════════════════════════════════════════════════

router.get('/staking/positions/:address', authenticateGateway, requireScope('staking'), async (req, res) => {
    try {
        const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        try {
            const info = await contractService.getStakingInfo(req.params.address);
            const hasPosition = parseFloat(info.stakedAmount || '0') > 0 || parseFloat(info.rewards || '0') > 0;
            return res.json({
                success: true,
                source: 'onchain',
                chainId,
                positions: hasPosition ? [{
                    positionId: `${chainId}:${req.params.address.toLowerCase()}:staking`,
                    amount: info.stakedAmount,
                    rewards: info.rewards,
                    baseEarned: info.baseEarned,
                    boostBps: info.boostBps,
                    validatorTier: info.validatorTier,
                    isValidator: info.isValidator,
                    startDate: null,
                    status: 'active',
                }] : [],
                totalStaked: info.stakedAmount,
                totalRewards: info.rewards,
            });
        } catch (onchainError) {
            logger.warn({ error: onchainError.message }, 'Staking on-chain read unavailable, falling back to DB');
        }

        const { rows } = await query(
            `SELECT sp.*, u.username FROM staking_positions sp
             LEFT JOIN users u ON sp.user_id = u.id
             WHERE sp.wallet_address = $1 AND sp.is_active = TRUE
             ORDER BY sp.staked_at DESC`,
            [req.params.address.toLowerCase()]
        );
        const totalStaked = rows.reduce((sum, r) => sum + parseFloat(r.amount_staked || 0), 0);
        const totalRewards = rows.reduce((sum, r) => sum + parseFloat(r.rewards_earned || 0), 0);
        res.json({ success: true, positions: rows, totalStaked, totalRewards });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get staking positions' });
    }
});

router.post('/staking/stake', authenticateGateway, requireScope('staking'), [
    body('walletAddress').isEthereumAddress(),
    body('amount').isFloat({ min: 0.001 }),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { walletAddress, amount } = req.body;
        const { ethers } = require('ethers');
        const txRequest = await buildUnsignedContractTx('StakingPool', 'stake', [ethers.parseEther(String(amount))], '0', parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337'));

        if (txRequest) {
            return res.json({
                success: true,
                mode: 'onchain',
                walletAddress,
                amount,
                txRequest,
                requiredApproval: {
                    contract: resolveBEZToken(parseInt(process.env.BEZHAS_CHAIN_ID || '31337')),
                    spender: txRequest.to,
                    amount,
                },
                nextAction: 'wallet_sign_and_send',
            });
        }

        const { rows: userRows } = await query(
            'SELECT id FROM users WHERE wallet_address = $1', [walletAddress.toLowerCase()]
        );
        const userId = userRows.length > 0 ? userRows[0].id : null;

        const { rows } = await query(
            `INSERT INTO staking_positions (user_id, wallet_address, amount_staked)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [userId, walletAddress.toLowerCase(), amount]
        );

        logger.info({ walletAddress, amount }, 'Staking position created via gateway');
        res.json({ success: true, position: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Staking failed' });
    }
});

router.post('/staking/unstake', authenticateGateway, requireScope('staking'), [
    body('positionId').optional().isString(),
    body('amount').optional().isFloat({ min: 0.001 }),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { ethers } = require('ethers');
        if (req.body.amount) {
            const txRequest = await buildUnsignedContractTx('StakingPool', 'withdraw', [ethers.parseEther(String(req.body.amount))], '0', parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337'));
            if (txRequest) {
                return res.json({ success: true, mode: 'onchain', txRequest, nextAction: 'wallet_sign_and_send' });
            }
        }

        const { rows } = await query(
            `UPDATE staking_positions 
             SET is_active = FALSE, unstaked_at = NOW()
             WHERE id = $1 AND is_active = TRUE
             RETURNING *`,
            [req.body.positionId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Position not found or already unstaked' });
        res.json({ success: true, position: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Unstaking failed' });
    }
});

// ═══════════════════════════════════════════════════════════
//  FARMING — LP positions
// ═══════════════════════════════════════════════════════════

router.get('/farming/positions/:address', authenticateGateway, requireScope('farming'), async (req, res) => {
    try {
        const poolId = Number.isFinite(parseInt(req.query.poolId)) ? parseInt(req.query.poolId) : 0;
        try {
            const [position, pool] = await Promise.all([
                contractService.getFarmingInfo(req.params.address, poolId),
                contractService.getFarmingPool(poolId).catch(() => null),
            ]);
            const hasPosition = parseFloat(position.lpAmount || '0') > 0 || parseFloat(position.pendingRewards || '0') > 0;
            return res.json({
                success: true,
                source: 'onchain',
                positions: hasPosition ? [{
                    poolId: String(poolId),
                    poolName: pool?.isLP ? `LP Pool #${poolId}` : `BEZ Pool #${poolId}`,
                    deposited: position.lpAmount,
                    rewards: position.pendingRewards,
                    apy: null,
                    multiplier: position.multiplier,
                    lockEndTimestamp: position.lockEndTimestamp,
                    lpToken: pool?.lpToken,
                }] : [],
            });
        } catch (onchainError) {
            logger.warn({ error: onchainError.message }, 'Farming on-chain read unavailable, falling back to DB');
        }

        const { rows } = await query(
            `SELECT * FROM farming_positions
             WHERE wallet_address = $1 AND is_active = TRUE
             ORDER BY deposited_at DESC`,
            [req.params.address.toLowerCase()]
        );
        res.json({ success: true, positions: rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get farming positions' });
    }
});

router.post('/farming/deposit', authenticateGateway, requireScope('farming'), [
    body('walletAddress').isEthereumAddress(),
    body('poolId').isInt({ min: 0 }),
    body('amount').isFloat({ min: 0.001 }),
    body('lockDays').optional().isInt({ min: 0 }),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { walletAddress, poolId, amount } = req.body;
        const { ethers } = require('ethers');
        const txRequest = await buildUnsignedContractTx(
            'LiquidityFarming',
            'deposit',
            [poolId, ethers.parseEther(String(amount)), parseInt(req.body.lockDays || 0)],
            '0',
            parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337')
        );
        if (txRequest) {
            return res.json({
                success: true,
                mode: 'onchain',
                walletAddress,
                poolId,
                amount,
                txRequest,
                nextAction: 'wallet_sign_and_send',
            });
        }

        const { rows: userRows } = await query(
            'SELECT id FROM users WHERE wallet_address = $1', [walletAddress.toLowerCase()]
        );

        const { rows } = await query(
            `INSERT INTO farming_positions (user_id, wallet_address, pool_id, lp_amount)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userRows[0]?.id || null, walletAddress.toLowerCase(), poolId, amount]
        );
        res.json({ success: true, position: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Farming deposit failed' });
    }
});

// ═══════════════════════════════════════════════════════════
//  GOVERNANCE — Proposals, voting
// ═══════════════════════════════════════════════════════════

router.get('/governance/proposals', authenticateGateway, requireScope('governance'), async (req, res) => {
    try {
        const status = req.query.status || 'active';
        const { rows } = await query(
            `SELECT * FROM governance_proposals 
             WHERE status = $1 
             ORDER BY created_at DESC 
             LIMIT $2 OFFSET $3`,
            [status, Math.min(parseInt(req.query.limit) || 20, 50), parseInt(req.query.offset) || 0]
        );
        res.json({ success: true, proposals: rows });
    } catch (error) {
        // Table may not exist yet — return empty
        res.json({ success: true, proposals: [], note: 'Governance module pending deployment' });
    }
});

router.post('/governance/vote', authenticateGateway, requireScope('governance'), [
    body('proposalId').isString().notEmpty(),
    body('walletAddress').isEthereumAddress(),
    body('vote').isIn(['for', 'against', 'abstain']),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { proposalId, walletAddress, vote } = req.body;
        const support = vote === 'for' ? 1 : vote === 'against' ? 0 : 2;
        const chainId = parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        if (/^\d+$/.test(String(proposalId))) {
            const txRequest = await buildUnsignedContractTx(
                'GovernanceSystem',
                'castVote',
                [BigInt(proposalId), support],
                '0',
                chainId
            );
            if (txRequest) {
                return res.json({
                    success: true,
                    mode: 'onchain',
                    txRequest,
                    nextAction: 'wallet_sign_and_send',
                });
            }
        }

        const { rows } = await query(
            `INSERT INTO governance_votes (proposal_id, voter_address, vote)
             VALUES ($1, $2, $3)
             ON CONFLICT (proposal_id, voter_address) DO UPDATE SET vote = $3, updated_at = NOW()
             RETURNING *`,
            [proposalId, walletAddress.toLowerCase(), vote]
        );
        res.json({ success: true, vote: rows[0] });
    } catch (error) {
        res.json({ success: false, note: 'Governance voting module pending deployment' });
    }
});

// ═══════════════════════════════════════════════════════════
//  BRIDGE — Cross-chain transfers
// ═══════════════════════════════════════════════════════════

router.get('/bridge/transfers/:address', authenticateGateway, requireScope('bridge'), async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT * FROM bridge_transfers
             WHERE sender = $1 OR recipient = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [req.params.address.toLowerCase(), Math.min(parseInt(req.query.limit) || 20, 50)]
        );
        res.json({ success: true, transfers: rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get bridge transfers' });
    }
});

router.post('/bridge/initiate', authenticateGateway, requireScope('bridge'), [
    body('sender').isEthereumAddress(),
    body('recipient').isEthereumAddress(),
    body('fromChainId').isInt(),
    body('toChainId').isInt(),
    body('tokenAddress').isEthereumAddress(),
    body('amount').isFloat({ min: 0.0001 }),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { sender, recipient, fromChainId, toChainId, tokenAddress, amount } = req.body;
        const { rows } = await query(
            `INSERT INTO bridge_transfers (from_chain_id, to_chain_id, sender, recipient, token_address, amount, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'initiated')
             RETURNING *`,
            [fromChainId, toChainId, sender.toLowerCase(), recipient.toLowerCase(), tokenAddress.toLowerCase(), amount]
        );

        logger.info({ sender, fromChainId, toChainId, amount }, 'Bridge transfer initiated via gateway');
        res.json({ success: true, transfer: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Bridge initiation failed' });
    }
});

router.get('/bridge/status/:transferId', authenticateGateway, requireScope('bridge'), async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT * FROM bridge_transfers WHERE id = $1',
            [req.params.transferId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Transfer not found' });
        res.json({ success: true, transfer: rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get bridge status' });
    }
});

/**
 * GET /bridge/fees — Estimate bridge fees for a given transfer.
 */
router.get('/bridge/fees', authenticateGateway, requireScope('bridge'), async (req, res) => {
    try {
        const fromChainId = parseInt(req.query.from || req.query.fromChainId) || 0;
        const toChainId = parseInt(req.query.to || req.query.toChainId) || 0;
        const amount = parseFloat(req.query.amount) || 0;

        if (!fromChainId || !toChainId || amount <= 0) {
            return res.status(400).json({ error: 'Missing from, to, or amount query params' });
        }

        // Fee model: 0.1% bridge fee + gas estimates per chain
        const bridgeFeePct = 0.001;
        const bridgeFee = (amount * bridgeFeePct).toFixed(6);

        // Estimated gas costs (USD) per chain — will be replaced by live oracle data
        const gasEstimates = {
            1: 14.50, 11155111: 0.02, 2708: 0.05, 137: 0.08, 42161: 0.12, 43114: 0.15,
        };
        const gasFeeOrigin = gasEstimates[fromChainId] || 0.10;
        const gasFeeDestination = gasEstimates[toChainId] || 0.10;
        const totalFeeUSD = (parseFloat(bridgeFee) * 0.10 + gasFeeOrigin + gasFeeDestination).toFixed(2);

        // Time estimates (minutes) per route
        const isL2toL2 = fromChainId !== 1 && toChainId !== 1;
        const estimatedTimeMinutes = isL2toL2 ? 3 : fromChainId === 1 ? 12 : 7;

        const chainNames = {
            1: 'Ethereum', 11155111: 'Sepolia', 2708: 'BeZhas', 137: 'Polygon', 42161: 'Arbitrum', 43114: 'Avalanche',
        };
        const route = `${chainNames[fromChainId] || 'Unknown'} → ${chainNames[toChainId] || 'Unknown'}`;

        res.json({
            success: true,
            fees: { bridgeFee, gasFeeOrigin: gasFeeOrigin.toFixed(2), gasFeeDestination: gasFeeDestination.toFixed(2), totalFeeUSD, estimatedTimeMinutes, route },
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Bridge fee estimation failed');
        res.status(500).json({ error: 'Failed to estimate bridge fees' });
    }
});

/**
 * GET /bridge/stats — Aggregated bridge statistics (public).
 */
router.get('/bridge/stats', authenticateGateway, requireScope('bridge'), async (req, res) => {
    try {
        const [totals, chainBreakdown, recentCount] = await Promise.all([
            query(`SELECT COALESCE(SUM(amount), 0) as total_bridged, COUNT(*) as total_transfers
                   FROM bridge_transfers WHERE status != 'failed'`),
            query(`SELECT to_chain_id as chain_id, COALESCE(SUM(amount), 0) as volume, COUNT(*) as count
                   FROM bridge_transfers WHERE status != 'failed'
                   GROUP BY to_chain_id ORDER BY volume DESC`),
            query(`SELECT COUNT(*) as cnt FROM bridge_transfers
                   WHERE status = 'finalized' AND finalized_at > NOW() - INTERVAL '24 hours'`),
        ]);

        res.json({
            success: true,
            stats: {
                totalBridged: totals.rows[0].total_bridged,
                totalTransfers: parseInt(totals.rows[0].total_transfers),
                chainBreakdown: chainBreakdown.rows,
                recentFinalized: parseInt(recentCount.rows[0].cnt),
            },
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Bridge stats failed');
        res.status(500).json({ error: 'Failed to get bridge stats' });
    }
});

// ═══════════════════════════════════════════════════════════
//  TREASURY — DAO funds overview
// ═══════════════════════════════════════════════════════════

router.get('/treasury/overview', authenticateGateway, requireScope('treasury'), async (req, res) => {
    try {
        // Aggregate treasury data
        const stakingTotal = await query('SELECT COALESCE(SUM(amount_staked), 0) as total FROM staking_positions WHERE is_active = TRUE');
        const farmingTotal = await query('SELECT COALESCE(SUM(lp_amount), 0) as total FROM farming_positions WHERE is_active = TRUE');
        const bridgeVolume = await query('SELECT COALESCE(SUM(amount), 0) as total FROM bridge_transfers WHERE status = \'finalized\'');
        const userCount = await query('SELECT COUNT(*) as total FROM users');

        res.json({
            success: true,
            treasury: {
                totalStaked: stakingTotal.rows[0].total,
                totalFarming: farmingTotal.rows[0].total,
                bridgeVolume: bridgeVolume.rows[0].total,
                totalUsers: parseInt(userCount.rows[0].total),
                updatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get treasury overview' });
    }
});

// ═══════════════════════════════════════════════════════════
//  TOKEN — Info, supply, balances
// ═══════════════════════════════════════════════════════════

router.get('/token/info', authenticateGateway, requireScope('token'), async (req, res) => {
    try {
        const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const bezTokenName = resolveBEZToken(chainId);
        const token = await contractService.getTokenInfo(bezTokenName, chainId);
        res.json({
            success: true,
            source: 'onchain',
            token: {
                ...token,
                circulatingSupply: token.totalSupply,
                wrappedVersion: {
                    name: 'Wrapped BeZhas Coin',
                    symbol: 'wBEZ',
                    chains: [137, 42161],
                },
            },
        });
    } catch (error) {
        res.json({
            success: true,
            source: 'fallback',
            token: {
                name: 'BeZhas Coin V2',
                symbol: 'BEZ',
                decimals: 18,
                totalSupply: '100000000',
                totalSupplyWei: '100000000000000000000000000',
                chainId: 2708,
                wrappedVersion: {
                    name: 'Wrapped BeZhas Coin',
                    symbol: 'wBEZ',
                    chains: [137, 42161],
                },
            },
        });
    }
});

router.post('/governance/propose', authenticateGateway, requireScope('governance'), [
    body('target').isEthereumAddress(),
    body('value').optional().isString(),
    body('calldata').optional().isString(),
    body('description').isString().notEmpty(),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { ethers } = require('ethers');
        const chainId = parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const txRequest = await buildUnsignedContractTx(
            'GovernanceSystem',
            'propose',
            [
                [req.body.target],
                [ethers.parseEther(String(req.body.value || '0'))],
                [req.body.calldata || '0x'],
                req.body.description,
            ],
            '0',
            chainId
        );
        if (!txRequest) return res.status(404).json({ error: 'GovernanceSystem contract not deployed' });
        res.json({ success: true, mode: 'onchain', txRequest, nextAction: 'wallet_sign_and_send' });
    } catch (error) {
        res.status(500).json({ error: 'Governance proposal tx failed', details: error.message });
    }
});

router.post('/governance/queue', authenticateGateway, requireScope('governance'), [
    body('target').isEthereumAddress(),
    body('value').optional().isString(),
    body('calldata').optional().isString(),
    body('description').isString().notEmpty(),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { ethers } = require('ethers');
        const chainId = parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const descriptionHash = ethers.id(req.body.description);
        const txRequest = await buildUnsignedContractTx(
            'GovernanceSystem',
            'queue',
            [
                [req.body.target],
                [ethers.parseEther(String(req.body.value || '0'))],
                [req.body.calldata || '0x'],
                descriptionHash,
            ],
            '0',
            chainId
        );
        if (!txRequest) return res.status(404).json({ error: 'GovernanceSystem contract not deployed' });
        res.json({ success: true, mode: 'onchain', txRequest, descriptionHash, nextAction: 'wallet_sign_and_send' });
    } catch (error) {
        res.status(500).json({ error: 'Governance queue tx failed', details: error.message });
    }
});

router.post('/governance/execute', authenticateGateway, requireScope('governance'), [
    body('target').isEthereumAddress(),
    body('value').optional().isString(),
    body('calldata').optional().isString(),
    body('description').isString().notEmpty(),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { ethers } = require('ethers');
        const chainId = parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const descriptionHash = ethers.id(req.body.description);
        const txRequest = await buildUnsignedContractTx(
            'GovernanceSystem',
            'execute',
            [
                [req.body.target],
                [ethers.parseEther(String(req.body.value || '0'))],
                [req.body.calldata || '0x'],
                descriptionHash,
            ],
            '0',
            chainId
        );
        if (!txRequest) return res.status(404).json({ error: 'GovernanceSystem contract not deployed' });
        res.json({ success: true, mode: 'onchain', txRequest, descriptionHash, nextAction: 'wallet_sign_and_send' });
    } catch (error) {
        res.status(500).json({ error: 'Governance execute tx failed', details: error.message });
    }
});

// ═══════════════════════════════════════════════════════════
//  CONTRACTS — ABIs, addresses, read calls
// ═══════════════════════════════════════════════════════════

router.get('/contracts/list', authenticateGateway, requireScope('contracts'), async (req, res) => {
    try {
        const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const { rows } = await query(
            'SELECT name, category, address, deployed_at FROM contract_addresses WHERE chain_id = $1 ORDER BY category, name',
            [chainId]
        );
        if (rows.length > 0) return res.json({ success: true, source: 'db', contracts: rows });

        const grouped = await contractService.getAllAddresses(chainId);
        const contracts = Object.entries(grouped).flatMap(([category, items]) =>
            Object.entries(items).map(([name, address]) => ({ name, category, address }))
        );
        res.json({ success: true, source: 'deployments', contracts });
    } catch (error) {
        try {
            const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
            const grouped = await contractService.getAllAddresses(chainId);
            const contracts = Object.entries(grouped).flatMap(([category, items]) =>
                Object.entries(items).map(([name, address]) => ({ name, category, address }))
            );
            return res.json({ success: true, source: 'deployments', contracts });
        } catch (_) {
            res.status(500).json({ error: 'Failed to list contracts' });
        }
    }
});

router.get('/contracts/:name', authenticateGateway, requireScope('contracts'), async (req, res) => {
    try {
        const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const { rows } = await query(
            'SELECT * FROM contract_addresses WHERE name = $1 AND chain_id = $2',
            [req.params.name, chainId]
        );
        const address = rows[0]?.address || await contractService.getContractAddress(req.params.name, chainId);
        if (!address) return res.status(404).json({ error: 'Contract not found' });
        const includeAbi = req.query.includeAbi === 'true';
        const abi = includeAbi ? contractService.loadABI(req.params.name) : undefined;
        res.json({ success: true, contract: { ...(rows[0] || {}), name: req.params.name, address, chain_id: chainId, abi } });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get contract', message: error.message });
    }
});

// ═══════════════════════════════════════════════════════════
//  DEX / TRADING — BEZ pairs, quotes, tx requests
// ═══════════════════════════════════════════════════════════

router.get('/dex/pool', authenticateGateway, requireScope('contracts'), [
    body().custom(() => true),
], async (req, res) => {
    const { tokenA, tokenB } = req.query;
    if (!tokenA || !tokenB) return res.status(400).json({ error: 'tokenA and tokenB are required' });

    try {
        const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const pool = await contractService.getDEXPool(tokenA, tokenB, chainId);
        res.json({ success: true, pool });
    } catch (error) {
        res.status(404).json({ error: 'DEX pool not found', message: error.message });
    }
});

router.get('/dex/quote', authenticateGateway, requireScope('contracts'), async (req, res) => {
    const { tokenIn, tokenOut, amountIn } = req.query;
    if (!tokenIn || !tokenOut || !amountIn) {
        return res.status(400).json({ error: 'tokenIn, tokenOut and amountIn are required' });
    }

    try {
        const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const quote = await contractService.quoteDEXSwap(tokenIn, tokenOut, amountIn, chainId);
        res.json({ success: true, quote });
    } catch (error) {
        res.status(404).json({ error: 'DEX quote unavailable', message: error.message });
    }
});

router.post('/dex/swap', authenticateGateway, requireScope('contracts'), [
    body('tokenIn').isEthereumAddress(),
    body('tokenOut').isEthereumAddress(),
    body('amountIn').isFloat({ min: 0.000001 }),
    body('minAmountOut').optional().isFloat({ min: 0 }),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { ethers } = require('ethers');
        const chainId = parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const txRequest = await buildUnsignedContractTx('BeZhasDEX', 'swap', [
            req.body.tokenIn,
            req.body.tokenOut,
            ethers.parseEther(String(req.body.amountIn)),
            ethers.parseEther(String(req.body.minAmountOut || '0')),
        ], '0', chainId);
        if (!txRequest) return res.status(404).json({ error: 'BeZhasDEX not deployed' });
        res.json({ success: true, mode: 'onchain', txRequest, nextAction: 'wallet_sign_and_send' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to build swap transaction', message: error.message });
    }
});

router.post('/dex/add-liquidity', authenticateGateway, requireScope('contracts'), [
    body('tokenA').isEthereumAddress(),
    body('tokenB').isEthereumAddress(),
    body('amountA').isFloat({ min: 0.000001 }),
    body('amountB').isFloat({ min: 0.000001 }),
    body('minLiquidity').optional().isFloat({ min: 0 }),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const { ethers } = require('ethers');
        const chainId = parseInt(req.body.chainId || process.env.BEZHAS_CHAIN_ID || '31337');
        const txRequest = await buildUnsignedContractTx('BeZhasDEX', 'addLiquidity', [
            req.body.tokenA,
            req.body.tokenB,
            ethers.parseEther(String(req.body.amountA)),
            ethers.parseEther(String(req.body.amountB)),
            ethers.parseEther(String(req.body.minLiquidity || '0')),
        ], '0', chainId);
        if (!txRequest) return res.status(404).json({ error: 'BeZhasDEX not deployed' });
        res.json({ success: true, mode: 'onchain', txRequest, nextAction: 'wallet_sign_and_send' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to build add-liquidity transaction', message: error.message });
    }
});

// ═══════════════════════════════════════════════════════════
//  APP MANAGEMENT — Registry (admin only)
// ═══════════════════════════════════════════════════════════

router.post('/apps/register', authenticateGateway, requireScope('admin'), [
    body('appName').isLength({ min: 3, max: 100 }),
    body('scopes').isArray({ min: 1 }),
    body('tier').optional().isIn(['free', 'standard', 'premium', 'internal']),
], async (req, res) => {
    if (!validate(req, res)) return;

    try {
        const result = await ssoService.registerApp(req.body);
        logger.info({ appName: req.body.appName }, 'New app registered in gateway');
        res.json({ success: true, ...result });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'App name already registered' });
        }
        res.status(500).json({ error: 'Failed to register app' });
    }
});

router.get('/apps/list', authenticateGateway, requireScope('admin'), async (req, res) => {
    try {
        const { rows } = await query(
            'SELECT id, app_name, scopes, tier, rate_limit, is_active, created_at FROM app_registry ORDER BY app_name'
        );
        res.json({ success: true, apps: rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to list apps' });
    }
});

// ═══════════════════════════════════════════════════════════
//  PAYMENTS — Buy BEZ, send BezPay, history
// ═══════════════════════════════════════════════════════════

router.post('/payments/buy', authenticateGateway, requireScope('wallet'), [
    body('walletAddress').optional().isEthereumAddress(),
    body('amountUSD').isFloat({ min: 1 }),
    body('paymentMethod').isIn(['card', 'crypto', 'qr', 'bank']),
    body('stripeUseCase').optional().isString().isLength({ min: 2, max: 80 }),
    body('email').optional().isEmail(),
], async (req, res) => {
    if (!validate(req, res)) return;
    const { amountUSD, paymentMethod, stripeUseCase, email } = req.body;

    // Stripe-style idempotency: same key → replay the original order instead
    // of creating a duplicate (network retries must be safe).
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;
    if (idempotencyKey && !/^[A-Za-z0-9_-]{8,80}$/.test(idempotencyKey)) {
        return res.status(400).json({ error: 'Idempotency-Key must be 8-80 chars [A-Za-z0-9_-]' });
    }

    try {
        const walletAddress = await resolvePrimaryWallet(req, req.body.walletAddress);
        if (!walletAddress) {
            return res.status(400).json({ error: 'walletAddress is required unless a user JWT is provided' });
        }

        if (idempotencyKey) {
            const existing = await query(
                `SELECT id, status, wallet_address, amount_usd, platform_fee_usd, payment_method, note, created_at
                 FROM payment_transactions WHERE idempotency_key = $1 AND type = 'buy'`,
                [idempotencyKey]
            );
            if (existing.rows.length > 0) {
                const row = existing.rows[0];
                if (row.wallet_address?.toLowerCase() !== walletAddress.toLowerCase()) {
                    return res.status(409).json({ error: 'Idempotency-Key already used for a different wallet' });
                }
                return res.json(buildBuyReplayResponse(row));
            }
        }

        // Gate KYC/MiCA: el volumen acumulado 12m de la wallet limita la compra.
        const kyc = await complianceGate.checkBuyAllowed(walletAddress, parseFloat(amountUSD));
        if (!kyc.allowed) {
            return res.status(403).json({
                error: `Cumulative purchase limit reached for KYC level ${kyc.level} (${kyc.limitUSD} USD / 12 months)`,
                code: 'KYC_REQUIRED',
                kycLevel: kyc.level,
                requiredLevel: kyc.requiredLevel,
                limitUSD: kyc.limitUSD,
                usedUSD: kyc.usedUSD,
            });
        }

        const feeBreakdown = calculateFeeBreakdown(amountUSD);
        const platformFeeUSD = feeBreakdown.platformFeeUSD;
        const grossAmountUSD = feeBreakdown.grossAmountUSD;
        const stripeLink = paymentMethod === 'card'
            ? getStripePaymentLink(stripeUseCase || 'token_purchase')
            : null;
        const bankTransfer = paymentMethod === 'bank';
        const onchain = paymentMethod === 'crypto' || paymentMethod === 'qr';

        // On-chain rail: quote the expected BEZ so the customer knows exactly
        // what to transfer and the settlement watcher can match it later.
        let onchainInstructions = null;
        if (onchain) {
            const price = await query(
                "SELECT price_usd FROM token_price_cache WHERE symbol = 'BEZ' LIMIT 1"
            ).catch(() => ({ rows: [] }));
            const priceUSD = parseFloat(price.rows[0]?.price_usd || '0.10');
            onchainInstructions = {
                provider: 'onchain',
                token: 'BEZ',
                treasury: SETTLEMENT_TREASURY,
                priceUSD,
                expectedBez: priceUSD > 0 ? Math.round((parseFloat(amountUSD) / priceUSD) * 1e6) / 1e6 : null,
                sendFrom: walletAddress,
                note: 'Transfer the BEZ from your order wallet — the watcher matches sender + amount.',
            };
        }

        const note = stripeLink || bankTransfer || onchain
            ? JSON.stringify(stripeLink ? {
                provider: 'stripe_payment_link',
                stripeUseCase: stripeLink.id,
                stripeLabel: stripeLink.label,
                email: email || null,
                platformFeeBps: PLATFORM_FEE_BPS,
                platformFeeUSD,
                grossAmountUSD,
                tokenomics: feeBreakdown.allocations,
            } : bankTransfer ? {
                provider: 'bank_transfer',
                paymentRail: BANK_TRANSFER_DETAILS.paymentRail,
                beneficiaryAlias: BANK_TRANSFER_DETAILS.beneficiaryAlias,
                iban: BANK_TRANSFER_DETAILS.iban,
                bic: BANK_TRANSFER_DETAILS.bic,
                platformFeeBps: PLATFORM_FEE_BPS,
                platformFeeUSD,
                grossAmountUSD,
                tokenomics: feeBreakdown.allocations,
            } : {
                ...onchainInstructions,
                platformFeeBps: PLATFORM_FEE_BPS,
                platformFeeUSD,
                grossAmountUSD,
                tokenomics: feeBreakdown.allocations,
            })
            : null;
        // TTL del intent: on-chain corto (el watcher deja de casar órdenes
        // rancias contra transfers nuevos); card/bank más holgado.
        const ttlHours = onchain
            ? parseInt(process.env.ONCHAIN_ORDER_TTL_HOURS || '24', 10)
            : parseInt(process.env.FIAT_ORDER_TTL_HOURS || '168', 10);

        // Bearer token del checkout hosted: quien tenga la URL puede ver el
        // estado de ESTA orden (y solo esta) sin API key.
        const checkoutToken = require('crypto').randomBytes(16).toString('hex');

        const result = await query(
            `INSERT INTO payment_transactions (wallet_address, primary_wallet_address, amount_usd,
                                               platform_fee_usd, payment_method, type, status, note, idempotency_key, app_id, expires_at, checkout_token)
             VALUES ($1, $1, $2, $3, $4, 'buy', 'pending', $5, $6, $7, NOW() + ($8 || ' hours')::interval, $9)
             ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
             RETURNING id, status, created_at, expires_at, checkout_token`,
            [walletAddress, grossAmountUSD, platformFeeUSD, paymentMethod, note, idempotencyKey, req.registeredApp?.id || null, String(ttlHours), checkoutToken]
        );

        // Carrera perdida: otro request con la misma key insertó primero → replay.
        if (result.rows.length === 0 && idempotencyKey) {
            const raced = await query(
                `SELECT id, status, wallet_address, amount_usd, platform_fee_usd, payment_method, note, created_at
                 FROM payment_transactions WHERE idempotency_key = $1 AND type = 'buy'`,
                [idempotencyKey]
            );
            if (raced.rows.length > 0) {
                return res.json(buildBuyReplayResponse(raced.rows[0]));
            }
            return res.status(500).json({ error: 'Payment processing failed' });
        }
        logger.info({
            walletAddress,
            amountUSD,
            paymentMethod,
            stripeUseCase: stripeLink?.id,
        }, 'BEZ purchase initiated');

        const bankTransferInstructions = bankTransfer
            ? buildBankTransferInstructions(`BEZ-${result.rows[0].id}`)
            : undefined;

        res.json({
            success: true,
            paymentId: result.rows[0].id,
            status: 'pending',
            provider: stripeLink ? 'stripe_payment_link' : bankTransfer ? 'bank_transfer' : paymentMethod,
            checkoutUrl: stripeLink?.url,
            bankTransfer: bankTransferInstructions,
            onchain: onchainInstructions || undefined,
            walletAddress,
            amountUSD: grossAmountUSD,
            netAmountUSD: parseFloat(amountUSD),
            platformFeeUSD,
            platformFeeBps: PLATFORM_FEE_BPS,
            tokenomics: feeBreakdown.allocations,
            stripeUseCase: stripeLink?.id,
            stripeLabel: stripeLink?.label,
            expiresAt: result.rows[0].expires_at,
            hostedCheckoutUrl: `${process.env.PUBLIC_PAY_BASE_URL || ''}/c/${result.rows[0].checkout_token}`,
            nextAction: stripeLink
                ? 'redirect_to_checkout'
                : bankTransfer
                    ? 'display_bank_transfer_instructions'
                    : onchain
                        ? 'transfer_bez_to_treasury'
                        : 'await_payment_confirmation',
        });
    } catch (error) {
        logger.error(error, 'Payment buy failed');
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

/**
 * GET /payments/:id — poll one order (intent) by id.
 * Visible only to the app that created it (app_id) or, for JWT sessions,
 * to the wallet that owns it. Admin-scoped apps see everything.
 */
router.get('/payments/:id(\\d+)', authenticateGateway, requireScope('wallet'), [
    param('id').isInt({ min: 1 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const { rows } = await query(
            `SELECT id, wallet_address, amount_usd, amount_bez, platform_fee_usd, payment_method,
                    type, status, note, tx_hash, app_id, expires_at, created_at, updated_at
             FROM payment_transactions WHERE id = $1 AND type = 'buy' LIMIT 1`,
            [parseInt(req.params.id, 10)]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Payment order not found' });
        }
        const order = rows[0];

        const isAdmin = req.registeredApp?.scopes?.includes('admin');
        const ownsAsApp = req.registeredApp && order.app_id === req.registeredApp.id;
        const userWallet = req.user?.address?.toLowerCase();
        const ownsAsWallet = userWallet && order.wallet_address?.toLowerCase() === userWallet;
        if (!isAdmin && !ownsAsApp && !ownsAsWallet) {
            return res.status(404).json({ error: 'Payment order not found' });
        }

        let meta = {};
        try { meta = order.note ? JSON.parse(order.note) : {}; } catch { meta = {}; }
        res.json({
            success: true,
            payment: {
                paymentId: order.id,
                status: order.status,
                walletAddress: order.wallet_address,
                amountUSD: parseFloat(order.amount_usd || '0'),
                amountBEZ: order.amount_bez,
                platformFeeUSD: parseFloat(order.platform_fee_usd || '0'),
                paymentMethod: order.payment_method,
                provider: meta.provider || order.payment_method,
                txHash: order.tx_hash,
                settlement: meta.settlement || null,
                onchain: meta.provider === 'onchain'
                    ? { treasury: meta.treasury, expectedBez: meta.expectedBez, token: meta.token }
                    : undefined,
                expiresAt: order.expires_at,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
            },
        });
    } catch (error) {
        logger.error(error, 'Payment fetch failed');
        res.status(500).json({ error: 'Failed to fetch payment' });
    }
});

router.get('/payments/stripe-links', authenticateGateway, requireScope('wallet'), (_req, res) => {
    res.json({
        success: true,
        provider: 'stripe_payment_link',
        links: STRIPE_PAYMENT_LINKS,
    });
});

router.get('/payments/bank-transfer-details', authenticateGateway, requireScope('wallet'), (_req, res) => {
    res.json({
        success: true,
        provider: 'bank_transfer',
        bankTransfer: BANK_TRANSFER_DETAILS,
    });
});

router.get('/payments/tokenomics', authenticateGateway, requireScope('wallet'), (req, res) => {
    const amountUSD = req.query.amountUSD ? parseFloat(req.query.amountUSD) : 100;
    const priceUSD = req.query.priceUSD ? parseFloat(req.query.priceUSD) : 0.10;
    res.json({
        success: true,
        model: 'rwa-real-yield-fiat-to-fiat',
        fee: calculateFeeBreakdown(amountUSD, priceUSD),
        notes: [
            'Burn improves scarcity but must not starve liquidity for high-frequency RWA flows.',
            'Staking rewards are funded by real transaction volume, not emissions.',
            'Microtransactions should be batched or netted before settlement when fee > economic value.',
        ],
    });
});

router.post('/payments/sell', authenticateGateway, requireScope('wallet'), [
    body('walletAddress').isEthereumAddress(),
    body('amountBEZ').isFloat({ min: 0.1 }),
    body('receiveMethod').isIn(['card', 'bank', 'crypto']),
], async (req, res) => {
    if (!validate(req, res)) return;
    const { walletAddress, amountBEZ, receiveMethod } = req.body;
    try {
        const result = await query(
            `INSERT INTO payment_transactions (wallet_address, amount_bez, payment_method, type, status)
             VALUES ($1, $2, $3, 'sell', 'pending') RETURNING id, status, created_at`,
            [walletAddress, amountBEZ, receiveMethod]
        );
        logger.info({ walletAddress, amountBEZ, receiveMethod }, 'BEZ sell initiated');
        res.json({ success: true, paymentId: result.rows[0].id, status: 'pending' });
    } catch (error) {
        logger.error(error, 'Payment sell failed');
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

router.post('/payments/send', authenticateGateway, requireScope('wallet'), [
    body('sender').isEthereumAddress(),
    body('recipient').isLength({ min: 3 }),
    body('amount').isFloat({ min: 0.001 }),
    body('note').optional().isLength({ max: 500 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    const { sender, recipient, amount, note } = req.body;
    try {
        const result = await query(
            `INSERT INTO payment_transactions (wallet_address, recipient, amount_bez, type, status, note)
             VALUES ($1, $2, $3, 'payment', 'pending', $4) RETURNING id, status, created_at`,
            [sender, recipient, amount, note || null]
        );
        logger.info({ sender, recipient, amount }, 'BezPay payment initiated');
        res.json({ success: true, paymentId: result.rows[0].id, status: 'pending' });
    } catch (error) {
        logger.error(error, 'BezPay send failed');
        res.status(500).json({ error: 'Payment send failed' });
    }
});

router.get('/payments/history/:address', authenticateGateway, requireScope('wallet'), [
    param('address').isEthereumAddress(),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const { rows } = await query(
            `SELECT id, type, COALESCE(amount_bez::text || ' BEZ', amount_usd::text || ' USD') as amount,
                    payment_method as method, recipient, status, note, tx_hash as "txHash",
                    created_at as date
             FROM payment_transactions
             WHERE wallet_address = $1
             ORDER BY created_at DESC LIMIT $2`,
            [req.params.address, limit]
        );
        res.json({ success: true, payments: rows });
    } catch (error) {
        logger.error(error, 'Payment history fetch failed');
        res.status(500).json({ error: 'Failed to fetch payment history' });
    }
});

/**
 * POST /payments/settle — Internal settlement hook for FIAT/bank/crypto orders.
 *
 * This is intentionally internal-only. Stripe/PSP webhooks or a backoffice worker
 * should call it after payment confirmation and, when available, after the BEZ
 * mint/transfer transaction is submitted.
 */
router.post('/payments/settle', requirePaymentSettlementKey, [
    body('paymentId').isInt({ min: 1 }),
    body('status').optional().isIn(['completed', 'failed']),
    body('providerReference').optional().isString().isLength({ min: 1, max: 160 }),
    body('txHash').optional().matches(/^0x[a-fA-F0-9]{64}$/),
], async (req, res) => {
    if (!validate(req, res)) return;

    const paymentId = parseInt(req.body.paymentId, 10);
    const status = req.body.status || 'completed';
    const providerReference = req.body.providerReference || null;
    const txHash = req.body.txHash || null;

    try {
        // Single settlement path shared with the on-chain watcher
        // (services/paymentSettlement.js) — also emits payment.settled webhooks.
        const result = await settlePayment({ paymentId, status, providerReference, txHash });
        res.json({ success: true, ...result });
    } catch (error) {
        if (error.code === 'NOT_FOUND') {
            return res.status(404).json({ error: error.message });
        }
        if (error.code === 'ALREADY_COMPLETED') {
            return res.status(409).json({ error: error.message });
        }
        logger.error(error, 'Payment settlement failed');
        res.status(500).json({ error: 'Payment settlement failed' });
    }
});

// ═══════════════════════════════════════════════════════════
//  TOKEN PRICE — Live or cached BEZ price
// ═══════════════════════════════════════════════════════════

router.get('/token/price', authenticateGateway, requireScope('token'), async (req, res) => {
    try {
        // Check cached price first
        const cached = await query(
            "SELECT price_usd, change_24h, updated_at FROM token_price_cache WHERE symbol = 'BEZ' LIMIT 1"
        ).catch(() => ({ rows: [] }));

        if (cached.rows.length > 0) {
            return res.json({
                success: true,
                priceUSD: parseFloat(cached.rows[0].price_usd),
                change24h: parseFloat(cached.rows[0].change_24h || 0),
                updatedAt: cached.rows[0].updated_at,
            });
        }

        // Fallback: initial price from config
        res.json({
            success: true,
            priceUSD: 0.10,
            change24h: 0,
            updatedAt: new Date().toISOString(),
        });
    } catch (error) {
        logger.error(error, 'Token price fetch failed');
        res.status(500).json({ error: 'Failed to fetch token price' });
    }
});

/**
 * POST /payments/:id/refund — Internal-only refund of a completed order.
 * Same trust boundary as /payments/settle: refunds move money, so only the
 * settlement key (backoffice / hot-wallet worker) may trigger them. The BEZ
 * return transfer itself is executed by the treasury; attach its txHash.
 */
router.post('/payments/:id(\\d+)/refund', requirePaymentSettlementKey, [
    param('id').isInt({ min: 1 }),
    body('reason').optional().isString().isLength({ min: 1, max: 300 }),
    body('refundTxHash').optional().matches(/^0x[a-fA-F0-9]{64}$/),
    body('requestedBy').optional().isString().isLength({ min: 1, max: 120 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const result = await refundPayment({
            paymentId: parseInt(req.params.id, 10),
            reason: req.body.reason || null,
            refundTxHash: req.body.refundTxHash || null,
            requestedBy: req.body.requestedBy || null,
        });
        res.json({ success: true, ...result });
    } catch (error) {
        if (error.code === 'NOT_FOUND') return res.status(404).json({ error: error.message });
        if (error.code === 'ALREADY_REFUNDED') return res.status(409).json({ error: error.message });
        if (error.code === 'NOT_REFUNDABLE') return res.status(422).json({ error: error.message });
        logger.error(error, 'Payment refund failed');
        res.status(500).json({ error: 'Payment refund failed' });
    }
});

// ═══════════════════════════════════════════════════════════
//  KYC / COMPLIANCE — tiered volume gates (MiCA)
// ═══════════════════════════════════════════════════════════

/** GET /kyc/status/:address — level + remaining headroom for a wallet. */
router.get('/kyc/status/:address', authenticateGateway, requireScope('wallet'), [
    param('address').isEthereumAddress(),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const { level, provider, verifiedAt } = await complianceGate.getKycLevel(req.params.address);
        const limitUSD = complianceGate.TIER_LIMITS_USD[level];
        const usedUSD = limitUSD === Infinity ? 0 : await complianceGate.getRollingVolumeUSD(req.params.address);
        res.json({
            success: true,
            walletAddress: req.params.address,
            level,
            provider,
            verifiedAt,
            limitUSD: limitUSD === Infinity ? null : limitUSD,
            usedUSD,
            remainingUSD: limitUSD === Infinity ? null : Math.max(limitUSD - usedUSD, 0),
        });
    } catch (error) {
        logger.error(error, 'KYC status fetch failed');
        res.status(500).json({ error: 'Failed to fetch KYC status' });
    }
});

/**
 * POST /kyc/status — Internal-only: the KYC provider callback / backoffice
 * sets a wallet's level. Apps cannot self-upgrade (settlement key boundary).
 */
router.post('/kyc/status', requirePaymentSettlementKey, [
    body('walletAddress').isEthereumAddress(),
    body('level').isInt({ min: 0, max: 2 }),
    body('provider').optional().isString().isLength({ min: 1, max: 60 }),
    body('reference').optional().isString().isLength({ min: 1, max: 160 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const updated = await complianceGate.setKycLevel({
            walletAddress: req.body.walletAddress,
            level: parseInt(req.body.level, 10),
            provider: req.body.provider || null,
            reference: req.body.reference || null,
        });
        logger.info({ walletAddress: updated.wallet_address, level: updated.level, provider: updated.provider }, 'KYC level updated');
        res.json({ success: true, kyc: updated });
    } catch (error) {
        logger.error(error, 'KYC level update failed');
        res.status(500).json({ error: 'Failed to update KYC level' });
    }
});

// ═══════════════════════════════════════════════════════════
//  HOSTED CHECKOUT — public, token-scoped order status
//  The bearer token (returned once at buy as hostedCheckoutUrl) is the only
//  credential: it reveals THIS order's payment state and instructions, never
//  the API surface. Consumed by the /c/:token page (routes/checkout.js).
// ═══════════════════════════════════════════════════════════

router.get('/checkout/:token([0-9a-f]{32})', async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT id, status, amount_usd, platform_fee_usd, payment_method, note,
                    tx_hash, expires_at, created_at, updated_at
             FROM payment_transactions
             WHERE checkout_token = $1 AND type = 'buy' LIMIT 1`,
            [req.params.token]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Checkout not found' });
        }
        const order = rows[0];
        let meta = {};
        try { meta = order.note ? JSON.parse(order.note) : {}; } catch { meta = {}; }

        // Solo lo que el pagador necesita — nada de app_id, wallets ajenas ni fees internos.
        res.set('Cache-Control', 'no-store');
        res.json({
            success: true,
            checkout: {
                paymentId: order.id,
                status: order.status,
                amountUSD: parseFloat(order.amount_usd || '0'),
                method: order.payment_method,
                provider: meta.provider || order.payment_method,
                onchain: meta.provider === 'onchain'
                    ? { token: meta.token, treasury: meta.treasury, expectedBez: meta.expectedBez, sendFrom: meta.sendFrom }
                    : undefined,
                bank: meta.provider === 'bank_transfer'
                    ? { iban: meta.iban, bic: meta.bic, beneficiary: meta.beneficiaryAlias, reference: `BEZ-${order.id}` }
                    : undefined,
                stripeUrl: meta.provider === 'stripe_payment_link'
                    ? getStripePaymentLink(meta.stripeUseCase || 'token_purchase')?.url
                    : undefined,
                txHash: order.tx_hash || undefined,
                expiresAt: order.expires_at,
                createdAt: order.created_at,
                updatedAt: order.updated_at,
            },
        });
    } catch (error) {
        logger.error(error, 'Checkout status fetch failed');
        res.status(500).json({ error: 'Failed to fetch checkout' });
    }
});

// ═══════════════════════════════════════════════════════════
//  OUTBOUND WEBHOOKS — signed payment events per registered app
//  Deliveries signed with X-BeZhas-Signature (sha256=<hex HMAC>), the format
//  @bezhas/connect webhooks.verify checks. Retries with exponential backoff.
// ═══════════════════════════════════════════════════════════

const requireAppForWebhooks = (req, res, next) => {
    if (!req.registeredApp) {
        return res.status(401).json({ error: 'Webhook endpoints require API-key auth (x-api-key)' });
    }
    next();
};

/**
 * POST /webhooks/register — subscribe a URL to payment events.
 * The signing secret is returned ONCE; store it to verify deliveries.
 */
router.post('/webhooks/register', authenticateGateway, requireAppForWebhooks, [
    body('url').isURL({ protocols: ['https', 'http'], require_protocol: true }),
    body('events').optional().isArray({ min: 1, max: 10 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    const events = (req.body.events || ['payment.settled']).map(String);
    const secret = paymentWebhooks.generateSecret();
    try {
        const { rows } = await query(
            `INSERT INTO payment_webhooks (app_id, url, secret, events)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (app_id, url) DO UPDATE SET events = $4::jsonb, secret = $3, is_active = TRUE
             RETURNING id, url, events, created_at`,
            [req.registeredApp.id, req.body.url, secret, JSON.stringify(events)]
        );
        res.json({
            success: true,
            webhook: rows[0],
            secret, // shown only on registration — never retrievable again
            signatureHeader: 'X-BeZhas-Signature',
            signatureFormat: 'sha256=<hex(hmacSha256(secret, rawBody))>',
        });
    } catch (error) {
        logger.error(error, 'Webhook registration failed');
        res.status(500).json({ error: 'Failed to register webhook' });
    }
});

/** GET /webhooks — list this app's webhooks (secrets never returned). */
router.get('/webhooks', authenticateGateway, requireAppForWebhooks, async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT id, url, events, is_active, created_at
             FROM payment_webhooks WHERE app_id = $1 ORDER BY created_at DESC`,
            [req.registeredApp.id]
        );
        res.json({ success: true, webhooks: rows });
    } catch (error) {
        logger.error(error, 'Webhook list failed');
        res.status(500).json({ error: 'Failed to list webhooks' });
    }
});

/** GET /webhooks/deliveries — recent delivery attempts (incl. dead-letter). */
router.get('/webhooks/deliveries', authenticateGateway, requireAppForWebhooks, async (req, res) => {
    try {
        const status = ['pending', 'delivered', 'dead'].includes(req.query.status) ? req.query.status : null;
        const { rows } = await query(
            `SELECT d.id, d.webhook_id, d.event_name, d.status, d.attempts, d.max_attempts,
                    d.last_http_status, d.last_error, d.next_attempt_at, d.created_at, w.url
             FROM payment_webhook_deliveries d
             JOIN payment_webhooks w ON w.id = d.webhook_id
             WHERE w.app_id = $1 ${status ? 'AND d.status = $2' : ''}
             ORDER BY d.created_at DESC LIMIT 100`,
            status ? [req.registeredApp.id, status] : [req.registeredApp.id]
        );
        res.json({ success: true, deliveries: rows });
    } catch (error) {
        logger.error(error, 'Webhook deliveries fetch failed');
        res.status(500).json({ error: 'Failed to fetch deliveries' });
    }
});

/** POST /webhooks/deliveries/:id/retry — re-queue a dead delivery. */
router.post('/webhooks/deliveries/:id/retry', authenticateGateway, requireAppForWebhooks, [
    param('id').isInt({ min: 1 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const { rows } = await query(
            `UPDATE payment_webhook_deliveries d
             SET status = 'pending', attempts = 0, next_attempt_at = NOW(), updated_at = NOW()
             FROM payment_webhooks w
             WHERE d.id = $1 AND w.id = d.webhook_id AND w.app_id = $2 AND d.status = 'dead'
             RETURNING d.id, d.status`,
            [parseInt(req.params.id, 10), req.registeredApp.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Dead delivery not found for this app' });
        }
        res.json({ success: true, delivery: rows[0] });
    } catch (error) {
        logger.error(error, 'Webhook retry failed');
        res.status(500).json({ error: 'Failed to retry delivery' });
    }
});

/** DELETE /webhooks/:id — deactivate a webhook. */
router.delete('/webhooks/:id', authenticateGateway, requireAppForWebhooks, [
    param('id').isInt({ min: 1 }),
], async (req, res) => {
    if (!validate(req, res)) return;
    try {
        const { rows } = await query(
            `UPDATE payment_webhooks SET is_active = FALSE
             WHERE id = $1 AND app_id = $2 RETURNING id`,
            [parseInt(req.params.id, 10), req.registeredApp.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Webhook not found for this app' });
        }
        res.json({ success: true, deactivated: rows[0].id });
    } catch (error) {
        logger.error(error, 'Webhook delete failed');
        res.status(500).json({ error: 'Failed to deactivate webhook' });
    }
});

// ═══════════════════════════════════════════════════════════
//  SUBSCRIPTION & ENTITLEMENTS — plan + active SubApps per registered app
//  Consumed by the @bezhas/connect SDK (subscription module) and the
//  embed widget. Infra surface: never entitlement-gated itself.
// ═══════════════════════════════════════════════════════════

// Subscription is per registered app (API key). JWT-only sessions have no
// app identity to attach a subscription to.
const requireRegisteredApp = (req, res, next) => {
    if (!req.registeredApp) {
        return res.status(401).json({ error: 'Subscription endpoints require API-key auth (x-api-key)' });
    }
    next();
};

async function loadSubscription(appId) {
    const { rows } = await query(
        'SELECT plan_id, subapps, status, renews_at FROM gateway_subscriptions WHERE app_id = $1',
        [appId]
    );
    if (rows.length === 0) {
        return { plan: 'starter', addons: [], status: 'active', renewsAt: null };
    }
    const row = rows[0];
    const addons = Array.isArray(row.subapps) ? row.subapps : [];
    return { plan: row.plan_id, addons, status: row.status, renewsAt: row.renews_at };
}

/**
 * GET /subscription — Current plan + active SubApps (entitlements).
 * Shape matches Entitlements.fromApi in @bezhas/connect: { plan, subapps, ... }.
 */
router.get('/subscription', authenticateGateway, requireRegisteredApp, async (req, res) => {
    try {
        const sub = await loadSubscription(req.registeredApp.id);
        res.json({
            success: true,
            plan: sub.plan,
            subapps: [...new Set([...CORE_SUBAPPS, ...sub.addons])],
            addons: sub.addons,
            status: sub.status,
            renewsAt: sub.renewsAt,
        });
    } catch (error) {
        logger.error(error, 'Subscription fetch failed');
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
});

/**
 * GET /subscription/quote — Price a plan config without committing.
 * Query: plan (o planId), addons (csv), annual (1|true), payWithBez (1|true).
 * Same calculation as the Hub landing (config/plans.js is a mirror of the
 * canonical Hub config).
 */
router.get('/subscription/quote', authenticateGateway, requireRegisteredApp, (req, res) => {
    const planId = req.query.plan || req.query.planId;
    const annual = req.query.annual === '1' || req.query.annual === 'true';
    const payWithBez = req.query.payWithBez === '1' || req.query.payWithBez === 'true';
    const addons = String(req.query.addons || '').split(',').map(s => s.trim()).filter(Boolean);

    const unknownAddons = addons.filter(a => !ACTIVATABLE_SUBAPPS.includes(a));
    if (unknownAddons.length > 0) {
        return res.status(400).json({
            error: `Unknown SubApp addon(s): ${unknownAddons.join(', ')}`,
            activatable: ACTIVATABLE_SUBAPPS,
        });
    }

    try {
        const quote = calculateSubscription({ planId, payWithBez, annual });
        res.json({ success: true, ...quote, addons });
    } catch (error) {
        if (error.code === 'UNKNOWN_PLAN') {
            return res.status(404).json({ error: error.message, plans: PLANS.map(p => p.id) });
        }
        logger.error(error, 'Subscription quote failed');
        res.status(500).json({ error: 'Failed to quote subscription' });
    }
});

/**
 * POST /subscription/activate — Activate a SubApp (adds it to the bill +
 * entitlements). Idempotent.
 */
router.post('/subscription/activate', authenticateGateway, requireRegisteredApp, [
    body('subapp').isString().notEmpty(),
], async (req, res) => {
    if (!validate(req, res)) return;
    const { subapp } = req.body;
    if (CORE_SUBAPPS.includes(subapp)) {
        const sub = await loadSubscription(req.registeredApp.id).catch(() => ({ addons: [] }));
        return res.json({ success: true, subapp, alreadyIncluded: true, subapps: [...new Set([...CORE_SUBAPPS, ...sub.addons])] });
    }
    if (!ACTIVATABLE_SUBAPPS.includes(subapp)) {
        return res.status(404).json({ error: `Unknown SubApp: ${subapp}`, activatable: ACTIVATABLE_SUBAPPS });
    }

    try {
        const sub = await loadSubscription(req.registeredApp.id);
        const next = [...new Set([...sub.addons, subapp])];
        await query(
            `INSERT INTO gateway_subscriptions (app_id, subapps)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (app_id) DO UPDATE SET subapps = $2::jsonb, updated_at = NOW()`,
            [req.registeredApp.id, JSON.stringify(next)]
        );
        res.json({ success: true, subapp, subapps: [...new Set([...CORE_SUBAPPS, ...next])] });
    } catch (error) {
        logger.error(error, 'Subscription activate failed');
        res.status(500).json({ error: 'Failed to activate SubApp' });
    }
});

/**
 * POST /subscription/deactivate — Deactivate a SubApp at the next cycle.
 * Core SubApps cannot be deactivated.
 */
router.post('/subscription/deactivate', authenticateGateway, requireRegisteredApp, [
    body('subapp').isString().notEmpty(),
], async (req, res) => {
    if (!validate(req, res)) return;
    const { subapp } = req.body;
    if (CORE_SUBAPPS.includes(subapp)) {
        return res.status(400).json({ error: `SubApp "${subapp}" is included in every subscription and cannot be deactivated` });
    }

    try {
        const sub = await loadSubscription(req.registeredApp.id);
        const next = sub.addons.filter(a => a !== subapp);
        await query(
            `INSERT INTO gateway_subscriptions (app_id, subapps)
             VALUES ($1, $2::jsonb)
             ON CONFLICT (app_id) DO UPDATE SET subapps = $2::jsonb, updated_at = NOW()`,
            [req.registeredApp.id, JSON.stringify(next)]
        );
        res.json({ success: true, subapp, subapps: [...new Set([...CORE_SUBAPPS, ...next])] });
    } catch (error) {
        logger.error(error, 'Subscription deactivate failed');
        res.status(500).json({ error: 'Failed to deactivate SubApp' });
    }
});

// ═══════════════════════════════════════════════════════════
//  NETWORK STATS — Public (used by landing pages)
// ═══════════════════════════════════════════════════════════

router.get('/network/stats', async (req, res) => {
    try {
        const [validators, bridgeVol, txCount, stakingAgg, farmingAgg, tokenPrice, nftCount, latestAnalytics] = await Promise.all([
            query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM validators').catch(() => ({ rows: [{ total: 0, active: 0 }] })),
            query("SELECT COALESCE(SUM(amount), 0) as total FROM bridge_transfers WHERE status = 'finalized'").catch(() => ({ rows: [{ total: 0 }] })),
            query('SELECT COUNT(*) as total FROM transactions').catch(() => ({ rows: [{ total: 0 }] })),
            query("SELECT COALESCE(SUM(amount_staked), 0) as total_staked, COUNT(*) FILTER (WHERE is_active = true) as active_positions FROM staking_positions").catch(() => ({ rows: [{ total_staked: 0, active_positions: 0 }] })),
            query("SELECT COALESCE(SUM(lp_amount), 0) as tvl, COUNT(*) FILTER (WHERE is_active = true) as active_farms FROM farming_positions").catch(() => ({ rows: [{ tvl: 0, active_farms: 0 }] })),
            query("SELECT price_usd, change_24h FROM token_price_cache WHERE symbol = 'BEZ' LIMIT 1").catch(() => ({ rows: [] })),
            query('SELECT COUNT(*) as total FROM nfts').catch(() => ({ rows: [{ total: 0 }] })),
            query('SELECT * FROM daily_analytics ORDER BY date DESC LIMIT 1').catch(() => ({ rows: [] })),
        ]);

        const priceUSD = tokenPrice.rows.length > 0 ? parseFloat(tokenPrice.rows[0].price_usd) : 0.10;
        const change24h = tokenPrice.rows.length > 0 ? parseFloat(tokenPrice.rows[0].change_24h || 0) : 0;
        const totalSupply = 100_000_000; // 100M BEZ from deploy-config
        const totalStaked = parseFloat(stakingAgg.rows[0].total_staked);
        const circulatingSupply = totalSupply * 0.428; // 42.8% circulating as per tokenomics
        const marketCap = priceUSD * circulatingSupply;
        const tvl = parseFloat(farmingAgg.rows[0].tvl);
        const analytics = latestAnalytics.rows[0] || {};

        res.json({
            success: true,
            network: {
                validatorsTotal: parseInt(validators.rows[0].total),
                validatorsActive: parseInt(validators.rows[0].active),
                bridgeVolume: bridgeVol.rows[0].total,
                totalTransactions: parseInt(txCount.rows[0].total),
                chainId: 2708,
                status: 'operational',
                uptime: 99.99,
            },
            token: {
                priceUSD,
                change24h,
                totalSupply,
                circulatingSupply,
                marketCap,
                symbol: 'BEZ',
            },
            staking: {
                totalStaked,
                activePositions: parseInt(stakingAgg.rows[0].active_positions),
                apr: 12.4, // base APR from staking contract config
            },
            defi: {
                tvl: tvl * priceUSD, // TVL in USD
                tvlBEZ: tvl,
                activeFarms: parseInt(farmingAgg.rows[0].active_farms),
            },
            commerce: {
                totalNFTs: parseInt(nftCount.rows[0].total),
                newMints24h: parseInt(analytics.new_nfts_minted || 0),
                dailyTransactions: parseInt(analytics.total_transactions || 0),
                dailyVolume: parseFloat(analytics.total_volume_bez || 0),
                activeUsers: parseInt(analytics.active_users || 0),
            },
        });
    } catch (error) {
        logger.error(error, 'Network stats failed');
        res.status(500).json({ error: 'Failed to fetch network stats' });
    }
});

// ═══════════════════════════════════════════════════════════
//  CHAT / LLM GATEWAY — Internal AI proxy for UnifiedAgent
//  Called by UnifiedAgent._callLLM via AI_GATEWAY_URL
// ═══════════════════════════════════════════════════════════

/**
 * Internal auth for agent-to-gateway calls.
 * Uses INTERNAL_API_KEY (shared secret, NOT the gateway API key).
 */
const requireInternalKey = (req, res, next) => {
    const key = req.headers['authorization']?.replace('Bearer ', '') || req.headers['x-internal-key'];
    const expected = process.env.INTERNAL_API_KEY || 'dev-internal-key';
    if (!key || key !== expected) {
        return res.status(401).json({ error: 'Internal auth required' });
    }
    next();
};

/**
 * Build a provider-agnostic chat request.
 * Priority: DeepSeek → Gemini → fallback
 */
async function callLLMProvider(messages) {
    const axios = require('axios');

    // ── DeepSeek ──────────────────────────────────────────
    if (process.env.DEEPSEEK_API_KEY) {
        try {
            const res = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                { model: 'deepseek-chat', messages, max_tokens: 1024, temperature: 0.7 },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                }
            );
            return res.data?.choices?.[0]?.message?.content || null;
        } catch (e) {
            logger.warn({ err: e.message }, 'DeepSeek failed, trying Gemini');
        }
    }

    // ── Gemini ────────────────────────────────────────────
    if (process.env.GEMINI_API_KEY) {
        try {
            // Convert messages to Gemini format (contents array)
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                }));

            const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

            const res = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents,
                    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
                },
                { timeout: 30000 }
            );
            return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (e) {
            logger.warn({ err: e.message }, 'Gemini failed, using fallback');
        }
    }

    return null; // No LLM available
}

/**
 * POST /chat — Sync LLM call from UnifiedAgent (non-streaming).
 */
router.post('/chat', requireInternalKey, async (req, res) => {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array required' });
    }

    try {
        const text = await callLLMProvider(messages);
        if (text) {
            return res.json({
                choices: [{ message: { role: 'assistant', content: text } }],
                provider: process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'gemini',
            });
        }
        // Graceful fallback when no LLM is configured
        return res.json({ text: null, fallback: true });
    } catch (err) {
        logger.error({ err: err.message }, 'Gateway /chat error');
        res.status(500).json({ error: 'LLM call failed', message: err.message });
    }
});

/**
 * POST /chat/stream — Streaming LLM call (SSE) from UnifiedAgent.
 * Emits OpenAI-compatible SSE: "data: {choices:[{delta:{content:'...'}}]}\n\n"
 */
router.post('/chat/stream', requireInternalKey, async (req, res) => {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendChunk = (content) => {
        const data = JSON.stringify({ choices: [{ delta: { content } }] });
        res.write(`data: ${data}\n\n`);
        if (typeof res.flush === 'function') res.flush();
    };

    try {
        const axios = require('axios');

        // ── DeepSeek streaming ──────────────────────────────
        if (process.env.DEEPSEEK_API_KEY) {
            try {
                const response = await axios.post(
                    'https://api.deepseek.com/v1/chat/completions',
                    { model: 'deepseek-chat', messages, max_tokens: 1024, temperature: 0.7, stream: true },
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
                            'Content-Type': 'application/json',
                            Accept: 'text/event-stream',
                        },
                        responseType: 'stream',
                        timeout: 60000,
                    }
                );

                let buffer = '';
                response.data.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            const json = line.slice(5).trim();
                            if (json === '[DONE]') return;
                            try {
                                const parsed = JSON.parse(json);
                                const token = parsed.choices?.[0]?.delta?.content || '';
                                if (token) sendChunk(token);
                            } catch { /* malformed — skip */ }
                        }
                    }
                });

                await new Promise((resolve, reject) => {
                    response.data.on('end', resolve);
                    response.data.on('error', reject);
                });

                res.write('data: [DONE]\n\n');
                return res.end();
            } catch (e) {
                logger.warn({ err: e.message }, 'DeepSeek stream failed, falling back to Gemini');
            }
        }

        // ── Gemini fallback (non-streaming, but chunked for UX) ──────────
        const text = await callLLMProvider(messages);
        if (text) {
            // Emit word-by-word to simulate streaming
            const words = text.split(' ');
            for (let i = 0; i < words.length; i += 4) {
                sendChunk(words.slice(i, i + 4).join(' ') + (i + 4 < words.length ? ' ' : ''));
                await new Promise(r => setTimeout(r, 20));
            }
        } else {
            sendChunk('Sin LLM configurado. Añade DEEPSEEK_API_KEY o GEMINI_API_KEY al .env.');
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (err) {
        logger.error({ err: err.message }, 'Gateway /chat/stream error');
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

module.exports = router;
