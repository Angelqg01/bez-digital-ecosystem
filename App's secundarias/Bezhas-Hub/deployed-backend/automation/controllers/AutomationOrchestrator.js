/**
 * 🎭 Automation Orchestrator - El Director de la Orquesta
 * 
 * Coordina toda la automatización de BeZhas:
 * 1. Escucha datos del Oráculo
 * 2. Envía a ML para análisis
 * 3. Ejecuta decisiones en blockchain
 * 4. Actualiza experiencia de usuario
 * 
 * @architecture Event-Driven con Circuit Breaker
 */

const pino = require('pino');
const eventBus = require('../events/EventBus');
const mlService = require('../services/ml.service');
const blockchainService = require('../services/blockchain.service');

const logger = pino({ name: 'AutomationOrchestrator' });

class AutomationOrchestrator {
    constructor() {
        this.isRunning = false;
        this.metrics = {
            totalDecisions: 0,
            successfulAdjustments: 0,
            failedAdjustments: 0,
            halvingsExecuted: 0,
            lastDecisionTime: null
        };

        // Configuración de umbrales para decisiones automáticas
        this.config = {
            minConfidenceForAPYChange: 0.75, // 75% confianza mínima
            minAPYChangePercent: 2, // Cambio mínimo del 2%
            maxAPYChangePerHour: 5, // Máximo 5 cambios por hora
            halvingCooldown: 86400000, // 24 horas entre halvings
            lastHalving: null,
            apyChangesInLastHour: []
        };
    }

    /**
     * 🚀 Iniciar el orquestador
     */
    async start() {
        if (this.isRunning) {
            logger.warn('⚠️ Orchestrator ya está corriendo');
            return;
        }

        try {
            logger.info('🎬 Iniciando Automation Orchestrator...');

            // Inicializar blockchain service
            await blockchainService.initialize();

            // Suscribirse a eventos clave
            this._subscribeToEvents();

            this.isRunning = true;
            logger.info('✅ Automation Orchestrator activo y escuchando eventos');

        } catch (error) {
            logger.error({ error: error.message }, '❌ Error iniciando orchestrator');
            throw error;
        }
    }

    /**
     * 🛑 Detener el orquestador
     */
    stop() {
        this.isRunning = false;
        logger.info('🛑 Automation Orchestrator detenido');
    }

    /**
     * 📊 Obtener métricas del orchestrator
     */
    getMetrics() {
        return {
            ...this.metrics,
            isRunning: this.isRunning,
            config: this.config
        };
    }

    // --- EVENT HANDLERS ---

    /**
     * 🎧 Suscribirse a eventos del EventBus
     */
    _subscribeToEvents() {
        // 1. ORACLE: Datos recibidos del oráculo
        eventBus.subscribe(
            eventBus.EVENTS.ORACLE_DATA_RECEIVED,
            this._handleOracleUpdate.bind(this),
            { priority: 'high' }
        );

        // 2. ML: Predicción lista
        eventBus.subscribe(
            eventBus.EVENTS.ML_PREDICTION_READY,
            this._handleMLPrediction.bind(this),
            { priority: 'high' }
        );

        // 3. ECONOMY: Halving requerido
        eventBus.subscribe(
            eventBus.EVENTS.ECONOMY_HALVING_DUE,
            this._handleHalvingDue.bind(this),
            { priority: 'critical' }
        );

        // 4. BLOCKCHAIN: Confirmación de transacción
        eventBus.subscribe(
            eventBus.EVENTS.BLOCKCHAIN_TX_CONFIRMED,
            this._handleBlockchainConfirmation.bind(this)
        );

        // 5. USER: Actividad de usuario detectada
        eventBus.subscribe(
            eventBus.EVENTS.USER_ACTIVITY_DETECTED,
            this._handleUserActivity.bind(this)
        );

        logger.info('👂 Suscripciones a eventos completadas');
    }

