/**
 * routes/unified-agent.js — API for the BeZhas Unified AI Agent.
 *
 * Mounts at /api/agent
 *
 * Endpoints:
 *   GET    /api/agent/config           → Get agent config (sanitized)
 *   PUT    /api/agent/config           → Update agent config (admin only)
 *   POST   /api/agent/chat             → Send a message to the agent
 *   GET    /api/agent/status           → Agent + channels status
 *   POST   /api/agent/channels/restart → Restart channel adapters
 *   GET    /api/agent/channels/status  → Channel adapter statuses
 *   *      /api/agent/webhook/whatsapp → WhatsApp Cloud API webhook
 */
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/security');
const { INTERNAL_API_KEY } = require('../config/secrets');
const { query } = require('../db/pool');
const { redisClient } = require('../cache/redis');
const MemoryManager = require('../../agent-runtime/MemoryManager');

const router = Router();

function requireInternalKey(req, res, next) {
    const provided = req.headers['x-internal-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!provided || provided !== INTERNAL_API_KEY) {
        return res.status(401).json({ error: 'Internal API key required' });
    }
    next();
}

// ── Lazy singleton ──
let _agent = null;
let _channelManager = null;
let _channelsStarted = false;

function startChannels() {
    if (_channelsStarted || !_agent || !_channelManager) return;
    _channelsStarted = true;

    _loadPersistedConfig().then(config => {
        if (config) _agent.updateConfig(config);
        _channelManager.init(_agent, _agent.getFullConfig().channels).catch(err => {
            console.warn('[UnifiedAgent] Channel init error:', err.message);
        });
    }).catch(() => { });
}

function getAgent(options = {}) {
    if (!_agent) {
        const { createRuntime } = require('../../agent-runtime');
        const UnifiedAgent = require('../../agent-runtime/core/UnifiedAgent');
        const ChannelManager = require('../../agent-runtime/channels');

        // Pass Redis client to Runtime so SessionManager gets persistence
        const runtime = createRuntime({
            redis: redisClient || null,
            startManager: false,
            startTokenomics: false,
            startOllama: false,
            startAgents: false
        });

        // Create MemoryManager with Redis (if available)
        const memory = new MemoryManager({
            redis: redisClient || null,
            maxMessages: 30,
            ttl: 86400, // 24h
        });

        _agent = new UnifiedAgent(runtime, null, memory);
        _channelManager = new ChannelManager();
    }

    if (options.initChannels !== false) startChannels();
    return { agent: _agent, channels: _channelManager };
}

async function _loadPersistedConfig() {
    try {
        const { rows } = await query(
            `SELECT config FROM agent_config WHERE id = 'unified_agent' LIMIT 1`
        );
        return rows.length > 0 ? rows[0].config : null;
    } catch {
        // Table may not exist yet
        return null;
    }
}

