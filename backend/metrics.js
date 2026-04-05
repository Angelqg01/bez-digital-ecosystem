const express = require('express');
const client = require('prom-client');

const router = express.Router();

// Prometheus metrics registry
client.collectDefaultMetrics();

router.get('/health', (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    } catch (err) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
    }
});

router.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

module.exports = router;
