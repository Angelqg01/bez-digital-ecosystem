/**
 * routes/blockchain.js — Blockchain-specific analytics and status endpoints.
 *
 * Security:
 *  - All query-string inputs are validated against whitelists or strict patterns.
 *  - Parameterized queries only (no string interpolation of user data into SQL).
 *  - Error responses never leak internal stack traces or DB details.
 *  - JSONB event_data is sanitized before returning to the client.
 */
const { Router } = require('express');
const { chainCall } = require('../utils/chainCall');
const { query } = require('../db/pool');
const { getContract, getBlockchainStats, getBEZTotalSupply } = require('../services/contractService');
const { cacheGet, cacheSet } = require('../cache/redis');
const { registerSSEClient, getConsumerStats } = require('../services/eventConsumer');

const router = Router();

// ── Whitelists for user-provided filter values ──
const VALID_STATUSES = new Set(['all', 'active']);
const VALID_EVENT_TYPES = new Set(['validator', 'sequencer', 'edge-node', 'generic']);
const VALID_CONTRACTS = new Set([
    'ValidatorRegistry', 'SequencerRotation', 'EdgeNodeRewards',
    'BEZCoinV2', 'StakingPool', 'BeZhasBridgeL2', 'LiquidityFarming',
    'BeZhasLogisticsNFT', 'QualityEscrow',
]);
// Event names: alphanumeric + underscore only, max 80 chars
const EVENT_NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const MAX_QS_LENGTH = 120;

// ── Safe type coercion helpers ──

function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function asString(value) {
    if (value === null || value === undefined) return '';
    return String(value);
}

/**
 * Strip HTML/script tags from any string value inside event_data
 * to prevent stored-XSS when rendered by the frontend.
 */
function sanitizeEventData(data) {
    if (data === null || data === undefined) return {};
    if (typeof data === 'string') return data.replace(/<[^>]*>/g, '');
    if (typeof data === 'number' || typeof data === 'boolean') return data;
    if (Array.isArray(data)) return data.map(sanitizeEventData);
    if (typeof data === 'object') {
        const clean = {};
        for (const [k, v] of Object.entries(data)) {
            const safeKey = String(k).replace(/<[^>]*>/g, '');
            clean[safeKey] = sanitizeEventData(v);
        }
        return clean;
    }
    return data;
}

/**
 * Validate a query-string parameter against a whitelist or regex.
 * Returns the sanitized value or null if invalid.
 */
function validateQS(raw, { whitelist, pattern, maxLen = MAX_QS_LENGTH } = {}) {
    if (raw === undefined || raw === null) return null;
    const str = String(raw).slice(0, maxLen).trim();
    if (!str) return null;
    if (whitelist && !whitelist.has(str)) return null;
    if (pattern && !pattern.test(str)) return null;
    return str;
}

/**
 * Generic async route wrapper — catches unhandled errors and returns
 * a safe 500 response without leaking internal details.
 */
function asyncRoute(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            console.error(`[blockchain] ${req.method} ${req.path} error:`, err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    };
}

// ═══════════════════════════════════════════
//  GET /overview
// ═══════════════════════════════════════════

