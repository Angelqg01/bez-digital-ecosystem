require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { autoSignAndSend } = require('./auto-signer');
const logger = require('./logger');

const app = express();
app.use(express.json());

// Restrict CORS to known origins
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'];
app.use(cors({ origin: CORS_ORIGINS }));

const PORT = process.env.PORT || 4000;
const CONTROL_API = process.env.CONTROL_API_URL || 'http://localhost:3001';
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '60000', 10);
let heartbeatTimer = null;
let lastHeartbeatAt = null;
let lastValidationAt = null;
let validationCount = 0;

// API Key middleware for B2B Authorization (timing-safe)
const requireAuth = (req, res, next) => {
    const apiKey = req.headers['authorization'] || req.query.api_key;
    const expected = process.env.API_KEY;
    if (!apiKey || !expected) {
        logger.warn('Unauthorized access attempt', { ip: req.ip, path: req.path });
        return res.status(401).json({ error: "Unauthorized. Invalid API Key." });
    }
    // Timing-safe comparison to prevent timing attacks
    const keyBuf = Buffer.from(apiKey);
    const expectedBuf = Buffer.from(expected);
    if (keyBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(keyBuf, expectedBuf)) {
        logger.warn('Unauthorized access attempt', { ip: req.ip, path: req.path });
        return res.status(401).json({ error: "Unauthorized. Invalid API Key." });
    }
    next();
};

// ── Webhook tier gate: only professional / enterprise plans can use webhooks ──
const ALLOWED_TIERS = ['professional', 'enterprise'];

