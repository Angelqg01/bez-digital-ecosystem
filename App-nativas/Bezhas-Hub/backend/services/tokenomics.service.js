/**
 * ============================================================================
 * BEZHAS TOKENOMICS SERVICE
 * ============================================================================
 * 
 * Servicio unificado para:
 * - Cálculo de costos AI → BEZ-Coin
 * - Gestión de Gas Oracle
 * - Cache de inferencias AI
 * - Rate limiting por tier
 * 
 * @version 2.0.0
 * @date 2026-01-27
 */

const { getTierConfig, BEZ_TO_USD_RATE, GAS_CONFIG, BASE_STAKING_APY } = require('../config/tier.config');
const Redis = require('ioredis');
const axios = require('axios');

// Redis client para cache
let redis = null;
try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connectionOptions = {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        family: 0
    };

    // Enable TLS for rediss:// protocol (Upstash, etc.)
    if (redisUrl.startsWith('rediss://')) {
        connectionOptions.tls = { rejectUnauthorized: false };
        console.log('[Tokenomics] Redis TLS mode enabled');
    }

    redis = new Redis(redisUrl, connectionOptions);
    redis.on('error', (err) => console.warn('[Tokenomics] Redis connection error:', err.message));
} catch (err) {
    console.warn('[Tokenomics] Redis not available, using in-memory cache');
}

// In-memory cache fallback
const memoryCache = new Map();

/**
 * =============================================================================
 * AI COST MATRIX
 * =============================================================================
 * 
 * Mapeo de modelos AI a costos en BEZ-Coin
 */
const AI_COST_MATRIX = {
    // OpenAI Models
    'gpt-4': {
        provider: 'openai',
        inputRate: 0.30,      // BEZ por 1K tokens input
        outputRate: 0.60,     // BEZ por 1K tokens output
        minCharge: 5,
        description: 'Modelo más avanzado'
    },
    'gpt-4-turbo': {
        provider: 'openai',
        inputRate: 0.10,
        outputRate: 0.30,
        minCharge: 3,
        description: 'GPT-4 optimizado'
    },
    'gpt-3.5-turbo': {
        provider: 'openai',
        inputRate: 0.01,
        outputRate: 0.02,
        minCharge: 1,
        description: 'Modelo rápido y económico'
    },

    // Google Models
    'gemini-pro': {
        provider: 'google',
        inputRate: 0.0025,
        outputRate: 0.005,
        minCharge: 1,
        description: 'Modelo multimodal de Google'
    },
    'gemini-pro-vision': {
        provider: 'google',
        inputRate: 0.005,
        outputRate: 0.01,
        minCharge: 2,
        description: 'Gemini con capacidad de visión'
    },

    // Local Models (TensorFlow.js)
    'tensorflow-sentiment': {
        provider: 'local',
        inferenceRate: 0.01,
        minCharge: 1,
        description: 'Análisis de sentimiento'
    },
    'tensorflow-toxicity': {
        provider: 'local',
        inferenceRate: 0.02,
        minCharge: 1,
        description: 'Detección de toxicidad'
    },
    'tensorflow-moderation': {
        provider: 'local',
        inferenceRate: 0.01,
        minCharge: 1,
        description: 'Moderación de contenido'
    },

    // OpenAI Utilities
    'text-embedding-ada-002': {
        provider: 'openai',
        inputRate: 0.001,
        outputRate: 0,
        minCharge: 0.5,
        description: 'Embeddings'
    },
    'whisper-1': {
        provider: 'openai',
        minuteRate: 0.06,
        minCharge: 1,
        description: 'Transcripción de audio'
    },
    'dall-e-3': {
        provider: 'openai',
        imageRate: 0.40,
        imageRateHD: 0.80,
        minCharge: 5,
        description: 'Generación de imágenes'
    }
};

/**
 * Platform fee base
 */
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 2.5;

class TokenomicsService {
    constructor() {
        this.gasCache = {
            price: GAS_CONFIG.DEFAULT_GAS_PRICE_GWEI,
            timestamp: 0
        };
        this.rateLimitCounters = new Map();
    }

    // ===========================================================================
    // CACHE MANAGEMENT
    // ===========================================================================

    /**
     * Obtener valor de cache (Redis o memoria)
     */
    async getCache(key) {
        try {
            if (redis && redis.status === 'ready') {
                const value = await redis.get(key);
                return value ? JSON.parse(value) : null;
            }
            return memoryCache.get(key) || null;
        } catch (err) {
            console.warn('[Tokenomics] Cache get error:', err.message);
            return memoryCache.get(key) || null;
        }
    }

