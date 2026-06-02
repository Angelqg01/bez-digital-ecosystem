/**
 * @fileoverview Token Distribution Service - Distribución Atómica de BEZ-Coin
 * @description Gestiona la distribución de tokens después de pagos FIAT (Stripe/SEPA)
 *              Incluye: 0.2% Burn + 1% Tesorería + Resto al Usuario
 * @version 2.0.0
 * @updated 2026-01-31
 */

const { ethers } = require('ethers');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const tokenomics = require('../config/tokenomics.config');
const settingsHelper = require('../utils/settingsHelper');

// ============================================================
// CONFIGURATION
// ============================================================

const PROVIDER_URL = tokenomics.blockchain.polygonMainnet;
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// Wallet configurations
const HOT_WALLET_PK = process.env.HOT_WALLET_PRIVATE_KEY;
const HOT_WALLET_ADDRESS = tokenomics.blockchain.hotWalletAddress;
const BEZ_TOKEN_ADDRESS = tokenomics.token.address;
const BURN_ADDRESS = tokenomics.burn.address;
const TREASURY_ADDRESS = tokenomics.treasury.address;

/**
 * Obtiene las tasas actuales de distribución desde el sistema de configuración global
 * @returns {Promise<object>} Tasas actuales
 */
async function getCurrentRates() {
    const config = await settingsHelper.getTokenConfig();
    return {
        burn: config.burnRate || 20,
        treasury: config.treasuryRate || 100
    };
}

