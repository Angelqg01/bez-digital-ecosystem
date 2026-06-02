/**
 * ⏰ Halving Check Job - Verificador Periódico de Condiciones
 * 
 * Cron job que verifica cada X minutos si se deben ejecutar:
 * - Halving automático
 * - Ajustes de emergencia
 * - Chequeos de salud del sistema
 */

const cron = require('node-cron');
const pino = require('pino');
const eventBus = require('../events/EventBus');
const mlService = require('../services/ml.service');

const logger = pino({ name: 'HalvingCheckJob' });

class HalvingCheckJob {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;

        // Configuración del job
        this.config = {
            schedule: process.env.HALVING_CHECK_CRON || '*/30 * * * *', // Cada 30 minutos por defecto
            enabled: process.env.HALVING_CHECK_ENABLED !== 'false',
            minSupplyForCheck: 1000000, // 1M tokens mínimo
            healthCheckInterval: '*/5 * * * *' // Cada 5 minutos
        };

        this.metrics = {
            totalChecks: 0,
            halvingTriggered: 0,
            lastCheck: null,
            lastCheckResult: null
        };
    }

    /**
     * 🚀 Iniciar el cron job
     */
    start() {
        if (this.isRunning) {
            logger.warn('⚠️ Halving check job ya está corriendo');
            return;
        }

        if (!this.config.enabled) {
            logger.info('ℹ️ Halving check job deshabilitado por configuración');
            return;
        }

        try {
            // Job principal: Verificar condiciones de halving
            this.cronJob = cron.schedule(this.config.schedule, async () => {
                await this._checkHalvingConditions();
            });

            // Job secundario: Health check del sistema
            this.healthCheckJob = cron.schedule(this.config.healthCheckInterval, async () => {
                await this._performHealthCheck();
            });

            this.isRunning = true;
            logger.info({
                schedule: this.config.schedule,
                healthCheckInterval: this.config.healthCheckInterval
            }, '✅ Halving check job iniciado');

        } catch (error) {
            logger.error({ error: error.message }, '❌ Error iniciando halving check job');
            throw error;
        }
    }

    /**
     * 🛑 Detener el cron job
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        if (this.healthCheckJob) {
            this.healthCheckJob.stop();
            this.healthCheckJob = null;
        }

        this.isRunning = false;
        logger.info('🛑 Halving check job detenido');
    }

    /**
     * 📊 Obtener métricas del job
     */
    getMetrics() {
        return {
            ...this.metrics,
            isRunning: this.isRunning,
            config: this.config
        };
    }

    // --- MÉTODOS PRIVADOS ---

    /**
     * 🔍 Verificar condiciones para halving
     */
    async _checkHalvingConditions() {
        this.metrics.totalChecks++;
        this.metrics.lastCheck = new Date().toISOString();

        logger.info('🔍 Verificando condiciones de halving...');

        try {
            // 1. Obtener métricas del sistema desde la DB o contrato
            const systemMetrics = await this._getSystemMetrics();

            // 2. Validación básica: ¿hay suficiente supply?
            if (systemMetrics.totalSupply < this.config.minSupplyForCheck) {
                this.metrics.lastCheckResult = 'SKIPPED_LOW_SUPPLY';
                logger.info({ totalSupply: systemMetrics.totalSupply }, 'ℹ️ Supply muy bajo, saltando verificación');
                return;
            }

            // 3. Enviar a ML para análisis
            const mlDecision = await mlService.checkHalvingConditions(systemMetrics);

            this.metrics.lastCheckResult = mlDecision.shouldHalve ? 'HALVING_TRIGGERED' : 'CONDITIONS_NOT_MET';

            if (mlDecision.shouldHalve && mlDecision.confidence > 0.8) {
                logger.warn({
                    confidence: mlDecision.confidence,
                    reasoning: mlDecision.reasoning
                }, '⚠️ Condiciones de HALVING cumplidas!');

                this.metrics.halvingTriggered++;

                // Publicar evento para que el orchestrator lo maneje
                eventBus.publish(eventBus.EVENTS.ECONOMY_HALVING_DUE, {
                    source: 'HalvingCheckJob',
                    reasoning: mlDecision.reasoning,
                    confidence: mlDecision.confidence,
                    urgency: mlDecision.urgency || 'MEDIUM',
                    systemMetrics
                });
            } else {
                logger.info({
                    shouldHalve: mlDecision.shouldHalve,
                    confidence: mlDecision.confidence
                }, 'ℹ️ Condiciones de halving NO cumplidas');
            }

        } catch (error) {
            this.metrics.lastCheckResult = 'ERROR';
            logger.error({
                error: error.message
            }, '❌ Error verificando condiciones de halving');

            eventBus.publish(eventBus.EVENTS.AUTOMATION_HANDLER_FAILED, {
                job: 'HalvingCheckJob',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 🏥 Realizar health check del sistema
     */
    async _performHealthCheck() {
        try {
            const health = {
                timestamp: new Date().toISOString(),
                components: {}
            };

            // 1. Verificar EventBus
            const eventBusMetrics = eventBus.getMetrics();
            health.components.eventBus = {
                status: eventBusMetrics.errors.length === 0 ? 'HEALTHY' : 'DEGRADED',
                totalEvents: eventBusMetrics.totalEvents,
                errors: eventBusMetrics.errors.length
            };

            // 2. Verificar circuit breakers
            if (eventBusMetrics.circuitBreaker?.isOpen) {
                logger.warn('🚨 Circuit breaker del EventBus está ABIERTO');
                health.components.eventBus.status = 'UNHEALTHY';
            }

            // 3. Publicar evento de health check
            eventBus.publish(eventBus.EVENTS.SYSTEM_HEALTH_CHECK, {
                source: 'HalvingCheckJob',
                health,
                jobMetrics: this.metrics
            });

            logger.info({ health }, '🏥 Health check completado');

        } catch (error) {
            logger.error({
                error: error.message
            }, '❌ Error en health check');
        }
    }

    /**
     * 📊 Obtener métricas del sistema
     */
    async _getSystemMetrics() {
        // TODO: Implementar obtención real de métricas desde:
        // - Smart contract (totalSupply, circulatingSupply)
        // - Base de datos (userGrowth, activityMetrics)
        // - Oracle (priceHistory, marketCap)

        // Por ahora, retornar mock data
        return {
            totalSupply: 10000000, // 10M tokens
            circulatingSupply: 7500000, // 7.5M en circulación
            burnRate: 0.01, // 1% burn rate
            priceHistory: [
                { timestamp: Date.now() - 86400000, price: 1.20 },
                { timestamp: Date.now() - 43200000, price: 1.25 },
                { timestamp: Date.now(), price: 1.30 }
            ],
            userGrowth: {
                daily: 150,
                weekly: 980,
                monthly: 4200
            },
            stakingMetrics: {
                totalStaked: 5000000,
                averageStakeDuration: 30 // días
            }
        };
    }
}

module.exports = new HalvingCheckJob();