    /**
     * Guardar valor en cache
     */
    async setCache(key, value, ttlSeconds = 3600) {
        try {
            const serialized = JSON.stringify(value);
            if (redis && redis.status === 'ready') {
                await redis.setex(key, ttlSeconds, serialized);
            }
            // También guardar en memoria como fallback
            memoryCache.set(key, value);
            setTimeout(() => memoryCache.delete(key), ttlSeconds * 1000);
        } catch (err) {
            console.warn('[Tokenomics] Cache set error:', err.message);
            memoryCache.set(key, value);
        }
    }

    /**
     * Generar hash para cache de inferencias AI
     */
    generateInferenceCacheKey(model, input) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5')
            .update(`${model}:${JSON.stringify(input)}`)
            .digest('hex');
        return `ai:inference:${hash}`;
    }

    /**
     * Obtener resultado cacheado de inferencia AI
     */
    async getCachedInference(model, input) {
        const key = this.generateInferenceCacheKey(model, input);
        return this.getCache(key);
    }

    /**
     * Guardar resultado de inferencia AI en cache
     */
    async cacheInference(model, input, result, ttlSeconds = 3600) {
        const key = this.generateInferenceCacheKey(model, input);
        await this.setCache(key, result, ttlSeconds);
    }

    // ===========================================================================
    // GAS ORACLE
    // ===========================================================================

    /**
     * Obtener precio de gas actual de Polygon
     */
    async getGasPrice() {
        const now = Date.now();

        // Usar cache si es reciente
        if (now - this.gasCache.timestamp < GAS_CONFIG.CACHE_TTL_MS) {
            return this.gasCache.price;
        }

        try {
            const response = await axios.get(GAS_CONFIG.POLYGON_GAS_STATION_URL, {
                timeout: 5000
            });

            // Polygon Gas Station v2 devuelve: fast, standard, safeLow
            const gasPrice = response.data?.fast?.maxFee ||
                response.data?.standard?.maxFee ||
                GAS_CONFIG.DEFAULT_GAS_PRICE_GWEI;

            this.gasCache = {
                price: Math.min(gasPrice, GAS_CONFIG.MAX_GAS_PRICE_GWEI),
                timestamp: now
            };

            return this.gasCache.price;
        } catch (err) {
            console.warn('[Tokenomics] Gas oracle fetch error:', err.message);
            return GAS_CONFIG.DEFAULT_GAS_PRICE_GWEI;
        }
    }

    /**
     * Estimar costo de gas para una transacción
     */
    async estimateGasCost(gasLimit, userTier = 'STARTER') {
        const gasPrice = await this.getGasPrice();
        const tierConfig = getTierConfig(userTier);

        // Calcular costo base en MATIC
        const gasCostMatic = (gasLimit * gasPrice) / 1e9;

        // Obtener precio de MATIC (simplificado, usar oracle real en producción)
        const maticPriceUSD = 1.0; // TODO: Integrar con price oracle
        const gasCostUSD = gasCostMatic * maticPriceUSD;

        // Aplicar subsidio del tier
        const subsidyPercent = tierConfig.gas.subsidyPercent;
        const subsidyAmount = gasCostUSD * subsidyPercent;
        const userPayUSD = gasCostUSD - subsidyAmount;

        // Convertir a BEZ
        const userPayBEZ = userPayUSD / BEZ_TO_USD_RATE;

        return {
            gasLimit,
            gasPriceGwei: gasPrice,
            gasCostMatic: this._round(gasCostMatic, 6),
            gasCostUSD: this._round(gasCostUSD, 4),
            subsidyPercent: subsidyPercent * 100,
            subsidyUSD: this._round(subsidyAmount, 4),
            userPayUSD: this._round(userPayUSD, 4),
            userPayBEZ: this._round(userPayBEZ, 2),
            tier: userTier,
            gasFree: subsidyPercent >= 1.0
        };
    }

    // ===========================================================================
    // AI COST CALCULATION
    // ===========================================================================

    /**
     * Calcular costo en BEZ para uso de AI
     */
    calculateAICost(model, usage, userTier = 'STARTER') {
        const rates = AI_COST_MATRIX[model];

        if (!rates) {
            console.warn(`[Tokenomics] Unknown model: ${model}`);
            return this._defaultAICost(userTier);
        }

        let baseCost = 0;
        const breakdown = {};

        // Calcular según tipo de modelo
        if (rates.inferenceRate && usage.inferences) {
            baseCost = usage.inferences * rates.inferenceRate;
            breakdown.inferences = usage.inferences;
            breakdown.ratePerInference = rates.inferenceRate;

        } else if (rates.minuteRate && usage.minutes) {
            baseCost = usage.minutes * rates.minuteRate;
            breakdown.minutes = usage.minutes;
            breakdown.ratePerMinute = rates.minuteRate;

        } else if (rates.imageRate && usage.images) {
            const isHD = usage.quality === 'hd';
            const rate = isHD ? rates.imageRateHD : rates.imageRate;
            baseCost = usage.images * rate;
            breakdown.images = usage.images;
            breakdown.quality = isHD ? 'HD' : 'Standard';
            breakdown.ratePerImage = rate;

        } else {
            // Modelos de texto
            const inputCost = ((usage.inputTokens || 0) / 1000) * rates.inputRate;
            const outputCost = ((usage.outputTokens || 0) / 1000) * rates.outputRate;
            baseCost = inputCost + outputCost;

            breakdown.inputTokens = usage.inputTokens || 0;
            breakdown.outputTokens = usage.outputTokens || 0;
            breakdown.inputCost = this._round(inputCost, 4);
            breakdown.outputCost = this._round(outputCost, 4);
        }

        // Aplicar mínimo
        baseCost = Math.max(baseCost, rates.minCharge || 0);

        // Aplicar descuento del tier
        const tierConfig = getTierConfig(userTier);
        // Los tiers con más AI credits tienen implícito un "descuento" 
        // ya que pagan suscripción fija
        const discountPercent = userTier === 'BUSINESS' ? 0.50 :
            userTier === 'CREATOR' ? 0.25 : 0;
        const discount = baseCost * discountPercent;
        const finalCost = baseCost - discount;

        return {
            model,
            provider: rates.provider,
            baseCost: this._round(baseCost, 4),
            discountPercent: discountPercent * 100,
            discount: this._round(discount, 4),
            finalCost: this._round(finalCost, 4),
            finalCostUSD: this._round(finalCost * BEZ_TO_USD_RATE, 4),
            tier: userTier,
            breakdown,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Costo por defecto para modelos desconocidos
     */
    _defaultAICost(userTier) {
        const baseCost = 2;
        const discountPercent = userTier === 'BUSINESS' ? 0.50 :
            userTier === 'CREATOR' ? 0.25 : 0;
        const discount = baseCost * discountPercent;

        return {
            model: 'unknown',
            provider: 'unknown',
            baseCost,
            discountPercent: discountPercent * 100,
            discount: this._round(discount, 4),
            finalCost: this._round(baseCost - discount, 4),
            tier: userTier,
            breakdown: {},
            warning: 'Unknown model, default rate applied'
        };
    }

    // ===========================================================================
    // RATE LIMITING
    // ===========================================================================

    /**
     * Verificar y actualizar rate limit para AI queries
     */
    async checkAIRateLimit(userId, userTier = 'STARTER') {
        const tierConfig = getTierConfig(userTier);
        const dailyLimit = tierConfig.ai.dailyQueries;

        // Tier Business no tiene límite
        if (dailyLimit === Infinity) {
            return { allowed: true, remaining: Infinity, limit: Infinity };
        }

        const today = new Date().toISOString().split('T')[0];
        const key = `ratelimit:ai:${userId}:${today}`;

        try {
            let current = 0;

            if (redis && redis.status === 'ready') {
                current = parseInt(await redis.get(key) || '0');
            } else {
                current = this.rateLimitCounters.get(key) || 0;
            }

            if (current >= dailyLimit) {
                return {
                    allowed: false,
                    current,
                    limit: dailyLimit,
                    remaining: 0,
                    resetAt: new Date(today + 'T23:59:59Z').toISOString()
                };
            }

            return {
                allowed: true,
                current,
                limit: dailyLimit,
                remaining: dailyLimit - current
            };

        } catch (err) {
            console.warn('[Tokenomics] Rate limit check error:', err.message);
            return { allowed: true, remaining: dailyLimit, limit: dailyLimit };
        }
    }

    /**
     * Incrementar contador de rate limit
     */
    async incrementAIRateLimit(userId) {
        const today = new Date().toISOString().split('T')[0];
        const key = `ratelimit:ai:${userId}:${today}`;
        const ttl = 86400; // 24 horas

        try {
            if (redis && redis.status === 'ready') {
                await redis.incr(key);
                await redis.expire(key, ttl);
            } else {
                const current = this.rateLimitCounters.get(key) || 0;
                this.rateLimitCounters.set(key, current + 1);
            }
        } catch (err) {
            console.warn('[Tokenomics] Rate limit increment error:', err.message);
        }
    }

    // ===========================================================================
    // STAKING ROI CALCULATIONS
    // ===========================================================================

    /**
     * Calcular recompensas proyectadas de staking
     */
    calculateStakingRewards(stakeAmount, userTier = 'STARTER', durationDays = 365) {
        const tierConfig = getTierConfig(userTier);
        const effectiveAPY = BASE_STAKING_APY * tierConfig.staking.multiplier;

        const yearlyReward = stakeAmount * (effectiveAPY / 100);
        const dailyReward = yearlyReward / 365;
        const periodReward = dailyReward * durationDays;

        // Considerar compounding si está habilitado
        let compoundedReward = periodReward;
        if (tierConfig.staking.compoundingEnabled && durationDays >= 30) {
            // Compound mensualmente
            const monthlyRate = effectiveAPY / 100 / 12;
            const months = Math.floor(durationDays / 30);
            compoundedReward = stakeAmount * (Math.pow(1 + monthlyRate, months) - 1);
        }

        return {
            stakeAmount,
            tier: userTier,
            durationDays,
            baseAPY: BASE_STAKING_APY,
            multiplier: tierConfig.staking.multiplier,
            effectiveAPY,
            dailyReward: this._round(dailyReward, 4),
            periodReward: this._round(periodReward, 4),
            compoundedReward: this._round(compoundedReward, 4),
            compoundingEnabled: tierConfig.staking.compoundingEnabled,
            periodRewardUSD: this._round(periodReward * BEZ_TO_USD_RATE, 2)
        };
    }

    // ===========================================================================
    // COMBINED COST CALCULATION
    // ===========================================================================

    /**
     * Calcular costo total de una operación (AI + Gas)
     */
    async calculateTotalCost(operation, userTier = 'STARTER') {
        const results = {
            operation: operation.type,
            tier: userTier,
            ai: null,
            gas: null,
            platformFee: 0,
            totalBEZ: 0,
            totalUSD: 0
        };

        // Costo de AI si aplica
        if (operation.ai) {
            results.ai = this.calculateAICost(
                operation.ai.model,
                operation.ai.usage,
                userTier
            );
        }

        // Costo de Gas si aplica
        if (operation.gas) {
            results.gas = await this.estimateGasCost(
                operation.gas.gasLimit,
                userTier
            );
        }

        // Calcular subtotal
        const subtotal = (results.ai?.finalCost || 0) + (results.gas?.userPayBEZ || 0);

        // Platform fee (ajustado por tier)
        const tierConfig = getTierConfig(userTier);
        const feePercent = PLATFORM_FEE_PERCENT * (userTier === 'BUSINESS' ? 0.5 : 1);
        results.platformFee = this._round(subtotal * (feePercent / 100), 4);

        // Total
        results.totalBEZ = this._round(subtotal + results.platformFee, 4);
        results.totalUSD = this._round(results.totalBEZ * BEZ_TO_USD_RATE, 4);
        results.platformFeePercent = feePercent;

        return results;
    }

    // ===========================================================================
    // UTILITY METHODS
    // ===========================================================================

    /**
     * Obtener modelos AI disponibles para un tier
     */
    getAvailableModels(userTier = 'STARTER') {
        const tierConfig = getTierConfig(userTier);
        const allowedModels = tierConfig.ai.models;

        if (allowedModels.includes('all')) {
            return Object.entries(AI_COST_MATRIX).map(([name, config]) => ({
                name,
                ...config,
                available: true
            }));
        }

        return Object.entries(AI_COST_MATRIX).map(([name, config]) => ({
            name,
            ...config,
            available: allowedModels.includes(name)
        }));
    }

    /**
     * Convertir BEZ a USD
     */
    bezToUSD(bezAmount) {
        return this._round(bezAmount * BEZ_TO_USD_RATE, 4);
    }

    /**
     * Convertir USD a BEZ
     */
    usdToBEZ(usdAmount) {
        return this._round(usdAmount / BEZ_TO_USD_RATE, 4);
    }

    /**
     * Redondear número
     */
    _round(value, decimals = 2) {
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
}

// Exportar instancia singleton
const tokenomicsService = new TokenomicsService();

module.exports = tokenomicsService;
module.exports.TokenomicsService = TokenomicsService;
module.exports.AI_COST_MATRIX = AI_COST_MATRIX;
