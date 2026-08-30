/**
 * routes/sectors.js — Sector overview (deployed contracts per sector).
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');
const { requireSuperAdmin } = require('../middleware/admin-auth');

const router = Router();

// ── All sectors with contract & transaction counts ──
router.get('/', async (req, res) => {
    const cacheKey = 'sectors:overview';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
        `SELECT
            ca.category AS key,
            COUNT(DISTINCT ca.id)::int AS contracts,
            COUNT(DISTINCT t.id)::int AS transactions,
            TRUE AS active
         FROM contract_addresses ca
         LEFT JOIN transactions t ON t.contract_name = ca.name
         GROUP BY ca.category
         ORDER BY ca.category`
    );

    await cacheSet(cacheKey, rows, 300);
    res.json({ sectors: rows });
});

// ═══════════════════════════════════════════════════════════════════════════
//  RWA FACTORY (panel SuperAdmin → pestaña Ecosystem & RWA)
//
//  OJO al orden: estas rutas van ANTES de `/:sector`. Colgadas después, el
//  comodín se traga 'rwa-factory-stats' como si fuera el nombre de un sector y
//  devuelve el sector vacío en vez del panel.
// ═══════════════════════════════════════════════════════════════════════════

// Clave sin TTL: es configuración, no caché. cacheSet sin ttl hace SET a secas.
const RWA_CONFIG_KEY = 'admin:config:rwa-factory';
const RWA_CONFIG_DEFAULTS = { minting_fee_bez: 100, is_paused: false };

async function readRwaConfig() {
    const stored = await cacheGet(RWA_CONFIG_KEY);
    return { ...RWA_CONFIG_DEFAULTS, ...(stored || {}) };
}

// ── GET /rwa-factory-stats ──
router.get('/rwa-factory-stats', requireSuperAdmin, async (_req, res) => {
    try {
        const config = await readRwaConfig();

        // `nfts` es el registro de activos tokenizados de la plataforma: sus
        // tipos son logistics / vehicle / land_title, todos activos del mundo
        // real. El recuento es real; si sale 0, es que no hay ninguno acuñado.
        const counts = await query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(DISTINCT nft_type)::int AS types,
                    COUNT(*) FILTER (WHERE minted_at > NOW() - INTERVAL '30 days')::int AS last_30d
               FROM nfts`
        ).catch(() => null);

        res.json({
            stats: {
                total_rwa_assets: counts?.rows?.[0]?.total ?? null,
                asset_types: counts?.rows?.[0]?.types ?? null,
                minted_last_30d: counts?.rows?.[0]?.last_30d ?? null,
                // null a propósito, no un número inventado: no hay pool de
                // liquidez RWA desplegado ni oráculo que lo valore, así que
                // cualquier cifra aquí sería ficción. El panel pinta "—".
                locked_liquidity_usd: null,
                minting_fee_bez: config.minting_fee_bez,
                is_paused: config.is_paused,
            },
            sources: {
                total_rwa_assets: 'db:nfts',
                locked_liquidity_usd: 'unavailable:no-rwa-pool-deployed',
                minting_fee_bez: 'config',
                // No hay contrato factoría desplegado: la pausa es una bandera
                // de plataforma que corta la acuñación desde la API, no un
                // Pausable on-chain. Decirlo evita creer que para la cadena.
                is_paused: 'config:platform-level',
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron leer las métricas de RWA' });
    }
});

// ── POST /rwa-factory-pause ──
router.post('/rwa-factory-pause', requireSuperAdmin, async (req, res) => {
    const { pause } = req.body || {};
    if (typeof pause !== 'boolean') {
        return res.status(400).json({ error: 'El campo `pause` debe ser booleano' });
    }

    try {
        const config = await readRwaConfig();
        const next = { ...config, is_paused: pause };
        const persisted = await cacheSet(RWA_CONFIG_KEY, next);
        if (!persisted) {
            // Sin Redis el cambio no sobrevive a la respuesta. Devolver 200
            // aquí haría que el panel pintase "pausado" sobre algo que sigue
            // activo en cuanto se recargue.
            return res.status(503).json({ error: 'No se pudo persistir el estado: almacén de configuración no disponible' });
        }

        await query(
            `INSERT INTO ai_logs (module, action, severity, input_data, output_data, processing_ms)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'admin-rwa',
                pause ? 'RWA_FACTORY_PAUSE' : 'RWA_FACTORY_RESUME',
                'warning',
                JSON.stringify({ ip: req.ip, admin: req.admin?.wallet || null }),
                JSON.stringify({ is_paused: pause }),
                0,
            ]
        ).catch(() => { /* auditoría no bloqueante */ });

        res.json({ success: true, is_paused: pause });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo cambiar el estado de la factoría' });
    }
});

// ── Contracts + transactions for a specific sector ──
router.get('/:sector', async (req, res) => {
    const { sector } = req.params;
    const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');

    const { rows: contracts } = await query(
        'SELECT id, name AS contract_name, category AS sector, address, chain_id, deployed_at FROM contract_addresses WHERE category = $1 AND chain_id = $2 ORDER BY name',
        [sector, chainId]
    );

    if (contracts.length === 0) return res.status(404).json({ error: `Sector '${sector}' not found` });

    const contractNames = contracts.map(c => c.contract_name);
    let transactions = [];
    if (contractNames.length > 0) {
        const txRes = await query(
            'SELECT * FROM transactions WHERE contract_name = ANY($1) ORDER BY created_at DESC LIMIT 50',
            [contractNames]
        );
        transactions = txRes.rows;
    }

    res.json({ sector, contracts, transactions });
});

module.exports = router;
