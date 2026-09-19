/**
 * @fileoverview Tokenomics Configuration - Configuración Centralizada de BEZ-Coin
 * @description Fuente única de verdad para todos los parámetros económicos del token
 * @version 2.0.0
 * @updated 2026-01-31
 */

// ════════════════════════════════════════════════════════════
// PRECIO OFICIAL DEL BEZ — FUENTE ÚNICA
// ════════════════════════════════════════════════════════════
// Precio definitivo del BEZ V1: 0,0075 $.
//
// Hasta esta unificación el precio estaba escrito a mano en catorce sitios
// del backend, el frontend y el servidor MCP, con SIETE valores distintos
// conviviendo en el mismo despliegue: 0,00075 · 0,0075 · 0,10 · 0,50 ·
// 0,55 · 1,24 USD y 0,46 · 1,14 EUR. El importe que se cobraba dependía de
// qué ruta atendiera la petición — comprar por /api/bezcoin/buy/stripe
// costaba 67 veces más que comprar por /api/payment/bank-transfer.
//
// Nada vuelve a escribir el precio a mano: todo lee de aquí, y el oráculo
// de QuickSwap (services/price-oracle.service.js) lo sobrescribe en
// caliente cuando el pool responde. Este valor es el que se sirve cuando
// el oráculo falla.
const BEZ_PRICE_USD = Number(process.env.BEZ_PRICE_USD) > 0
    ? Number(process.env.BEZ_PRICE_USD)
    : 0.0075;

// Tipo EUR/USD de referencia (1 EUR = 1,08 USD), el mismo que declara
// packages/mcp-server/src/tools/payment-tools.ts. No es una cotización de
// mercado; el oráculo calcula el EUR real a partir del USD cuando puede.
const EUR_USD_RATE = Number(process.env.EUR_USD_RATE) > 0
    ? Number(process.env.EUR_USD_RATE)
    : 1.08;

const BEZ_PRICE_EUR = Number((BEZ_PRICE_USD / EUR_USD_RATE).toFixed(8));