router.get('/overview', asyncRoute(async (req, res) => {
    const cacheKey = 'blockchain:overview';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [chainStats, rawSupply, statsRes] = await Promise.all([
        getBlockchainStats().catch(() => ({ blockNumber: 0, chainId: 31337, gasPrice: '0' })),
        getBEZTotalSupply().catch(() => '0'),
        query('SELECT COUNT(*)::int AS cnt FROM contract_addresses').catch(() => ({ rows: [{ cnt: 0 }] })),
    ]);

    const [staking, registry, sequencer] = await Promise.all([
        getContract('StakingPool').catch(() => null),
        getContract('ValidatorRegistry').catch(() => null),
        getContract('SequencerRotation').catch(() => null),
    ]);

    // Llamada tolerante: si el método no existe en el ABI, invocarlo lanza un
    // TypeError SÍNCRONO que un `.catch()` encadenado no llega a atrapar — la
    // excepción escapa de la ruta y devuelve un 500. Aquí se envuelve la
    // invocación entera para que el fallback funcione de verdad.
    const callOr = async (contract, method, fallback, ...args) => {
        if (!contract || typeof contract[method] !== 'function') return fallback;
        try { return await contract[method](...args); } catch { return fallback; }
    };

    const [totalStakedRaw, activeCandidates, epochInfo] = await Promise.all([
        // StakingPool lleva el total apostado en `totalSupply()`; no expone
        // ningún `totalStaked()`, y llamarlo tumbaba este endpoint siempre.
        callOr(staking, 'totalSupply', 0n),
        callOr(registry, 'getActiveSequencerCandidates', []),
        callOr(sequencer, 'getEpochInfo', null),
    ]);

    const totalSupply = asNumber(rawSupply, 0);
    const totalStaked = asNumber(totalStakedRaw ? totalStakedRaw.toString() : '0', 0) / 1e18;
    const circulatingSupply = Math.max(0, totalSupply - totalStaked);

    const payload = {
        block_height: chainStats.blockNumber || 0,
        chain_id: chainStats.chainId || 31337,
        gas_price_gwei: chainStats.gasPrice || '0',
        total_supply_bez: totalSupply,
        total_staked_bez: totalStaked,
        circulating_supply_bez: circulatingSupply,
        active_validators: activeCandidates.length,
        current_epoch: epochInfo ? asNumber(epochInfo[0], 0) : 0,
        current_sequencer: epochInfo ? asString(epochInfo[1]) : '',
        epoch_start_block: epochInfo ? asNumber(epochInfo[2], 0) : 0,
        epoch_blocks_remaining: epochInfo ? asNumber(epochInfo[3], 0) : 0,
        total_contracts_deployed: statsRes.rows[0]?.cnt || 0,
        computed_at: new Date().toISOString(),
    };

    await cacheSet(cacheKey, payload, 10);
    res.json(payload);
}));

// ═══════════════════════════════════════════
//  GET /validators?status=active|all
// ═══════════════════════════════════════════

router.get('/validators', asyncRoute(async (req, res) => {
    const status = validateQS(req.query.status, { whitelist: VALID_STATUSES }) || 'all';
    const registry = await getContract('ValidatorRegistry').catch(() => null);
    if (!registry) return res.json({ validators: [], total: 0 });

    const candidates = await chainCall('ValidatorRegistry.getActiveSequencerCandidates',
      () => registry.getActiveSequencerCandidates(), []);

    const { rows } = await query(
        `SELECT DISTINCT actor_address
         FROM blockchain_events
         WHERE contract_name = 'ValidatorRegistry'
           AND event_name = 'ValidatorRegistered'
           AND actor_address IS NOT NULL
         ORDER BY actor_address`
    ).catch(() => ({ rows: [] }));

    const operatorSet = new Set([
        ...candidates.map((v) => asString(v).toLowerCase()),
        ...rows.map((r) => asString(r.actor_address).toLowerCase()),
    ]);
    const operators = Array.from(operatorSet).filter(Boolean);

    const validators = [];
    for (const operator of operators) {
        const info = await chainCall('ValidatorRegistry.getValidatorInfo',
      () => registry.getValidatorInfo(operator), null);
        if (!info) continue;

        const record = {
            operator,
            company_name: asString(info[0]),
            total_stake_bez: asNumber(info[1], 0) / 1e18,
            contribution_points: asNumber(info[2], 0),
            tier: asNumber(info[3], 0),
            is_active: Boolean(info[4]),
            is_sequencer_eligible: Boolean(info[5]),
            uptime_bps: asNumber(info[6], 0),
            uptime_pct: asNumber(info[6], 0) / 100,
        };

        if (status === 'active' && !record.is_active) continue;
        validators.push(record);
    }

    validators.sort((a, b) => b.total_stake_bez - a.total_stake_bez);

    res.json({
        validators,
        total: validators.length,
        total_staked_all_bez: validators.reduce((acc, v) => acc + v.total_stake_bez, 0),
    });
}));

// ═══════════════════════════════════════════
//  GET /sequencer/current
// ═══════════════════════════════════════════

