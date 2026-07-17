/**
 * usage-pricing.js — Modelo de coste del plan Starter (pago por uso).
 *
 * Precio al cliente = (coste API Claude + coste de cómputo BeZhas) × (1 + MARGIN).
 * La unidad de facturación es el "crédito API": 1 crédito = 0,001 EUR.
 * Los créditos se reportan al Billing Meter de Stripe (event_name
 * `bezhas_api_credits`) y Stripe factura mensualmente el consumo, tras
 * 15 días de prueba gratis (trial_period_days en la suscripción).
 *
 * Precios Claude API vigentes (USD por millón de tokens, platform.claude.com
 * /docs/en/pricing — actualizados 2026-07-16). Si Anthropic cambia precios,
 * actualizar SOLO esta tabla.
 */

const MARGIN_RATE = 0.25;              // +25% sobre coste real
const EUR_PER_CREDIT = 0.001;          // 1 crédito API = 0,001 EUR
const USD_EUR_RATE = parseFloat(process.env.USD_EUR_RATE || '0.93');
const STARTER_TRIAL_DAYS = 15;

// USD por 1M tokens (input / output)
const CLAUDE_PRICES_PER_MTOK = {
    'claude-fable-5': { input: 10.0, output: 50.0 },
    'claude-opus-4-8': { input: 5.0, output: 25.0 },
    'claude-opus-4-7': { input: 5.0, output: 25.0 },
    'claude-opus-4-6': { input: 5.0, output: 25.0 },
    'claude-sonnet-5': { input: 3.0, output: 15.0 },
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5': { input: 1.0, output: 5.0 },
};
const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-8';

// Coste de cómputo BeZhas por tipo de acción, en EUR.
// Cubre infra (Cloud Run/GPU), orquestación OpenClaw, DB y ancho de banda.
// Derivado del coste medio observado por request; revisar trimestralmente.
const BEZHAS_COMPUTE_COST_EUR = {
    ai_action: 0.004,        // acción IA orquestada (OpenClaw, sin tokens LLM)
    api_call: 0.0008,        // llamada REST estándar del gateway/SDK
    oracle_query: 0.006,     // consulta Quality/Dispute Oracle
    onchain_relay: 0.012,    // relay de tx on-chain (sin contar gas)
    webhook_delivery: 0.0005,
    default: 0.001,
};

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Coste de una llamada API-SDK, en EUR y en créditos facturables.
 * @param {{model?:string, inputTokens?:number, outputTokens?:number, action?:string}} usage
 * @returns {{claudeCostEUR:number, computeCostEUR:number, rawCostEUR:number,
 *            margin:number, billableEUR:number, credits:number}}
 */
function calculateCallCost({ model, inputTokens = 0, outputTokens = 0, action = 'api_call' } = {}) {
    const prices = CLAUDE_PRICES_PER_MTOK[model] ||
        (inputTokens || outputTokens ? CLAUDE_PRICES_PER_MTOK[DEFAULT_CLAUDE_MODEL] : null);

    const claudeCostUSD = prices
        ? (inputTokens / 1e6) * prices.input + (outputTokens / 1e6) * prices.output
        : 0;
    const claudeCostEUR = round6(claudeCostUSD * USD_EUR_RATE);

    const computeCostEUR = BEZHAS_COMPUTE_COST_EUR[action] ?? BEZHAS_COMPUTE_COST_EUR.default;

    const rawCostEUR = round6(claudeCostEUR + computeCostEUR);
    const billableEUR = round6(rawCostEUR * (1 + MARGIN_RATE));
    // Los créditos se redondean SIEMPRE hacia arriba (mínimo 1 por llamada):
    // nunca facturar por debajo del coste.
    const credits = Math.max(1, Math.ceil(billableEUR / EUR_PER_CREDIT));

    return {
        claudeCostEUR, computeCostEUR, rawCostEUR,
        margin: MARGIN_RATE, billableEUR, credits,
        eurPerCredit: EUR_PER_CREDIT,
    };
}

module.exports = {
    MARGIN_RATE,
    EUR_PER_CREDIT,
    STARTER_TRIAL_DAYS,
    CLAUDE_PRICES_PER_MTOK,
    BEZHAS_COMPUTE_COST_EUR,
    calculateCallCost,
};
