const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Post = require('../models/Post');

/**
 * @route   GET /api/social/trending/hashtags
 * @desc    Get trending hashtags
 * @access  Public
 */
router.get('/trending/hashtags', async (req, res) => {
    try {
        // Agregamos hashtags desde posts recientes
        const recentPosts = await Post.find({
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Últimos 7 días
        }).select('content hashtags');

        // Contar hashtags
        const hashtagCount = {};
        recentPosts.forEach(post => {
            // Extraer hashtags del contenido
            const contentHashtags = (post.content.match(/#[\w]+/g) || []).map(tag => tag.toLowerCase());
            const dbHashtags = (post.hashtags || []).map(tag => tag.toLowerCase());

            [...contentHashtags, ...dbHashtags].forEach(hashtag => {
                hashtagCount[hashtag] = (hashtagCount[hashtag] || 0) + 1;
            });
        });

        // Convertir a array y ordenar
        const trending = Object.entries(hashtagCount)
            .map(([tag, count]) => ({
                category: tag.startsWith('#') ? tag.substring(1) : tag,
                topic: tag,
                posts: count,
                trending: true
            }))
            .sort((a, b) => b.posts - a.posts)
            .slice(0, 10);

        res.json({
            success: true,
            data: trending.length > 0 ? trending : [
                { category: 'BeZhas', topic: '#BeZhas', posts: 156, trending: true },
                { category: 'Crypto', topic: '#BEZToken', posts: 89, trending: true },
                { category: 'Web3', topic: '#Web3Social', posts: 67, trending: true },
                { category: 'Community', topic: '#BeVIP', posts: 45, trending: true }
            ]
        });
    } catch (error) {
        console.error('Error fetching trending hashtags:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener trending topics',
            data: [
                { category: 'BeZhas', topic: '#BeZhas', posts: 156, trending: true },
                { category: 'Crypto', topic: '#BEZToken', posts: 89, trending: true }
            ]
        });
    }
});

/**
 * @route   GET /api/social/users/active
 * @desc    Get currently active users
 * @access  Private
 */
router.get('/users/active', auth, async (req, res) => {
    try {
        // Usuarios activos en los últimos 5 minutos
        const activeUsers = await User.find({
            lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
            _id: { $ne: req.user.id } // Excluir usuario actual
        })
            .select('username name profilePicture lastActive')
            .limit(20)
            .sort({ lastActive: -1 });

        const formattedUsers = activeUsers.map(user => ({
            id: user._id,
            name: user.name || user.username,
            username: user.username,
            avatar: user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`,
            status: getStatusText(user.lastActive),
            lastActive: user.lastActive,
            online: Date.now() - new Date(user.lastActive).getTime() < 60000 // Online si < 1 min
        }));

        res.json({
            success: true,
            data: formattedUsers
        });
    } catch (error) {
        console.error('Error fetching active users:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios activos'
        });
    }
});

/**
 * @route   GET /api/social/users/recommended
 * @desc    Get recommended users to follow
 * @access  Private
 */
router.get('/users/recommended', auth, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id).select('following');
        const followingIds = currentUser.following || [];

        // Usuarios recomendados: no seguidos, activos, con contenido
        const recommended = await User.find({
            _id: {
                $ne: req.user.id,
                $nin: followingIds
            },
            postsCount: { $gt: 0 } // Al menos 1 post
        })
            .select('username name profilePicture bio followersCount postsCount')
            .sort({ followersCount: -1, postsCount: -1 })
            .limit(5);

        const formattedUsers = recommended.map(user => ({
            id: user._id,
            name: user.name || user.username,
            username: user.username,
            avatar: user.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`,
            bio: user.bio || 'Usuario de BeZhas',
            followers: user.followersCount || 0,
            posts: user.postsCount || 0,
            isFollowing: false
        }));

        res.json({
            success: true,
            data: formattedUsers
        });
    } catch (error) {
        console.error('Error fetching recommended users:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios recomendados'
        });
    }
});

/**
 * @route   POST /api/social/users/:userId/follow
 * @desc    Follow a user
 * @access  Private
 */
router.post('/users/:userId/follow', auth, async (req, res) => {
    try {
        const { userId } = req.params;

        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'No puedes seguirte a ti mismo'
            });
        }

        const [currentUser, targetUser] = await Promise.all([
            User.findById(req.user.id),
            User.findById(userId)
        ]);

        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Verificar si ya sigue
        const isFollowing = currentUser.following && currentUser.following.includes(userId);

        if (isFollowing) {
            // Unfollow
            currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
            targetUser.followers = targetUser.followers.filter(id => id.toString() !== req.user.id);
            targetUser.followersCount = Math.max(0, (targetUser.followersCount || 0) - 1);

            await Promise.all([currentUser.save(), targetUser.save()]);

            res.json({
                success: true,
                data: {
                    isFollowing: false,
                    followersCount: targetUser.followersCount
                }
            });
        } else {
            // Follow
            if (!currentUser.following) currentUser.following = [];
            if (!targetUser.followers) targetUser.followers = [];

            currentUser.following.push(userId);
            targetUser.followers.push(req.user.id);
            targetUser.followersCount = (targetUser.followersCount || 0) + 1;

            await Promise.all([currentUser.save(), targetUser.save()]);

            // Emitir evento WebSocket
            const io = req.app.get('io');
            if (io) {
                io.to(userId).emit('notification', {
                    type: 'new_follower',
                    user: {
                        id: currentUser._id,
                        username: currentUser.username,
                        name: currentUser.name,
                        avatar: currentUser.profilePicture
                    },
                    message: `${currentUser.username} comenzó a seguirte`,
                    timestamp: new Date()
                });
            }

            res.json({
                success: true,
                data: {
                    isFollowing: true,
                    followersCount: targetUser.followersCount
                }
            });
        }
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({
            success: false,
            message: 'Error al seguir usuario'
        });
    }
});

/**
 * @route   GET /api/social/recent-activity
 * @desc    Get recent platform activity
 * @access  Public
 */
router.get('/recent-activity', async (req, res) => {
    try {
        const recentPosts = await Post.find()
            .populate('author', 'username name profilePicture')
            .sort({ createdAt: -1 })
            .limit(10)
            .select('content author createdAt likesCount commentsCount');

        const activities = recentPosts.map(post => ({
            type: 'post',
            user: {
                name: post.author?.name || post.author?.username || 'Usuario',
                username: post.author?.username,
                avatar: post.author?.profilePicture || `https://ui-avatars.com/api/?name=U&background=random`
            },
            action: 'publicó',
            content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
            timestamp: post.createdAt,
            stats: {
                likes: post.likesCount || 0,
                comments: post.commentsCount || 0
            }
        }));

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener actividad reciente'
        });
    }
});

// Helper function
function getStatusText(lastActive) {
    const diffMs = Date.now() - new Date(lastActive).getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'En línea';
    if (diffMins < 5) return `Activo hace ${diffMins}m`;
    if (diffMins < 60) return `Hace ${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;

    return 'Inactivo';
}

module.exports = router;
