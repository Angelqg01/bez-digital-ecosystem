/**
 * 🧠 Machine Learning Service - El Cerebro de BeZhas
 * 
 * Analiza datos del Oráculo y genera decisiones automáticas para:
 * - Ajuste dinámico de APY
 * - Detección de tendencias de mercado
 * - Predicción de comportamiento de usuarios
 * - Optimización de tokenomics
 * 
 * @architecture Integra con Python ML Service vía HTTP/gRPC
 */

const axios = require('axios');
const pino = require('pino');
const eventBus = require('../events/EventBus');

const logger = pino({ name: 'MLService' });

class MachineLearningService {
    constructor() {
        // Configuración del servicio ML (Python/FastAPI)
        this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
        this.timeout = 30000; // 30 segundos
        this.cache = new Map(); // Cache de predicciones
        this.cacheTTL = 300000; // 5 minutos

        // Estrategia de fallback si ML falla
        this.fallbackStrategy = {
            defaultAPY: 1200, // 12% APY por defecto
            defaultRiskLevel: 5,
            defaultTrend: 'STABLE'
        };
    }

    /**
     * 📊 Analizar condiciones del mercado y generar decisión
     * 
     * @param {Object} oracleData - Datos del oráculo
     * @returns {Promise<Object>} Decisión del ML con acciones recomendadas
     */
    async analyzeMarketConditions(oracleData) {
        const startTime = Date.now();
        logger.info({ assetPair: oracleData.assetPair }, '🔍 Iniciando análisis de ML...');

        try {
            // 1. Verificar caché
            const cacheKey = this._generateCacheKey(oracleData);
            const cached = this._getFromCache(cacheKey);
            if (cached) {
                logger.info('💾 Predicción obtenida de caché');
                return cached;
            }

            // 2. Preparar datos para el modelo
            const mlPayload = this._prepareMLPayload(oracleData);

            // 3. Llamar al servicio de ML (Python)
            const prediction = await this._callMLService('/analyze', mlPayload);

            // 4. Post-procesar y enriquecer la predicción
            const decision = this._enrichPrediction(prediction, oracleData);

            // 5. Cachear resultado
            this._saveToCache(cacheKey, decision);

            // 6. Publicar evento de análisis completado
            eventBus.publish(eventBus.EVENTS.ML_ANALYSIS_COMPLETE, {
                source: 'MLService',
                oracleLogId: oracleData.id,
                decision,
                processingTime: Date.now() - startTime
            });

            logger.info({
                trend: decision.trendForecast,
                suggestedAPY: decision.suggestedAPY,
                riskLevel: decision.riskLevel,
                processingTime: Date.now() - startTime
            }, '✅ Análisis ML completado');

            return decision;

        } catch (error) {
            logger.error({
                error: error.message,
                oracleData
            }, '❌ Error en análisis ML. Usando fallback');

            // Estrategia de fallback
            return this._getFallbackDecision(oracleData);
        }
    }

    /**
     * 📈 Predecir tendencia de mercado (BULLISH/BEARISH/STABLE)
     */
    async predictMarketTrend(historicalData) {
        try {
            const response = await this._callMLService('/predict/trend', {
                data: historicalData,
                horizon: 24 // horas
            });

            return {
                trend: response.prediction,
                confidence: response.confidence,
                signals: response.signals
            };

        } catch (error) {
            logger.error({ error: error.message }, '❌ Error en predicción de tendencia');
            return {
                trend: this.fallbackStrategy.defaultTrend,
                confidence: 0.5,
                signals: []
            };
        }
    }

    /**
     * 💰 Calcular APY óptimo basado en condiciones del mercado
     * 
     * ESTRATEGIA:
     * - Mercado BAJISTA → Subir APY para retener liquidez
     * - Mercado ALCISTA → Bajar APY (menos incentivos necesarios)
     * - Alta volatilidad → APY moderado pero estable
     */
    async calculateOptimalAPY(marketData) {
        try {
            const response = await this._callMLService('/optimize/apy', {
                currentAPY: marketData.currentAPY,
                marketConditions: marketData.conditions,
                userActivity: marketData.userActivity,
                competitorAPYs: marketData.competitors || []
            });

            const suggestedAPY = response.optimalAPY;

            // Validación de seguridad: límites
            const MIN_APY = 500;  // 5%
            const MAX_APY = 5000; // 50%

            const boundedAPY = Math.max(MIN_APY, Math.min(MAX_APY, suggestedAPY));

            logger.info({
                suggested: suggestedAPY,
                bounded: boundedAPY,
                reasoning: response.reasoning
            }, '💡 APY óptimo calculado');

            return {
                suggestedAPY: boundedAPY,
                confidence: response.confidence,
                reasoning: response.reasoning,
                expectedImpact: response.impact
            };

        } catch (error) {
            logger.error({ error: error.message }, '❌ Error calculando APY óptimo');
            return {
                suggestedAPY: this.fallbackStrategy.defaultAPY,
                confidence: 0.5,
                reasoning: 'Fallback: Valor por defecto debido a error',
                expectedImpact: null
            };
        }
    }

