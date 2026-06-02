/**
 * MoonPay Integration Service
 * Handles cryptocurrency purchase and sales through MoonPay widget
 */

const MOONPAY_BASE_URL = 'https://buy.moonpay.com';
const MOONPAY_SELL_URL = 'https://sell.moonpay.com';

// MoonPay API Keys (get from environment variables)
const MOONPAY_API_KEY_TEST = import.meta.env.VITE_MOONPAY_API_KEY_TEST || 'pk_test_demo';
const MOONPAY_API_KEY_LIVE = import.meta.env.VITE_MOONPAY_API_KEY_LIVE || '';
const MOONPAY_ENVIRONMENT = import.meta.env.VITE_MOONPAY_ENVIRONMENT || 'sandbox';

// Use test key in development, live key in production
const getApiKey = () => {
    return MOONPAY_ENVIRONMENT === 'production' ? MOONPAY_API_KEY_LIVE : MOONPAY_API_KEY_TEST;
};

/**
 * Build MoonPay URL for cryptocurrency purchase
 * @param {Object} params - Purchase parameters
 * @returns {string} MoonPay widget URL
 */
export const buildBuyUrl = (params = {}) => {
    const {
        currencyCode = 'eth',           // Crypto to buy (eth, btc, matic, etc.)
        walletAddress = '',             // User's wallet address
        baseCurrencyCode = 'usd',       // Fiat currency
        baseCurrencyAmount = '',        // Amount in fiat
        email = '',                     // User email
        colorCode = '#7C3AED',          // Brand color (BeZhas purple)
        redirectURL = '',               // Return URL after purchase
        externalTransactionId = '',     // Your internal transaction ID
        showWalletAddressForm = false,  // Show wallet input form
    } = params;

    const urlParams = new URLSearchParams({
        apiKey: getApiKey(),
        currencyCode,
        colorCode: colorCode.replace('#', ''),
    });

    // Add optional parameters
    if (walletAddress) urlParams.append('walletAddress', walletAddress);
    if (baseCurrencyCode) urlParams.append('baseCurrencyCode', baseCurrencyCode);
    if (baseCurrencyAmount) urlParams.append('baseCurrencyAmount', baseCurrencyAmount);
    if (email) urlParams.append('email', email);
    if (redirectURL) urlParams.append('redirectURL', redirectURL);
    if (externalTransactionId) urlParams.append('externalTransactionId', externalTransactionId);
    if (showWalletAddressForm) urlParams.append('showWalletAddressForm', 'true');

    return `${MOONPAY_BASE_URL}?${urlParams.toString()}`;
};

/**
 * Build MoonPay URL for cryptocurrency sale (off-ramp)
 * @param {Object} params - Sale parameters
 * @returns {string} MoonPay widget URL
 */
export const buildSellUrl = (params = {}) => {
    const {
        currencyCode = 'eth',           // Crypto to sell
        baseCurrencyCode = 'usd',       // Fiat currency to receive
        refundWalletAddress = '',       // Wallet for refunds
        email = '',                     // User email
        colorCode = '#7C3AED',          // Brand color
        redirectURL = '',               // Return URL
        externalTransactionId = '',     // Your internal transaction ID
    } = params;

    const urlParams = new URLSearchParams({
        apiKey: getApiKey(),
        currencyCode,
        colorCode: colorCode.replace('#', ''),
    });

    // Add optional parameters
    if (refundWalletAddress) urlParams.append('refundWalletAddress', refundWalletAddress);
    if (baseCurrencyCode) urlParams.append('baseCurrencyCode', baseCurrencyCode);
    if (email) urlParams.append('email', email);
    if (redirectURL) urlParams.append('redirectURL', redirectURL);
    if (externalTransactionId) urlParams.append('externalTransactionId', externalTransactionId);

    return `${MOONPAY_SELL_URL}?${urlParams.toString()}`;
};

/**
 * Build MoonPay URL for NFT purchase
 * @param {Object} params - NFT purchase parameters
 * @returns {string} MoonPay widget URL
 */
