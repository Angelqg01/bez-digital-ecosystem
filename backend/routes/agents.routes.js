const express = require('express');
const router = express.Router();
const agentsController = require('../controllers/agents.controller');

// Obtener estado general
router.get('/status', agentsController.getAgentsStatus);

// Iniciar campaña completa de Scraper y Mensajería
router.post('/campaign/start', agentsController.startAcquisitionCampaign);

// Probar un envío (Test Mode)
router.post('/test-pitch', agentsController.testPitch);

module.exports = router;