    /**
     * 👤 Análisis de comportamiento de usuario
     * 
     * Detecta usuarios elegibles para airdrops, promos, etc.
     */
    async analyzeUserBehavior(userActivity) {
        try {
            const response = await this._callMLService('/analyze/user', {
                wallet: userActivity.wallet,
                transactions: userActivity.transactions,
                stakingHistory: userActivity.stakingHistory,
                socialActivity: userActivity.socialActivity
            });

            return {
                reputationScore: response.score,
                eligibleForAirdrop: response.score > 70,
                recommendedPromos: response.promos,
                riskFlags: response.flags
            };

        } catch (error) {
            logger.error({ error: error.message, wallet: userActivity.wallet }, '❌ Error en análisis de usuario');
            return {
                reputationScore: 50,
                eligibleForAirdrop: false,
                recommendedPromos: [],
                riskFlags: []
            };
        }
    }

    /**
     * 🎯 Detectar condiciones para Halving automático
     */
    async checkHalvingConditions(systemMetrics) {
        try {
            const response = await this._callMLService('/check/halving', {
                totalSupply: systemMetrics.totalSupply,
                circulatingSupply: systemMetrics.circulatingSupply,
                burnRate: systemMetrics.burnRate,
                priceHistory: systemMetrics.priceHistory,
                userGrowth: systemMetrics.userGrowth
            });

            if (response.shouldHalve) {
                logger.warn('⚠️ ML recomienda ejecutar HALVING', response.reasoning);

                eventBus.publish(eventBus.EVENTS.ECONOMY_HALVING_DUE, {
                    source: 'MLService',
                    reasoning: response.reasoning,
                    urgency: response.urgency,
                    estimatedImpact: response.impact
                });
            }

            return {
                shouldHalve: response.shouldHalve,
                confidence: response.confidence,
                reasoning: response.reasoning,
                optimalTiming: response.timing
            };

        } catch (error) {
            logger.error({ error: error.message }, '❌ Error verificando condiciones de halving');
            return {
                shouldHalve: false,
                confidence: 0,
                reasoning: 'Error en análisis',
                optimalTiming: null
            };
        }
    }

    // --- MÉTODOS PRIVADOS ---

    async _callMLService(endpoint, payload) {
        const response = await axios.post(
            `${this.mlServiceUrl}${endpoint}`,
            payload,
            {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': process.env.ML_API_KEY || 'dev-key'
                }
            }
        );

        return response.data;
    }

    _prepareMLPayload(oracleData) {
        return {
            timestamp: oracleData.timestamp || Date.now(),
            assetPair: oracleData.assetPair,
            price: parseFloat(oracleData.price),
            volume: parseFloat(oracleData.volume),
            // Agregar más features según tu oráculo
            ...(oracleData.extraData || {})
        };
    }

    _enrichPrediction(prediction, oracleData) {
        // Determinar acción basada en la predicción
        let action = 'MAINTAIN';

        if (prediction.trend === 'BEARISH' && prediction.confidence > 0.7) {
            action = 'INCREASE_INCENTIVES'; // Subir APY
        } else if (prediction.trend === 'BULLISH' && prediction.confidence > 0.8) {
            action = 'DECREASE_INCENTIVES'; // Bajar APY
        }

        return {
            trendForecast: prediction.trend || 'STABLE',
            suggestedAPY: prediction.recommendedAPY || this.fallbackStrategy.defaultAPY,
            riskLevel: prediction.riskLevel || this.fallbackStrategy.defaultRiskLevel,
            confidence: prediction.confidence || 0.5,
            action,
            sentiment: prediction.sentiment || 'NEUTRAL',
            reasoning: prediction.reasoning || 'Análisis automático del mercado',
            volumeChange: this._calculateVolumeChange(oracleData),
            recommendedAds: prediction.ads || [],
            timestamp: new Date().toISOString()
        };
    }

    _getFallbackDecision(oracleData) {
        logger.warn('⚠️ Usando decisión de fallback');

        return {
            trendForecast: this.fallbackStrategy.defaultTrend,
            suggestedAPY: this.fallbackStrategy.defaultAPY,
            riskLevel: this.fallbackStrategy.defaultRiskLevel,
            confidence: 0.5,
            action: 'MAINTAIN',
            sentiment: 'NEUTRAL',
            reasoning: 'Fallback: Servicio ML no disponible',
            volumeChange: 0,
            recommendedAds: [],
            timestamp: new Date().toISOString(),
            isFallback: true
        };
    }

    _calculateVolumeChange(oracleData) {
        // Implementar cálculo de cambio de volumen
        // Por ahora retornar 0 como placeholder
        return 0;
    }

    _generateCacheKey(data) {
        return `ml:${data.assetPair}:${Math.floor(Date.now() / this.cacheTTL)}`;
    }

    _getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }

    _saveToCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });

        // Limpiar caché antigua
        if (this.cache.size > 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }
}

module.exports = new MachineLearningService();
