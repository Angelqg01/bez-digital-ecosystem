/**
 * routes/nfts.js — NFT routes (DB + on-chain).
 */
const { Router } = require('express');
const { param, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');

const router = Router();

// ── List NFTs with pagination + filters ──
router.get('/', async (req, res) => {
    const { page = 1, limit = 20, owner, type, contract } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (owner) { conditions.push(`owner_address = $${idx++}`); params.push(owner); }
    if (type) { conditions.push(`nft_type = $${idx++}`); params.push(type); }
    if (contract) { conditions.push(`contract_address = $${idx++}`); params.push(contract); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countRes = await query(`SELECT COUNT(*) FROM nfts ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const { rows } = await query(
        `SELECT * FROM nfts ${where} ORDER BY minted_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        params
    );

    res.json({
        nfts: rows,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
});

// ── Single NFT by token ID ──
router.get('/:tokenId', [
    param('tokenId').isInt({ min: 0 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { tokenId } = req.params;
    const { rows } = await query(
        `SELECT n.*, 
                (SELECT json_agg(json_build_object('tx_hash', t.tx_hash, 'method', t.method_name, 'from', t.from_address, 'to', t.to_address, 'block', t.block_number, 'at', t.created_at))
                 FROM transactions t WHERE t.contract_name = 'BeZhasLogisticsNFT' AND t.value_wei = $1::text) AS history
         FROM nfts n WHERE n.token_id = $1`,
        [tokenId]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'NFT not found' });
    res.json(rows[0]);
});

module.exports = router;