module.exports = {
    // ============================================================
    // PRECIO (leer siempre de aquí, nunca escribirlo a mano)
    // ============================================================
    price: {
        usd: BEZ_PRICE_USD,
        eur: BEZ_PRICE_EUR,
        eurUsdRate: EUR_USD_RATE,
    },

    // ============================================================
    // TOKEN INFORMATION
    // ============================================================
    token: {
        name: 'BEZ-Coin',
        symbol: 'BEZ',
        decimals: 18,
        address: process.env.BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        network: 'polygon',
        chainId: 137
    },

    // ============================================================
    // PRICE ORACLE CONFIGURATION
    // ============================================================
    priceOracle: {
        // QuickSwap V2 Pool BEZ/USDC
        quickswapPool: {
            address: '0x4edc77de01f2a2c87611c2f8e9249be43df745a9',
            token0: 'BEZ',  // Ajustar según orden real en el contrato
            token1: 'USDC',
            token0Decimals: 18,
            token1Decimals: 6
        },

        // Fallback price (usado cuando el oráculo falla).
        // Deriva del precio oficial de arriba: no lo dupliques aquí.
        fallbackPriceUSD: BEZ_PRICE_USD,
        fallbackPriceEUR: BEZ_PRICE_EUR,

        // Cache settings
        cacheTTL: 30000, // 30 segundos

        // Slippage protection
        maxSlippagePercent: 2,

        // Spread de protección anti-arbitraje (2%)
        // El precio de venta en BeZhas será: precio_oracle * (1 + spreadPercent/100)
        spreadPercent: 2,

        // Refresh interval para WebSocket updates
        refreshInterval: 15000 // 15 segundos
    },

    // ============================================================
    // BURN MECHANISM
    // ============================================================
    burn: {
        enabled: true,
        address: '0x89c23890c742d710265dD61be789C71dC8999b12',

        // Burn rates (base 10000 = 100%)
        rates: {
            marketplace: 40,      // 0.4% en ventas del marketplace
            qualityPerfect: 50,   // 0.5% en posts con calidad perfecta (100%)
            stakingRewards: 10,   // 0.1% de rewards de staking
            vipUpgrade: 25,       // 0.25% en upgrades VIP
            fiatPurchase: 20      // 0.2% en compras FIAT (Stripe/SEPA)
        }
    },

    // ============================================================
    // TESORERÍA / TREASURY
    // ============================================================
    treasury: {
        address: process.env.TREASURY_WALLET || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',

        // Tasas de comisión para tesorería (base 10000 = 100%)
        rates: {
            fiatPurchase: 100     // 1% en compras FIAT (Stripe/SEPA)
        }
    },

    // ============================================================
    // MARKETPLACE COMMISSIONS
    // ============================================================
    marketplace: {
        // Platform commission (base 10000)
        platformCommissionBPS: 250, // 2.5%

        // Vendor registration fee in BEZ
        vendorFeeEUR: 50,

        // Minimum order value in BEZ
        minOrderBEZ: 100,

        // Max pending orders per user
        maxPendingOrders: 10
    },

    // ============================================================
    // FIAT GATEWAY CONFIGURATION
    // ============================================================
    fiat: {
        // Purchase limits in EUR
        minPurchase: 10,
        maxPurchase: 10000,

        // KYC threshold
        kycThreshold: 1000,

        // Discounts
        fiatDiscountPercent: 1,    // 1% descuento pagando con FIAT
        bezDiscountPercent: 5,     // 5% descuento pagando con BEZ

        // Supported currencies
        supportedCurrencies: ['EUR', 'USD', 'GBP'],

        // Default currency
        defaultCurrency: 'EUR',

        // EUR/USD rate (fallback)
        eurUsdRate: 1.08,

        // Bank transfer processing time (hours)
        bankTransferProcessingHours: 48
    },

    // ============================================================
    // VIP SUBSCRIPTION TIERS
    // ============================================================
    vipTiers: {
        FREE: {
            id: 'FREE',
            name: 'Free',
            priceEUR: 0,
            priceBEZ: 0,
            discount: 0,
            features: ['basic_access']
        },
        STARTER: {
            id: 'STARTER',
            name: 'Starter',
            priceEUR: 4.99,
            priceBEZ: null, // Calculado dinámicamente
            discount: 2,
            features: ['basic_access', 'priority_support']
        },
        CREATOR: {
            id: 'CREATOR',
            name: 'Creator',
            priceEUR: 19.99,
            priceBEZ: null,
            discount: 5,
            features: ['basic_access', 'priority_support', 'analytics', 'monetization']
        },
        BUSINESS: {
            id: 'BUSINESS',
            name: 'Business',
            priceEUR: 99.99,
            priceBEZ: null,
            discount: 10,
            features: ['all_features', 'api_access', 'white_label']
        },
        ENTERPRISE: {
            id: 'ENTERPRISE',
            name: 'Enterprise',
            priceEUR: 299.99,
            priceBEZ: null,
            discount: 15,
            features: ['all_features', 'dedicated_support', 'custom_integrations']
        }
    },

    // ============================================================
    // STAKING & REWARDS
    // ============================================================
    staking: {
        // APY rates by lock period
        apyRates: {
            flexible: 5,      // 5% APY
            '30days': 8,      // 8% APY
            '90days': 12,     // 12% APY
            '180days': 18,    // 18% APY
            '365days': 25     // 25% APY
        },

        // Minimum stake amount
        minStakeBEZ: 1000,

        // Early withdrawal penalty
        earlyWithdrawalPenaltyPercent: 10
    },

    // ============================================================
    // PAYMENT RETRY CONFIGURATION
    // ============================================================
    paymentRetry: {
        maxAttempts: 3,
        backoffType: 'exponential',
        initialDelayMs: 5000,
        maxDelayMs: 60000,

        // Dead letter queue
        deadLetterQueue: 'payment-failed-dlq'
    },

    // ============================================================
    // BLOCKCHAIN CONFIGURATION
    // ============================================================
    blockchain: {
        // RPC URLs
        polygonMainnet: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        polygonAmoy: process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',

        // Gas settings
        defaultGasLimit: 100000,
        maxGasPrice: '500', // gwei

        // Confirmation blocks
        confirmationsRequired: 2,

        // Hot Wallet
        hotWalletAddress: process.env.HOT_WALLET_ADDRESS || '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
        safeAddress: process.env.SAFE_ADDRESS || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3'
    },

    // ============================================================
    // MOONPAY CONFIGURATION (DISABLED)
    // ============================================================
    moonpay: {
        enabled: false, // DESHABILITADO - Usar conversión directa FIAT/BEZ
        reason: 'Conversión directa FIAT/BEZ implementada. MoonPay genera doble conversión y slippage.'
    },

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /**
     * Calculate VIP price in BEZ based on current oracle price
     * @param {string} tierId - VIP tier ID
     * @param {number} bezPriceEUR - Current BEZ price in EUR
     * @returns {number} Price in BEZ
     */
    calculateVipPriceBEZ(tierId, bezPriceEUR) {
        const tier = this.vipTiers[tierId];
        if (!tier || tier.priceEUR === 0) return 0;
        return Math.ceil(tier.priceEUR / bezPriceEUR);
    },

    /**
     * Calculate burn amount for a transaction
     * @param {string} type - Transaction type
     * @param {number} amount - Amount in BEZ
     * @returns {number} Burn amount
     */
    calculateBurnAmount(type, amount) {
        const rate = this.burn.rates[type] || 0;
        return (amount * rate) / 10000;
    },

    /**
     * Get commission for marketplace sale
     * @param {number} price - Sale price in BEZ
     * @returns {object} { commission, burn, sellerNet }
     */
    calculateMarketplaceFees(price) {
        const commission = (price * this.marketplace.platformCommissionBPS) / 10000;
        const burn = this.burn.enabled ? (price * this.burn.rates.marketplace) / 10000 : 0;
        const sellerNet = price - commission - burn;

        return {
            price,
            commission,
            burn,
            sellerNet,
            commissionPercent: this.marketplace.platformCommissionBPS / 100,
            burnPercent: this.burn.rates.marketplace / 100
        };
    }
};
