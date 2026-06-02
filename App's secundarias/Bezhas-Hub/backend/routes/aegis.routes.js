const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/admin.middleware');

// Simulación de integración con Aegis (FastAPI)
const axios = require('axios');
const AEGIS_URL = process.env.AEGIS_URL || 'http://localhost:8001/aegis/v1';

// POST /aegis/chat - Chat con IA (Aegis)
router.post('/chat', verifyAdminToken, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });
        // Llama al endpoint de FastAPI
        const response = await axios.post(`${AEGIS_URL}/chat`, { message });
        res.json({ reply: response.data.reply || 'Sin respuesta de la IA.' });
    } catch (error) {
        console.error('Aegis chat error:', error.message);
        res.status(500).json({ error: 'Error comunicando con Aegis' });
    }
});

// POST /aegis/admin-action - Ejecutar acción administrativa/auto-healing
router.post('/admin-action', verifyAdminToken, async (req, res) => {
    try {
        const { action } = req.body;
        if (!action) return res.status(400).json({ error: 'Action required' });
        // Llama al endpoint de FastAPI
        const response = await axios.post(`${AEGIS_URL}/admin-action`, { action });
        res.json({ result: response.data.result || 'Acción ejecutada.' });
    } catch (error) {
        console.error('Aegis admin-action error:', error.message);
        res.status(500).json({ error: 'Error ejecutando acción en Aegis' });
    }
});

module.exports = router;
