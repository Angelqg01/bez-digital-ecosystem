const express = require('express');
const router = express.Router();
const { db } = require('../database/inMemoryDB');

// In-memory rewards storage
const claimedRewards = new Map();
const dailyRewards = new Map(); // userId -> lastClaimed timestamp

// Get user reward stats
router.get('/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = db.findUserByWallet(userId.toLowerCase());

        if (!user) {
            return res.json({
                level: 1,
                experience: 0,
                experienceToNextLevel: 100,
                totalTokensEarned: 0,
                questsCompleted: 0,
                badgesEarned: 0,
                rank: 'Bronce'
            });
        }

        // Calculate level from experience
        const exp = user.experience || 0;
        const level = Math.floor(Math.sqrt(exp / 100)) + 1;
        const expForNextLevel = (level * level) * 100;

        // Determine rank based on level
        let rank = 'Bronce';
        if (level >= 20) rank = 'Diamante';
        else if (level >= 15) rank = 'Platino';
        else if (level >= 10) rank = 'Oro';
        else if (level >= 5) rank = 'Plata';

        res.json({
            level,
            experience: exp,
            experienceToNextLevel: expForNextLevel,
            totalTokensEarned: user.tokenBalance || 0,
            questsCompleted: user.questsCompleted || 0,
            badgesEarned: user.badges?.length || 0,
            rank
        });
    } catch (error) {
        console.error('Error getting reward stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Get available rewards
router.get('/available', async (req, res) => {
    try {
        const rewards = [
            {
                id: 1,
                type: 'daily',
                title: 'Recompensa Diaria',
                description: 'Reclama tu recompensa diaria',
                reward: { tokens: 10, exp: 25 },
                available: true,
                icon: '🎁',
                cooldown: null
            },
            {
                id: 2,
                type: 'weekly',
                title: 'Recompensa Semanal',
                description: 'Completa 5 días de actividad esta semana',
                reward: { tokens: 50, exp: 100 },
                available: true,
                icon: '📅',
                cooldown: null
            },
            {
                id: 3,
                type: 'achievement',
                title: 'Primera Publicación',
                description: 'Haz tu primera publicación',
                reward: { tokens: 20, exp: 50, badge: 'Primer Post' },
                available: true,
                icon: '✍️',
                cooldown: null
            }
        ];

        res.json(rewards);
    } catch (error) {
        console.error('Error getting available rewards:', error);
        res.status(500).json({ error: 'Error al obtener recompensas' });
    }
});

// Get claimed rewards
router.get('/:userId/claimed', async (req, res) => {
    try {
        const { userId } = req.params;
        const userClaimed = Array.from(claimedRewards.values())
            .filter(r => r.userId === userId.toLowerCase())
            .sort((a, b) => new Date(b.claimedAt) - new Date(a.claimedAt));

        res.json(userClaimed);
    } catch (error) {
        console.error('Error getting claimed rewards:', error);
        res.status(500).json({ error: 'Error al obtener recompensas reclamadas' });
    }
});

// Claim reward
router.post('/:rewardId/claim', async (req, res) => {
    try {
        const { rewardId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }

        // Check if daily reward
        if (parseInt(rewardId) === 1) {
            const lastClaimed = dailyRewards.get(userId.toLowerCase());
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            if (lastClaimed && new Date(lastClaimed) > oneDayAgo) {
                return res.status(400).json({
                    error: 'Recompensa diaria ya reclamada. Vuelve mañana.'
                });
            }

            dailyRewards.set(userId.toLowerCase(), now.toISOString());
        }

        // Update user balance and experience
        const user = db.findUserByWallet(userId.toLowerCase());
        if (user) {
            user.tokenBalance = (user.tokenBalance || 0) + 10;
            user.experience = (user.experience || 0) + 25;
            db.updateUser(user.walletAddress, user);
        }

        // Record claimed reward
        const claimedReward = {
            id: Date.now(),
            rewardId: parseInt(rewardId),
            userId: userId.toLowerCase(),
            tokens: 10,
            exp: 25,
            claimedAt: new Date().toISOString()
        };
        claimedRewards.set(claimedReward.id, claimedReward);

        res.json({
            success: true,
            tokens: 10,
            exp: 25,
            message: 'Recompensa reclamada exitosamente'
        });
    } catch (error) {
        console.error('Error claiming reward:', error);
        res.status(500).json({ error: 'Error al reclamar recompensa' });
    }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const allUsers = db.getAllUsers();

        const leaderboard = allUsers
            .map(user => ({
                address: user.walletAddress,
                username: user.username || 'Anónimo',
                level: Math.floor(Math.sqrt((user.experience || 0) / 100)) + 1,
                experience: user.experience || 0,
                tokens: user.tokenBalance || 0,
                questsCompleted: user.questsCompleted || 0
            }))
            .sort((a, b) => b.experience - a.experience)
            .slice(0, 100); // Top 100

        res.json(leaderboard);
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({ error: 'Error al obtener ranking' });
    }
});

module.exports = router;
