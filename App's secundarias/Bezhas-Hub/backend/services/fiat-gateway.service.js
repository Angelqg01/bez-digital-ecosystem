const { ethers } = require('ethers');
require('dotenv').config();
const settingsHelper = require('../utils/settingsHelper');
const tokenomics = require('../config/tokenomics.config');
const priceOracle = require('./price-oracle.service');

// --- CONFIGURATION (from tokenomics) ---
const PROVIDER_URL = tokenomics.blockchain.polygonMainnet;
const HOT_WALLET_PK = process.env.HOT_WALLET_PRIVATE_KEY;
const SAFE_ADDRESS = tokenomics.blockchain.safeAddress;
const HOT_WALLET_ADDRESS = tokenomics.blockchain.hotWalletAddress;
const BEZ_TOKEN_ADDRESS = tokenomics.token.address;

// Minimal ABI for ERC20
const TOKEN_ABI = [
    "function transferFrom(address sender, address recipient, uint256 amount) public returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

// Initialize Provider & Wallet
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
let hotWalletSigner;
let bezContract;

// Safety check for Private Key
if (HOT_WALLET_PK) {
    try {
        hotWalletSigner = new ethers.Wallet(HOT_WALLET_PK, provider);
        bezContract = new ethers.Contract(BEZ_TOKEN_ADDRESS, TOKEN_ABI, hotWalletSigner);
        console.log('✅ Fiat Gateway Service initialized with Hot Wallet:', HOT_WALLET_ADDRESS);
    } catch (error) {
        console.error('❌ Error initializing Hot Wallet:', error.message);
    }
} else {
    console.warn("⚠️ HOT_WALLET_PRIVATE_KEY is missing in .env. Fiat Gateway will not work.");
    // Initialize read-only contract
    bezContract = new ethers.Contract(BEZ_TOKEN_ADDRESS, TOKEN_ABI, provider);
}

/**
 * Get Fiat Gateway configuration from GlobalSettings
 * @returns {Promise<object>} Fiat configuration
 */
async function getFiatConfig() {
    return await settingsHelper.getFiatConfig();
}

/**
 * Check if fiat gateway is enabled
 * @returns {Promise<boolean>}
 */
async function isFiatEnabled() {
    return await settingsHelper.isEnabled('fiatGateway');
}

/**
 * Get current BEZ Price in EUR from QuickSwap Oracle (precio spot)
 * @param {boolean} withSpread - Si true, aplica spread de protección
 * @returns {Promise<number>} Price in EUR per BEZ
 */
async function getBezPriceInEur(withSpread = false) {
    return await priceOracle.getBezEurPrice(withSpread);
}

/**
 * Get current BEZ Price in USD from QuickSwap Oracle (precio spot)
 * @param {boolean} withSpread - Si true, aplica spread de protección
 * @returns {Promise<number>} Price in USD per BEZ
 */
async function getBezPriceInUsd(withSpread = false) {
    return await priceOracle.getBezUsdPrice(withSpread);
}

/**
 * Get sale prices (with 2% spread protection for anti-arbitrage)
 * Este es el precio oficial para ventas FIAT en BeZhas
 * @returns {Promise<object>} Sale price data with spread
 */
async function getSalePrices() {
    return await priceOracle.getSalePrices();
}

/**
 * Get complete price information
 * @returns {Promise<object>} Complete price data
 */
async function getPriceInfo() {
    return await priceOracle.getOracleInfo();
}

/**
 * Calculate how many BEZ tokens the user will receive for a given EUR amount
 * @param {number} amountEur - Amount in Euros
 * @returns {Promise<number>} - Amount of BEZ tokens
 */
async function calculateBezOutput(amountEur) {
    const price = await getBezPriceInEur();
    return amountEur / price;
}

/**
 * EXECUTES AUTOMATIC DISPERSION FROM SAFE WALLET
 * @param {string} clientAddress - User Polygon Address
 * @param {number} amountEur - Fiat Amount Received via Bank Transfer
 * @returns {Promise<object>} - Transaction result
 */
async function processFiatPayment(clientAddress, amountEur) {
    // Check if fiat gateway is enabled
    const enabled = await isFiatEnabled();
    if (!enabled) {
        throw new Error("Fiat Gateway is currently disabled by admin");
    }

    if (!hotWalletSigner) {
        throw new Error("Server wallet not configured. Check HOT_WALLET_PRIVATE_KEY in .env");
    }

    // Get dynamic configuration
    const config = await getFiatConfig();

    // Validate against limits
    if (amountEur < config.minPurchase) {
        throw new Error(`Minimum purchase is ${config.minPurchase}€`);
    }
    if (amountEur > config.maxPurchase) {
        throw new Error(`Maximum purchase is ${config.maxPurchase}€`);
    }

    try {
        console.log(`🔄 Processing payment of ${amountEur}€ for ${clientAddress}...`);

        // 1. Calculate Tokens
        const price = await getBezPriceInEur();
        const tokensToSend = amountEur / price;
        const decimals = await bezContract.decimals(); // Usually 18

        // Convert to BigInt (Wei)
        // Fixed to 4 decimal places for calculation to avoid float errors, then parsed
        const amountWei = ethers.parseUnits(tokensToSend.toFixed(4), decimals);

        console.log(`💎 Calculated Amount: ${tokensToSend} BEZ (${ethers.formatUnits(amountWei, decimals)} BEZ)`);

        // 2. Security Checks
        // A. Check Safe Balance
        const safeBalance = await bezContract.balanceOf(SAFE_ADDRESS);
        console.log(`🏦 Safe Balance: ${ethers.formatUnits(safeBalance, decimals)} BEZ`);

        if (safeBalance < amountWei) {
            throw new Error(`⚠️ Safe Wallet insufficient funds. Has: ${ethers.formatUnits(safeBalance, decimals)} BEZ, needs: ${ethers.formatUnits(amountWei, decimals)} BEZ`);
        }

        // B. Check Allowance (Crucial Step: Safe must have approved Hot Wallet)
        const allowance = await bezContract.allowance(SAFE_ADDRESS, HOT_WALLET_ADDRESS);
        console.log(`🔑 Allowance: ${ethers.formatUnits(allowance, decimals)} BEZ`);

        if (allowance < amountWei) {
            throw new Error(`⚠️ Hot Wallet needs 'approve()' from Safe Wallet. Current allowance: ${ethers.formatUnits(allowance, decimals)} BEZ, needs: ${ethers.formatUnits(amountWei, decimals)} BEZ`);
        }

        // 3. Execute Transfer (Gas is paid by Hot Wallet/Server)
        console.log(`📤 Executing transferFrom: ${SAFE_ADDRESS} -> ${clientAddress} (${ethers.formatUnits(amountWei, decimals)} BEZ)`);

        const tx = await bezContract.transferFrom(SAFE_ADDRESS, clientAddress, amountWei, {
            gasLimit: 100000 // Set reasonable gas limit
        });

        console.log(`⏳ TX Sent: ${tx.hash}`);
        console.log(`🔗 View on PolygonScan: https://amoy.polygonscan.com/tx/${tx.hash}`);

        const receipt = await tx.wait();

        console.log(`✅ Success! Tokens transferred in block ${receipt.blockNumber}`);

        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            tokensSent: tokensToSend,
            rate: price,
            eurProcessed: amountEur,
            explorerUrl: `https://amoy.polygonscan.com/tx/${tx.hash}`
        };

    } catch (error) {
        console.error("❌ Error in fiatGateway:", error.message);

        // Enhanced error messages for common issues
        if (error.message.includes('insufficient funds')) {
            throw new Error('Hot Wallet needs MATIC for gas fees. Please fund the wallet.');
        }

        if (error.message.includes('execution reverted')) {
            throw new Error('Transaction reverted. Check Safe balance and allowance.');
        }

        throw error;
    }
}

