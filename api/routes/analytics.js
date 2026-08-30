/**
 * routes/analytics.js — Platform + user analytics (DB-backed).
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');
const { authenticateToken } = require('../middleware/security');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const { getBlockchainStats } = require('../services/contractService');

const router = Router();

function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundMetric(metric, value) {
    if (metric === 'gas_used') return round2(value);
    return Math.max(0, Math.round(value));
}

function buildDeltaPayload(metric, windowDays, currentTotal, previousTotal) {
    const currentRounded = roundMetric(metric, currentTotal);
    const previousRounded = roundMetric(metric, previousTotal);
    const deltaAbs = currentTotal - previousTotal;
    const deltaAbsRounded = roundMetric(metric, deltaAbs);
    const deltaPct = previousTotal === 0 ? null : round2((deltaAbs / previousTotal) * 100);

    return {
        metric,
        window_days: windowDays,
        current_total: currentRounded,
        previous_total: previousRounded,
        delta_abs: deltaAbsRounded,
        delta_pct: deltaPct,
        trend: deltaAbs > 0 ? 'up' : deltaAbs < 0 ? 'down' : 'flat',
        computed_at: new Date().toISOString(),
    };
}

function buildBaselineForecast(metric, history, horizon) {
    const values = history.map((r) => Number(r.value) || 0);
    const n = values.length;

    if (n === 0) {
        return [];
    }

    // Simple linear trend y = a + bx over day index.
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((acc, v) => acc + v, 0) / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        num += (i - xMean) * (values[i] - yMean);
        den += (i - xMean) * (i - xMean);
    }

    const slope = den === 0 ? 0 : num / den;
    const intercept = yMean - slope * xMean;

    const residuals = values.map((v, i) => v - (intercept + slope * i));
    const variance = residuals.reduce((acc, r) => acc + (r * r), 0) / Math.max(1, n - 1);
    const std = Math.sqrt(variance);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const points = [];
    for (let i = 1; i <= horizon; i++) {
        const x = n - 1 + i;
        const rawPred = intercept + slope * x;
        const rawLower = rawPred - 1.96 * std;
        const rawUpper = rawPred + 1.96 * std;

        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() + i);

        points.push({
            date: date.toISOString().slice(0, 10),
            predicted: roundMetric(metric, Math.max(0, rawPred)),
            lower: roundMetric(metric, Math.max(0, rawLower)),
            upper: roundMetric(metric, Math.max(0, rawUpper)),
        });
    }

    return points;
}

// ── Dashboard stats (public) ──
router.get('/stats', async (req, res) => {
    const cacheKey = 'analytics:dashboard-stats';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let blockHeight = 0;
    try { const s = await getBlockchainStats(); blockHeight = s.blockNumber || 0; } catch (_) { /* chain offline */ }

    const [txRes, gasRes, nftRes, entRes, conRes, recentTxRes] = await Promise.all([
        query('SELECT COUNT(*)::int AS cnt FROM transactions'),
        query("SELECT COALESCE(SUM(CAST(gas_used AS NUMERIC)), 0)::text AS total FROM transactions WHERE status = 'confirmed'"),
        query('SELECT COUNT(*)::int AS cnt FROM nfts'),
        query('SELECT COUNT(*)::int AS cnt FROM enterprises WHERE is_active = true'),
        query('SELECT COUNT(*)::int AS cnt FROM contract_addresses'),
        query(`SELECT COUNT(*)::int AS cnt
               FROM transactions
               WHERE created_at >= NOW() - INTERVAL '5 minutes'
                 AND status = 'confirmed'`),
    ]);

    const tx5m = recentTxRes.rows[0]?.cnt || 0;
    const tps = round2(tx5m / 300);

    const stats = {
        total_transactions: txRes.rows[0].cnt,
        total_gas_used: gasRes.rows[0].total,
        total_nfts: nftRes.rows[0].cnt,
        active_enterprises: entRes.rows[0].cnt,
        active_contracts: conRes.rows[0].cnt,
        block_height: blockHeight,
        tps,
    };

    await cacheSet(cacheKey, stats, 15);
    res.json(stats);
});