    /**
     * 🔮 Handler: Actualización del Oráculo
     */
    async _handleOracleUpdate(event) {
        const { oracleData } = event.payload;

        logger.info({
            source: oracleData.source,
            assetPair: oracleData.assetPair,
            price: oracleData.price
        }, '📡 Datos del oráculo recibidos');

        try {
            // 1. Enviar a ML para análisis
            const mlDecision = await mlService.analyzeMarketConditions(oracleData);

            // 2. Publicar predicción lista
            eventBus.publish(eventBus.EVENTS.ML_PREDICTION_READY, {
                oracleData,
                decision: mlDecision,
                orchestratorId: 'main'
            });

        } catch (error) {
            logger.error({
                error: error.message,
                oracleData
            }, '❌ Error procesando datos del oráculo');

            eventBus.publish(eventBus.EVENTS.ORACLE_ERROR, {
                error: error.message,
                oracleData
            });
        }
    }

    /**
     * 🧠 Handler: Predicción del ML lista
     */
    async _handleMLPrediction(event) {
        const { decision, oracleData } = event.payload;

        logger.info({
            trend: decision.trendForecast,
            suggestedAPY: decision.suggestedAPY,
            confidence: decision.confidence,
            action: decision.action
        }, '🧠 Decisión del ML recibida');

        this.metrics.totalDecisions++;
        this.metrics.lastDecisionTime = new Date().toISOString();

        try {
            // Evaluar si se debe ejecutar el ajuste
            const shouldExecute = this._shouldExecuteAPYChange(decision);

            if (!shouldExecute.execute) {
                logger.info({ reason: shouldExecute.reason }, 'ℹ️ Ajuste NO ejecutado');
                return;
            }

            // Ejecutar ajuste de APY en blockchain
            await this._executeEconomyAdjustments(decision);

            // Actualizar UX (notificaciones, feed social, etc.)
            await this._updateUserExperience(decision);

        } catch (error) {
            logger.error({
                error: error.message,
                decision
            }, '❌ Error ejecutando decisión del ML');

            this.metrics.failedAdjustments++;
        }
    }

    /**
     * 🔪 Handler: Halving requerido
     */
    async _handleHalvingDue(event) {
        const { reasoning, urgency } = event.payload;

        logger.warn({
            reasoning,
            urgency
        }, '⚠️ Solicitud de HALVING recibida');

        try {
            // Verificar cooldown
            if (this.config.lastHalving) {
                const timeSinceLastHalving = Date.now() - this.config.lastHalving;
                if (timeSinceLastHalving < this.config.halvingCooldown) {
                    logger.warn('⏸️ Halving en cooldown, ignorando solicitud');
                    return;
                }
            }

            // Ejecutar halving
            const result = await blockchainService.executeHalving(reasoning);

            if (result.success) {
                this.config.lastHalving = Date.now();
                this.metrics.halvingsExecuted++;

                logger.info('✅ HALVING ejecutado exitosamente');

                // Notificar a todos los usuarios
                eventBus.publish(eventBus.EVENTS.USER_PROMO_TRIGGERED, {
                    type: 'HALVING_EXECUTED',
                    message: '🔪 ¡Halving ejecutado! Las recompensas se han reducido a la mitad',
                    priority: 'HIGH'
                });
            }

        } catch (error) {
            logger.error({
                error: error.message,
                reasoning
            }, '❌ Error ejecutando halving');
        }
    }

    /**
     * ✅ Handler: Confirmación de transacción blockchain
     */
    async _handleBlockchainConfirmation(event) {
        const { eventName, txHash, blockNumber } = event.payload;

        logger.info({
            eventName,
            txHash,
            blockNumber
        }, '✅ Transacción confirmada en blockchain');

        // Actualizar métricas según el tipo de evento
        if (eventName === 'APYUpdated') {
            this.metrics.successfulAdjustments++;
        }
    }

    /**
     * 👤 Handler: Actividad de usuario
     */
    async _handleUserActivity(event) {
        const { wallet, activityType } = event.payload;

        logger.info({ wallet, activityType }, '👤 Actividad de usuario detectada');

        try {
            // Analizar comportamiento del usuario
            const userAnalysis = await mlService.analyzeUserBehavior(event.payload);

            if (userAnalysis.eligibleForAirdrop) {
                logger.info({ wallet }, '🎁 Usuario elegible para airdrop');

                eventBus.publish(eventBus.EVENTS.USER_ELIGIBLE_AIRDROP, {
                    wallet,
                    reason: 'High reputation score',
                    reputationScore: userAnalysis.reputationScore
                });
            }

        } catch (error) {
            logger.error({
                error: error.message,
                wallet
            }, '❌ Error analizando actividad de usuario');
        }
    }

