const express = require('express');
const router = express.Router();
const agentsController = require('../controllers/agents.controller');

function requireCampaignApproval(req, res, next) {
    if (process.env.NODE_ENV !== 'production') return next();

    const provided = req.headers['x-openclaw-key'] || req.headers['x-api-key'];
    const expected = process.env.OPENCLAW_API_KEY || process.env.INTERNAL_API_KEY;

    if (!expected || provided !== expected) {
        return res.status(401).json({
            success: false,
            error: 'Campaign approval requires an authorized admin/OpenClaw key'
        });
    }

    next();
}

// Obtener estado general
router.get('/status', agentsController.getAgentsStatus);

// Iniciar campaña completa de Scraper y Mensajería
router.post('/campaign/start', agentsController.startAcquisitionCampaign);

// Probar un envío (Test Mode)
router.post('/test-pitch', agentsController.testPitch);

// Aprobar y enviar un borrador de outreach. Ningún envío real ocurre sin esta llamada.
router.post('/campaign/leads/:leadId/approve-send', requireCampaignApproval, agentsController.approveLeadOutreach);

module.exports = router;
