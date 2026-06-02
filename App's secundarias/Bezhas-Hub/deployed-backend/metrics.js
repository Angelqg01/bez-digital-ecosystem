const express = require('express');
const client = require('prom-client');

const router = express.Router();

// Prometheus metrics registry
client.collectDefaultMetrics();

router.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

router.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

module.exports = router;
