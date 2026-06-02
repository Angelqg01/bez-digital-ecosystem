const express = require('express');
const router = express.Router();
const {
    signSwapTransaction,
    getAIStats,
    checkSanctions
} = require('../controllers/aiRiskEngine.controller');

/**
 * AI Risk Engine Routes
 * Endpoints para evaluación de riesgo y firma criptográfica
 */

/**
 * @route   POST /api/ai/sign-swap
 * @desc    Evalúa riesgo y genera firma criptográfica para swap
 * @access  Public (el contrato valida la firma)
 */
router.post('/sign-swap', signSwapTransaction);

/**
 * @route   GET /api/ai/stats
 * @desc    Obtiene estadísticas del AI Risk Engine
 * @access  Public
 */
router.get('/stats', getAIStats);

/**
 * @route   POST /api/ai/check-sanctions
 * @desc    Verifica si una dirección está en lista de sanciones
 * @access  Public
 */
router.post('/check-sanctions', checkSanctions);

module.exports = router;
