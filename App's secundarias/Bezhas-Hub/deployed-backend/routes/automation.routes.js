/**
 * 🛣️ Automation API Routes
 * 
 * Endpoints para:
 * - Monitorear estado del sistema de automatización
 * - Ver métricas y logs
 * - Ejecutar acciones manuales (admin)
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const orchestrator = require('../automation/controllers/AutomationOrchestrator');
const halvingJob = require('../automation/jobs/halvingCheck.job');
const eventBus = require('../automation/events/EventBus');
const mlService = require('../automation/services/ml.service');
const blockchainService = require('../automation/services/blockchain.service');

/**
 * @route   GET /api/automation/status
 * @desc    Estado general del sistema de automatización
 * @access  Private (Admin)
 */
router.get('/status', protect, async (req, res) => {
    try {
        const status = {
            orchestrator: {
                isRunning: orchestrator.isRunning,
                metrics: orchestrator.getMetrics()
            },
            halvingJob: {
                isRunning: halvingJob.isRunning,
                metrics: halvingJob.getMetrics()
            },
            eventBus: {
                metrics: eventBus.getMetrics()
            },
            blockchain: {
                isInitialized: blockchainService.isInitialized,
                currentAPY: await blockchainService.getCurrentAPY()
            },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/automation/metrics
 * @desc    Métricas detalladas del sistema
 * @access  Private (Admin)
 */
router.get('/metrics', protect, async (req, res) => {
    try {
        const metrics = {
            orchestrator: orchestrator.getMetrics(),
            eventBus: eventBus.getMetrics(),
            halvingJob: halvingJob.getMetrics(),
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            data: metrics
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/automation/start
 * @desc    Iniciar sistema de automatización
 * @access  Private (Admin)
 */
router.post('/start', protect, async (req, res) => {
    try {
        await orchestrator.start();
        halvingJob.start();

        res.json({
            success: true,
            message: 'Sistema de automatización iniciado',
            status: {
                orchestrator: orchestrator.isRunning,
                halvingJob: halvingJob.isRunning
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/automation/stop
 * @desc    Detener sistema de automatización
 * @access  Private (Admin)
 */
router.post('/stop', protect, async (req, res) => {
    try {
        orchestrator.stop();
        halvingJob.stop();

        res.json({
            success: true,
            message: 'Sistema de automatización detenido',
            status: {
                orchestrator: orchestrator.isRunning,
                halvingJob: halvingJob.isRunning
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/automation/manual/apy
 * @desc    Ajustar APY manualmente (bypass ML)
 * @access  Private (Admin)
 */
router.post('/manual/apy', protect, async (req, res) => {
    try {
        const { newAPY, reason } = req.body;

        if (!newAPY || newAPY < 500 || newAPY > 5000) {
            return res.status(400).json({
                success: false,
                error: 'APY inválido (debe estar entre 500-5000)'
            });
        }

        const result = await blockchainService.setStakingAPY(
            newAPY,
            reason || `Ajuste manual por admin: ${req.user.wallet}`
        );

        res.json({
            success: true,
            message: 'APY ajustado manualmente',
            data: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/automation/manual/halving
 * @desc    Ejecutar halving manualmente
 * @access  Private (Admin)
 */
router.post('/manual/halving', protect, async (req, res) => {
    try {
        const { reason } = req.body;

        const result = await blockchainService.executeHalving(
            reason || `Halving manual ejecutado por admin: ${req.user.wallet}`
        );

        res.json({
            success: true,
            message: 'Halving ejecutado manualmente',
            data: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/automation/test/oracle
 * @desc    Simular datos del oráculo (testing)
 * @access  Private (Admin)
 */
router.post('/test/oracle', protect, async (req, res) => {
    try {
        const { assetPair, price, volume } = req.body;

        if (!assetPair || !price) {
            return res.status(400).json({
                success: false,
                error: 'assetPair y price son requeridos'
            });
        }

        // Simular evento del oráculo
        eventBus.publish(eventBus.EVENTS.ORACLE_DATA_RECEIVED, {
            oracleData: {
                id: `test_${Date.now()}`,
                source: 'MANUAL_TEST',
                assetPair,
                price: parseFloat(price),
                volume: volume ? parseFloat(volume) : 1000000,
                timestamp: Date.now(),
                extraData: {
                    testMode: true,
                    triggeredBy: req.user.wallet
                }
            }
        });

        res.json({
            success: true,
            message: 'Evento de oráculo simulado',
            note: 'El sistema procesará estos datos automáticamente'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/automation/logs/events
 * @desc    Obtener historial de eventos recientes
 * @access  Private (Admin)
 */
router.get('/logs/events', protect, async (req, res) => {
    try {
        const { limit = 50, type } = req.query;

        const metrics = eventBus.getMetrics();

        // Filtrar por tipo si se especifica
        let events = metrics.eventsByType;
        if (type && events[type]) {
            events = { [type]: events[type] };
        }

        res.json({
            success: true,
            data: {
                totalEvents: metrics.totalEvents,
                lastEventTime: metrics.lastEventTime,
                eventsByType: events,
                errors: metrics.errors.slice(-limit),
                circuitBreaker: metrics.circuitBreaker
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   POST /api/automation/ml/analyze
 * @desc    Forzar análisis ML con datos custom
 * @access  Private (Admin)
 */
router.post('/ml/analyze', protect, async (req, res) => {
    try {
        const { oracleData } = req.body;

        if (!oracleData || !oracleData.assetPair || !oracleData.price) {
            return res.status(400).json({
                success: false,
                error: 'oracleData con assetPair y price requeridos'
            });
        }

        const decision = await mlService.analyzeMarketConditions(oracleData);

        res.json({
            success: true,
            message: 'Análisis ML completado',
            data: decision
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route   GET /api/automation/health
 * @desc    Health check del sistema
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            components: {
                orchestrator: orchestrator.isRunning ? 'UP' : 'DOWN',
                halvingJob: halvingJob.isRunning ? 'UP' : 'DOWN',
                eventBus: eventBus.getMetrics().circuitBreaker?.isOpen ? 'DEGRADED' : 'UP',
                blockchain: blockchainService.isInitialized ? 'UP' : 'DOWN'
            }
        };

        // Determinar status general
        const allUp = Object.values(health.components).every(s => s === 'UP');
        const anyDegraded = Object.values(health.components).some(s => s === 'DEGRADED');

        if (!allUp) {
            health.status = anyDegraded ? 'DEGRADED' : 'DOWN';
        }

        const statusCode = health.status === 'OK' ? 200 : health.status === 'DEGRADED' ? 503 : 503;

        res.status(statusCode).json({
            success: true,
            data: health
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
