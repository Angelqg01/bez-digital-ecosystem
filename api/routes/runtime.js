/**
 * routes/runtime.js — API route for BeZhas Agent Runtime.
 * Mounts at /api/runtime
 *
 * Endpoints:
 *   GET  /api/runtime/health         → Runtime health status
 *   GET  /api/runtime/tools          → List all registered tools
 *   GET  /api/runtime/commands       → List all slash commands
 *   GET  /api/runtime/plugins        → List loaded plugins
 *   GET  /api/runtime/parity         → Run parity audit
 *   GET  /api/runtime/circuits       → Circuit breaker statuses
 *   GET  /api/runtime/stream         → SSE real-time event stream
 *   POST /api/runtime/invoke         → Invoke a tool with permission check
 *   POST /api/runtime/command        → Execute a slash command
 *   GET  /api/runtime/session/:id    → Get session state
 *   DELETE /api/runtime/session/:id  → Destroy a session
 */
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');

// Lazy-init runtime (singleton)
let _runtime = null;
function getRuntime() {
    if (!_runtime) {
        const { createRuntime } = require('../../agent-runtime');
        _runtime = createRuntime();
    }
    return _runtime;
}

const router = Router();

// ── GET /api/runtime/health ──
router.get('/health', (req, res) => {
    const { registry, router: cmdRouter, sessions, plugins, breaker } = getRuntime();
    res.json({
        status: 'ok',
        version: '0.4.0',
        tools_registered: registry.size,
        commands_registered: cmdRouter.size,
        plugins_loaded: plugins.size,
        sessions_active: sessions.size,
        circuits: breaker ? breaker.getAll() : {},
    });
});

// ── GET /api/runtime/tools ──
router.get('/tools', authenticateToken, (req, res) => {
    const { registry } = getRuntime();
    const sector = req.query.sector || null;
    const tools = registry.list(sector ? { sector } : {});
    res.json({ status: 'success', data: { tools, total: tools.length } });
});

// ── GET /api/runtime/commands ──
router.get('/commands', authenticateToken, (req, res) => {
    const { router: cmdRouter } = getRuntime();
    const commands = cmdRouter.list();
    res.json({ status: 'success', data: { commands, total: commands.length } });
});

// ── POST /api/runtime/invoke ──
router.post('/invoke',
    authenticateToken,
    body('tool').isString().notEmpty().withMessage('tool name is required'),
    body('params').optional().isObject(),
    body('sessionId').optional().isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { tool, params = {}, sessionId } = req.body;
        const { registry, permissions, sessions, eventBus } = getRuntime();
        const { invokeWithPermissions } = require('../../agent-runtime');

        const user = {
            role: req.user?.role || 'viewer',
            address: req.user?.address || 'anonymous',
            sectors: req.user?.sectors || [],
        };

        // Rate-limit check per tool
        const rateCheck = permissions.checkRateLimit(tool, user.address);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: rateCheck.retryAfter,
            });
        }

        try {
            // Emit SSE event: tool invocation started
            eventBus.publish('tool:invoke', { tool, user: user.address });

            const result = await invokeWithPermissions(registry, permissions, tool, params, user);

            // Emit SSE event: result
            eventBus.publish(result.success ? 'tool:result' : 'tool:error', {
                tool,
                success: result.success,
                user: user.address,
            });

            // Track in session if sessionId provided
            if (sessionId) {
                await sessions.appendHistory(sessionId, {
                    type: 'tool',
                    name: tool,
                    input: params,
                    output: result.success ? result.data : result.error,
                });
            }

            if (result.error === 'Permission denied') {
                return res.status(403).json(result);
            }

            if (!result.success) {
                return res.status(result.meta?.error?.includes('not found') ? 404 : 500).json(result);
            }

            res.json({ status: 'success', data: result.data, meta: result.meta });
        } catch (err) {
            console.error('[RUNTIME] invoke error:', err.message);
            res.status(500).json({ error: 'Runtime invocation failed', details: err.message });
        }
    }
);

