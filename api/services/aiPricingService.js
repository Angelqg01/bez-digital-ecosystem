/**
 * aiPricingService.js — AI Provider Pricing & Billing Calculator
 *
 * Supported providers: Claude (Anthropic), Gemini (Google), Kimi (Moonshot), Ollama (local).
 * Commission: 30 % on top of API cost.
 * Subscription discount: up to 15 % (enterprise tier).
 */

// ─── Provider price catalogue (USD per 1 M tokens) ──────────────────
const PROVIDERS = {
    claude: {
        name: 'Claude (Anthropic)',
        models: {
            'claude-4-opus': { inputPer1M: 15.00, outputPer1M: 75.00, maxTokens: 200000 },
            'claude-4-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00, maxTokens: 200000 },
            'claude-3-5-haiku': { inputPer1M: 0.80, outputPer1M: 4.00, maxTokens: 200000 },
        },
    },
    gemini: {
        name: 'Gemini (Google)',
        models: {
            'gemini-2.0-flash': { inputPer1M: 0.075, outputPer1M: 0.30, maxTokens: 1000000 },
            'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00, maxTokens: 2000000 },
        },
    },
    kimi: {
        name: 'Kimi (Moonshot AI)',
        models: {
            'moonshot-v1-8k': { inputPer1M: 0.012, outputPer1M: 0.012, maxTokens: 8000 },
            'moonshot-v1-32k': { inputPer1M: 0.024, outputPer1M: 0.024, maxTokens: 32000 },
            'moonshot-v1-128k': { inputPer1M: 0.060, outputPer1M: 0.060, maxTokens: 128000 },
        },
    },
    ollama: {
        name: 'Ollama (Local)',
        models: {
            'llama3': { inputPer1M: 0, outputPer1M: 0, maxTokens: 8192, computePerHour: 0.50 },
            'mistral': { inputPer1M: 0, outputPer1M: 0, maxTokens: 32768, computePerHour: 0.75 },
            'codellama': { inputPer1M: 0, outputPer1M: 0, maxTokens: 16384, computePerHour: 0.60 },
        },
    },
};

// ─── Subscription tiers ──────────────────────────────────────────────
const SUBSCRIPTION_TIERS = {
    free: { name: 'Free', monthlyLimitUSD: 0, discount: 0, priceUSD: 0 },
    starter: { name: 'Starter', monthlyLimitUSD: 100, discount: 0.05, priceUSD: 9.99 },
    professional: { name: 'Professional', monthlyLimitUSD: 500, discount: 0.10, priceUSD: 49.99 },
    enterprise: { name: 'Enterprise', monthlyLimitUSD: 5000, discount: 0.15, priceUSD: 299.99 },
};

const COMMISSION_RATE = 0.30; // 30 %

// ─── Helpers ─────────────────────────────────────────────────────────

function round6(n) {
    return Math.round(n * 1e6) / 1e6;
}

/**
 * Resolve a (provider, model) pair or throw.
 */
function resolveModel(provider, model) {
    const prov = PROVIDERS[provider];
    if (!prov) throw new Error(`Unsupported provider: ${provider}`);
    const m = prov.models[model];
    if (!m) throw new Error(`Unsupported model "${model}" for provider "${provider}"`);
    return { providerMeta: prov, modelMeta: m };
}

/**
 * Raw API cost in USD for a given token usage.
 */
function calculateAPICost(provider, model, inputTokens, outputTokens, execSeconds = 0) {
    const { modelMeta } = resolveModel(provider, model);
    let cost = (inputTokens / 1e6) * modelMeta.inputPer1M
        + (outputTokens / 1e6) * modelMeta.outputPer1M;
    // Ollama: add compute cost
    if (provider === 'ollama' && modelMeta.computePerHour && execSeconds > 0) {
        cost += (execSeconds / 3600) * modelMeta.computePerHour;
    }
    return round6(cost);
}

/**
 * Full invoice breakdown:
 *   totalCost = (apiCost * 1.30) * (1 - subscriptionDiscount)
 */
function calculateInvoice(provider, model, inputTokens, outputTokens, tier = 'free', execSeconds = 0) {
    const apiCost = calculateAPICost(provider, model, inputTokens, outputTokens, execSeconds);
    const commission = round6(apiCost * COMMISSION_RATE);
    const subtotal = round6(apiCost + commission);
    const discount = SUBSCRIPTION_TIERS[tier]?.discount ?? 0;
    const discountAmount = round6(subtotal * discount);
    const totalCost = round6(subtotal - discountAmount);

    return {
        provider,
        model,
        inputTokens,
        outputTokens,
        execSeconds,
        apiCost,
        commissionRate: COMMISSION_RATE,
        commission,
        subtotal,
        subscriptionTier: tier,
        discountPct: discount,
        discountAmount,
        totalCost,
        currency: 'USD',
        timestamp: new Date().toISOString(),
    };
}

/**
 * Public price catalogue (safe to expose).
 */
function getPriceCatalogue() {
    const out = {};
    for (const [key, prov] of Object.entries(PROVIDERS)) {
        out[key] = {
            name: prov.name,
            models: Object.entries(prov.models).map(([mName, m]) => ({
                model: mName,
                inputPer1M: m.inputPer1M,
                outputPer1M: m.outputPer1M,
                maxTokens: m.maxTokens,
                ...(m.computePerHour ? { computePerHour: m.computePerHour } : {}),
            })),
        };
    }
    return out;
}

function getSubscriptionTiers() {
    return Object.entries(SUBSCRIPTION_TIERS).map(([id, t]) => ({
        id, ...t, discountPct: `${(t.discount * 100).toFixed(0)}%`,
    }));
}

module.exports = {
    PROVIDERS,
    SUBSCRIPTION_TIERS,
    COMMISSION_RATE,
    resolveModel,
    calculateAPICost,
    calculateInvoice,
    getPriceCatalogue,
    getSubscriptionTiers,
};
