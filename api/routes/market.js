/**
 * routes/market.js — Market stats (DB-backed).
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { getBEZTotalSupply, getBlockchainStats } = require('../services/contractService');
const { cacheGet, cacheSet } = require('../cache/redis');

const router = Router();

// ── Market stats ──
router.get('/stats', async (req, res) => {
    const cacheKey = 'market:stats';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const [nftStats, txVolume, chainStats] = await Promise.all([
        query(`SELECT
                 COUNT(*) AS total_nfts,
                 COUNT(DISTINCT owner_address) AS owners
               FROM nfts`),
        query(`SELECT
                 COALESCE(SUM(CAST(value_wei AS NUMERIC) / 1e18), 0) AS total_volume,
                 COALESCE(SUM(CAST(value_wei AS NUMERIC) / 1e18) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0) AS volume_24h
               FROM transactions WHERE status = 'confirmed'`),
        getBlockchainStats().catch(() => ({ blockNumber: 0, gasPrice: '0' })),
    ]);

    let totalSupply = '0';
    try { totalSupply = await getBEZTotalSupply(); } catch (_) { }

    const result = {
        totalSupply,
        totalNFTs: parseInt(nftStats.rows[0].total_nfts),
        owners: parseInt(nftStats.rows[0].owners),
        totalVolume: txVolume.rows[0].total_volume,
        volume24h: txVolume.rows[0].volume_24h,
        ...chainStats,
    };

    await cacheSet(cacheKey, result, 30);
    res.json(result);
});

module.exports = router;
