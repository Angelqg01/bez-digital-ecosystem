/**
 * @fileoverview Tokenomics Configuration - Frontend
 * @description Configuración centralizada de BEZ-Coin para el frontend
 * @version 2.0.0
 * @updated 2026-01-31
 * 
 * NOTA: Los precios reales se obtienen del backend via PriceService
 * Esta configuración contiene valores de fallback y constantes de UI
 */

const tokenomicsConfig = {
    // ============================================================
    // TOKEN INFORMATION
    // ============================================================
    token: {
        name: 'BEZ-Coin',
        symbol: 'BEZ',
        decimals: 18,
        address: import.meta.env.VITE_BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        network: 'polygon',
        chainId: 137,
        logo: '/images/bez-coin-logo.png'
    },

    // ============================================================
    // PRICE ORACLE (QUICKSWAP)
    // ============================================================
    priceOracle: {
        // QuickSwap V2 Pool BEZ/USDC
        poolAddress: '0x4edc77de01f2a2c87611c2f8e9249be43df745a9',
        poolUrl: 'https://dapp.quickswap.exchange/pool/positions/v2/0x4edc77de01f2a2c87611c2f8e9249be43df745a9?chainId=137',

        // Fallback prices (USD) - Se actualizan desde el oráculo
        fallbackPriceUSD: 0.00075,
        fallbackPriceEUR: 0.00070,

        // Spread de protección anti-arbitraje (2%)
        spreadPercent: 2,

        // Cache TTL for frontend (ms)
        cacheTTL: 30000
    },

    // ============================================================
    // BURN MECHANISM
    // ============================================================
    burn: {
        enabled: true,
        address: '0x89c23890c742d710265dD61be789C71dC8999b12',
        explorerUrl: 'https://polygonscan.com/address/0x89c23890c742d710265dd61be789c71dc8999b12',

        // Burn rates (displayed as percentages)
        rates: {
            marketplace: 0.4,      // 0.4% en ventas del marketplace
            qualityPerfect: 0.5,   // 0.5% en posts con calidad perfecta
            stakingRewards: 0.1,   // 0.1% de rewards de staking
            vipUpgrade: 0.25,      // 0.25% en upgrades VIP
            fiatPurchase: 0.2      // 0.2% en compras FIAT (Stripe/SEPA)
        }
    },

    // ============================================================
    // TREASURY
    // ============================================================
    treasury: {
        address: '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
        explorerUrl: 'https://polygonscan.com/address/0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',

        // Treasury rates (displayed as percentages)
        rates: {
            fiatPurchase: 1        // 1% en compras FIAT (Stripe/SEPA)
        }
    },

    // ============================================================
    // FIAT PURCHASE DISTRIBUTION
    // ============================================================
    fiatDistribution: {
        userPercent: 98.8,        // Usuario recibe
        burnPercent: 0.2,         // Se quema
        treasuryPercent: 1        // Va a tesorería
    },

    // ============================================================
    // MARKETPLACE COMMISSIONS
    // ============================================================
    marketplace: {
        platformCommissionPercent: 2.5, // 2.5%
        vendorFeeEUR: 50,

        // Display texts
        commissionLabel: 'Comisión de plataforma',
        burnLabel: 'Quema deflacionaria'
    },

    // ============================================================
    // FIAT GATEWAY
    // ============================================================
    fiat: {
        minPurchaseEUR: 10,
        maxPurchaseEUR: 10000,
        kycThresholdEUR: 1000,

        // Discounts
        fiatDiscountPercent: 1,
        bezDiscountPercent: 5,

        // Supported currencies
        supportedCurrencies: ['EUR', 'USD', 'GBP'],

        // Payment methods
        paymentMethods: {
            stripe: {
                enabled: true,
                name: 'Tarjeta de Crédito/Débito',
                icon: '💳',
                processingTime: 'Instantáneo'
            },
            sepa: {
                enabled: true,
                name: 'Transferencia Bancaria (SEPA)',
                icon: '🏦',
                processingTime: '24-48 horas'
            },
            crypto: {
                enabled: true,
                name: 'Pago con Cripto',
                icon: '🔐',
                processingTime: '~2 minutos'
            },
            moonpay: {
                enabled: false,
                name: 'MoonPay',
                icon: '🌙',
                processingTime: 'Deshabilitado',
                disabledReason: 'Usar métodos de pago directos'
            }
        }
    },

    // ============================================================
    // VIP TIERS
    // ============================================================
    vipTiers: {
        FREE: {
            id: 'FREE',
            name: 'Gratis',
            priceEUR: 0,
            color: '#6B7280',
            discount: 0,
            features: [
                'Acceso básico a la plataforma',
                'Publicaciones limitadas'
            ]
        },
        STARTER: {
            id: 'STARTER',
            name: 'Starter',
            priceEUR: 4.99,
            color: '#10B981',
            discount: 2,
            features: [
                'Soporte prioritario',
                'Badge verificado',
                '2% descuento en compras'
            ]
        },
        CREATOR: {
            id: 'CREATOR',
            name: 'Creator',
            priceEUR: 19.99,
            color: '#3B82F6',
            discount: 5,
            popular: true,
            features: [
                'Todo de Starter',
                'Analytics avanzados',
                'Monetización de contenido',
                '5% descuento en compras'
            ]
        },
        BUSINESS: {
            id: 'BUSINESS',
            name: 'Business',
            priceEUR: 99.99,
            color: '#8B5CF6',
            discount: 10,
            features: [
                'Todo de Creator',
                'API Access',
                'White label options',
                '10% descuento en compras'
            ]
        },
        ENTERPRISE: {
            id: 'ENTERPRISE',
            name: 'Enterprise',
            priceEUR: 299.99,
            color: '#F59E0B',
            discount: 15,
            features: [
                'Todo de Business',
                'Soporte dedicado 24/7',
                'Integraciones personalizadas',
                '15% descuento en compras'
            ]
        }
    },

    // ============================================================
    // STAKING TIERS
    // ============================================================
    stakingTiers: {
        flexible: { apy: 5, lockDays: 0, label: 'Flexible' },
        '30days': { apy: 8, lockDays: 30, label: '30 Días' },
        '90days': { apy: 12, lockDays: 90, label: '90 Días' },
        '180days': { apy: 18, lockDays: 180, label: '6 Meses' },
        '365days': { apy: 25, lockDays: 365, label: '1 Año' }
    },

    // ============================================================
    // BLOCKCHAIN LINKS
    // ============================================================
    links: {
        tokenContract: 'https://polygonscan.com/token/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        burnAddress: 'https://polygonscan.com/address/0x89c23890c742d710265dd61be789c71dc8999b12',
        quickswapPool: 'https://dapp.quickswap.exchange/pool/positions/v2/0x4edc77de01f2a2c87611c2f8e9249be43df745a9?chainId=137',
        buyOnQuickSwap: 'https://quickswap.exchange/#/swap?outputCurrency=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'
    },

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /**
     * Format BEZ amount with proper decimals
     */
    formatBez(amount, decimals = 2) {
        if (!amount) return '0';
        return new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(amount);
    },

    /**
     * Format fiat amount
     */
    formatFiat(amount, currency = 'EUR') {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency
        }).format(amount);
    },

    /**
     * Calculate VIP price in BEZ
     */
    calculateVipPriceBez(tierId, bezPriceEUR) {
        const tier = this.vipTiers[tierId];
        if (!tier || tier.priceEUR === 0) return 0;
        return Math.ceil(tier.priceEUR / bezPriceEUR);
    },

    /**
     * Get burn amount for transaction
     */
    calculateBurnAmount(type, amount) {
        const rate = this.burn.rates[type];
        if (!rate) return 0;
        return (amount * rate) / 100;
    }
};

export default tokenomicsConfig;