// ── Chart data points (public) ──
router.get('/chart', async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 30, 90);
    const cacheKey = `analytics:chart:${days}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
        `SELECT
            d::date AS date,
            COALESCE(t.tx_count, 0)::int AS transactions,
            COALESCE(t.gas_total, 0)::numeric AS gas_used,
            COALESCE(n.nft_count, 0)::int AS nfts_minted
         FROM generate_series(CURRENT_DATE - $1 * INTERVAL '1 day', CURRENT_DATE, '1 day') AS d
         LEFT JOIN (
            SELECT created_at::date AS day, COUNT(*) AS tx_count, COALESCE(SUM(CAST(gas_used AS NUMERIC)), 0) AS gas_total
            FROM transactions GROUP BY day
         ) t ON t.day = d::date
         LEFT JOIN (
            SELECT minted_at::date AS day, COUNT(*) AS nft_count
            FROM nfts GROUP BY day
         ) n ON n.day = d::date
         ORDER BY date`,
        [days]
    );

    const points = rows.map(r => ({
        date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
        transactions: r.transactions,
        gas_used: parseFloat(r.gas_used) || 0,
        nfts_minted: r.nfts_minted,
    }));

    await cacheSet(cacheKey, points, 60);
    res.json(points);
});

// ── Forecast baseline (public) ──
router.get('/forecast', async (req, res) => {
    const allowedMetrics = new Set(['transactions', 'gas_used', 'nfts_minted']);
    const metric = String(req.query.metric || 'transactions');
    if (!allowedMetrics.has(metric)) {
        return res.status(400).json({
            error: 'Invalid metric',
            allowed: Array.from(allowedMetrics),
        });
    }

    const horizonRaw = parseInt(req.query.horizon, 10);
    const horizon = Math.min(Math.max(Number.isFinite(horizonRaw) ? horizonRaw : 7, 1), 30);
    const cacheKey = `analytics:forecast:${metric}:${horizon}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let sql;
    if (metric === 'transactions') {
        sql = `SELECT
                    d::date AS date,
                    COALESCE(t.tx_count, 0)::numeric AS value
               FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day') AS d
               LEFT JOIN (
                    SELECT created_at::date AS day, COUNT(*) AS tx_count
                    FROM transactions
                    GROUP BY day
               ) t ON t.day = d::date
               ORDER BY date`;
    } else if (metric === 'gas_used') {
        sql = `SELECT
                    d::date AS date,
                    COALESCE(t.gas_total, 0)::numeric AS value
               FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day') AS d
               LEFT JOIN (
                    SELECT created_at::date AS day, COALESCE(SUM(CAST(gas_used AS NUMERIC)), 0) AS gas_total
                    FROM transactions
                    GROUP BY day
               ) t ON t.day = d::date
               ORDER BY date`;
    } else {
        sql = `SELECT
                    d::date AS date,
                    COALESCE(n.nft_count, 0)::numeric AS value
               FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, '1 day') AS d
               LEFT JOIN (
                    SELECT minted_at::date AS day, COUNT(*) AS nft_count
                    FROM nfts
                    GROUP BY day
               ) n ON n.day = d::date
               ORDER BY date`;
    }

    const { rows } = await query(sql);
    const forecastPoints = buildBaselineForecast(metric, rows, horizon);

    const payload = {
        metric,
        horizon,
        model: 'baseline_linear_trend_v1',
        generated_at: new Date().toISOString(),
        points: forecastPoints,
    };

    await cacheSet(cacheKey, payload, 60);
    res.json(payload);
});