// ── POST /api/runtime/command ──
router.post('/command',
    authenticateToken,
    body('input').isString().notEmpty().withMessage('command input is required (e.g. "/bridge-health")'),
    body('sessionId').optional().isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Validation failed', details: errors.array() });
        }

        const { input, sessionId } = req.body;
        const { registry, permissions, router: cmdRouter, sessions, eventBus } = getRuntime();

        const user = {
            role: req.user?.role || 'viewer',
            address: req.user?.address || 'anonymous',
            sectors: req.user?.sectors || [],
        };

        try {
            eventBus.publish('command:exec', { input, user: user.address });
            const result = await cmdRouter.dispatch(input, { registry, permissions, user });

            // Track in session
            if (sessionId) {
                await sessions.appendHistory(sessionId, {
                    type: 'command',
                    name: result.command || input,
                    input: { raw: input },
                    output: result.success ? result.data : result.message,
                });
            }

            if (!result.success && result.message?.includes('Permission denied')) {
                return res.status(403).json(result);
            }

            if (!result.success && result.message?.includes('Unknown command')) {
                return res.status(404).json(result);
            }

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.json({ status: 'success', ...result });
        } catch (err) {
            console.error('[RUNTIME] command error:', err.message);
            res.status(500).json({ error: 'Command execution failed', details: err.message });
        }
    }
);

// ── GET /api/runtime/plugins ──
router.get('/plugins', authenticateToken, (req, res) => {
    const { plugins } = getRuntime();
    const list = plugins.list();
    res.json({ status: 'success', data: { plugins: list, total: list.length } });
});

// ── GET /api/runtime/parity ──
router.get('/parity',
    authenticateToken,
    async (req, res) => {
        const { parity, plugins } = getRuntime();
        const user = {
            role: req.user?.role || 'viewer',
        };

        // Require deployer or admin
        if (!['admin', 'deployer'].includes(user.role)) {
            return res.status(403).json({ error: 'Permission denied', required: 'deployer or admin role' });
        }

        try {
            const pluginContracts = plugins.getAllContracts();
            const report = parity.audit({ plugins: pluginContracts });
            res.json({ status: 'success', data: report });
        } catch (err) {
            console.error('[RUNTIME] parity error:', err.message);
            res.status(500).json({ error: 'Parity audit failed', details: err.message });
        }
    }
);

// ── GET /api/runtime/circuits ──
router.get('/circuits', authenticateToken, (req, res) => {
    const { breaker } = getRuntime();
    res.json({
        status: 'success',
        data: {
            circuits: breaker ? breaker.getAll() : {},
            log: breaker ? breaker.getLog(30) : [],
        },
    });
});

// ── GET /api/runtime/stream (SSE) ──
router.get('/stream', (req, res) => {
    // SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // disable Nginx buffering
    });

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

    // Subscribe to runtime events
    const { eventBus } = getRuntime();
    const handler = (event) => {
        try {
            res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
        } catch { /* client disconnected */ }
    };
    eventBus.on('runtime-event', handler);

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
        try { res.write(`: heartbeat\n\n`); } catch { /* ignore */ }
    }, 30000);

    // Cleanup on close
    req.on('close', () => {
        eventBus.off('runtime-event', handler);
        clearInterval(heartbeat);
    });
});

// ── GET /api/runtime/session/:id ──
router.get('/session/:id',
    authenticateToken,
    param('id').isString().notEmpty(),
    async (req, res) => {
        const { sessions } = getRuntime();
        try {
            const session = await sessions.get(req.params.id);
            res.json({ status: 'success', data: session });
        } catch (err) {
            res.status(500).json({ error: 'Failed to get session', details: err.message });
        }
    }
);

// ── DELETE /api/runtime/session/:id ──
router.delete('/session/:id',
    authenticateToken,
    param('id').isString().notEmpty(),
    async (req, res) => {
        const { sessions } = getRuntime();
        try {
            await sessions.destroy(req.params.id);
            res.json({ status: 'success', message: 'Session destroyed' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to destroy session', details: err.message });
        }
    }
);

module.exports = router;
