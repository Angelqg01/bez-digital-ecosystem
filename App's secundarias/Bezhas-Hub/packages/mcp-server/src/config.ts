/**
 * BeZhas Intelligence - MCP Server Configuration
 * 
 * Centralizes all configuration from environment variables.
 * Uses Polygon Amoy for testing, Polygon Mainnet for production.
 */
import dotenv from 'dotenv';
dotenv.config();

export const config = {
    // ─── Network ───────────────────────────────────────────
    network: {
        mode: (process.env.NETWORK_MODE || 'amoy') as 'mainnet' | 'amoy' | 'localhost',
        rpc: {
            mainnet: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
            amoy: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
            localhost: 'http://localhost:8545',
        },
        get activeRpc(): string {
            return config.network.rpc[config.network.mode];
        },
    },

    // ─── BEZ Token (INMUTABLE) ─────────────────────────────
    token: {
        address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        priceUSD: parseFloat(process.env.BEZ_PRICE_USD || '0.50'),
        decimals: 18,
        abi: [
            'function transfer(address to, uint256 amount) returns (bool)',
            'function transferFrom(address from, address to, uint256 amount) returns (bool)',
            'function balanceOf(address account) view returns (uint256)',
            'function allowance(address owner, address spender) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function totalSupply() view returns (uint256)',
        ],
    },

    // ─── Relayer (Gasless for ToolBEZ/IoT) ─────────────────
    relayer: {
        privateKey: process.env.RELAYER_PRIVATE_KEY || '',
        address: process.env.RELAYER_ADDRESS || '',
    },

    // ─── Platform Fees ─────────────────────────────────────
    fees: {
        platformPercent: parseFloat(process.env.PLATFORM_FEE_PERCENT || '1.0'),
        feeBurnPercent: parseFloat(process.env.FEE_BURN_PERCENT || '50'),
    },

    // ─── Stripe (Fiat Gateway) ─────────────────────────────
    stripe: {
        feePercent: parseFloat(process.env.STRIPE_FEE_PERCENT || '2.9'),
        feeFixedCents: parseInt(process.env.STRIPE_FEE_FIXED_CENTS || '30', 10),
    },

    // ─── MongoDB ───────────────────────────────────────────
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bezhas',
    },

    // ─── HTTP Server ───────────────────────────────────────
    http: {
        port: parseInt(process.env.PORT || process.env.HTTP_PORT || '8080', 10),
    },

    // ─── Gas Thresholds ────────────────────────────────────
    gas: {
        highThresholdGwei: 300,
        lowValueThresholdUSD: 50,
        iotAlwaysRelayer: true,
    },

    // ─── Compliance ────────────────────────────────────────
    compliance: {
        highValueThresholdUSD: 10000,
        sanctionedRegions: ['KP', 'IR', 'CU', 'SY', 'RU'],
    },

    // ─── Integrations (MCP Tools) ──────────────────────────
    integrations: {
        githubToken: process.env.GITHUB_TOKEN || '',
        firecrawlApiKey: process.env.FIRECRAWL_API_KEY || '',
        tallyApiKey: process.env.TALLY_API_KEY || '',
        alpacaApiKey: process.env.ALPACA_API_KEY || '',
        alpacaSecretKey: process.env.ALPACA_SECRET_KEY || '',
    },
} as const;
