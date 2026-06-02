const express = require('express');
const router = express.Router();
const Share = require('../models/Share');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const { protect } = require('../middleware/auth.middleware');

/**
 * @route   POST /api/social/share
 * @desc    Registrar un compartido y otorgar rewards
 * @access  Private
 */
router.post('/share', protect, async (req, res) => {
    try {
        const { postId, platform, url, comment } = req.body;
        const userId = req.user.id || req.user._id;

        // Validar que el post existe
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Crear registro de compartido
        const share = new Share({
            postId,
            userId,
            platform,
            url: url || req.headers.referer,
            comment,
            timestamp: new Date(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        await share.save();

        // Incrementar contador en el post
        post.shares = (post.shares || 0) + 1;
        await post.save();

        // Calcular reward (5 BEZ por compartir, máximo 20 por día)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayShares = await Share.countDocuments({
            userId,
            timestamp: { $gte: today }
        });

        let reward = null;
        if (todayShares <= 20) {
            reward = {
                tokens: 5,
                exp: 10,
                reason: 'Compartir contenido'
            };

            // Actualizar tokens del usuario
            const user = await User.findById(userId);
            if (user) {
                user.bezTokenBalance = (user.bezTokenBalance || 0) + reward.tokens;
                user.exp = (user.exp || 0) + reward.exp;
                await user.save();
            }
        }

        // Notificar al autor del post
        if (post.userId && post.userId.toString() !== userId.toString()) {
            // TODO: Enviar notificación al autor
        }

        res.json({
            success: true,
            share,
            reward,
            totalShares: post.shares,
            todayShares: todayShares + 1,
            limitReached: todayShares >= 20
        });

    } catch (error) {
        console.error('Error registering share:', error);
        res.status(500).json({ error: 'Error al registrar compartido' });
    }
});

/**
 * @route   GET /api/social/share/:postId
 * @desc    Obtener estadísticas de compartidos de un post
 * @access  Public
 */
router.get('/share/:postId', async (req, res) => {
    try {
        const { postId } = req.params;

        const shares = await Share.find({ postId })
            .populate('userId', 'username avatar')
            .sort({ timestamp: -1 })
            .limit(50);

        const total = await Share.countDocuments({ postId });

        // Agrupar por plataforma
        const byPlatform = await Share.aggregate([
            { $match: { postId: postId } },
            {
                $group: {
                    _id: '$platform',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            total,
            shares,
            byPlatform: byPlatform.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {})
        });

    } catch (error) {
        console.error('Error fetching shares:', error);
        res.status(500).json({ error: 'Error al obtener compartidos' });
    }
});

/**
 * @route   GET /api/social/share/user/:userId
 * @desc    Obtener historial de compartidos de un usuario
 * @access  Private
 */
router.get('/share/user/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, skip = 0 } = req.query;

        const shares = await Share.find({ userId })
            .populate('postId', 'content images')
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Share.countDocuments({ userId });

        res.json({
            success: true,
            shares,
            total,
            hasMore: total > parseInt(skip) + parseInt(limit)
        });

    } catch (error) {
        console.error('Error fetching user shares:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

/**
 * @route   GET /api/social/share/analytics
 * @desc    Obtener analytics de compartidos (admin)
 * @access  Private (Admin)
 */
router.get('/share/analytics', protect, async (req, res) => {
    try {
        // TODO: Verificar que el usuario es admin

        const now = new Date();
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

        // Total de compartidos
        const totalShares = await Share.countDocuments();
        const lastMonthShares = await Share.countDocuments({
            timestamp: { $gte: lastMonth }
        });

        // Por plataforma
        const byPlatform = await Share.aggregate([
            {
                $group: {
                    _id: '$platform',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Posts más compartidos
        const topSharedPosts = await Share.aggregate([
            {
                $group: {
                    _id: '$postId',
                    shareCount: { $sum: 1 }
                }
            },
            { $sort: { shareCount: -1 } },
            { $limit: 10 }
        ]);

        // Compartidos por hora (últimas 24h)
        const last24h = new Date(now - 24 * 60 * 60 * 1000);
        const sharesByHour = await Share.aggregate([
            { $match: { timestamp: { $gte: last24h } } },
            {
                $group: {
                    _id: { $hour: '$timestamp' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        res.json({
            success: true,
            analytics: {
                totalShares,
                lastMonthShares,
                growthRate: ((lastMonthShares / totalShares) * 100).toFixed(2),
                byPlatform,
                topSharedPosts,
                sharesByHour
            }
        });

    } catch (error) {
        console.error('Error fetching share analytics:', error);
        res.status(500).json({ error: 'Error al obtener analytics' });
    }
});

/**
 * @route   DELETE /api/social/share/:shareId
 * @desc    Eliminar un compartido
 * @access  Private
 */
router.delete('/share/:shareId', protect, async (req, res) => {
    try {
        const { shareId } = req.params;
        const userId = req.user.id || req.user._id;

        const share = await Share.findById(shareId);

        if (!share) {
            return res.status(404).json({ error: 'Share not found' });
        }

        // Solo el usuario que compartió puede eliminar
        if (share.userId.toString() !== userId.toString()) {
            return res.status(403).json({ error: 'No autorizado' });
        }

        await share.deleteOne();

        // Decrementar contador en el post
        await Post.findByIdAndUpdate(share.postId, {
            $inc: { shares: -1 }
        });

        res.json({ success: true, message: 'Share deleted' });

    } catch (error) {
        console.error('Error deleting share:', error);
        res.status(500).json({ error: 'Error al eliminar compartido' });
    }
});

module.exports = router;
