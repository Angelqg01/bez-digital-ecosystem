const express = require('express');
const router = express.Router();
const Share = require('../models/pg/Share');
const { protect } = require('../middleware/auth.middleware');
const { verifyAdminToken } = require('../middleware/admin.middleware');
const isAdminRequest = require('../middleware/isAdminRequest');

/**
 * Compartidos de posts (PostgreSQL: `post_shares`, migración 025).
 *
 * Seguridad (corregida al migrar desde Mongo):
 *  - Las respuestas públicas ya NO incluyen la IP ni el user-agent de quien compartió.
 *  - /share/analytics es sólo de administradores (había un TODO: cualquier usuario autenticado lo leía; además, al ir definida
 *    después de /share/:postId, esa ruta ni siquiera era alcanzable).
 *  - El historial de un usuario sólo lo ve él o un administrador.
 *  - La recompensa (5 BEZ) se paga una vez por post y usuario, con tope de 20 compartidos al día (ver models/pg/Share.js).
 */

/**
 * @route   POST /api/social/share
 * @desc    Registrar un compartido y otorgar rewards
 * @access  Private
 */
router.post('/share', protect, async (req, res) => {
    try {
        const { postId, platform, url, comment } = req.body;
        const userId = req.user.id || req.user._id;

        if (!Share.PLATFORMS.includes(platform)) {
            return res.status(400).json({ error: 'Plataforma inválida', platforms: Share.PLATFORMS });
        }

        const r = await Share.record({
            postId, userId, platform,
            url: url || req.headers.referer, comment,
            ipAddress: req.ip, userAgent: req.headers['user-agent'],
            walletAddress: req.user.walletAddress || req.user.wallet_address || null,
        });
        if (r.error === 'POST_NOT_FOUND') return res.status(404).json({ error: 'Post not found' });

        res.json({
            success: true,
            share: r.share,
            reward: r.reward,
            totalShares: r.totalShares,
            todayShares: r.todayShares,
            limitReached: r.limitReached
        });

    } catch (error) {
        console.error('Error registering share:', error);
        res.status(500).json({ error: 'Error al registrar compartido' });
    }
});

/**
 * @route   GET /api/social/share/analytics
 * @desc    Obtener analytics de compartidos (admin)
 * @access  Private (Admin)
 * NOTA: va ANTES de /share/:postId; si no, «analytics» se interpretaría como un id de post.
 */
router.get('/share/analytics', protect, verifyAdminToken, async (req, res) => {
    try {
        res.json({ success: true, analytics: await Share.analytics() });
    } catch (error) {
        console.error('Error fetching share analytics:', error);
        res.status(500).json({ error: 'Error al obtener analytics' });
    }
});

/**
 * @route   GET /api/social/share/user/:userId
 * @desc    Obtener historial de compartidos de un usuario (él mismo o un administrador)
 * @access  Private
 */
router.get('/share/user/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const yo = String(req.user.id || req.user._id);
        if (userId !== yo && !isAdminRequest(req)) {
            return res.status(403).json({ error: 'No autorizado' });
        }
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

        if (!Share.isValidId(userId)) return res.json({ success: true, shares: [], total: 0, hasMore: false });
        const { shares, total } = await Share.forUser(userId, { limit, skip });

        res.json({ success: true, shares, total, hasMore: total > skip + limit });

    } catch (error) {
        console.error('Error fetching user shares:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

/**
 * @route   GET /api/social/share/:postId
 * @desc    Obtener estadísticas de compartidos de un post
 * @access  Public
 */
router.get('/share/:postId', async (req, res) => {
    try {
        const { shares, total, byPlatform } = await Share.forPost(req.params.postId);
        res.json({ success: true, total, shares, byPlatform });
    } catch (error) {
        console.error('Error fetching shares:', error);
        res.status(500).json({ error: 'Error al obtener compartidos' });
    }
});

/**
 * @route   DELETE /api/social/share/:shareId
 * @desc    Eliminar un compartido (sólo quien lo hizo)
 * @access  Private
 */
router.delete('/share/:shareId', protect, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const r = await Share.removeOwned(req.params.shareId, userId);

        if (!r.found) return res.status(404).json({ error: 'Share not found' });
        if (r.forbidden) return res.status(403).json({ error: 'No autorizado' });

        res.json({ success: true, message: 'Share deleted' });

    } catch (error) {
        console.error('Error deleting share:', error);
        res.status(500).json({ error: 'Error al eliminar compartido' });
    }
});

module.exports = router;
