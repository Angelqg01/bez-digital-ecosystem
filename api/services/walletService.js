/**
 * walletService.js — Smart Wallet interaction layer.
 * 
 * Provides on-chain read/write operations for:
 * - SmartWallet (AA) + Factory  
 * - MultiSigWallet (Enterprise)
 * - Paymaster (Gas Sponsorship)
 * - SecurityModule (Global Security)
 * - WalletGuardian (Social Recovery Registry)
 */
const { ethers } = require('ethers');
const { getContract, getSignedContract, getProvider, getBEZBalance } = require('./contractService');
const { query } = require('../db/pool');
const { cacheGet, cacheSet, cacheDelete } = require('../cache/redis');
const walletVault = require('./walletVaultService');

function normalizeAddress(address) {
    return String(address || '').toLowerCase();
}

// ═══════════════════════════════════════════════
//  SMART WALLET (Account Abstraction)
// ═══════════════════════════════════════════════

async function createSmartWallet(ownerAddress, guardianAddress, dailyLimit, salt) {
    const factory = await getSignedContract('SmartWalletFactory');
    const normalizedOwner = ethers.getAddress(ownerAddress);
    const bytesSalt = salt || ethers.randomBytes(32);
    const limitWei = ethers.parseEther(String(dailyLimit || 0));
    const tx = typeof factory.createWalletFor === 'function'
        ? await factory.createWalletFor(
            normalizedOwner,
            guardianAddress || ethers.ZeroAddress,
            limitWei,
            bytesSalt
        )
        : await factory.createWallet(
            guardianAddress || ethers.ZeroAddress,
            limitWei,
            bytesSalt
        );
    const receipt = await tx.wait();

    // Parse WalletCreated event
    const event = receipt.logs.find(l => {
        try { return factory.interface.parseLog(l)?.name === 'WalletCreated'; } catch { return false; }
    });

    const parsed = factory.interface.parseLog(event);
    const walletAddress = parsed.args.wallet;
    const eventOwner = parsed.args.owner || normalizedOwner;

    // Store in DB
    await query(
        `INSERT INTO smart_wallets (owner_address, wallet_address, guardian_address, daily_limit, tx_hash, chain_id, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
         ON CONFLICT (wallet_address) DO UPDATE
           SET owner_address = EXCLUDED.owner_address,
               guardian_address = EXCLUDED.guardian_address,
               daily_limit = EXCLUDED.daily_limit,
               tx_hash = EXCLUDED.tx_hash,
               status = 'active',
               updated_at = NOW()`,
        [
            normalizeAddress(eventOwner),
            normalizeAddress(walletAddress),
            guardianAddress ? normalizeAddress(guardianAddress) : null,
            dailyLimit || 0,
            tx.hash,
            Number(receipt.chainId || process.env.BEZHAS_CHAIN_ID || 2708),
        ]
    );

    await cacheDelete(`wallets:${normalizeAddress(eventOwner)}`);

    return {
        ownerAddress: normalizeAddress(eventOwner),
        walletAddress: normalizeAddress(walletAddress),
        txHash: tx.hash,
        dailyLimit,
        onChain: true,
    };
}