async function _persistConfig(config) {
    try {
        await query(
            `INSERT INTO agent_config (id, config, updated_at)
             VALUES ('unified_agent', $1::jsonb, NOW())
             ON CONFLICT (id) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
            [JSON.stringify(config)]
        );
    } catch (err) {
        console.warn('[UnifiedAgent] Config persist error:', err.message);
    }
}

// ── GET /api/agent/internal/status ──
router.get('/internal/status', requireInternalKey, (_req, res) => {
    const { agent, channels } = getAgent({ initChannels: false });
    const config = agent.getConfig();

    res.json({
        status: 'success',
        source: 'unified-agent-internal',
        data: {
            name: config.name,
            enabled: config.enabled,
            language: config.language,
            channels: channels.getStatus(),
            channelsStarted: _channelsStarted,
            rateLimitPerMin: config.rateLimitPerMin,
            auditLog: config.auditLog,
        },
    });
});

// ── POST /api/agent/internal/channels/restart ──
router.post('/internal/channels/restart', requireInternalKey, async (_req, res) => {
    try {
        const { agent, channels } = getAgent({ initChannels: false });
        const persistedConfig = await _loadPersistedConfig();
        if (persistedConfig) agent.updateConfig(persistedConfig);

        await channels.restart(agent, agent.getFullConfig().channels);
        _channelsStarted = true;

        res.json({
            status: 'success',
            source: 'unified-agent-internal',
            data: {
                channels: channels.getStatus(),
                channelsStarted: _channelsStarted,
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Channel restart failed', details: err.message });
    }
});

// ── POST /api/agent/internal/chat ──
router.post('/internal/chat', requireInternalKey, async (req, res) => {
    const { message, user = {}, context = {} } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
    }

    try {
        const { agent } = getAgent({ initChannels: false });
        const userContext = {
            userId: user.userId || `hub:${user.address || 'anonymous'}`,
            role: user.role || 'admin',
            channel: user.channel || 'hub-chat',
            address: user.address || 'anonymous',
            sectors: user.sectors || context.sectors || [],
        };

        const response = await agent.processMessage(message, userContext);

        try {
            await query(
                `INSERT INTO ai_logs (module, action, severity, input_data, output_data, wallet_address)
                 VALUES ('unified_agent', 'internal_chat', 'info', $1::jsonb, $2::jsonb, $3)`,
                [
                    JSON.stringify({ message: message.slice(0, 500), channel: userContext.channel }),
                    JSON.stringify({ response: response.text?.slice(0, 1000), source: 'hub' }),
                    userContext.address || 'hub',
                ]
            );
        } catch { /* audit failure is non-blocking */ }

        res.json({
            status: 'success',
            source: 'unified-agent',
            data: response,
            reply: response.text,
        });
    } catch (err) {
        console.error('[UnifiedAgent] internal chat error:', err.message);
        res.status(500).json({ error: 'Unified Agent internal chat failed', details: err.message });
    }
});

// ── GET /api/agent/config ──
router.get('/config', authenticateToken, (req, res) => {
    const { agent } = getAgent();
    res.json({ status: 'success', data: agent.getConfig() });
});

// ── PUT /api/agent/config ──
router.put('/config', authenticateToken, [
    body('name').optional().isString().isLength({ max: 100 }),
    body('enabled').optional().isBoolean(),
    body('personality').optional().isString().isLength({ max: 2000 }),
    body('language').optional().isIn(['es', 'en', 'pt', 'fr']),
    body('rateLimitPerMin').optional().isInt({ min: 1, max: 300 }),
    body('auditLog').optional().isBoolean(),
    body('channels').optional().isObject(),
    body('allowedRoles').optional().isArray(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Admin-only for config changes
    if (!['admin', 'deployer'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Admin role required' });
    }

    const { agent, channels } = getAgent();

    // ── Normalize UI token fields → internal botToken ──────────────────────
    // The admin dashboard uses `token` for Telegram/Discord (UI field name),
    // but ChannelManager expects `botToken`. Normalize here before persisting.
    const body = { ...req.body };
    if (body.channels) {
        const ch = body.channels;
        if (ch.telegram) {
            if (ch.telegram.token !== undefined && !ch.telegram.botToken) {
                ch.telegram.botToken = ch.telegram.token;
                delete ch.telegram.token;
            }
        }
        if (ch.discord) {
            if (ch.discord.token !== undefined && !ch.discord.botToken) {
                ch.discord.botToken = ch.discord.token;
                delete ch.discord.token;
            }
        }
    }

    agent.updateConfig(body);

    // Persist to DB
    await _persistConfig(agent.getFullConfig());

    // If channels changed, restart them
    if (body.channels) {
        try {
            await channels.restart(agent, agent.getFullConfig().channels);
        } catch (err) {
            console.error('[UnifiedAgent] Channel restart error:', err.message);
        }
    }

    res.json({ status: 'success', data: agent.getConfig() });
});

// ── POST /api/agent/chat ──
router.post('/chat', authenticateToken, [
    body('message').isString().trim().isLength({ min: 1, max: 2000 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { agent } = getAgent();
    const { message } = req.body;

    const response = await agent.processMessage(message, {
        userId: `api:${req.user?.address || 'anonymous'}`,
        role: req.user?.role || 'viewer',
        channel: 'api',
        address: req.user?.address,
        sectors: req.user?.sectors || [],
    });

    // Audit log
    try {
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, output_data, wallet_address)
             VALUES ('unified_agent', 'chat', 'info', $1::jsonb, $2::jsonb, $3)`,
            [
                JSON.stringify({ message: message.slice(0, 500), channel: 'api' }),
                JSON.stringify({ response: response.text?.slice(0, 1000) }),
                req.user?.address || 'system',
            ]
        );
    } catch { /* audit failure is non-blocking */ }

    res.json({ status: 'success', data: response });
});