// ERC20 ABI for transfers
const TOKEN_ABI = [
    "function transfer(address recipient, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// Initialize signer and contract
let hotWalletSigner;
let bezContract;

if (HOT_WALLET_PK) {
    try {
        hotWalletSigner = new ethers.Wallet(HOT_WALLET_PK, provider);
        bezContract = new ethers.Contract(BEZ_TOKEN_ADDRESS, TOKEN_ABI, hotWalletSigner);
        
        // Log setup but rates will be dynamic per transaction
        logger.info({
            hotWallet: HOT_WALLET_ADDRESS,
            burnAddress: BURN_ADDRESS,
            treasuryAddress: TREASURY_ADDRESS,
        }, '✅ Token Distribution Service initialized (using GlobalSettings)');
    } catch (error) {
        logger.error({ error: error.message }, '❌ Error initializing Token Distribution Service');
    }
} else {
    logger.warn('⚠️ HOT_WALLET_PRIVATE_KEY missing - Distribution service will not work');
    bezContract = new ethers.Contract(BEZ_TOKEN_ADDRESS, TOKEN_ABI, provider);
}

/**
 * Calcula la distribución de tokens para una compra FIAT usando tasas dinámicas
 * @param {number} totalBez - Cantidad total de BEZ a distribuir
 * @param {object} overrideRates - Opcional: Tasas para forzar
 * @returns {Promise<object>} Desglose de la distribución
 */
async function calculateDistribution(totalBez, overrideRates = null) {
    const rates = overrideRates || await getCurrentRates();
    
    // Calcular cada componente
    const burnAmount = (totalBez * rates.burn) / 10000;
    const treasuryAmount = (totalBez * rates.treasury) / 10000;
    const userAmount = totalBez - burnAmount - treasuryAmount;

    return {
        total: totalBez,
        user: userAmount,
        burn: burnAmount,
        treasury: treasuryAmount,
        rates: {
            burnPercent: rates.burn / 100,
            treasuryPercent: rates.treasury / 100,
            userPercent: (10000 - rates.burn - rates.treasury) / 100
        }
    };
}

/**
 * Ejecuta la distribución atómica de tokens
 * Esta función realiza 3 transferencias en secuencia (no atómicas on-chain)
 * Para atomicidad real, se necesitaría un contrato de distribución
 * 
 * @param {string} userWallet - Dirección del usuario
 * @param {number} totalBez - Cantidad total de BEZ comprados
 * @returns {Promise<object>} Resultado de las transacciones
 */
async function distributeTokens(userWallet, totalBez) {
    if (!hotWalletSigner) {
        throw new Error('Hot Wallet not configured. Check HOT_WALLET_PRIVATE_KEY in .env');
    }

    if (!userWallet || !ethers.isAddress(userWallet)) {
        throw new Error('Invalid user wallet address');
    }

    if (!totalBez || totalBez <= 0) {
        throw new Error('Invalid BEZ amount');
    }

    const distribution = await calculateDistribution(totalBez);

    logger.info({
        userWallet,
        distribution
    }, '🔄 Starting atomic token distribution');

    const decimals = await bezContract.decimals();
    const results = {
        success: false,
        distribution,
        transactions: {
            user: null,
            burn: null,
            treasury: null
        },
        errors: []
    };

    try {
        // 1. Verificar balance del Hot Wallet
        const hotWalletBalance = await bezContract.balanceOf(HOT_WALLET_ADDRESS);
        const totalNeeded = ethers.parseUnits(totalBez.toFixed(4), decimals);

        logger.info({
            hotWalletBalance: ethers.formatUnits(hotWalletBalance, decimals),
            totalNeeded: totalBez
        }, '🏦 Checking Hot Wallet balance');

        if (hotWalletBalance < totalNeeded) {
            throw new Error(`Hot Wallet insufficient balance. Has: ${ethers.formatUnits(hotWalletBalance, decimals)} BEZ, needs: ${totalBez} BEZ`);
        }

        // 2. Verificar MATIC para gas
        const maticBalance = await provider.getBalance(HOT_WALLET_ADDRESS);
        if (maticBalance < ethers.parseEther('0.03')) { // 3 txs * ~0.01 MATIC
            throw new Error('Hot Wallet needs more MATIC for gas (at least 0.03 MATIC for 3 transfers)');
        }

        // ============================================================
        // DISTRIBUCIÓN ATÓMICA (3 transferencias secuenciales)
        // ============================================================

        // 3A. Transfer to USER (98.8% del total)
        const userAmountWei = ethers.parseUnits(distribution.user.toFixed(4), decimals);
        logger.info({ to: userWallet, amount: distribution.user }, '📤 Transferring to user');

        const userTx = await bezContract.transfer(userWallet, userAmountWei, {
            gasLimit: 100000
        });
        const userReceipt = await userTx.wait();
        results.transactions.user = {
            txHash: userTx.hash,
            blockNumber: userReceipt.blockNumber,
            amount: distribution.user,
            gasUsed: userReceipt.gasUsed.toString()
        };
        logger.info({ txHash: userTx.hash }, '✅ User transfer completed');

        // 3B. Transfer to BURN ADDRESS (0.2%)
        if (distribution.burn > 0 && tokenomics.burn.enabled) {
            const burnAmountWei = ethers.parseUnits(distribution.burn.toFixed(4), decimals);
            logger.info({ to: BURN_ADDRESS, amount: distribution.burn }, '🔥 Burning tokens');

            const burnTx = await bezContract.transfer(BURN_ADDRESS, burnAmountWei, {
                gasLimit: 100000
            });
            const burnReceipt = await burnTx.wait();
            results.transactions.burn = {
                txHash: burnTx.hash,
                blockNumber: burnReceipt.blockNumber,
                amount: distribution.burn,
                gasUsed: burnReceipt.gasUsed.toString()
            };
            logger.info({ txHash: burnTx.hash }, '✅ Burn transfer completed');
        }

        // 3C. Transfer to TREASURY (1%)
        if (distribution.treasury > 0) {
            const treasuryAmountWei = ethers.parseUnits(distribution.treasury.toFixed(4), decimals);
            logger.info({ to: TREASURY_ADDRESS, amount: distribution.treasury }, '💰 Sending to treasury');

            const treasuryTx = await bezContract.transfer(TREASURY_ADDRESS, treasuryAmountWei, {
                gasLimit: 100000
            });
            const treasuryReceipt = await treasuryTx.wait();
            results.transactions.treasury = {
                txHash: treasuryTx.hash,
                blockNumber: treasuryReceipt.blockNumber,
                amount: distribution.treasury,
                gasUsed: treasuryReceipt.gasUsed.toString()
            };
            logger.info({ txHash: treasuryTx.hash }, '✅ Treasury transfer completed');
        }

        results.success = true;

        logger.info({
            userWallet,
            userReceived: distribution.user,
            burned: distribution.burn,
            treasury: distribution.treasury,
            userTxHash: results.transactions.user?.txHash,
            burnTxHash: results.transactions.burn?.txHash,
            treasuryTxHash: results.transactions.treasury?.txHash
        }, '🎉 Atomic distribution completed successfully');

        return results;

    } catch (error) {
        logger.error({
            error: error.message,
            userWallet,
            totalBez,
            distribution,
            completedTxs: results.transactions
        }, '❌ Error in atomic distribution');

        results.errors.push(error.message);

        // Si falló después de la transferencia al usuario, loggear para reconciliación manual
        if (results.transactions.user && (!results.transactions.burn || !results.transactions.treasury)) {
            logger.error({
                userWallet,
                userTxHash: results.transactions.user.txHash,
                pendingBurn: !results.transactions.burn,
                pendingTreasury: !results.transactions.treasury
            }, '⚠️ PARTIAL DISTRIBUTION - Requires manual reconciliation');
        }

        throw error;
    }
}

/**
 * Obtiene estadísticas de distribución incluyendo las tasas dinámicas
 * @returns {Promise<object>} Estadísticas de configuración
 */
async function getDistributionStats() {
    const rates = await getCurrentRates();
    const config = await settingsHelper.getTokenConfig();

    return {
        rates: {
            burn: rates.burn / 100 + '%',
            treasury: rates.treasury / 100 + '%',
            user: (10000 - rates.burn - rates.treasury) / 100 + '%'
        },
        addresses: {
            hotWallet: HOT_WALLET_ADDRESS,
            burn: BURN_ADDRESS,
            treasury: TREASURY_ADDRESS,
            token: BEZ_TOKEN_ADDRESS
        },
        enabled: {
            burn: config.burningEnabled,
            service: !!hotWalletSigner
        }
    };
}

/**
 * Simula una distribución sin ejecutar transacciones usando tasas dinámicas
 * @param {number} totalBez - Cantidad a simular
 * @returns {Promise<object>} Distribución simulada
 */
async function simulateDistribution(totalBez) {
    return await calculateDistribution(totalBez);
}

module.exports = {
    distributeTokens,
    calculateDistribution,
    getDistributionStats,
    simulateDistribution,
    getCurrentRates
};
