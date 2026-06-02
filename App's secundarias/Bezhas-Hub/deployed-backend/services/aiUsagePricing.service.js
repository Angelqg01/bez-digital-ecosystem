/**
 * Central AI usage pricing for BEZ-Coin credits.
 *
 * The values here are intentionally configurable through environment variables
 * because provider prices, FX and tax treatment change over time.
 */

const DEFAULT_OPENAI_PRICES = {
    'gpt-4o': {
        inputUsdPer1M: 5,
        cachedInputUsdPer1M: 2.5,
        outputUsdPer1M: 15,
        reasoningUsdPer1M: 15
    },
    'gpt-4o-mini': {
        inputUsdPer1M: 0.15,
        cachedInputUsdPer1M: 0.075,
        outputUsdPer1M: 0.6,
        reasoningUsdPer1M: 0.6
    },
    'gpt-4-turbo': {
        inputUsdPer1M: 10,
        cachedInputUsdPer1M: 5,
        outputUsdPer1M: 30,
        reasoningUsdPer1M: 30
    },
    'gpt-3.5-turbo': {
        inputUsdPer1M: 0.5,
        cachedInputUsdPer1M: 0.25,
        outputUsdPer1M: 1.5,
        reasoningUsdPer1M: 1.5
    },
    'dall-e-3': {
        imageUsd: 0.04,
        imageHdUsd: 0.08
    },
    'whisper-1': {
        minuteUsd: 0.006
    }
};

function numberFromEnv(name, fallback) {
    const value = parseFloat(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
}

function round(value, decimals = 6) {
    return Math.round((Number(value) + Number.EPSILON) * (10 ** decimals)) / (10 ** decimals);
}

function ceilMoney(value) {
    return Math.ceil((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeUsage(usage = {}) {
    return {
        inputTokens: Math.max(Number(usage.inputTokens || usage.input_tokens || 0), 0),
        cachedInputTokens: Math.max(Number(usage.cachedInputTokens || usage.cached_input_tokens || 0), 0),
        outputTokens: Math.max(Number(usage.outputTokens || usage.output_tokens || 0), 0),
        reasoningTokens: Math.max(Number(usage.reasoningTokens || usage.reasoning_tokens || 0), 0),
        images: Math.max(Number(usage.images || 0), 0),
        hdImages: Math.max(Number(usage.hdImages || usage.hd_images || 0), 0),
        minutes: Math.max(Number(usage.minutes || 0), 0)
    };
}

function getModelPrice(model) {
    const override = process.env[`AI_PRICE_${String(model).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
    if (override) {
        try {
            return JSON.parse(override);
        } catch (error) {
            throw new Error(`Invalid JSON pricing override for model ${model}`);
        }
    }

    const price = DEFAULT_OPENAI_PRICES[model];
    if (!price) {
        throw new Error(`Unsupported AI pricing model: ${model}`);
    }
    return price;
}

function calculateOpenAICostUsd(usageInput, price) {
    const usage = normalizeUsage(usageInput);
    const cachedInputTokens = Math.min(usage.cachedInputTokens, usage.inputTokens);
    const billableInputTokens = Math.max(usage.inputTokens - cachedInputTokens, 0);

    const inputCost = ((billableInputTokens / 1_000_000) * (price.inputUsdPer1M || 0));
    const cachedInputCost = ((cachedInputTokens / 1_000_000) * (price.cachedInputUsdPer1M || price.cachedUsdPer1M || 0));
    const outputCost = ((usage.outputTokens / 1_000_000) * (price.outputUsdPer1M || 0));
    const reasoningCost = ((usage.reasoningTokens / 1_000_000) * (price.reasoningUsdPer1M || price.outputUsdPer1M || 0));
    const imageCost = (usage.images * (price.imageUsd || 0)) + (usage.hdImages * (price.imageHdUsd || price.imageUsd || 0));
    const audioCost = usage.minutes * (price.minuteUsd || 0);

    return round(inputCost + cachedInputCost + outputCost + reasoningCost + imageCost + audioCost);
}

function calculateBezCharge({
    openaiCostUsd,
    usdEur = numberFromEnv('USD_EUR_RATE', 0.92),
    infraMultiplier = numberFromEnv('AI_INFRA_MULTIPLIER', 1.25),
    marginMultiplier = numberFromEnv('AI_MARGIN_MULTIPLIER', 2.4),
    vatRate = numberFromEnv('AI_VAT_RATE', 0.21),
    bezEurRate = numberFromEnv('BEZ_EUR_RATE', 0.05)
}) {
    if (!Number.isFinite(openaiCostUsd) || openaiCostUsd < 0) {
        throw new Error('openaiCostUsd must be a positive number');
    }
    if (!Number.isFinite(bezEurRate) || bezEurRate <= 0) {
        throw new Error('bezEurRate must be greater than zero');
    }

    const apiCostEur = openaiCostUsd * usdEur;
    const infrastructureCostEur = apiCostEur * (infraMultiplier - 1);
    const subtotalEur = apiCostEur * infraMultiplier;
    const marginBeforeTaxEur = subtotalEur * (marginMultiplier - 1);
    const netBeforeTaxEur = subtotalEur * marginMultiplier;
    const vatEur = netBeforeTaxEur * vatRate;
    const grossEur = netBeforeTaxEur + vatEur;
    const chargedBez = ceilMoney(grossEur / bezEurRate);

    return {
        apiCostEur: round(apiCostEur),
        infrastructureCostEur: round(infrastructureCostEur),
        marginBeforeTaxEur: round(marginBeforeTaxEur),
        vatEur: round(vatEur),
        grossEur: ceilMoney(grossEur),
        chargedBez,
        marginEur: round((chargedBez * bezEurRate) - apiCostEur - infrastructureCostEur - vatEur),
        bezEurRate,
        usdEur,
        infraMultiplier,
        marginMultiplier,
        vatRate
    };
}

function estimateAIUsageCharge({ model, usage, bezEurRate, usdEur, infraMultiplier, marginMultiplier, vatRate }) {
    const price = getModelPrice(model);
    const normalizedUsage = normalizeUsage(usage);
    const openaiCostUsd = calculateOpenAICostUsd(normalizedUsage, price);
    const charge = calculateBezCharge({
        openaiCostUsd,
        bezEurRate,
        usdEur,
        infraMultiplier,
        marginMultiplier,
        vatRate
    });

    return {
        provider: 'openai',
        model,
        usage: normalizedUsage,
        openaiCostUsd,
        ...charge,
        currency: 'BEZ'
    };
}

module.exports = {
    DEFAULT_OPENAI_PRICES,
    normalizeUsage,
    getModelPrice,
    calculateOpenAICostUsd,
    calculateBezCharge,
    estimateAIUsageCharge
};
