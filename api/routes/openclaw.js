/**
 * routes/openclaw.js — OpenClaw Integration Endpoints
 *
 * Exposes OpenClaw status, platform discovery, and skill invocation
 * as API routes for the Control Center and external consumers.
 *
 * Routes:
 *   GET  /api/openclaw/status        — OpenClaw init status + skill list
 *   GET  /api/openclaw/platforms      — Discover running platforms
 *   GET  /api/openclaw/skills         — List all registered skills
 *   POST /api/openclaw/skills/:name   — Invoke a skill
 */

const { Router } = require('express');

const router = Router();

// Lazy-load openclaw to avoid hard crash if not linked yet
let openclaw = null;
function getOpenClaw() {
    if (openclaw) return openclaw;
    try {
        openclaw = require('@bezhas/openclaw-unified');
    } catch {
        // Fallback: try relative path (when installed via file: protocol)
        try {
            openclaw = require('../../Sincronizar OpenClaw');
        } catch {
            return null;
        }
    }
    return openclaw;
}

/**
 * GET /status — Overall OpenClaw status
 */
router.get('/status', async (req, res) => {
    const oc = getOpenClaw();
    if (!oc) {
        return res.json({
            initialized: false,
            error: '@bezhas/openclaw-unified not installed. Run: npm link @bezhas/openclaw-unified',
        });
    }

    try {
        const status = oc.getStatus();
        res.json({ success: true, ...status });
    } catch (error) {
        res.json({
            success: false,
            initialized: false,
            error: error.message,
        });
    }
});

/**
 * GET /platforms — Discover all running BeZhas platforms
 */
router.get('/platforms', async (req, res) => {
    const oc = getOpenClaw();
    if (!oc || !oc.discoverSummary) {
        return res.status(503).json({ error: 'OpenClaw not available' });
    }

    try {
        const result = await oc.discoverSummary();
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /skills — List registered skills with status
 */
router.get('/skills', async (req, res) => {
    const oc = getOpenClaw();
    if (!oc) return res.status(503).json({ error: 'OpenClaw not available' });

    try {
        const status = oc.getStatus();
        res.json({ success: true, skills: status.skills });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /skills/:name — Invoke a skill
 * Now routes through the Unified Agent / Runtime pipeline for unified
 * permissions, audit logging, and circuit-breaking.
 * Falls back to direct OpenClaw invocation if Runtime is unavailable.
 */
router.post('/skills/:name', async (req, res) => {
    const { name } = req.params;
    const platform = req.query.platform || 'blockchain';

    // Try unified agent path first
    try {
        const { createRuntime } = require('../../agent-lib');
        const runtime = createRuntime();
        const toolName = `openclaw:${name}`;
        if (runtime.tools?.has(toolName)) {
            const result = await runtime.tools.invoke(toolName, { ...req.body, platform });
            return res.json({ success: true, result, via: 'unified-agent' });
        }
    } catch {
        // Runtime unavailable — fall through to legacy path
    }

    // Legacy fallback: direct OpenClaw
    const oc = getOpenClaw();
    if (!oc) return res.status(503).json({ error: 'OpenClaw not available' });

    try {
        const result = await oc.invokeSkill(name, req.body, platform);
        res.json({ success: true, result, via: 'openclaw-direct' });
    } catch (error) {
        res.status(error.message?.includes('no registrado') ? 404 : 500).json({
            error: error.message,
        });
    }
});

module.exports = router;
