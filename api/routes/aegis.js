/**
 * routes/aegis.js — Aegis AI control proxy + telemetry.
 */
const { Router } = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireRole } = require('../middleware/security');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const aegisService = require('../services/aegisService');
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');

const { JWT_SECRET, AUTH_BYPASS } = require('../config/secrets');

const router = Router();
const AEGIS_URL = process.env.AEGIS_API_URL || 'http://localhost:8001/api/aegis';

function parseJsonSafe(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

async function logAdminAction(req, action, payload = {}, status = 'ok') {
    try {
        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, output_data)
             VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
            [
                'aegis_admin',
                action,
                status === 'ok' ? 'info' : 'warning',
                JSON.stringify({ actor: req.user?.address || 'unknown', role: req.user?.role || 'unknown', payload }),
                JSON.stringify({ status }),
            ]
        );
    } catch {
        // Non-blocking audit
    }
}

function authenticateSse(req, res, next) {
    // Antes bastaba con que NODE_ENV no fuese 'production' para entrar como
    // admin sin token: un NODE_ENV mal puesto en un despliegue dejaba este SSE
    // abierto de par en par. Ahora se exige la misma opción explícita que el
    // resto de la API (AUTH_BYPASS=true, imposible en producción).
    if (AUTH_BYPASS) {
        req.user = { address: '0xDev0000000000000000000000000000000000001', role: 'admin' };
        return next();
    }

    const authHeader = req.headers['authorization'];
    const headerToken = authHeader && authHeader.split(' ')[1];
    // EventSource no permite cabeceras propias, de ahí el token por query.
    const token = headerToken || req.query.token;

    if (!token) {
        return res.status(401).json({ error: 'Access token required for SSE' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

// ── Set AI mode (admin only) ──
router.put('/mode', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { mode } = req.body;
        const response = await axios.put(`${AEGIS_URL}/control/set_mode`, { mode });
        await logAdminAction(req, 'set_mode', { mode }, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'set_mode', { mode: req.body?.mode, error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to communicate with Aegis AI Engine', details: error.message });
    }
});

// ── AI status ──
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${AEGIS_URL}/status`);
        res.json(response.data);
    } catch (error) {
        // Fallback when Aegis is not running
        res.json({
            status: 'success',
            data: { mode: 'autonomous', active_models: 3, health: 'offline (fallback)' },
        });
    }
});

// ── Process IoT telemetry → validate + mint NFT ──
router.post('/telemetry', authenticateToken, [
    body('containerId').isString().isLength({ min: 1 }),
    body('telemetryData').isObject(),
    body('telemetryData.temperature').isNumeric(),
    body('telemetryData.humidity').isNumeric(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const result = await aegisService.processTelemetryAndTokenize(
            req.user.address,
            req.body.containerId,
            req.body.telemetryData
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Telemetry processing failed', details: error.message });
    }
});

// ── Paginated AI logs for the dashboard ──
router.get('/logs', authenticateToken, requireRole('admin', 'enterprise', 'user', 'edge_node'), async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const severity = req.query.severity;
    const module = req.query.module;
    const qText = req.query.q;
    const from = req.query.from;
    const to = req.query.to;
    const walletFilter = req.query.wallet;

    const where = [];
    const params = [];

    if (severity) {
        params.push(String(severity));
        where.push(`severity = $${params.length}`);
    }

    if (module) {
        params.push(String(module));
        where.push(`module = $${params.length}`);
    }

    if (from) {
        params.push(new Date(String(from)));
        where.push(`created_at >= $${params.length}`);
    }

    if (to) {
        params.push(new Date(String(to)));
        where.push(`created_at <= $${params.length}`);
    }

    if (qText) {
        params.push(`%${String(qText)}%`);
        where.push(`(
            action ILIKE $${params.length}
            OR module ILIKE $${params.length}
            OR input_data::text ILIKE $${params.length}
            OR output_data::text ILIKE $${params.length}
        )`);
    }

    // Tenant guard: non-admin users can only see logs related to their wallet.
    if (req.user?.role !== 'admin') {
        params.push(req.user.address);
        where.push(`(
            input_data->>'walletAddress' = $${params.length}
            OR input_data->>'enterpriseWallet' = $${params.length}
            OR input_data->>'address' = $${params.length}
            OR output_data->>'walletAddress' = $${params.length}
            OR output_data->>'enterpriseWallet' = $${params.length}
        )`);
    } else if (walletFilter) {
        params.push(String(walletFilter));
        where.push(`(
            input_data->>'walletAddress' = $${params.length}
            OR input_data->>'enterpriseWallet' = $${params.length}
            OR output_data->>'walletAddress' = $${params.length}
            OR output_data->>'enterpriseWallet' = $${params.length}
        )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    try {
        const countRes = await query(`SELECT COUNT(*)::int AS cnt FROM ai_logs ${whereSql}`, params);
        const total = countRes.rows[0].cnt;

        const pageParams = [...params, limit, offset];
        const limitParam = pageParams.length - 1;
        const offsetParam = pageParams.length;
        const { rows } = await query(
            `SELECT * FROM ai_logs ${whereSql} ORDER BY created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
            pageParams
        );

        const enrichedRows = rows.map((row) => {
            const input = parseJsonSafe(row.input_data);
            const output = parseJsonSafe(row.output_data);
            const txHash = output.txHash || output.tx_hash || input.txHash || input.tx_hash || null;
            const blockNumber = output.blockNumber || output.block_number || input.blockNumber || input.block_number || null;
            const contractName = output.contract_name || output.contract || input.contract_name || input.contract || null;
            const walletAddress =
                input.walletAddress || input.enterpriseWallet || input.address ||
                output.walletAddress || output.enterpriseWallet || null;
            const gasUsed = output.gas_used || output.gasUsed || input.gas_used || input.gasUsed || null;
            const estimatedCostBez = output.estimated_cost_bez || output.estimatedCostBez || null;
            const confirmationStatus = output.confirmation_status || output.txStatus || output.status || null;

            return {
                ...row,
                tx_hash: txHash,
                block_number: blockNumber,
                contract_name: contractName,
                wallet_address: walletAddress,
                gas_used: gasUsed,
                estimated_cost_bez: estimatedCostBez,
                confirmation_status: confirmationStatus,
            };
        });

        res.json({ rows: enrichedRows, total, page, limit });
    } catch (err) {
        res.json({ rows: [], total: 0 });
    }
});

// ── Critical alerts stream (SSE) ──
router.get('/alerts/stream', authenticateSse, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    let lastSeen = req.query.lastSeen ? new Date(String(req.query.lastSeen)).toISOString() : new Date(0).toISOString();
    const breakerThreshold = Number(process.env.AEGIS_CRITICAL_BREAKER_THRESHOLD || 10);

    const pushHeartbeat = () => {
        res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
    };

    const pushCriticalUpdates = async () => {
        try {
            const criticalCountRes = await query(
                `SELECT COUNT(*)::int AS cnt
                 FROM ai_logs
                 WHERE severity = 'critical' AND created_at >= NOW() - INTERVAL '5 minutes'`
            );

            const circuitOpen = (criticalCountRes.rows[0]?.cnt || 0) >= breakerThreshold;

            const newRowsRes = await query(
                `SELECT *
                 FROM ai_logs
                 WHERE severity = 'critical' AND created_at > $1::timestamptz
                 ORDER BY created_at ASC
                 LIMIT 50`,
                [lastSeen]
            );

            for (const row of newRowsRes.rows) {
                if (row.created_at) {
                    lastSeen = new Date(row.created_at).toISOString();
                }
                res.write(`event: critical\ndata: ${JSON.stringify({ row, circuit_open: circuitOpen })}\n\n`);
            }

            res.write(`event: breaker\ndata: ${JSON.stringify({
                circuit_open: circuitOpen,
                critical_last_5m: criticalCountRes.rows[0]?.cnt || 0,
                threshold: breakerThreshold,
            })}\n\n`);
        } catch {
            // Keep stream alive even on query failures.
        }
    };

    pushHeartbeat();
    pushCriticalUpdates();

    const heartbeatTimer = setInterval(pushHeartbeat, 15000);
    const pollTimer = setInterval(pushCriticalUpdates, 5000);

    req.on('close', () => {
        clearInterval(heartbeatTimer);
        clearInterval(pollTimer);
        res.end();
    });
});

// ── Pause / Resume system (admin only) ──
router.post('/pause', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const response = await axios.post(`${AEGIS_URL}/control/pause`);
        await logAdminAction(req, 'pause', {}, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'pause', { error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to pause Aegis', details: error.message });
    }
});

router.post('/resume', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const response = await axios.post(`${AEGIS_URL}/control/resume`);
        await logAdminAction(req, 'resume', {}, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'resume', { error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to resume Aegis', details: error.message });
    }
});

// ── Trigger manual action (admin only) ──
router.post('/trigger', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { action } = req.body;
        const response = await axios.post(`${AEGIS_URL}/control/trigger_action`, { action });
        await logAdminAction(req, 'trigger_action', { action }, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'trigger_action', { action: req.body?.action, error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to trigger action', details: error.message });
    }
});

// ── Approve / Reject suggestions (admin only) ──
router.post('/suggestions/:id/approve', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const payload = {
            ...(req.body || {}),
            approved_by: req.user?.address || 'unknown',
        };
        const response = await axios.post(
            `${AEGIS_URL}/control/approve_action/${req.params.id}`,
            payload
        );
        await logAdminAction(req, 'approve_suggestion', { id: req.params.id, feedback: payload.feedback }, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'approve_suggestion', { id: req.params.id, error: error.message }, 'error');
        const status = error.response?.status || 500;
        res.status(status).json({
            error: 'Failed to approve suggestion',
            details: error.response?.data?.detail || error.message,
        });
    }
});

router.post('/suggestions/:id/reject', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const payload = {
            ...(req.body || {}),
            rejected_by: req.user?.address || 'unknown',
        };
        const response = await axios.post(
            `${AEGIS_URL}/control/reject_action/${req.params.id}`,
            payload
        );
        await logAdminAction(req, 'reject_suggestion', { id: req.params.id, feedback: payload.feedback }, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'reject_suggestion', { id: req.params.id, error: error.message }, 'error');
        const status = error.response?.status || 500;
        res.status(status).json({
            error: 'Failed to reject suggestion',
            details: error.response?.data?.detail || error.message,
        });
    }
});

// ── List pending suggestions ──
router.get('/suggestions', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const response = await axios.get(`${AEGIS_URL}/suggestions/pending?limit=${limit}`);
        res.json(response.data);
    } catch (error) {
        res.json({ status: 'success', data: { suggestions: [], total: 0 } });
    }
});

// ── Anomaly threshold (admin only) ──
router.put('/threshold', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const { level } = req.body;
        const response = await axios.put(`${AEGIS_URL}/config/anomaly_threshold`, { level });
        await logAdminAction(req, 'set_threshold', { level }, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'set_threshold', { level: req.body?.level, error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to set threshold', details: error.message });
    }
});

// ── False positive marking ──
router.post('/false-positive', authenticateToken, async (req, res) => {
    try {
        const response = await axios.post(`${AEGIS_URL}/model/mark_false_positive`, req.body);
        await logAdminAction(req, 'mark_false_positive', req.body || {}, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'mark_false_positive', { ...(req.body || {}), error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to mark false positive', details: error.message });
    }
});

// ── Telemetry configuration (admin only) ──
router.put('/config/telemetry', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const response = await axios.put(`${AEGIS_URL}/config/telemetry`, req.body);
        await logAdminAction(req, 'set_telemetry_config', req.body || {}, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'set_telemetry_config', { ...(req.body || {}), error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to update telemetry config', details: error.message });
    }
});

router.put('/config/samplerate', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const response = await axios.put(`${AEGIS_URL}/config/telemetry_samplerate`, req.body);
        await logAdminAction(req, 'set_samplerate', req.body || {}, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'set_samplerate', { ...(req.body || {}), error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to update samplerate', details: error.message });
    }
});

// ── Model retrain (admin only) ──
router.post('/retrain', authenticateToken, requireRole('admin'), async (req, res) => {
    try {
        const response = await axios.post(`${AEGIS_URL}/model/retrain`);
        await logAdminAction(req, 'retrain_model', {}, 'ok');
        res.json(response.data);
    } catch (error) {
        await logAdminAction(req, 'retrain_model', { error: error.message }, 'error');
        res.status(500).json({ error: 'Failed to start retrain', details: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIG DEL ORÁCULO AEGIS (panel SuperAdmin → pestaña Ecosystem & RWA)
//
//  Distinto de /config/telemetry y /threshold, que empujan al servicio Aegis
//  por HTTP: esto es la configuración que el panel edita y que debe sobrevivir
//  aunque el servicio esté caído. Se guarda en el mismo espacio de claves que
//  el resto de la config de administración.
// ═══════════════════════════════════════════════════════════════════════════

const AEGIS_CONFIG_KEY = 'admin:config:aegis-oracle';
const AEGIS_CONFIG_DEFAULTS = {
    confidence_threshold: 85,
    vision_model: 'gemini-2.0-flash',
    auto_pause_on_failure: true,
};

// Lista cerrada. Un modelo libre aquí acaba en una llamada a un proveedor que
// no existe y en un Aegis que falla en silencio.
const ALLOWED_VISION_MODELS = new Set([
    'gemini-2.0-flash',
    'gpt-4o',
    'claude-3-5-sonnet',
    'llava-1.5-7b',
]);

router.get('/aegis-config', requireSuperAdmin, async (_req, res) => {
    try {
        const stored = await cacheGet(AEGIS_CONFIG_KEY);
        res.json({ config: { ...AEGIS_CONFIG_DEFAULTS, ...(stored || {}) } });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo leer la configuración de Aegis' });
    }
});

router.put('/aegis-config', requireSuperAdmin, async (req, res) => {
    const incoming = req.body?.config;
    if (!incoming || typeof incoming !== 'object') {
        return res.status(400).json({ error: 'Falta el objeto `config`' });
    }

    const threshold = Number(incoming.confidence_threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
        return res.status(400).json({ error: '`confidence_threshold` debe ser un número entre 0 y 100' });
    }
    if (!ALLOWED_VISION_MODELS.has(incoming.vision_model)) {
        // gemini-1.5-flash está deprecado y prohibido en el proyecto: si llega
        // aquí, es mejor un 400 explícito que una config guardada que romperá
        // la primera inferencia.
        return res.status(400).json({
            error: `Modelo de visión no admitido: ${incoming.vision_model}`,
            allowed: [...ALLOWED_VISION_MODELS],
        });
    }
    if (typeof incoming.auto_pause_on_failure !== 'boolean') {
        return res.status(400).json({ error: '`auto_pause_on_failure` debe ser booleano' });
    }

    const config = {
        confidence_threshold: threshold,
        vision_model: incoming.vision_model,
        auto_pause_on_failure: incoming.auto_pause_on_failure,
    };

    try {
        const persisted = await cacheSet(AEGIS_CONFIG_KEY, config);
        if (!persisted) {
            return res.status(503).json({ error: 'No se pudo persistir: almacén de configuración no disponible' });
        }
        await logAdminAction(req, 'set_aegis_oracle_config', config, 'ok');
        res.json({ success: true, config });
    } catch (error) {
        await logAdminAction(req, 'set_aegis_oracle_config', { ...config, error: error.message }, 'error');
        res.status(500).json({ error: 'No se pudo guardar la configuración de Aegis' });
    }
});

module.exports = router;