async function getSmartWalletInfo(walletAddress) {
    const cacheKey = `sw:${walletAddress}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const wallet = await getContract('SmartWallet');
    const walletContract = wallet.attach(walletAddress);

    const [owner, guardian, isLocked, dailyLimit, nonce] = await Promise.all([
        walletContract.owner(),
        walletContract.guardian(),
        walletContract.isLocked(),
        walletContract.dailyLimit(),
        walletContract.nonce(),
    ]);

    const provider = getProvider();
    const ethBalance = await provider.getBalance(walletAddress);

    const info = {
        address: walletAddress,
        owner,
        guardian,
        isLocked,
        dailyLimit: ethers.formatEther(dailyLimit),
        nonce: Number(nonce),
        ethBalance: ethers.formatEther(ethBalance),
    };

    await cacheSet(cacheKey, info, 30);
    return info;
}

async function getUserWallets(ownerAddress) {
    const cacheKey = `wallets:${ownerAddress}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const owner = normalizeAddress(ownerAddress);
    let chainWallets = [];
    try {
        const factory = await getContract('SmartWalletFactory');
        const wallets = await factory.getWalletsByOwner(owner);
        chainWallets = wallets.map(w => normalizeAddress(w));
    } catch (_) {
        chainWallets = [];
    }

    const { rows } = await query(
        `SELECT wallet_address
         FROM smart_wallets
         WHERE owner_address = $1 AND status IN ('pending', 'active')
         ORDER BY created_at ASC`,
        [owner]
    ).catch(() => ({ rows: [] }));

    const result = [...new Set([...chainWallets, ...rows.map(r => normalizeAddress(r.wallet_address))])];
    await cacheSet(cacheKey, result, 60);
    return result;
}

async function getRemainingDailyLimit(walletAddress) {
    const wallet = await getContract('SmartWallet');
    const walletContract = wallet.attach(walletAddress);
    const remaining = await walletContract.getRemainingDailyLimit();
    return ethers.formatEther(remaining);
}

// ═══════════════════════════════════════════════
//  MULTI-SIG WALLET (Enterprise)
// ═══════════════════════════════════════════════

async function getMultiSigInfo(msigAddress) {
    const cacheKey = `msig:${msigAddress}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const msig = await getContract('MultiSigWallet');
    const msigContract = msig.attach(msigAddress);

    const [signers, required, paused, dailyLimit, txCount] = await Promise.all([
        msigContract.getSigners(),
        msigContract.required(),
        msigContract.paused(),
        msigContract.dailyLimit(),
        msigContract.getTransactionCount(),
    ]);

    const provider = getProvider();
    const ethBalance = await provider.getBalance(msigAddress);

    const info = {
        address: msigAddress,
        signers: signers.map(s => s.toString()),
        required: Number(required),
        paused,
        dailyLimit: ethers.formatEther(dailyLimit),
        transactionCount: Number(txCount),
        ethBalance: ethers.formatEther(ethBalance),
    };

    await cacheSet(cacheKey, info, 30);
    return info;
}

async function getMultiSigPendingTxs(msigAddress) {
    const msig = await getContract('MultiSigWallet');
    const msigContract = msig.attach(msigAddress);
    const pending = await msigContract.getPendingTransactions();
    return pending.map(id => Number(id));
}

// ═══════════════════════════════════════════════
//  PAYMASTER (Gas Sponsorship)
// ═══════════════════════════════════════════════

async function getPaymasterEnterpriseInfo(enterpriseAddress) {
    const pm = await getContract('Paymaster');
    const [balance, remainingDaily] = await Promise.all([
        pm.getEnterpriseBalance(enterpriseAddress),
        pm.getEnterpriseRemainingDaily(enterpriseAddress),
    ]);

    const acct = await pm.enterprises(enterpriseAddress);

    return {
        balance: ethers.formatEther(balance),
        remainingDaily: ethers.formatEther(remainingDaily),
        dailyLimit: ethers.formatEther(acct.dailyLimit),
        maxGasPerTx: ethers.formatEther(acct.maxGasPerTx),
        isActive: acct.isActive,
    };
}

// ═══════════════════════════════════════════════
//  SECURITY MODULE
// ═══════════════════════════════════════════════

async function getSecurityStatus() {
    const cacheKey = 'sec:status';
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const sec = await getContract('SecurityModule');
    const [globalPause, guardians, pendingOps, auditCount] = await Promise.all([
        sec.globalPause(),
        sec.getGuardians(),
        sec.getPendingOperations(),
        sec.getAuditLogLength(),
    ]);

    const status = {
        globalPause,
        guardians: guardians.map(g => g.toString()),
        pendingOperations: pendingOps.length,
        auditLogEntries: Number(auditCount),
    };

    await cacheSet(cacheKey, status, 15);
    return status;
}

async function getRecentAuditLogs(count = 20) {
    const sec = await getContract('SecurityModule');
    const entries = await sec.getRecentAudits(count);
    return entries.map(e => ({
        timestamp: Number(e.timestamp),
        actor: e.actor,
        action: e.action,
        dataHash: e.dataHash,
    }));
}

// ═══════════════════════════════════════════════
//  WALLET GUARDIAN (Social Recovery Registry)
// ═══════════════════════════════════════════════

async function getWalletGuardians(walletAddress) {
    const wg = await getContract('WalletGuardian');
    const guardians = await wg.getWalletGuardians(walletAddress);

    const details = await Promise.all(guardians.map(async (g) => {
        const info = await wg.getGuardianInfo(walletAddress, g);
        return {
            address: g.toString(),
            registeredAt: Number(info.registeredAt),
            recoveryCount: Number(info.recoveryCount),
            isVerified: info.isVerified,
            label: info.label,
        };
    }));

    return details;
}

async function getGuardianTrustScore(guardianAddress) {
    const wg = await getContract('WalletGuardian');
    const score = await wg.guardianTrustScore(guardianAddress);
    return Number(score);
}

// ═══════════════════════════════════════════════
//  PORTFOLIO AGGREGATION
// ═══════════════════════════════════════════════

async function getWalletPortfolio(ownerAddress) {
    const cacheKey = `portfolio:${ownerAddress}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { getBEZBalance } = require('./contractService');
    const wallets = await getUserWallets(ownerAddress);

    const portfolio = {
        eoa: {
            address: ownerAddress,
            bezBalance: await getBEZBalance(ownerAddress),
        },
        smartWallets: [],
        totalBEZ: 0,
    };

    for (const wa of wallets) {
        const info = await getSmartWalletInfo(wa);
        const { getBEZBalance: getBal } = require('./contractService');
        const bezBal = await getBal(wa);
        portfolio.smartWallets.push({ ...info, bezBalance: bezBal });
    }

    portfolio.totalBEZ = parseFloat(portfolio.eoa.bezBalance) +
        portfolio.smartWallets.reduce((sum, w) => sum + parseFloat(w.bezBalance || 0), 0);

    await cacheSet(cacheKey, portfolio, 30);
    return portfolio;
}