// ── Delta vs previous period (public) ──
router.get('/deltas', async (req, res) => {
    const allowedMetrics = new Set(['transactions', 'gas_used', 'nfts_minted']);
    const metric = String(req.query.metric || 'transactions');
    if (!allowedMetrics.has(metric)) {
        return res.status(400).json({
            error: 'Invalid metric',
            allowed: Array.from(allowedMetrics),
        });
    }

    const windowRaw = parseInt(req.query.window, 10);
    const windowDays = Math.min(Math.max(Number.isFinite(windowRaw) ? windowRaw : 7, 1), 30);
    const cacheKey = `analytics:deltas:${metric}:${windowDays}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let sql;
    if (metric === 'transactions') {
        sql = `SELECT
                    COALESCE(COUNT(*) FILTER (
                        WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
                          AND created_at < CURRENT_DATE + INTERVAL '1 day'
                    ), 0)::numeric AS current_total,
                    COALESCE(COUNT(*) FILTER (
                        WHERE created_at >= CURRENT_DATE - (($1 * 2) * INTERVAL '1 day')
                          AND created_at < CURRENT_DATE - ($1 * INTERVAL '1 day')
                    ), 0)::numeric AS previous_total
               FROM transactions`;
    } else if (metric === 'gas_used') {
        sql = `SELECT
                    COALESCE(SUM(CAST(gas_used AS NUMERIC)) FILTER (
                        WHERE created_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
                          AND created_at < CURRENT_DATE + INTERVAL '1 day'
                    ), 0)::numeric AS current_total,
                    COALESCE(SUM(CAST(gas_used AS NUMERIC)) FILTER (
                        WHERE created_at >= CURRENT_DATE - (($1 * 2) * INTERVAL '1 day')
                          AND created_at < CURRENT_DATE - ($1 * INTERVAL '1 day')
                    ), 0)::numeric AS previous_total
               FROM transactions`;
    } else {
        sql = `SELECT
                    COALESCE(COUNT(*) FILTER (
                        WHERE minted_at >= CURRENT_DATE - ($1 * INTERVAL '1 day')
                          AND minted_at < CURRENT_DATE + INTERVAL '1 day'
                    ), 0)::numeric AS current_total,
                    COALESCE(COUNT(*) FILTER (
                        WHERE minted_at >= CURRENT_DATE - (($1 * 2) * INTERVAL '1 day')
                          AND minted_at < CURRENT_DATE - ($1 * INTERVAL '1 day')
                    ), 0)::numeric AS previous_total
               FROM nfts`;
    }

    const { rows } = await query(sql, [windowDays]);
    const currentTotal = Number(rows[0]?.current_total || 0);
    const previousTotal = Number(rows[0]?.previous_total || 0);

    const payload = buildDeltaPayload(metric, windowDays, currentTotal, previousTotal);
    await cacheSet(cacheKey, payload, 60);
    res.json(payload);
});

// ── Realtime KPI snapshot (public) ──
router.get('/kpis/realtime', async (req, res) => {
    const cacheKey = 'analytics:kpis:realtime';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [tx1mRes, tx5mRes, tx1hRes, failed24hRes, avgGas24hRes] = await Promise.all([
        query(`SELECT COUNT(*)::int AS cnt
                             FROM transactions
                             WHERE created_at >= NOW() - INTERVAL '1 minute'
                                 AND status = 'confirmed'`),
        query(`SELECT COUNT(*)::int AS cnt
                             FROM transactions
                             WHERE created_at >= NOW() - INTERVAL '5 minutes'
                                 AND status = 'confirmed'`),
        query(`SELECT COUNT(*)::int AS cnt
                             FROM transactions
                             WHERE created_at >= NOW() - INTERVAL '1 hour'
                                 AND status = 'confirmed'`),
        query(`SELECT COUNT(*)::int AS cnt
                             FROM transactions
                             WHERE created_at >= NOW() - INTERVAL '24 hours'
                                 AND status = 'failed'`),
        query(`SELECT COALESCE(AVG(CAST(gas_used AS NUMERIC)), 0)::text AS avg
                             FROM transactions
                             WHERE created_at >= NOW() - INTERVAL '24 hours'
                                 AND status = 'confirmed'`),
    ]);

    const tx1m = tx1mRes.rows[0]?.cnt || 0;
    const tx5m = tx5mRes.rows[0]?.cnt || 0;
    const tx1h = tx1hRes.rows[0]?.cnt || 0;
    const failed24h = failed24hRes.rows[0]?.cnt || 0;

    const result = {
        tx_1m: tx1m,
        tx_5m: tx5m,
        tx_1h: tx1h,
        tps_1m: round2(tx1m / 60),
        tps_5m: round2(tx5m / 300),
        tps_1h: round2(tx1h / 3600),
        failed_24h: failed24h,
        avg_gas_24h: avgGas24hRes.rows[0]?.avg || '0',
        computed_at: new Date().toISOString(),
    };

    await cacheSet(cacheKey, result, 15);
    res.json(result);
});

// ── Platform analytics ──
router.get('/platform', authenticateToken, async (req, res) => {
    const cacheKey = 'analytics:platform';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [users, txs, nfts, telemetry] = await Promise.all([
        query(`SELECT 
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '24 hours') AS active24h,
                 COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') AS active7d,
                 COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS new24h
               FROM users`),
        query(`SELECT 
                 COUNT(*) AS total,
                 COALESCE(SUM(CAST(value_wei AS NUMERIC) / 1e18), 0) AS volume_bez,
                 COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS today
               FROM transactions WHERE status = 'confirmed'`),
        query(`SELECT
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE minted_at > NOW() - INTERVAL '24 hours') AS minted24h
               FROM nfts`),
        query(`SELECT COUNT(*) AS total FROM telemetry_logs WHERE created_at > NOW() - INTERVAL '24 hours'`),
    ]);

    const result = {
        users: users.rows[0],
        transactions: txs.rows[0],
        nfts: nfts.rows[0],
        telemetry: telemetry.rows[0],
    };

    await cacheSet(cacheKey, result, 30); // 30s cache
    res.json(result);
});

// ── User analytics ──
router.get('/user/:address', async (req, res) => {
    const { address } = req.params;

    const [profile, txCount, nftCount, staking, farming] = await Promise.all([
        query('SELECT * FROM users WHERE wallet_address = $1', [address]),
        query('SELECT COUNT(*) AS total FROM transactions WHERE from_address = $1 OR to_address = $1', [address]),
        query('SELECT COUNT(*) AS total FROM nfts WHERE owner_address = $1', [address]),
        query('SELECT COALESCE(SUM(amount_staked), 0) AS total_staked, COALESCE(SUM(rewards_earned), 0) AS total_rewards FROM staking_positions WHERE wallet_address = $1 AND is_active = true', [address]),
        query('SELECT COUNT(*) AS positions, COALESCE(SUM(pending_rewards), 0) AS pending FROM farming_positions WHERE wallet_address = $1 AND is_active = true', [address]),
    ]);

    res.json({
        address,
        user: profile.rows[0] || null,
        totalTransactions: parseInt(txCount.rows[0].total),
        nftsOwned: parseInt(nftCount.rows[0].total),
        staking: staking.rows[0],
        farming: farming.rows[0],
    });
});

// ── GET /ai-logs — Traza de auditoría del panel SuperAdmin ──
//
// La pestaña DAO Governance ya consumía este endpoint; al no existir, caía a
// una lista vacía y el panel de auditoría salía siempre en blanco.
//
// Va detrás de requireSuperAdmin y no de authenticateToken porque el panel se
// autentica con la cookie de admin, que authenticateToken no mira. Y el
// contenido lo justifica: ai_logs guarda los intentos de login con IP y
// user-agent, además de la entrada y salida de cada decisión de los agentes.
router.get('/ai-logs', requireSuperAdmin, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 200);
    const { module: moduleFilter, severity } = req.query;

    // Filtros opcionales construidos con parámetros, nunca interpolados.
    const conditions = [];
    const params = [];
    if (moduleFilter) {
        params.push(moduleFilter);
        conditions.push(`module = $${params.length}`);
    }
    if (severity) {
        params.push(severity);
        conditions.push(`severity = $${params.length}`);
    }
    params.push(limit);

    try {
        const { rows } = await query(
            `SELECT id, module, action, severity, input_data, output_data, confidence,
                    processing_ms, created_at
               FROM ai_logs
              ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
              ORDER BY created_at DESC
              LIMIT $${params.length}`,
            params
        );

        res.json({
            rows: rows.map(row => ({
                ...row,
                // La columna usa el vocabulario de la base
                // (debug/info/warning/critical) y el panel colorea por
                // info/warn/error. Se traduce aquí para no tener que tocar el
                // CHECK de la tabla ni inventar un tercer vocabulario.
                severity: { warning: 'warn', critical: 'error', debug: 'info' }[row.severity] || row.severity,
                // ai_logs no tiene columna de wallet: cuando el actor es
                // conocido viaja dentro de input_data. Se expone plano porque
                // es lo que el panel pinta, y 'system' cuando no hay actor
                // humano —que es el caso de la mayoría de los agentes.
                wallet_address:
                    row.input_data?.wallet
                    || row.input_data?.walletAddress
                    || row.input_data?.address
                    || 'system',
            })),
            count: rows.length,
            limit,
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron leer los registros de auditoría' });
    }
});

module.exports = router;
