/**
 * routes/contracts.js — Deployed contract registry + blockchain info.
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { getAllAddresses, getBlockchainStats, getBEZTotalSupply } = require('../services/contractService');
const { cacheGet, cacheSet } = require('../cache/redis');

const router = Router();

// ── All deployed contracts by chain ──
router.get('/', async (req, res) => {
    const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');

    if (req.query.flat === 'true') {
        const { rows } = await query(
            'SELECT id, name AS contract_name, category AS sector, address, chain_id, deployed_at FROM contract_addresses WHERE chain_id = $1 ORDER BY category, name',
            [chainId]
        );
        return res.json(rows);
    }

    const grouped = await getAllAddresses(chainId);
    res.json({ chainId, contracts: grouped });
});

// ── Single contract info ──
router.get('/:name', async (req, res) => {
    const { name } = req.params;
    const chainId = parseInt(req.query.chainId || process.env.BEZHAS_CHAIN_ID || '31337');

    const { rows } = await query(
        'SELECT * FROM contract_addresses WHERE name = $1 AND chain_id = $2',
        [name, chainId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(rows[0]);
});

module.exports = router;