const requireWebhookTier = async (req, res, next) => {
    try {
        const apiKey = req.headers['authorization'] || req.query.api_key;
        const resp = await fetch(`${CONTROL_API}/api/enterprises/by-key`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CONTROL_JWT || ''}`,
                'X-API-Key': apiKey || '',
            },
        });

        if (!resp.ok) {
            logger.warn('Tier lookup failed', { status: resp.status });
            return res.status(403).json({ error: 'Unable to verify subscription tier.' });
        }

        const enterprise = await resp.json();
        const tier = enterprise.tier || 'basic';

        if (!ALLOWED_TIERS.includes(tier)) {
            logger.warn('Webhook tier denied', { tier, ip: req.ip });
            return res.status(403).json({
                error: 'Webhook access requires a professional or enterprise plan.',
                current_tier: tier,
                required_tiers: ALLOWED_TIERS,
            });
        }

        req.enterpriseTier = tier;
        next();
    } catch (err) {
        logger.error('Tier gate error', { error: err.message });
        return res.status(500).json({ error: 'Subscription verification failed.' });
    }
};

app.post('/webhook/logistics', requireAuth, requireWebhookTier, async (req, res) => {
    try {
        logger.info('Logistics webhook received', { container_id: req.body.container_id });

        const { container_id, temperature, status } = req.body;

        if (!container_id || temperature === undefined) {
            return res.status(400).json({ error: "Missing required fields: container_id, temperature" });
        }

        const txReceipt = await autoSignAndSend(container_id, temperature, status);
        validationCount++;
        lastValidationAt = new Date().toISOString();

        logger.info('Logistics tx confirmed', { tx_hash: txReceipt.hash, block: txReceipt.blockNumber });

        res.status(200).json({
            success: true,
            message: "Data securely submitted to BeZhas L2 Escrow",
            tx_hash: txReceipt.hash,
            l2_block: txReceipt.blockNumber
        });

    } catch (error) {
        logger.error('Logistics webhook failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /webhook/generic — Accepts data from any sector (health, energy, automotive, etc.)
 * Body: { sector, entity_id, data: { ... }, metadata: { ... } }
 */
app.post('/webhook/generic', requireAuth, requireWebhookTier, async (req, res) => {
    try {
        const { sector, entity_id, data, metadata } = req.body;

        if (!sector || !entity_id || !data) {
            return res.status(400).json({ error: 'Missing required fields: sector, entity_id, data' });
        }

        // Sanitize sector to safe chars
        const safeSector = String(sector).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
        const safeEntityId = String(entity_id).slice(0, 100);

        logger.info('Generic webhook received', { sector: safeSector, entity_id: safeEntityId });

        // Forward to control API for processing
        const resp = await fetch(`${CONTROL_API}/api/contracts/${safeSector}/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CONTROL_JWT || ''}`,
            },
            body: JSON.stringify({
                sector: safeSector,
                entity_id: safeEntityId,
                data,
                metadata,
                source: 'edge-node',
                node_address: process.env.VALIDATOR_ADDRESS || '',
            }),
        });

        const result = await resp.json().catch(() => ({}));
        validationCount++;
        lastValidationAt = new Date().toISOString();

        logger.info('Generic webhook processed', { sector: safeSector, status: resp.status });

        res.status(resp.ok ? 200 : 502).json({
            success: resp.ok,
            sector: safeSector,
            entity_id: safeEntityId,
            api_status: resp.status,
            result,
        });
    } catch (error) {
        logger.error('Generic webhook failed', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/network/stats', async (req, res) => {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
        const [blockNumber, network, feeData] = await Promise.all([
            provider.getBlockNumber(),
            provider.getNetwork(),
            provider.getFeeData(),
        ]);
        res.json({
            success: true,
            chain_id: Number(network.chainId),
            status: "Operational",
            block_height: blockNumber,
            gas_price_gwei: feeData.gasPrice ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei')) : null,
        });
    } catch (err) {
        res.json({
            success: false,
            chain_id: 2708,
            status: "RPC Unreachable",
            error: err.message,
        });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: "ok",
        node: "BeZhas Edge Relay",
        version: "2.0.0",
        uptime_seconds: Math.floor(process.uptime()),
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        validator_address: process.env.VALIDATOR_ADDRESS || null,
        heartbeat: {
            active: !!heartbeatTimer,
            last_at: lastHeartbeatAt,
            interval_ms: HEARTBEAT_INTERVAL_MS,
        },
        validations: {
            total: validationCount,
            last_at: lastValidationAt,
        },
    });
});

/**
 * GET /validator/status — Local validator node info (tier, stake, rewards, uptime).
 */
app.get('/validator/status', async (req, res) => {
    const addr = process.env.VALIDATOR_ADDRESS;
    if (!addr) {
        return res.json({ registered: false, message: 'VALIDATOR_ADDRESS not configured' });
    }
    try {
        const resp = await fetch(`${CONTROL_API}/api/validators/${addr}`, {
            headers: { 'Authorization': `Bearer ${process.env.CONTROL_JWT || ''}` },
        });
        if (!resp.ok) {
            return res.json({ registered: false, address: addr, api_status: resp.status });
        }
        const profile = await resp.json();
        res.json({
            registered: true,
            address: addr,
            ...profile,
            local_uptime_seconds: Math.floor(process.uptime()),
            local_validations: validationCount,
            heartbeat_active: !!heartbeatTimer,
            last_heartbeat: lastHeartbeatAt,
        });
    } catch (err) {
        res.json({ registered: false, address: addr, error: err.message });
    }
});

async function sendHeartbeat() {
    try {
        const resp = await fetch(`${CONTROL_API}/api/validators/heartbeat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.CONTROL_JWT || ''}`,
            },
            body: JSON.stringify({
                operator: process.env.VALIDATOR_ADDRESS || '',
                metrics: {
                    uptime_seconds: Math.floor(process.uptime()),
                    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    validations: validationCount,
                },
            }),
        });
        if (resp.ok) {
            lastHeartbeatAt = new Date().toISOString();
            logger.debug('Heartbeat sent', { status: resp.status });
        } else {
            logger.warn('Heartbeat non-ok response', { status: resp.status });
        }
    } catch (err) {
        logger.warn('Heartbeat failed', { error: err.message });
    }
}

function startHeartbeat() {
    if (!process.env.VALIDATOR_ADDRESS) {
        logger.info('VALIDATOR_ADDRESS not set — heartbeat disabled');
        return;
    }
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    logger.info('Heartbeat activated', { interval_ms: HEARTBEAT_INTERVAL_MS, target: CONTROL_API });
}

if (require.main === module) {
    app.listen(PORT, () => {
        logger.info('BeZhas Edge Node Online', {
            port: PORT,
            rpc: process.env.RPC_URL || 'http://localhost:8545',
            validator: process.env.VALIDATOR_ADDRESS || 'not set',
        });
        startHeartbeat();
    });
}

module.exports = { app, startHeartbeat, sendHeartbeat };
