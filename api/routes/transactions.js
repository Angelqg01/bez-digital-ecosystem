/**
 * routes/transactions.js — Transaction history routes.
 */
const { Router } = require('express');
const { getRecentTxs, getTxByHash } = require('../services/txService');

const router = Router();

// ── List transactions with pagination ──
router.get('/', async (req, res) => {
    const { page = 1, limit = 20, address, contract } = req.query;
    const result = await getRecentTxs({
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        address,
        contract,
    });
    res.json(result);
});

// ── Single transaction by hash ──
router.get('/:txHash', async (req, res) => {
    const { txHash } = req.params;
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return res.status(400).json({ error: 'Invalid transaction hash' });
    }

    const tx = await getTxByHash(txHash);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json(tx);
});

module.exports = router;