export const buildNFTUrl = (params = {}) => {
    const {
        contractAddress = '',           // NFT contract address
        tokenId = '',                   // NFT token ID
        walletAddress = '',             // User's wallet address
        email = '',                     // User email
        colorCode = '#7C3AED',          // Brand color
        redirectURL = '',               // Return URL
    } = params;

    const urlParams = new URLSearchParams({
        apiKey: getApiKey(),
        colorCode: colorCode.replace('#', ''),
    });

    if (contractAddress) urlParams.append('nftData.contractAddress', contractAddress);
    if (tokenId) urlParams.append('nftData.tokenId', tokenId);
    if (walletAddress) urlParams.append('walletAddress', walletAddress);
    if (email) urlParams.append('email', email);
    if (redirectURL) urlParams.append('redirectURL', redirectURL);

    return `${MOONPAY_BASE_URL}?${urlParams.toString()}`;
};

/**
 * Open MoonPay widget in a popup window
 * @param {string} url - MoonPay URL
 * @param {Object} options - Window options
 * @returns {Window} Popup window reference
 */
export const openMoonPayPopup = (url, options = {}) => {
    const {
        width = 450,
        height = 700,
        onClose = null,
    } = options;

    // Center the popup
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
        url,
        'MoonPay',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    // Monitor popup close
    if (popup && onClose) {
        const timer = setInterval(() => {
            if (popup.closed) {
                clearInterval(timer);
                onClose();
            }
        }, 500);
    }

    return popup;
};

/**
 * Get supported cryptocurrencies
 * @returns {Array} List of supported cryptos
 */
export const getSupportedCryptocurrencies = () => [
    { code: 'eth', name: 'Ethereum', symbol: 'ETH' },
    { code: 'btc', name: 'Bitcoin', symbol: 'BTC' },
    { code: 'matic', name: 'Polygon', symbol: 'MATIC' },
    { code: 'usdc', name: 'USD Coin', symbol: 'USDC' },
    { code: 'usdt', name: 'Tether', symbol: 'USDT' },
    { code: 'sol', name: 'Solana', symbol: 'SOL' },
    { code: 'ada', name: 'Cardano', symbol: 'ADA' },
    { code: 'dot', name: 'Polkadot', symbol: 'DOT' },
    { code: 'avax', name: 'Avalanche', symbol: 'AVAX' },
    { code: 'link', name: 'Chainlink', symbol: 'LINK' },
];

/**
 * Get supported fiat currencies
 * @returns {Array} List of supported fiat
 */
export const getSupportedFiatCurrencies = () => [
    { code: 'usd', name: 'US Dollar', symbol: '$' },
    { code: 'eur', name: 'Euro', symbol: '€' },
    { code: 'gbp', name: 'British Pound', symbol: '£' },
    { code: 'cad', name: 'Canadian Dollar', symbol: 'CA$' },
    { code: 'aud', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'jpy', name: 'Japanese Yen', symbol: '¥' },
    { code: 'mxn', name: 'Mexican Peso', symbol: 'MX$' },
    { code: 'brl', name: 'Brazilian Real', symbol: 'R$' },
];

/**
 * Validate wallet address format
 * @param {string} address - Wallet address
 * @returns {boolean} Is valid
 */
export const isValidWalletAddress = (address) => {
    if (!address) return false;
    // Basic Ethereum address validation
    return /^0x[a-fA-F0-9]{40}$/.test(address);
};

/**
 * Get MoonPay transaction status
 * @param {string} transactionId - MoonPay transaction ID
 * @returns {Promise<Object>} Transaction data
 */
export const getTransactionStatus = async (transactionId) => {
    // This requires server-side implementation with secret key
    // Frontend should call your backend API
    try {
        const response = await fetch(`/api/moonpay/transaction/${transactionId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching MoonPay transaction:', error);
        throw error;
    }
};

export default {
    buildBuyUrl,
    buildSellUrl,
    buildNFTUrl,
    openMoonPayPopup,
    getSupportedCryptocurrencies,
    getSupportedFiatCurrencies,
    isValidWalletAddress,
    getTransactionStatus,
};
