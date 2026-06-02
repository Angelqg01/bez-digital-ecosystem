/**
 * routes/sectors.js — Sector overview (deployed contracts per sector).
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');

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
