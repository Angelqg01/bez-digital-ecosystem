const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { getBlockchainStats } = require('../services/contractService');
const { authenticateToken } = require('../middleware/security');
const { requireWebhookTier } = require('../middleware/webhook-tier-gate');

/**
 * GET /api/config/platform
 * Returns live platform configuration for the Settings page.
 * No auth required — only exposes public operational metadata.
 */
router.get('/platform', async (req, res) => {
    let db = 'down';
    let dbVersion = null;
    let dbTables = 0;
    try {
        const versionRes = await query('SELECT version()');
        dbVersion = versionRes.rows[0]?.version?.split(' ').slice(0, 2).join(' ') || 'PostgreSQL';
        db = 'up';

        const tablesRes = await query(
            "SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'public'"
        );
        dbTables = tablesRes.rows[0]?.cnt || 0;
    } catch (_) { /* db offline */ }

    let chainId = null;
    let blockHeight = null;
    let gasPrice = null;
    try {
        const stats = await getBlockchainStats();
        chainId = stats.chainId || 2708;
        blockHeight = stats.blockNumber || null;
        gasPrice = stats.gasPrice || null;
    } catch (_) { /* chain offline */ }

    let aegisStatus = 'offline';
    let aegisModels = 0;
    try {
        const axios = require('axios');
        const aegisUrl = process.env.AEGIS_API_URL || 'http://localhost:8001/api/aegis';
        const baseUrl = aegisUrl.replace(/\/api\/aegis$/, '');
        const r = await axios.get(`${baseUrl}/aegis/v1/health`, { timeout: 5000 });
        aegisStatus = r.data?.status || 'unknown';
        aegisModels = r.data?.models_loaded || 0;
    } catch (_) { /* aegis offline */ }

    let mcpTools = 0;
    try {
        const axios = require('axios');
        const mcpUrl = process.env.MCP_URL || 'http://localhost:3002';
        const r = await axios.get(`${mcpUrl}/api/mcp/tools`, { timeout: 5000 });
        mcpTools = r.data?.tools?.length || 0;
    } catch (_) { /* mcp offline */ }

    const rateLimit = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

    res.json({
        network: {
            chain_id: chainId || 2708,
            name: 'BeZhas L2',
            rpc_url: process.env.BEZHAS_L2_RPC_URL || 'http://localhost:8545',
            token: 'BEZ',
            block_height: blockHeight,
            gas_price: gasPrice,
        },
        api: {
            version: '2.0.0',
            url: `http://localhost:${process.env.PORT || 3001}/api`,
            docs_url: '/api-docs',
            rate_limit_per_15min: rateLimit,
            auth_method: 'JWT (Bearer)',
            cors_origins: process.env.NODE_ENV === 'production'
                ? ['https://bez.digital', 'https://app.bez.digital']
                : ['http://localhost:3000', 'http://localhost:5173'],
        },
        services: {
            database: { status: db, version: dbVersion, tables: dbTables },
            aegis: { status: aegisStatus, models: aegisModels },
            mcp: { tools: mcpTools },
        },
        ipfs: {
            configured: !!(process.env.PINATA_JWT || process.env.PINATA_API_KEY),
            gateway: process.env.IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs',
        },
    });
});

// ═══════════════════════════════════════════════════════════════════
//  WEBHOOK CONFIGURATION — requires auth + professional/enterprise tier
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/config/webhooks/tier-check
 * Returns whether the authenticated user's plan allows webhook access.
 */
router.get('/webhooks/tier-check', authenticateToken, async (req, res) => {
    const addr = req.user.address;
    try {
        // Check enterprise tier
        const entRes = await query(
            'SELECT tier FROM enterprises WHERE wallet_address = $1 LIMIT 1',
            [addr]
        );
        if (entRes.rows.length > 0) {
            const tier = entRes.rows[0].tier;
            const allowed = ['professional', 'enterprise'].includes(tier);
            return res.json({ allowed, current_tier: tier, source: 'enterprise' });
        }

        // Fall back to subscription tier
        const subRes = await query(
            `SELECT tier FROM ai_billing_subscriptions
             WHERE user_address = $1 AND status = 'active'
             ORDER BY created_at DESC LIMIT 1`,
            [addr]
        );
        if (subRes.rows.length > 0) {
            const tier = subRes.rows[0].tier;
            const allowed = ['professional', 'enterprise'].includes(tier);
            return res.json({ allowed, current_tier: tier, source: 'subscription' });
        }

        res.json({ allowed: false, current_tier: 'none', source: 'none' });
    } catch (err) {
        res.status(500).json({ error: 'Tier check failed' });
    }
});

/**
 * POST /api/config/webhooks/setup
 * Saves webhook configuration for the authenticated enterprise.
 */
router.post('/webhooks/setup', authenticateToken, requireWebhookTier, async (req, res) => {
    try {
        const { erpType, url, secret, sectors, walletAddress } = req.body;

        if (!url || !sectors || !Array.isArray(sectors) || sectors.length === 0) {
            return res.status(400).json({ error: 'url and sectors[] are required' });
        }

        // Validate URL format
        try { new URL(url); } catch {
            return res.status(400).json({ error: 'Invalid webhook URL' });
        }

        const addr = walletAddress || req.user.address;
        const safeErp = String(erpType || 'generic').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
        const safeSectors = sectors.map(s => String(s).slice(0, 50)).slice(0, 20);

        // Upsert webhook config in enterprises table
        await query(
            `UPDATE enterprises
             SET webhook_url = $1,
                 metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
                 updated_at = NOW()
             WHERE wallet_address = $3`,
            [
                url,
                JSON.stringify({
                    webhook_secret: secret ? '***configured***' : null,
                    erp_type: safeErp,
                    webhook_sectors: safeSectors,
                }),
                addr,
            ]
        );

        res.json({
            success: true,
            message: 'Webhook configured',
            config: { erpType: safeErp, url, sectors: safeSectors },
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save webhook config', detail: err.message });
    }
});

/**
 * POST /api/config/webhooks/test
 * Sends a test ping to the provided webhook URL.
 */
router.post('/webhooks/test', authenticateToken, requireWebhookTier, async (req, res) => {
    const { url, secret } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'url is required' });
    }

    try { new URL(url); } catch {
        return res.status(400).json({ error: 'Invalid webhook URL' });
    }

    try {
        const testPayload = {
            event: 'webhook.test',
            timestamp: new Date().toISOString(),
            source: 'bezhas-platform',
            data: { message: 'Test ping from BeZhas L2' },
        };

        const headers = { 'Content-Type': 'application/json' };
        if (secret) {
            const crypto = require('crypto');
            const sig = crypto.createHmac('sha256', secret)
                .update(JSON.stringify(testPayload))
                .digest('hex');
            headers['X-BeZhas-Signature'] = `sha256=${sig}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(testPayload),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        res.json({
            success: resp.ok,
            status: resp.status,
            message: resp.ok ? 'Webhook responded successfully' : `Webhook returned ${resp.status}`,
        });
    } catch (err) {
        res.json({
            success: false,
            message: err.name === 'AbortError' ? 'Webhook timed out (10s)' : err.message,
        });
    }
});

module.exports = router;
