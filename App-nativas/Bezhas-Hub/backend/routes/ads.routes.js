// backend/routes/ads.routes.js
const express = require('express');
const router = express.Router();
const { getActiveCampaigns, logAdEvent, verifyAdEvent, getEventsByFilter } = require('../services/adService');
const { matchContextToCampaign } = require('../utils/nlp');

// Solicitud de anuncio contextual
router.post('/request-ad', async (req, res) => {
    const { context } = req.body;
    const campaigns = await getActiveCampaigns();
    const matched = matchContextToCampaign(context, campaigns);
    if (!matched) return res.status(404).json({ error: 'No ad found' });
    const eventId = await logAdEvent(matched.id, req.ip, 'impression');
    res.json({
        ad: {
            image: matched.image,
            text: matched.text,
            link: matched.link,
            campaignId: matched.id
        },
        eventId
    });
});

// Verificación de evento de impresión/clic
router.post('/verify-event', async (req, res) => {
    const { eventId, type, userId } = req.body;
    const valid = await verifyAdEvent(eventId, type, userId, req.ip);
    res.json({ valid });
});

// Endpoint para consultar historial de eventos
router.get('/events', async (req, res) => {
    const { userId, campaignId } = req.query;
    const events = getEventsByFilter({ userId, campaignId });
    res.json(events);
});

module.exports = router;
