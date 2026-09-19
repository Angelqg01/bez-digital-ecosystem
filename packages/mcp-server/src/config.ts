/**
 * BeZhas Intelligence - MCP Server Configuration
 * 
 * Centralizes all configuration from environment variables.
 * Uses Polygon Amoy for testing, Polygon Mainnet for production.
 */
import dotenv from 'dotenv';
dotenv.config();

/**
 * Lee un número del entorno, o se queda con el de reserva.
 *
 * `parseFloat('abc')` devuelve `NaN` sin quejarse, y un `NaN` metido en un
 * precio no revienta: se propaga en silencio por cada división hasta salir
 * como `null` en el JSON de una herramienta, con `success: true` al lado. Un
 * cero hace lo mismo con `Infinity`. Por eso aquí se exige un número finito
 * y, cuando el valor va a acabar en un denominador, estrictamente positivo.
 */
function envNumber(name: string, fallback: number, { positivo = false } = {}): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') return fallback;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    if (positivo ? parsed <= 0 : parsed < 0) return fallback;
    return parsed;
}

/** Igual que `envNumber`, pero para valores que han de ser enteros. */
function envInt(name: string, fallback: number): number {
    const n = envNumber(name, fallback);
    return Number.isInteger(n) ? n : fallback;
}

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
        priceUSD: envNumber('BEZ_PRICE_USD', 0.0075, { positivo: true }),
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
        platformPercent: envNumber('PLATFORM_FEE_PERCENT', 1.0),
        feeBurnPercent: envNumber('FEE_BURN_PERCENT', 50),
    },

    // ─── Stripe (Fiat Gateway) ─────────────────────────────
    stripe: {
        feePercent: envNumber('STRIPE_FEE_PERCENT', 2.9),
        feeFixedCents: envInt('STRIPE_FEE_FIXED_CENTS', 30),
    },

    // ─── MongoDB ───────────────────────────────────────────
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bezhas',
    },

    // ─── HTTP Server ───────────────────────────────────────
    http: {
        port: envInt('PORT', envInt('HTTP_PORT', 8080)),
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