/**
 * Get Safe Wallet Status
 * @returns {Promise<object>} - Safe wallet info
 */
async function getSafeStatus() {
    try {
        const decimals = await bezContract.decimals();
        const safeBalance = await bezContract.balanceOf(SAFE_ADDRESS);
        const allowance = await bezContract.allowance(SAFE_ADDRESS, HOT_WALLET_ADDRESS);

        // Check Hot Wallet MATIC balance for gas
        const hotWalletMaticBalance = await provider.getBalance(HOT_WALLET_ADDRESS);

        return {
            safeAddress: SAFE_ADDRESS,
            hotWalletAddress: HOT_WALLET_ADDRESS,
            bezBalance: ethers.formatUnits(safeBalance, decimals),
            allowance: ethers.formatUnits(allowance, decimals),
            hotWalletMaticBalance: ethers.formatEther(hotWalletMaticBalance),
            isConfigured: !!hotWalletSigner,
            needsApproval: allowance === 0n
        };
    } catch (error) {
        console.error('Error getting Safe status:', error.message);
        throw error;
    }
}

/**
 * Get Bank Details for Frontend
 * @returns {object} - Bank account information
 */
function getBankDetails() {
    return {
        bankName: "BeZhas Platform",
        iban: "ES77 1465 0100 91 1766376210",
        bic: "INGDESMMXXX",
        beneficiary: "bez.digital",
        instructions: "Include your wallet address in the transfer concept/reference"
    };
}

