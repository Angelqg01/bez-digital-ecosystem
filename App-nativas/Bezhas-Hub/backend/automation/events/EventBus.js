/**
 * 🧠 BeZhas Event Bus - Sistema Nervioso Central
 * 
 * Implementa el patrón Observer/Pub-Sub para comunicación desacoplada
 * entre el Oráculo, ML, Blockchain y Frontend.
 * 
 * @architecture Singleton Pattern para garantizar única instancia
 */

const EventEmitter = require('events');
const pino = require('pino');

const logger = pino({
    name: 'EventBus',
    level: process.env.LOG_LEVEL || 'info'
});

class BeZhasEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50); // Aumentar límite para múltiples suscriptores

        // Métricas de monitoreo
        this.metrics = {
            totalEvents: 0,
            eventsByType: {},
            lastEventTime: null,
            errors: 0
        };

        // Circuit Breaker para prevenir cascadas de fallos
        this.circuitBreaker = {
            isOpen: false,
            failures: 0,
            threshold: 10,
            timeout: 60000 // 1 minuto
        };

        this._setupGlobalHandlers();
    }

    /**
     * 📡 Publicar evento con validación y logging
     */
    publish(eventType, payload) {
        // Circuit Breaker: Si el sistema está fallando mucho, pausar
        if (this.circuitBreaker.isOpen) {
            logger.warn({ eventType }, '⚠️ Circuit Breaker ABIERTO. Evento descartado');
            return false;
        }

        try {
            // Validación de payload
            if (!payload || typeof payload !== 'object') {
                throw new Error('Payload debe ser un objeto válido');
            }

            // Enriquecer con metadata
            const enrichedPayload = {
                ...payload,
                _meta: {
                    timestamp: new Date().toISOString(),
                    eventId: this._generateEventId(),
                    source: payload.source || 'unknown'
                }
            };

            // Emitir evento
            this.emit(eventType, enrichedPayload);

            // Actualizar métricas
            this.metrics.totalEvents++;
            this.metrics.eventsByType[eventType] = (this.metrics.eventsByType[eventType] || 0) + 1;
            this.metrics.lastEventTime = Date.now();

            logger.info({
                eventType,
                eventId: enrichedPayload._meta.eventId,
                source: enrichedPayload._meta.source
            }, `✅ Evento publicado: ${eventType}`);

            return true;

        } catch (error) {
            this._handlePublishError(eventType, error);
            return false;
        }
    }

    /**
     * 👂 Suscribirse a eventos con error handling automático
     */
    subscribe(eventType, handler, options = {}) {
        const { priority = 'normal', retries = 3 } = options;

        // Wrapper con manejo de errores y reintentos
        const safeHandler = async (payload) => {
            let attempts = 0;

            while (attempts < retries) {
                try {
                    await handler(payload);
                    return;
                } catch (error) {
                    attempts++;
                    logger.error({
                        eventType,
                        attempt: attempts,
                        error: error.message
                    }, `❌ Error en handler (intento ${attempts}/${retries})`);

                    if (attempts >= retries) {
                        this._recordFailure();
                        this.publish('automation.handler.failed', {
                            eventType,
                            error: error.message,
                            payload
                        });
                    } else {
                        // Exponential backoff
                        await this._sleep(Math.pow(2, attempts) * 1000);
                    }
                }
            }
        };

        // Registrar listener con prioridad
        if (priority === 'high') {
            this.prependListener(eventType, safeHandler);
        } else {
            this.on(eventType, safeHandler);
        }

        logger.info({ eventType, priority }, `📌 Nuevo suscriptor registrado`);
    }

    /**
     * 🔕 Desuscribirse (Cleanup)
     */
    unsubscribe(eventType, handler) {
        this.off(eventType, handler);
        logger.info({ eventType }, `🔕 Suscriptor removido`);
    }

    /**
     * 📊 Obtener métricas del sistema
     */
    getMetrics() {
        return {
            ...this.metrics,
            listeners: this.eventNames().map(event => ({
                event,
                count: this.listenerCount(event)
            })),
            circuitBreaker: this.circuitBreaker
        };
    }

    /**
     * 🔄 Resetear Circuit Breaker manualmente
     */
    resetCircuitBreaker() {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
        logger.info('✅ Circuit Breaker reseteado');
    }

    // --- MÉTODOS PRIVADOS ---

    _setupGlobalHandlers() {
        // Handler para errores no capturados en listeners
        this.on('error', (error) => {
            logger.error({ error: error.message }, '🔥 Error global en EventBus');
            this._recordFailure();
        });

        // Auto-reset del Circuit Breaker
        setInterval(() => {
            if (this.circuitBreaker.isOpen) {
                logger.info('🔄 Intentando cerrar Circuit Breaker...');
                this.circuitBreaker.failures = Math.max(0, this.circuitBreaker.failures - 1);

                if (this.circuitBreaker.failures === 0) {
                    this.circuitBreaker.isOpen = false;
                    logger.info('✅ Circuit Breaker CERRADO');
                }
            }
        }, this.circuitBreaker.timeout);
    }

    _generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    _recordFailure() {
        this.metrics.errors++;
        this.circuitBreaker.failures++;

        if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            logger.error('🚨 CIRCUIT BREAKER ACTIVADO - Sistema en protección');
        }
    }

    _handlePublishError(eventType, error) {
        logger.error({
            eventType,
            error: error.message,
            stack: error.stack
        }, '❌ Error al publicar evento');

        this._recordFailure();
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton Instance
const eventBus = new BeZhasEventBus();

// Eventos predefinidos del sistema (Type Safety)
eventBus.EVENTS = {
    // Oracle Events
    ORACLE_DATA_RECEIVED: 'oracle.data.received',
    ORACLE_ERROR: 'oracle.error',

    // ML Events
    ML_ANALYSIS_COMPLETE: 'ml.analysis.complete',
    ML_PREDICTION_READY: 'ml.prediction.ready',
    ML_MODEL_UPDATED: 'ml.model.updated',

    // Blockchain Events
    BLOCKCHAIN_APY_UPDATED: 'blockchain.apy.updated',
    BLOCKCHAIN_HALVING_EXECUTED: 'blockchain.halving.executed',
    BLOCKCHAIN_TX_CONFIRMED: 'blockchain.tx.confirmed',
    BLOCKCHAIN_TX_FAILED: 'blockchain.tx.failed',

    // Economy Events
    ECONOMY_CONFIG_CHANGED: 'economy.config.changed',
    ECONOMY_HALVING_DUE: 'economy.halving.due',
    ECONOMY_RISK_ALERT: 'economy.risk.alert',

    // User Events
    USER_ACTIVITY_DETECTED: 'user.activity.detected',
    USER_ELIGIBLE_AIRDROP: 'user.eligible.airdrop',
    USER_PROMO_TRIGGERED: 'user.promo.triggered',

    // System Events
    SYSTEM_EMERGENCY_PAUSE: 'system.emergency.pause',
    SYSTEM_HEALTH_CHECK: 'system.health.check',
    AUTOMATION_HANDLER_FAILED: 'automation.handler.failed'
};

module.exports = eventBus;
