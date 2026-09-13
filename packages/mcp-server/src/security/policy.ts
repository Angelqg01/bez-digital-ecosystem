/**
 * BeZhas Watchdog — política de riesgo
 *
 * Clasifica cada herramienta y fija los límites que el vigilante hace cumplir:
 * qué se puede ejecutar, con cuánto dinero y a qué ritmo.
 */
import { type Severity } from './patterns.js';

export type RiskTier = 'critical' | 'elevated' | 'standard' | 'read_only';

/**
 * Riesgo por herramienta. Lo que mueve dinero, firma o despliega es crítico;
 * lo que solo consulta es de lectura. Una herramienta no listada se trata como
 * `standard`, nunca como inocua.
 */
export const TOOL_RISK: Record<string, RiskTier> = {
    // Dinero y activos
    process_stripe_payment: 'critical',
    initiate_crypto_payment: 'critical',
    calculate_smart_swap: 'elevated',
    get_payment_quote: 'standard',
    check_payment_status: 'standard',
    get_wallet_balance: 'read_only',

    // Cadena y gobernanza
    analyze_gas_strategy: 'standard',
    blockscout_explorer: 'read_only',
    tally_dao_governance: 'elevated',

    // Cumplimiento y seguridad
    verify_regulatory_compliance: 'standard',
    auditmos_security: 'standard',

    // Infraestructura y terceros
    github_repo_manager: 'elevated',
    playwright_automation: 'elevated',
    firecrawl_scraper: 'elevated',
    skill_creator_ai: 'elevated',
    obliq_ai_sre: 'standard',
    kinaxis_supply_chain: 'standard',
    alpaca_markets: 'critical',

    // Comunicación y datos personales
    send_telegram_message: 'elevated',
    sync_contacts: 'elevated',
};

export function riskOf(toolName: string): RiskTier {
    return TOOL_RISK[toolName] ?? 'standard';
}

function num(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined) return fallback;
    return /^(1|true|yes|on)$/i.test(raw);
}

export const policy = {
    /** Con `false` el vigilante observa y registra, pero no bloquea. */
    get enforce(): boolean {
        return bool('WATCHDOG_ENFORCE', true);
    },

    /** Severidad a partir de la cual se bloquea una entrada con inyección. */
    get blockAtSeverity(): Severity {
        const raw = (process.env.WATCHDOG_BLOCK_AT || 'high').toLowerCase();
        return (['low', 'medium', 'high', 'critical'] as Severity[]).includes(raw as Severity)
            ? (raw as Severity)
            : 'high';
    },

    /** Techo por operación, en USD, para herramientas que mueven dinero. */
    get maxTransactionUSD(): number {
        return num('WATCHDOG_MAX_TX_USD', 1_000);
    },

    /** Techo acumulado por ventana, en USD. */
    get maxHourlyUSD(): number {
        return num('WATCHDOG_MAX_HOURLY_USD', 5_000);
    },

    /** Llamadas permitidas por ventana y por sujeto para herramientas críticas. */
    get criticalCallsPerHour(): number {
        return num('WATCHDOG_CRITICAL_CALLS_PER_HOUR', 20);
    },

    /** Llamadas totales permitidas por ventana y por sujeto. */
    get callsPerMinute(): number {
        return num('WATCHDOG_CALLS_PER_MINUTE', 120);
    },

    /**
     * Herramientas desactivadas por completo. Lista separada por comas.
     * Sirve para cortar en caliente sin desplegar.
     */
    get disabledTools(): string[] {
        return (process.env.WATCHDOG_DISABLED_TOOLS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    },

    /**
     * Dominios a los que se permite que apunten las herramientas de red.
     * Vacío = sin restricción de dominio (solo se registra).
     */
    get allowedDomains(): string[] {
        return (process.env.WATCHDOG_ALLOWED_DOMAINS || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
    },
};

/** Campos cuyo valor se interpreta como importe monetario. */
const AMOUNT_FIELDS = [
    'amount',
    'amountUSD',
    'estimatedValueUSD',
    'valueUSD',
    'total',
    'totalUSD',
    'price',
    'notional',
];

/** Extrae el importe en USD de los parámetros, si lo hay. */
export function extractAmountUSD(params: unknown): number | null {
    if (!params || typeof params !== 'object') return null;
    const obj = params as Record<string, unknown>;

    for (const field of AMOUNT_FIELDS) {
        const raw = obj[field];
        const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
        if (!Number.isFinite(value) || value <= 0) continue;

        const currency = String(obj.currency ?? obj.fromCurrency ?? 'USD').toUpperCase();
        // Solo se tratan como USD las monedas con paridad conocida y estable.
        // Cualquier otra se considera no evaluable y se deja pasar al techo
        // por número de llamadas en lugar de inventar una conversión.
        if (['USD', 'USDT', 'USDC'].includes(currency)) return value;
        if (currency === 'EUR') return value * 1.08;
        return null;
    }
    return null;
}