// ── GET /api/agent/status ──
router.get('/status', authenticateToken, (req, res) => {
    const { agent, channels } = getAgent();
    const config = agent.getConfig();
    const userId = `api:${req.user?.address || 'anonymous'}`;

    res.json({
        status: 'success',
        data: {
            name: config.name,
            enabled: config.enabled,
            language: config.language,
            channels: channels.getStatus(),
            rateLimitPerMin: config.rateLimitPerMin,
            auditLog: config.auditLog,
            pendingConfirmation: agent.getPendingConfirmation(userId) || null,
        },
    });
});

// ── POST /api/agent/channels/restart ──
router.post('/channels/restart', authenticateToken, async (req, res) => {
    if (!['admin', 'deployer'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Admin role required' });
    }

    const { agent, channels } = getAgent();
    try {
        await channels.restart(agent, agent.getFullConfig().channels);
        res.json({ status: 'success', data: channels.getStatus() });
    } catch (err) {
        res.status(500).json({ error: 'Channel restart failed', details: err.message });
    }
});

// ── GET /api/agent/channels/status ──
router.get('/channels/status', authenticateToken, (req, res) => {
    const { channels } = getAgent();
    res.json({ status: 'success', data: channels.getStatus() });
});

// ── GET /api/agent/memory/:userId — Memory stats for a user ──
router.get('/memory/:userId', authenticateToken, async (req, res) => {
    // Admins can view any user; others can only view their own
    const requestedId = req.params.userId;
    const selfId = `api:${req.user?.address || 'anonymous'}`;
    if (!['admin', 'deployer'].includes(req.user?.role) && requestedId !== selfId) {
        return res.status(403).json({ error: 'Can only view your own memory' });
    }

    const { agent } = getAgent();
    const stats = await agent.getMemoryStats(requestedId);
    res.json({ status: 'success', data: stats });
});

// ── DELETE /api/agent/memory/:userId — Clear memory for a user ──
router.delete('/memory/:userId', authenticateToken, async (req, res) => {
    const requestedId = req.params.userId;
    const selfId = `api:${req.user?.address || 'anonymous'}`;
    if (!['admin', 'deployer'].includes(req.user?.role) && requestedId !== selfId) {
        return res.status(403).json({ error: 'Can only clear your own memory' });
    }

    const { agent } = getAgent();
    await agent.clearMemory(requestedId);
    res.json({ status: 'success', message: 'Memory cleared.' });
});

/**
 * GET /api/agent/stream — SSE endpoint for streaming agent responses.
 *
 * Query params:
 *   ?message=<url-encoded-message>   — the user message to send
 *
 * The SSE stream emits:
 *   { event: 'start' }               — connection established
 *   { event: 'chunk', data: '...' }  — text tokens as they arrive
 *   { event: 'done', data: {} }      — stream complete
 *   { event: 'error', data: '...' }  — on failure
 *
 * For natural-language messages: tokens stream directly from the LLM gateway.
 * For slash commands: response is word-chunked for a live feel.
 */
router.get('/stream', authenticateToken, async (req, res) => {
    const message = (req.query.message || '').trim();
    if (!message) {
        return res.status(400).json({ error: 'Query param ?message is required' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering
    res.flushHeaders();

    const send = (event, data) => {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        res.write(`event: ${event}\ndata: ${payload}\n\n`);
    };

    // Flush helper for Nginx / proxies that buffer
    const flush = () => { if (typeof res.flush === 'function') res.flush(); };

    send('start', { message: 'Conectado al agente BeZhas...' });
    flush();

    const context = {
        userId: `api:${req.user?.address || 'anonymous'}`,
        role: req.user?.role || 'viewer',
        channel: 'api-sse',
        address: req.user?.address,
        sectors: req.user?.sectors || [],
    };

    try {
        const { agent } = getAgent();
        const isSlashCommand = message.startsWith('/');

        if (isSlashCommand) {
            // ── Slash commands: synchronous, simulate streaming ───────────
            const response = await agent.processMessage(message, context);
            const text = response.text || '';
            const words = text.split(' ');
            const CHUNK_SIZE = 3;

            for (let i = 0; i < words.length; i += CHUNK_SIZE) {
                const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
                send('chunk', chunk + (i + CHUNK_SIZE < words.length ? ' ' : ''));
                flush();
                await new Promise(r => setTimeout(r, 25));
            }

            send('done', { data: response.data || null });

        } else {
            // ── Natural language: real LLM token streaming ────────────────
            let streamingActive = true;

            // onChunk callback: writes each token directly to the SSE response
            const onChunk = (token) => {
                if (!streamingActive) return;
                send('chunk', token);
                flush();
            };

            // processMessage now passes onChunk down to _handleNaturalLanguage → _callLLM
            const response = await agent.processMessage(message, context, onChunk);

            // If _callLLM already streamed, the text is the accumulation.
            // If it fell back (no LLM), we do word-chunking here.
            if (response._wordChunkFallback && response.text) {
                const words = response.text.split(' ');
                for (let i = 0; i < words.length; i += 3) {
                    const chunk = words.slice(i, i + 3).join(' ');
                    send('chunk', chunk + (i + 3 < words.length ? ' ' : ''));
                    flush();
                    await new Promise(r => setTimeout(r, 30));
                }
            }

            streamingActive = false;
            send('done', { data: response.data || null });
        }

    } catch (err) {
        send('error', err.message);
    } finally {
        res.end();
    }
});


// ── WhatsApp webhook (no auth — Meta verifies via verify_token) ──
router.all('/webhook/whatsapp', (req, res, next) => {
    const { channels } = getAgent();
    if (channels.whatsapp) {
        const waRouter = channels.whatsapp.createRouter();
        waRouter(req, res, next);
    } else {
        res.status(503).json({ error: 'WhatsApp not configured' });
    }
});

// ═══════════════════════════════════════════════════════════
//  EDGE NODE HITL CONFIRMATIONS
//  Used by bezhas-edge-node/auto-signer.js to request and
//  resolve human approval for high-risk on-chain operations.
// ═══════════════════════════════════════════════════════════

const EDGE_CONFIRM_PREFIX = 'bezhas:agent:edge_confirm:';
const EDGE_CONFIRM_TTL_S = 600; // 10 minutes

/**
 * POST /api/agent/edge-confirm
 * Called by the Edge Node auto-signer to register a pending HITL request.
 * Auth: EDGE_NODE_API_KEY (passed as Bearer token).
 */
router.post('/edge-confirm', authenticateToken, async (req, res) => {
    const { operationType, contractAddress, params, estimatedValueBez, nodeId, requestedAt } = req.body || {};

    if (!operationType) {
        return res.status(400).json({ error: 'operationType is required' });
    }

    const requestId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = EDGE_CONFIRM_PREFIX + requestId;

    const payload = {
        requestId,
        operationType,
        contractAddress: contractAddress || null,
        params: params || {},
        estimatedValueBez: estimatedValueBez || 0,
        nodeId: nodeId || 'unknown',
        requestedAt: requestedAt || new Date().toISOString(),
        decision: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + (EDGE_CONFIRM_TTL_S * 1000),
    };

    if (redisClient) {
        try {
            await redisClient.set(key, JSON.stringify(payload), { EX: EDGE_CONFIRM_TTL_S });
        } catch (err) {
            console.error('[UnifiedAgent] Redis error saving confirmation:', err.message);
        }
    }

    // Audit log
    try {
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, wallet_address)
             VALUES ('edge_node_hitl', 'confirmation_requested', 'warn', $1::jsonb, $2)`,
            [JSON.stringify({ requestId, operationType, nodeId, estimatedValueBez }), req.user?.address || 'edge-node']
        );
    } catch { /* non-blocking */ }

    res.json({ status: 'success', requestId, expiresIn: EDGE_CONFIRM_TTL_S });
});

/**
 * GET /api/agent/edge-confirm/:requestId
 * Polled by the Edge Node to check if the operator has responded.
 */
router.get('/edge-confirm/:requestId', authenticateToken, async (req, res) => {
    const key = EDGE_CONFIRM_PREFIX + req.params.requestId;
    
    let confirmation = null;
    if (redisClient) {
        try {
            const raw = await redisClient.get(key);
            if (raw) confirmation = JSON.parse(raw);
        } catch (err) {
            console.error('[UnifiedAgent] Redis error fetching confirmation:', err.message);
        }
    }

    if (!confirmation) {
        return res.status(404).json({ error: 'Confirmation request not found or expired' });
    }

    res.json({ status: 'success', decision: confirmation.decision, requestId: confirmation.requestId });
});

/**
 * GET /api/agent/edge-confirm
 * Returns all pending edge confirmations (admin dashboard use).
 */
router.get('/edge-confirm', authenticateToken, async (req, res) => {
    if (!['admin', 'deployer'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Admin role required' });
    }

    const pending = [];
    if (redisClient) {
        try {
            const keys = await redisClient.keys(EDGE_CONFIRM_PREFIX + '*');
            for (const key of keys) {
                const raw = await redisClient.get(key);
                if (raw) {
                    const conf = JSON.parse(raw);
                    if (conf.decision === 'pending') pending.push(conf);
                }
            }
        } catch (err) {
            console.error('[UnifiedAgent] Redis error listing confirmations:', err.message);
        }
    }

    res.json({ status: 'success', data: pending });
});

/**
 * PATCH /api/agent/edge-confirm/:requestId — Approve or reject (admin only).
 * Body: { decision: 'approved' | 'rejected' }
 */
router.patch('/edge-confirm/:requestId', authenticateToken, async (req, res) => {
    if (!['admin', 'deployer'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Admin role required' });
    }

    const { decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const key = EDGE_CONFIRM_PREFIX + req.params.requestId;
    let confirmation = null;

    if (redisClient) {
        try {
            const raw = await redisClient.get(key);
            if (raw) confirmation = JSON.parse(raw);
        } catch (err) {
            console.error('[UnifiedAgent] Redis error fetching confirmation for patch:', err.message);
        }
    }

    if (!confirmation) {
        return res.status(404).json({ error: 'Request not found or expired' });
    }

    confirmation.decision = decision;
    confirmation.decidedBy = req.user?.address || 'admin';
    confirmation.decidedAt = new Date().toISOString();

    if (redisClient) {
        try {
            // Keep the record for a bit after decision so the poller can see it, then it expires
            await redisClient.set(key, JSON.stringify(confirmation), { EX: 60 }); 
        } catch (err) {
            console.error('[UnifiedAgent] Redis error updating confirmation:', err.message);
        }
    }

    // Audit log
    try {
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, wallet_address)
             VALUES ('edge_node_hitl', $1, $2, $3::jsonb, $4)`,
            [
                `confirmation_${decision}`,
                decision === 'approved' ? 'info' : 'warn',
                JSON.stringify({ requestId: req.params.requestId, operationType: confirmation.operationType }),
                req.user?.address || 'admin',
            ]
        );
    } catch { /* non-blocking */ }

    res.json({ status: 'success', decision, requestId: req.params.requestId });
});

// ── SKILL Memory Endpoints ─────────────────────────────────────────────────────

/**
 * GET /api/agent/skills
 * List recent SKILL interactions from the index.
 * Query params: limit (default 50), provider, intent
 */
router.get('/skills', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const SkillWriter = require('../../agent-runtime/core/SkillWriter');
        const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
        const skills = SkillWriter.listRecent(limit);

        // Apply optional filters
        let filtered = skills;
        if (req.query.provider) filtered = filtered.filter(s => s.provider === req.query.provider);
        if (req.query.intent)   filtered = filtered.filter(s => s.intent === req.query.intent);
        if (req.query.channel)  filtered = filtered.filter(s => s.channel === req.query.channel);

        res.json({ status: 'success', data: filtered, total: filtered.length });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * GET /api/agent/skills/:id
 * Get full SKILL detail (including turn data) from the individual JSON file.
 */
router.get('/skills/:id', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const path = require('path');
        const fs   = require('fs');
        const SkillWriter = require('../../agent-runtime/core/SkillWriter');

        const { id } = req.params;
        // Sanitize id — only allow alphanumeric, underscore, hyphen
        if (!/^[\w-]+$/.test(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid skill ID' });
        }

        const filePath = path.join(SkillWriter.SKILL_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ status: 'error', message: 'SKILL not found' });
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * DELETE /api/agent/skills/:id
 * Remove a specific SKILL interaction (admin only).
 */
router.delete('/skills/:id', authenticateToken, requireRole('admin'), (req, res) => {
    try {
        const path = require('path');
        const fs   = require('fs');
        const SkillWriter = require('../../agent-runtime/core/SkillWriter');

        const { id } = req.params;
        if (!/^[\w-]+$/.test(id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid skill ID' });
        }

        const filePath = path.join(SkillWriter.SKILL_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ status: 'error', message: 'SKILL not found' });
        }
        fs.unlinkSync(filePath);
        res.json({ status: 'success', message: `SKILL ${id} deleted` });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

module.exports = router;
