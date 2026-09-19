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

    // ─── Tasas de referencia (FUENTE ÚNICA) ────────────────
    //
    // Dólares por unidad. NO son cotizaciones de mercado: son constantes del
    // servidor, el valor que se usa cuando no hay oráculo o cuando falla.
    // Donde ya existe una llamada en vivo (CoinGecko), esa llamada manda y
    // esta tabla solo cubre el fallo.
    //
    // Hasta unificarlas, este mismo paquete tenía el MATIC a 0,40 $ en las
    // herramientas de gas y a 0,80 $ en las de pago: el coste que se le
    // reportaba al usuario dependía de qué herramienta preguntase. Deben
    // coincidir con backend/config/tokenomics.config.js.
    rates: {
        usdPerUnit: {
            USD: 1,
            USDT: 1,
            USDC: 1,
            EUR: envNumber('REFERENCE_RATE_EUR', 1.08, { positivo: true }),
            GBP: envNumber('REFERENCE_RATE_GBP', 1.27, { positivo: true }),
            MXN: envNumber('REFERENCE_RATE_MXN', 0.0583, { positivo: true }),
            MATIC: envNumber('REFERENCE_RATE_MATIC', 0.8, { positivo: true }),
            ETH: envNumber('REFERENCE_RATE_ETH', 2400, { positivo: true }),
            BTC: envNumber('REFERENCE_RATE_BTC', 45000, { positivo: true }),
            BNB: envNumber('REFERENCE_RATE_BNB', 430, { positivo: true }),
        } as Record<string, number>,
        disclaimer:
            'Constantes del servidor, no cotizaciones de mercado. ' +
            'Sustituir por el oráculo en producción.',
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

/**
 * Unidades de cada divisa por dólar: el inverso de `config.rates.usdPerUnit`.
 *
 * Las herramientas de conversión fiat llevaban su propia tabla escrita a mano
 * (`{ USD: 1.0, EUR: 0.92, GBP: 0.79, MXN: 17.15 }`), duplicada en dos
 * ficheros. Derivarla de la tabla única evita que las dos versiones se
 * separen y que el importe dependa de cuál de las dos atienda la petición.
 *
 * Solo incluye las divisas fiat: convertir un importe a ETH o BTC no es lo
 * que hacen estas rutas, y ofrecerlo aquí invitaría a tratarlos como moneda
 * de cuenta.
 */
const DIVISAS_FIAT = ['USD', 'EUR', 'GBP', 'MXN'] as const;

export function unidadesPorUsd(): Record<string, number> {
    const salida: Record<string, number> = {};
    for (const divisa of DIVISAS_FIAT) {
        const usdPorUnidad = config.rates.usdPerUnit[divisa];
        if (Number.isFinite(usdPorUnidad) && usdPorUnidad > 0) {
            salida[divisa] = Number((1 / usdPorUnidad).toPrecision(8));
        }
    }
    return salida;
}
