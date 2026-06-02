/**
 * routes/gamification.js — Gamification + leaderboard (DB-backed).
 */
const { Router } = require('express');
const { query } = require('../db/pool');
const { cacheGet, cacheSet } = require('../cache/redis');
const { authenticateToken } = require('../middleware/security');
const crypto = require('crypto');

const router = Router();

const gamificationService = require('../services/gamificationService');

// ── User achievements (Protected) ──
router.get('/achievements', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { address } = req.user;

    try {
        // 1. Get all rules
        const { rows: rules } = await query('SELECT * FROM achievement_rules ORDER BY id ASC');
        
        // 2. Get user unlocked achievements
        const { rows: unlocked } = await query(
            'SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = $1',
            [userId]
        );
        const unlockedKeys = new Set(unlocked.map(u => u.achievement_key));
        const unlockedMap = Object.fromEntries(unlocked.map(u => [u.achievement_key, u.unlocked_at]));

        // 3. Calculate current progress for locked ones
        // In a real app, this would be cached or pre-calculated
        const [txRes, nftRes] = await Promise.all([
            query("SELECT COUNT(*)::int AS cnt FROM transactions WHERE from_address = $1 AND status = 'confirmed'", [address]),
            query('SELECT COUNT(*)::int AS cnt FROM nfts WHERE owner_address = $1', [address]),
        ]);
        const txCount = txRes.rows[0].cnt;
        const nftCount = nftRes.rows[0].cnt;

        const results = rules.map(r => {
            let current = 0;
            if (r.metric_type === 'transactions') current = txCount;
            else if (r.metric_type === 'nfts') current = nftCount;
            // Referral count would be another query...
            
            const isUnlocked = unlockedKeys.has(r.key);
            
            return {
                id: r.key,
                name: r.name,
                description: r.description,
                xp: r.xp,
                threshold: r.threshold,
                current: isUnlocked ? r.threshold : current,
                unlocked: isUnlocked,
                unlocked_at: unlockedMap[r.key]
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
});

// ── Record an Event (Protected) ──
router.post('/event', authenticateToken, async (req, res) => {
    const { eventKey, value, enterpriseId } = req.body;
    
    if (!eventKey) return res.status(400).json({ error: 'eventKey is required' });

    try {
        // If enterpriseId is not provided, find it from userId
        let entId = enterpriseId;
        if (!entId) {
            const { rows } = await query('SELECT id FROM enterprises WHERE user_id = $1', [req.user.userId]);
            if (rows.length === 0) return res.status(404).json({ error: 'Enterprise not found for user' });
            entId = rows[0].id;
        }

        await gamificationService.recordEvent(entId, eventKey, value || 1);
        res.json({ success: true, message: 'Event recorded and processed' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process event' });
    }
});

// ── Referral System (Protected) ──

// Get or generate referral code
router.get('/referral/code', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    
    try {
        let { rows } = await query('SELECT code FROM referral_codes WHERE user_id = $1', [userId]);
        
        if (rows.length === 0) {
            // Generate a unique 8-char code
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            await query('INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)', [userId, code]);
            return res.json({ code });
        }
        
        res.json({ code: rows[0].code });
    } catch (err) {
        res.status(500).json({ error: 'Failed to manage referral code' });
    }
});

// Get referral list and stats
router.get('/referral/stats', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    
    try {
        const { rows: referrals } = await query(
            `SELECT r.status, r.created_at, u.username as referred_name, u.wallet_address
             FROM referrals r
             JOIN users u ON r.referred_id = u.id
             WHERE r.referrer_id = $1
             ORDER BY r.created_at DESC`,
            [userId]
        );
        
        const stats = {
            total: referrals.length,
            completed: referrals.filter(r => r.status === 'completed' || r.status === 'rewarded').length,
            pending: referrals.filter(r => r.status === 'pending').length,
            xp_earned: referrals.filter(r => r.status === 'rewarded').length * 500
        };
        
        res.json({ stats, referrals });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch referral stats' });
    }
});

// ── Enterprise leaderboard (public) ──
router.get('/leaderboard', async (req, res) => {
    const cacheKey = 'gamification:leaderboard:general';
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const { rows } = await query(
        `SELECT e.name AS enterprise_name,
                COUNT(DISTINCT t.id)::int AS tx_count,
                COUNT(DISTINCT n.id)::int AS nft_count,
                (SELECT COUNT(*)::int FROM referrals WHERE referrer_id = e.user_id AND status = 'rewarded') as ref_count
         FROM enterprises e
         LEFT JOIN transactions t ON t.from_address = e.wallet_address AND t.status = 'confirmed'
         LEFT JOIN nfts n ON n.owner_address = e.wallet_address
         WHERE e.is_active = true
         GROUP BY e.id, e.name, e.user_id
         ORDER BY tx_count DESC
         LIMIT 20`
    );

    const badges = ['🏆', '⭐', '🎯', '🚀', '💎'];
    const result = rows.map((r, i) => {
        const xp = r.tx_count + (r.nft_count * 5) + (r.ref_count * 500);
        const level = Math.floor(Math.sqrt(xp / 100)) + 1; // Updated to match frontend level formula
        return {
            rank: i + 1,
            enterprise_name: r.enterprise_name,
            xp,
            level,
            badge: badges[Math.min(level - 1, badges.length - 1)],
        };
    });

    await cacheSet(cacheKey, result, 60);
    res.json(result);
});

// ── User gamification profile ──
router.get('/profile/:address', async (req, res) => {
    const { address } = req.params;

    const { rows: userRows } = await query('SELECT * FROM users WHERE wallet_address = $1', [address]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

    const userId = userRows[0].id;

    const [txCount, nftCount, stakingCount, refCount] = await Promise.all([
        query('SELECT COUNT(*) AS total FROM transactions WHERE from_address = $1', [address]),
        query('SELECT COUNT(*) AS total FROM nfts WHERE owner_address = $1', [address]),
        query('SELECT COALESCE(SUM(amount_staked), 0) AS total FROM staking_positions WHERE wallet_address = $1 AND is_active = true', [address]),
        query('SELECT COUNT(*) AS total FROM referrals WHERE referrer_id = $1 AND status = \'rewarded\'', [userId]),
    ]);

    const totalFrom = (result) => result?.rows?.[0]?.total || 0;
    const txPts = parseInt(totalFrom(txCount), 10) || 0;
    const nftPts = (parseInt(totalFrom(nftCount), 10) || 0) * 5;
    const stakePts = Math.floor((parseFloat(totalFrom(stakingCount)) || 0) * 10);
    const refPts = (parseInt(totalFrom(refCount), 10) || 0) * 500;
    const totalPoints = txPts + nftPts + stakePts + refPts;
    const level = Math.floor(Math.sqrt(totalPoints / 100)) + 1;

    res.json({
        address,
        level,
        totalPoints,
        breakdown: { transactions: txPts, nfts: nftPts, staking: stakePts, referrals: refPts },
    });
});

// ── Leaderboard by type ──
router.get('/leaderboard/:type', async (req, res) => {
    const { type } = req.params;
    const limit = Math.min(parseInt(req.query.limit || '10'), 100);

    const cacheKey = `leaderboard:${type}:${limit}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let rows;
    switch (type) {
        case 'transactions':
            ({ rows } = await query(
                `SELECT from_address AS address, COUNT(*) AS score
                 FROM transactions WHERE status = 'confirmed'
                 GROUP BY from_address ORDER BY score DESC LIMIT $1`, [limit]
            ));
            break;
        case 'nfts':
            ({ rows } = await query(
                `SELECT owner_address AS address, COUNT(*) AS score
                 FROM nfts GROUP BY owner_address ORDER BY score DESC LIMIT $1`, [limit]
            ));
            break;
        case 'staking':
            ({ rows } = await query(
                `SELECT wallet_address AS address, SUM(amount_staked) AS score
                 FROM staking_positions WHERE is_active = true
                 GROUP BY wallet_address ORDER BY score DESC LIMIT $1`, [limit]
            ));
            break;
        case 'referrals':
             ({ rows } = await query(
                `SELECT u.wallet_address AS address, COUNT(r.id) AS score
                 FROM referrals r
                 JOIN users u ON r.referrer_id = u.id
                 WHERE r.status = 'rewarded'
                 GROUP BY u.wallet_address ORDER BY score DESC LIMIT $1`, [limit]
            ));
            break;
        default:
            return res.status(400).json({ error: 'Invalid leaderboard type. Use: transactions, nfts, staking, referrals' });
    }

    const result = {
        type,
        leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })),
    };

    await cacheSet(cacheKey, result, 60);
    res.json(result);
});

// ── Marketplace (Public/Protected) ──

router.get('/marketplace', async (req, res) => {
    try {
        const { rows } = await query('SELECT * FROM marketplace_items WHERE is_active = true ORDER BY cost_xp ASC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch marketplace items' });
    }
});

router.post('/redeem', authenticateToken, async (req, res) => {
    const { itemId } = req.body;
    const userId = req.user.userId;

    try {
        // 1. Get item details
        const { rows: itemRows } = await query('SELECT * FROM marketplace_items WHERE id = $1 AND is_active = true', [itemId]);
        if (itemRows.length === 0) return res.status(404).json({ error: 'Item not found or inactive' });
        const item = itemRows[0];

        // 2. Calculate user spendable XP
        // total points from profile logic
        const { rows: userRows } = await query('SELECT wallet_address FROM users WHERE id = $1', [userId]);
        const address = userRows[0].wallet_address;

        const [txCount, nftCount, refCount, spentRes] = await Promise.all([
            query('SELECT COUNT(*) AS total FROM transactions WHERE from_address = $1', [address]),
            query('SELECT COUNT(*) AS total FROM nfts WHERE owner_address = $1', [address]),
            query('SELECT COUNT(*) AS total FROM referrals WHERE referrer_id = $1 AND status = \'rewarded\'', [userId]),
            query('SELECT COALESCE(SUM(mi.cost_xp), 0) AS total FROM user_redemptions ur JOIN marketplace_items mi ON ur.item_id = mi.id WHERE ur.user_id = $1', [userId]),
        ]);

        const totalPoints = parseInt(txCount.rows[0].total) + 
                            (parseInt(nftCount.rows[0].total) * 5) + 
                            (parseInt(refCount.rows[0].total) * 500);
        const spentPoints = parseInt(spentRes.rows[0].total);
        const spendable = totalPoints - spentPoints;

        if (spendable < item.cost_xp) {
            return res.status(400).json({ error: `Saldo insuficiente. Necesitas ${item.cost_xp} XP, tienes ${spendable} XP.` });
        }

        // 3. Process redemption
        await query(
            'INSERT INTO user_redemptions (user_id, item_id, status) VALUES ($1, $2, $3)',
            [userId, itemId, 'processed']
        );

        // Record Social Activity
        const { rows: entRows } = await query('SELECT id, name FROM enterprises WHERE user_id = $1', [userId]);
        if (entRows.length > 0) {
            await gamificationService.recordActivity(
                entRows[0].id,
                'redemption',
                '¡Nueva Recompensa!',
                `${entRows[0].name} ha canjeado "${item.name}"`,
                item.cost_xp,
                { item_id: item.id }
            );
        }

        // 4. Notify user
        await query(
            'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
            [userId, 'reward', 'Canje Exitoso', `Has canjeado "${item.name}" por ${item.cost_xp} XP.`]
        );

        res.json({ success: true, message: 'Item canjeado correctamente', spendable: spendable - item.cost_xp });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process redemption' });
    }
});

// ── Global Activity Feed ──
router.get('/feed', async (req, res) => {
    try {
        const { rows } = await query(
            `SELECT ga.*, e.name as enterprise_name
             FROM gamification_activities ga
             JOIN enterprises e ON ga.enterprise_id = e.id
             ORDER BY ga.created_at DESC
             LIMIT 30`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
});

module.exports = router;
