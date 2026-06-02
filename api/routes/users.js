/**
 * routes/users.js — User profile routes (DB-backed).
 */
const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authenticateToken } = require('../middleware/security');
const { getBEZBalance, getStakingInfo } = require('../services/contractService');

const router = Router();

// ── Get profile by address ──
router.get('/profile/:address', [
    param('address').isEthereumAddress(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { address } = req.params;

    const { rows } = await query(
        `SELECT u.*, 
                (SELECT COUNT(*) FROM nfts WHERE owner_address = $1) AS nfts_owned,
                (SELECT COALESCE(SUM(amount_staked), 0) FROM staking_positions WHERE wallet_address = $1 AND is_active = true) AS tokens_staked
         FROM users u WHERE u.wallet_address = $1`,
        [address]
    );

    if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    let balance = '0';
    try {
        balance = await getBEZBalance(address);
    } catch (_) { /* chain not reachable */ }

    res.json({
        ...user,
        bez_balance: balance,
    });
});

// ── Update own profile ──
router.put('/profile', authenticateToken, [
    body('username').optional().isLength({ min: 3, max: 20 }),
    body('email').optional().isEmail(),
    body('avatar_url').optional().isURL(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, avatar_url } = req.body;
    const sets = [];
    const params = [];
    let idx = 1;

    if (username !== undefined) { sets.push(`username = $${idx++}`); params.push(username); }
    if (email !== undefined) { sets.push(`email = $${idx++}`); params.push(email); }
    if (avatar_url !== undefined) { sets.push(`avatar_url = $${idx++}`); params.push(avatar_url); }

    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    sets.push(`updated_at = NOW()`);
    params.push(req.user.address);

    const { rows } = await query(
        `UPDATE users SET ${sets.join(', ')} WHERE wallet_address = $${idx} RETURNING *`,
        params
    );

    res.json({ success: true, user: rows[0] });
});

module.exports = router;