async function getBalance(address) {
    const provider = getProvider();
    const [nativeBalance, bezBalance] = await Promise.all([
        provider.getBalance(address).then(v => ethers.formatEther(v)).catch(() => '0'),
        getBEZBalance(address).catch(() => '0'),
    ]);
    return {
        address: normalizeAddress(address),
        nativeBalance,
        bezBalance,
        symbol: 'BEZ',
    };
}

async function ensureFiatSafeWalletForUser(userId, options = {}) {
    const { rows } = await query(
        `SELECT id, wallet_address, primary_wallet_address, primary_smart_wallet_address,
                custody_mode, auth_type, email, role
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
    );
    if (rows.length === 0) throw new Error('User not found');
    const user = rows[0];

    let ownerAddress = user.primary_wallet_address || user.wallet_address;
    let managedWallet = null;

    if (!ownerAddress || user.custody_mode === 'managed' || user.auth_type === 'fiat') {
        managedWallet = await walletVault.getManagedWallet(userId);
        if (!managedWallet) managedWallet = await walletVault.createManagedWallet(userId);
        ownerAddress = managedWallet.address;
        await query(
            `UPDATE users
             SET wallet_address = COALESCE(wallet_address, $2),
                 primary_wallet_address = $2,
                 custody_mode = CASE WHEN custody_mode = 'external' THEN 'managed' ELSE custody_mode END,
                 auth_type = CASE WHEN auth_type = 'wallet' THEN 'fiat' ELSE auth_type END,
                 updated_at = NOW()
             WHERE id = $1`,
            [userId, ownerAddress]
        );
    }

    if (user.primary_smart_wallet_address) {
        return {
            userId,
            ownerAddress: normalizeAddress(ownerAddress),
            smartWalletAddress: normalizeAddress(user.primary_smart_wallet_address),
            custodyMode: user.custody_mode || 'managed',
            status: 'active',
            created: false,
        };
    }

    const existing = await query(
        `SELECT wallet_address, status
         FROM smart_wallets
         WHERE user_id = $1 AND purpose = 'primary'
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
    ).catch(() => ({ rows: [] }));

    if (existing.rows.length > 0) {
        await query(
            `UPDATE users
             SET primary_smart_wallet_address = $2, updated_at = NOW()
             WHERE id = $1`,
            [userId, existing.rows[0].wallet_address]
        );
        return {
            userId,
            ownerAddress: normalizeAddress(ownerAddress),
            smartWalletAddress: normalizeAddress(existing.rows[0].wallet_address),
            custodyMode: user.custody_mode || 'managed',
            status: existing.rows[0].status,
            created: false,
        };
    }

    const guardian = options.guardian || process.env.DEFAULT_WALLET_GUARDIAN || ethers.ZeroAddress;
    const dailyLimit = options.dailyLimit ?? process.env.DEFAULT_WALLET_DAILY_LIMIT_BEZ ?? 0;
    const salt = ethers.id(`${userId}:${ownerAddress}:primary`);

    try {
        const created = await createSmartWallet(ownerAddress, guardian, dailyLimit, salt);
        await query(
            `UPDATE smart_wallets
             SET user_id = $1, custody_mode = $2, purpose = 'primary', updated_at = NOW()
             WHERE wallet_address = $3`,
            [userId, user.custody_mode === 'external' ? 'external' : 'managed', created.walletAddress]
        );
        await query(
            `UPDATE users
             SET primary_wallet_address = $2,
                 primary_smart_wallet_address = $3,
                 updated_at = NOW()
             WHERE id = $1`,
            [userId, normalizeAddress(ownerAddress), created.walletAddress]
        );
        return {
            userId,
            ownerAddress: normalizeAddress(ownerAddress),
            smartWalletAddress: created.walletAddress,
            custodyMode: user.custody_mode === 'external' ? 'external' : 'managed',
            status: 'active',
            created: true,
            txHash: created.txHash,
        };
    } catch (error) {
        await query(
            `INSERT INTO smart_wallets (user_id, owner_address, wallet_address, guardian_address,
                                        daily_limit, custody_mode, purpose, status, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, 'primary', 'pending', $7)
             ON CONFLICT (wallet_address) DO NOTHING`,
            [
                userId,
                normalizeAddress(ownerAddress),
                normalizeAddress(ownerAddress),
                guardian === ethers.ZeroAddress ? null : normalizeAddress(guardian),
                dailyLimit,
                user.custody_mode === 'external' ? 'external' : 'managed',
                JSON.stringify({ provisioningError: error.message, mode: 'managed_eoa_pending_smart_wallet' }),
            ]
        );
        return {
            userId,
            ownerAddress: normalizeAddress(ownerAddress),
            smartWalletAddress: null,
            custodyMode: user.custody_mode === 'external' ? 'external' : 'managed',
            status: 'pending_onchain',
            created: false,
            error: error.message,
        };
    }
}

module.exports = {
    // SmartWallet
    createSmartWallet,
    getSmartWalletInfo,
    getUserWallets,
    getRemainingDailyLimit,
    getBalance,
    ensureFiatSafeWalletForUser,
    // MultiSig
    getMultiSigInfo,
    getMultiSigPendingTxs,
    // Paymaster
    getPaymasterEnterpriseInfo,
    // Security
    getSecurityStatus,
    getRecentAuditLogs,
    // Guardian
    getWalletGuardians,
    getGuardianTrustScore,
    // Portfolio
    getWalletPortfolio,
};
