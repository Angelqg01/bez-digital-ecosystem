/**
 * routes/notifications.js — Notification routes (DB-backed).
 */
const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db/pool');
const { authenticateToken } = require('../middleware/security');
const { publish } = require('../cache/redis');

const router = Router();

// ── Get all notifications for the authenticated user ──
router.get('/', authenticateToken, async (req, res) => {
    const { rows } = await query(
        `SELECT n.* FROM notifications n
         JOIN users u ON n.user_id = u.id
         WHERE u.wallet_address = $1
         ORDER BY n.created_at DESC
         LIMIT 50`,
        [req.user.address]
    );
    res.json({ notifications: rows });
});

// ── Send notification ──
router.post('/send', authenticateToken, [
    body('to').isEthereumAddress().withMessage('Invalid recipient address'),
    body('type').isIn(['transaction', 'nft_sold', 'staking_reward', 'message', 'security_alert']),
    body('title').isLength({ min: 1, max: 100 }),
    body('message').isLength({ min: 1, max: 500 }),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { to, type, title, message } = req.body;

    // Resolve recipient user_id
    const { rows: userRows } = await query('SELECT id FROM users WHERE wallet_address = $1', [to]);
    if (userRows.length === 0) return res.status(404).json({ error: 'Recipient user not found' });

    const { rows } = await query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, type, title, created_at`,
        [userRows[0].id, type, title, message, JSON.stringify({ from: req.user.address })]
    );

    await publish('notification:new', { userId: userRows[0].id, ...rows[0] });

    res.json({ success: true, notification: rows[0] });
});

// ── Mark all as read ──
router.post('/read-all', authenticateToken, async (req, res) => {
    await query(
        `UPDATE notifications SET is_read = true
         WHERE user_id = (SELECT id FROM users WHERE wallet_address = $1) AND is_read = false`,
        [req.user.address]
    );
    res.json({ success: true });
});

// ── Mark as read ──
router.patch('/:id/read', authenticateToken, async (req, res) => {
    await query(
        `UPDATE notifications SET is_read = true
         WHERE id = $1 AND user_id = (SELECT id FROM users WHERE wallet_address = $2)`,
        [req.params.id, req.user.address]
    );
    res.json({ success: true });
});

module.exports = router;