    // --- MÉTODOS PRIVADOS ---

    /**
     * ⚙️ Ejecutar ajustes económicos en blockchain
     */
    async _executeEconomyAdjustments(decision) {
        const { suggestedAPY, reasoning } = decision;

        logger.info({ suggestedAPY, reasoning }, '⚙️ Ejecutando ajuste de APY...');

        try {
            const result = await blockchainService.setStakingAPY(
                suggestedAPY,
                reasoning
            );

            if (result.success && !result.unchanged) {
                // Registrar cambio
                this.config.apyChangesInLastHour.push({
                    timestamp: Date.now(),
                    oldAPY: result.oldAPY,
                    newAPY: result.newAPY
                });

                // Limpiar cambios antiguos (más de 1 hora)
                this._cleanOldAPYChanges();

                logger.info({
                    oldAPY: result.oldAPY,
                    newAPY: result.newAPY,
                    txHash: result.txHash
                }, '✅ APY ajustado exitosamente');
            }

        } catch (error) {
            logger.error({
                error: error.message,
                suggestedAPY
            }, '❌ Error ajustando APY');
            throw error;
        }
    }

    /**
     * 🎨 Actualizar experiencia de usuario
     */
    async _updateUserExperience(decision) {
        logger.info('🎨 Actualizando experiencia de usuario...');

        try {
            // 1. Publicar en feed social (si hay cambio significativo)
            if (decision.action !== 'MAINTAIN') {
                eventBus.publish(eventBus.EVENTS.SYSTEM_ANNOUNCEMENT, {
                    type: 'ECONOMY_UPDATE',
                    message: `APY ajustado a ${decision.suggestedAPY / 100}% basado en condiciones del mercado`,
                    trend: decision.trendForecast,
                    sentiment: decision.sentiment
                });
            }

            // 2. Triggers para promos/airdrops personalizados
            if (decision.trendForecast === 'BULLISH' && decision.confidence > 0.8) {
                eventBus.publish(eventBus.EVENTS.USER_PROMO_TRIGGERED, {
                    type: 'BULLISH_BONUS',
                    message: '🚀 Mercado alcista detectado! Bonos especiales activados',
                    eligibilityCriteria: 'active_stakers'
                });
            }

            logger.info('✅ Experiencia de usuario actualizada');

        } catch (error) {
            logger.error({
                error: error.message
            }, '❌ Error actualizando UX');
        }
    }

    /**
     * 🤔 Evaluar si se debe ejecutar un cambio de APY
     */
    _shouldExecuteAPYChange(decision) {
        // 1. Verificar confianza del modelo
        if (decision.confidence < this.config.minConfidenceForAPYChange) {
            return {
                execute: false,
                reason: `Confianza insuficiente: ${decision.confidence} < ${this.config.minConfidenceForAPYChange}`
            };
        }

        // 2. Verificar si es un cambio significativo
        // (Necesitaríamos el APY actual del contrato)
        // Por ahora, asumimos que es significativo si la acción no es MAINTAIN
        if (decision.action === 'MAINTAIN') {
            return {
                execute: false,
                reason: 'Acción sugerida es MAINTAIN'
            };
        }

        // 3. Verificar límite de cambios por hora
        if (this.config.apyChangesInLastHour.length >= this.config.maxAPYChangePerHour) {
            return {
                execute: false,
                reason: `Límite de ${this.config.maxAPYChangePerHour} cambios/hora alcanzado`
            };
        }

        // 4. Todo OK, ejecutar
        return {
            execute: true,
            reason: 'Todas las condiciones cumplidas'
        };
    }

    /**
     * 🧹 Limpiar cambios de APY antiguos (>1 hora)
     */
    _cleanOldAPYChanges() {
        const oneHourAgo = Date.now() - 3600000;
        this.config.apyChangesInLastHour = this.config.apyChangesInLastHour.filter(
            change => change.timestamp > oneHourAgo
        );
    }
}

module.exports = new AutomationOrchestrator();
