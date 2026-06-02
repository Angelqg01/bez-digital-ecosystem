/**
 * routes/gas.js — Gas tank status and enterprise balances.
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { getBlockchainStats } = require('../services/contractService');
const { authenticateToken, requireRole } = require('../middleware/security');
const { cacheGet, cacheSet } = require('../cache/redis');

const router = Router();

// ── Chain gas info (public) ──
router.get('/status', async (req, res) => {
    try {
        const stats = await getBlockchainStats();
        res.json(stats);
    } catch (err) {
        res.json({ error: 'Chain not reachable', gasPrice: '0', blockNumber: 0 });
    }
});

// ── Enterprise gas balances (admin / enterprise) ──
router.get('/balances', authenticateToken, requireRole('admin', 'enterprise'), async (req, res) => {
    const { rows } = await query(
        `SELECT gb.*, e.name AS enterprise_name, e.sector
         FROM gas_balances gb
         JOIN enterprises e ON gb.enterprise_id = e.id
         ORDER BY gb.updated_at DESC`
    );
    res.json({ balances: rows });
});

module.exports = router;