router.get('/sequencer/current', asyncRoute(async (req, res) => {
    const sequencer = await getContract('SequencerRotation').catch(() => null);
    if (!sequencer) return res.json({ epoch: 0, sequencer: '', queue_length: 0 });

    const [info, queueLength] = await Promise.all([
        chainCall('SequencerRotation.getEpochInfo', () => sequencer.getEpochInfo(), null),
        chainCall('SequencerRotation.getSequencerQueueLength',
      () => sequencer.getSequencerQueueLength(), 0n),
    ]);

    if (!info) {
        return res.json({ epoch: 0, sequencer: '', queue_length: asNumber(queueLength, 0) });
    }

    const stats = await chainCall('SequencerRotation.getSequencerStats',
      () => sequencer.getSequencerStats(info[1]), null);

    res.json({
        epoch: asNumber(info[0], 0),
        sequencer: asString(info[1]),
        start_block: asNumber(info[2], 0),
        blocks_remaining: asNumber(info[3], 0),
        queue_position: asNumber(info[4], 0),
        queue_length: asNumber(queueLength, 0),
        epochs_served: stats ? asNumber(stats[0], 0) : 0,
        blocks_produced_total: stats ? asNumber(stats[1], 0) : 0,
        fees_accumulated_wei: stats ? asString(stats[2]) : '0',
        is_current_sequencer: stats ? Boolean(stats[3]) : false,
    });
}));

// ═══════════════════════════════════════════
//  GET /events?type=&contract=&event=&limit=&offset=
// ═══════════════════════════════════════════

router.get('/events', asyncRoute(async (req, res) => {
    const type = validateQS(req.query.type, { whitelist: VALID_EVENT_TYPES });
    const contract = validateQS(req.query.contract, { whitelist: VALID_CONTRACTS });
    const eventName = validateQS(req.query.event, { pattern: EVENT_NAME_RE });
    const limit = Math.min(Math.max(asNumber(req.query.limit, 20), 1), 100);
    const offset = Math.max(asNumber(req.query.offset, 0), 0);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (type) {
        conditions.push(`event_type = $${idx++}`);
        params.push(type);
    }
    if (contract) {
        conditions.push(`contract_name = $${idx++}`);
        params.push(contract);
    }
    if (eventName) {
        conditions.push(`event_name = $${idx++}`);
        params.push(eventName);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalRes = await query(
        `SELECT COUNT(*)::int AS cnt FROM blockchain_events ${where}`, params
    ).catch(() => ({ rows: [{ cnt: 0 }] }));

    const rowsRes = await query(
        `SELECT id, contract_name, event_name, event_type, tx_hash, block_number, log_index,
                actor_address, event_data, created_at
         FROM blockchain_events ${where}
         ORDER BY created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
    ).catch(() => ({ rows: [] }));

    // Sanitize event_data JSONB to strip any embedded HTML/script tags
    const events = rowsRes.rows.map((row) => ({
        ...row,
        event_data: sanitizeEventData(row.event_data),
    }));

    res.json({ events, total: totalRes.rows[0]?.cnt || 0, limit, offset });
}));

// ═══════════════════════════════════════════
//  GET /stream — SSE real-time blockchain events
// ═══════════════════════════════════════════

router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Optional filter: ?type=validator or ?channel=event:bez:*
    const filter = {};
    const typeParam = validateQS(req.query.type, { whitelist: VALID_EVENT_TYPES });
    if (typeParam) filter.eventType = typeParam;
    if (req.query.channel && typeof req.query.channel === 'string') {
        filter.channel = req.query.channel.slice(0, 60);
    }

    const cleanup = registerSSEClient(res, { filter: Object.keys(filter).length ? filter : null });

    // Heartbeat every 25s to keep connection alive
    const heartbeat = setInterval(() => {
        try { res.write(':heartbeat\n\n'); } catch { clearInterval(heartbeat); }
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        cleanup();
    });
});

// ═══════════════════════════════════════════
//  GET /consumer-stats — Event consumer health (internal)
// ═══════════════════════════════════════════

router.get('/consumer-stats', asyncRoute(async (_req, res) => {
    res.json(getConsumerStats());
}));

module.exports = router;