/**
 * Dispense BEZ tokens directly from Hot Wallet (for Stripe payments)
 * @param {string} recipientAddress - User's wallet address
 * @param {number} bezAmount - Amount of BEZ tokens to send
 * @returns {Promise<object>} - Transaction result
 */
async function dispenseTokens(recipientAddress, bezAmount) {
    if (!hotWalletSigner) {
        throw new Error("Hot Wallet not configured. Check HOT_WALLET_PRIVATE_KEY in .env");
    }

    try {
        console.log(`💸 Dispensing ${bezAmount} BEZ to ${recipientAddress}...`);

        const decimals = await bezContract.decimals();
        const amountWei = ethers.parseUnits(bezAmount.toFixed(4), decimals);

        // Check Hot Wallet balance (not Safe, since we're transferring directly)
        const hotWalletBalance = await bezContract.balanceOf(HOT_WALLET_ADDRESS);
        console.log(`🔑 Hot Wallet Balance: ${ethers.formatUnits(hotWalletBalance, decimals)} BEZ`);

        if (hotWalletBalance < amountWei) {
            throw new Error(`Hot Wallet insufficient balance. Has: ${ethers.formatUnits(hotWalletBalance, decimals)} BEZ, needs: ${bezAmount} BEZ`);
        }

        // Check MATIC for gas
        const maticBalance = await provider.getBalance(HOT_WALLET_ADDRESS);
        console.log(`⛽ Hot Wallet MATIC: ${ethers.formatEther(maticBalance)} MATIC`);

        if (maticBalance < ethers.parseEther('0.01')) {
            throw new Error('Hot Wallet needs more MATIC for gas. Please fund with at least 0.01 MATIC.');
        }

        // Execute transfer directly from Hot Wallet
        const tx = await bezContract.transfer(recipientAddress, amountWei, {
            gasLimit: 100000
        });

        console.log(`⏳ TX Sent: ${tx.hash}`);
        console.log(`🔗 PolygonScan: https://amoy.polygonscan.com/tx/${tx.hash}`);

        const receipt = await tx.wait();

        console.log(`✅ Tokens dispensed successfully in block ${receipt.blockNumber}`);

        return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            tokensSent: bezAmount,
            explorerUrl: `https://amoy.polygonscan.com/tx/${tx.hash}`
        };

    } catch (error) {
        console.error("❌ Error dispensing tokens:", error.message);

        if (error.message.includes('insufficient funds')) {
            throw new Error('Hot Wallet needs MATIC for gas fees.');
        }

        throw error;
    }
}

module.exports = {
    processFiatPayment,
    getBezPriceInEur,
    getBezPriceInUsd,
    getSalePrices,
    getPriceInfo,
    calculateBezOutput,
    getSafeStatus,
    getBankDetails,
    dispenseTokens,
    getFiatConfig,
    isFiatEnabled
};
