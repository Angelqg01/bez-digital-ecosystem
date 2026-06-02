/**
 * ============================================================================
 * AUTOMATION ENGINE
 * ============================================================================
 * 
 * Motor de automatizaciones para mejorar la experiencia del usuario
 * - Auto-recompensas por actividad
 * - Notificaciones inteligentes
 * - Distribución automática de incentivos
 * - Mantenimiento de sistema
 */

const { ethers } = require('ethers');
const cron = require('node-cron');
const Post = require('../models/post.model');
const User = require('../models/user.model');
const { getOracle } = require('./oracle.service');
const { notifyHigh, notifyMedium } = require('../middleware/discordNotifier');
const telegram = require('../middleware/telegramNotifier');

class AutomationEngine {
    constructor() {
        this.jobs = [];
        this.isRunning = false;
        this.oracle = null;
    }

    /**
     * Iniciar todas las automatizaciones
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Automation Engine already running');
            return;
        }

        console.log('🤖 Starting Automation Engine...\n');
        this.isRunning = true;

        // Obtener instancia del Oracle
        this.oracle = getOracle();

        // Registrar todos los jobs
        this.registerJobs();

        console.log('✅ Automation Engine started successfully\n');
    }

    /**
     * Registrar todos los trabajos automatizados
     */
    registerJobs() {
        // 1. Auto-análisis de contenido nuevo (cada 2 minutos)
        this.jobs.push(
            cron.schedule('*/2 * * * *', () => this.autoAnalyzeNewContent())
        );

        // 2. Distribución de recompensas diarias (cada día a las 00:00)
        this.jobs.push(
            cron.schedule('0 0 * * *', () => this.distributeDailyRewards())
        );

        // 3. Limpieza de contenido de baja calidad (cada semana)
        this.jobs.push(
            cron.schedule('0 2 * * 0', () => this.cleanLowQualityContent())
        );

        // 4. Notificaciones de logros (cada hora)
        this.jobs.push(
            cron.schedule('0 * * * *', () => this.checkAndNotifyAchievements())
        );

        // 5. Estadísticas y métricas (cada 6 horas)
        this.jobs.push(
            cron.schedule('0 */6 * * *', () => this.calculatePlatformMetrics())
        );

        // 6. Detección de usuarios inactivos (cada día a las 12:00)
        this.jobs.push(
            cron.schedule('0 12 * * *', () => this.reengageInactiveUsers())
        );

        console.log(`   Registered ${this.jobs.length} automation jobs`);
    }

    /**
     * AUTO-ANÁLISIS: Analizar contenido nuevo automáticamente
     */
    async autoAnalyzeNewContent() {
        try {
            console.log('\n🔍 Running auto-analysis of new content...');

            const unanalyzedPosts = await Post.find({
                qualityScore: { $exists: false },
                content: { $exists: true, $ne: '' },
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
            }).limit(20);

            console.log(`   Found ${unanalyzedPosts.length} unanalyzed posts`);

            for (const post of unanalyzedPosts) {
                try {
                    await this.oracle.processContent(post._id, post.content, post.userId);
                    // Pausa entre análisis
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (error) {
                    console.error(`   Error processing post ${post._id}:`, error.message);
                }
            }

            console.log('   ✅ Auto-analysis completed\n');

        } catch (error) {
            console.error('Error in auto-analysis:', error.message);
        }
    }

    /**
     * RECOMPENSAS DIARIAS: Distribuir bonos por actividad
     */
    async distributeDailyRewards() {
        try {
            console.log('\n💰 Distributing daily activity rewards...');

            // Encontrar usuarios activos del día
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const activeUsers = await Post.aggregate([
                {
                    $match: {
                        createdAt: { $gte: yesterday },
                        qualityScore: { $gte: 50 }
                    }
                },
                {
                    $group: {
                        _id: '$userId',
                        postCount: { $sum: 1 },
                        avgQuality: { $avg: '$qualityScore' }
                    }
                }
            ]);

            console.log(`   Found ${activeUsers.length} active users`);

            for (const userData of activeUsers) {
                try {
                    // Calcular bonus basado en actividad y calidad
                    let bonus = 0;
                    if (userData.postCount >= 5 && userData.avgQuality >= 70) {
                        bonus = 25; // Super activo
                    } else if (userData.postCount >= 3 && userData.avgQuality >= 60) {
                        bonus = 15; // Muy activo
                    } else if (userData.postCount >= 1 && userData.avgQuality >= 50) {
                        bonus = 5; // Activo
                    }

                    if (bonus > 0) {
                        await User.findByIdAndUpdate(userData._id, {
                            $inc: {
                                bezBalance: bonus,
                                totalEarned: bonus
                            },
                            $push: {
                                notifications: {
                                    type: 'reward',
                                    message: `¡Ganaste ${bonus} BEZ por tu actividad diaria!`,
                                    amount: bonus,
                                    createdAt: new Date()
                                }
                            }
                        });

                        console.log(`   ✅ ${bonus} BEZ → User ${userData._id}`);
                    }

                } catch (error) {
                    console.error(`   Error rewarding user ${userData._id}:`, error.message);
                }
            }

            // Notificar a Discord
            await notifyMedium(
                'Daily Rewards Distributed',
                `${activeUsers.length} users rewarded for daily activity`
            );

            console.log('   ✅ Daily rewards distributed\n');

        } catch (error) {
            console.error('Error distributing daily rewards:', error.message);
        }
    }

    /**
     * LIMPIEZA: Marcar contenido de baja calidad
     */
    async cleanLowQualityContent() {
        try {
            console.log('\n🧹 Cleaning low quality content...');

            const result = await Post.updateMany(
                {
                    qualityScore: { $lt: 30 },
                    isHidden: { $ne: true }
                },
                {
                    $set: {
                        isHidden: true,
                        hiddenReason: 'Low quality score',
                        hiddenAt: new Date()
                    }
                }
            );

            console.log(`   Hidden ${result.modifiedCount} low-quality posts`);

            if (result.modifiedCount > 0) {
                await notifyMedium(
                    'Content Cleanup',
                    `Hidden ${result.modifiedCount} low-quality posts`
                );
            }

            console.log('   ✅ Cleanup completed\n');

        } catch (error) {
            console.error('Error cleaning content:', error.message);
        }
    }

    /**
     * LOGROS: Detectar y notificar achievements
     */
    async checkAndNotifyAchievements() {
        try {
            console.log('\n🏆 Checking for user achievements...');

            // Buscar usuarios que alcanzaron hitos
            const milestones = [
                { posts: 10, reward: 50, badge: 'Creador Novato' },
                { posts: 50, reward: 200, badge: 'Creador Activo' },
                { posts: 100, reward: 500, badge: 'Creador Experto' },
                { posts: 500, reward: 2000, badge: 'Creador Maestro' }
            ];

            for (const milestone of milestones) {
                const users = await User.aggregate([
                    {
                        $lookup: {
                            from: 'posts',
                            localField: '_id',
                            foreignField: 'userId',
                            as: 'posts'
                        }
                    },
                    {
                        $match: {
                            'posts': { $size: milestone.posts },
                            [`achievements.${milestone.badge}`]: { $exists: false }
                        }
                    }
                ]);

                for (const user of users) {
                    await User.findByIdAndUpdate(user._id, {
                        $inc: { bezBalance: milestone.reward },
                        $set: {
                            [`achievements.${milestone.badge}`]: {
                                unlockedAt: new Date(),
                                reward: milestone.reward
                            }
                        },
                        $push: {
                            notifications: {
                                type: 'achievement',
                                message: `¡Desbloqueaste: ${milestone.badge}! +${milestone.reward} BEZ`,
                                createdAt: new Date()
                            }
                        }
                    });

                    console.log(`   🏆 ${milestone.badge} → User ${user._id}`);
                }
            }

            console.log('   ✅ Achievements checked\n');

        } catch (error) {
            console.error('Error checking achievements:', error.message);
        }
    }

    /**
     * MÉTRICAS: Calcular estadísticas de la plataforma
     */
    async calculatePlatformMetrics() {
        try {
            console.log('\n📊 Calculating platform metrics...');

            const [
                totalUsers,
                totalPosts,
                activeUsersToday,
                avgQualityScore,
                totalRewardsDistributed
            ] = await Promise.all([
                User.countDocuments(),
                Post.countDocuments(),
                Post.distinct('userId', {
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }).then(users => users.length),
                Post.aggregate([
                    { $match: { qualityScore: { $exists: true } } },
                    { $group: { _id: null, avg: { $avg: '$qualityScore' } } }
                ]).then(result => result[0]?.avg || 0),
                User.aggregate([
                    { $group: { _id: null, total: { $sum: '$totalEarned' } } }
                ]).then(result => result[0]?.total || 0)
            ]);

            const metrics = {
                timestamp: new Date(),
                totalUsers,
                totalPosts,
                activeUsersToday,
                avgQualityScore: avgQualityScore.toFixed(2),
                totalRewardsDistributed
            };

            console.log('   Platform Metrics:', JSON.stringify(metrics, null, 2));

            // Notificar a Discord cada 24 horas
            const hour = new Date().getHours();
            if (hour === 0) {
                await notifyHigh(
                    'Daily Platform Metrics',
                    `Users: ${totalUsers}\nPosts: ${totalPosts}\nActive Today: ${activeUsersToday}\nAvg Quality: ${metrics.avgQualityScore}\nTotal Rewards: ${totalRewardsDistributed} BEZ`
                );
            }

            console.log('   ✅ Metrics calculated\n');

        } catch (error) {
            console.error('Error calculating metrics:', error.message);
        }
    }

    /**
     * RE-ENGAGEMENT: Notificar usuarios inactivos
     */
    async reengageInactiveUsers() {
        try {
            console.log('\n📢 Re-engaging inactive users...');

            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const inactiveUsers = await User.find({
                lastActive: { $lt: weekAgo },
                isActive: true
            }).limit(50);

            console.log(`   Found ${inactiveUsers.length} inactive users`);

            for (const user of inactiveUsers) {
                // Dar un pequeño incentivo para volver
                await User.findByIdAndUpdate(user._id, {
                    $inc: { bezBalance: 10 },
                    $push: {
                        notifications: {
                            type: 'incentive',
                            message: '¡Te extrañamos! Aquí tienes 10 BEZ de regalo 🎁',
                            createdAt: new Date()
                        }
                    }
                });
            }

            console.log('   ✅ Incentives sent to inactive users\n');

        } catch (error) {
            console.error('Error re-engaging users:', error.message);
        }
    }

    /**
     * Detener todas las automatizaciones
     */
    stop() {
        console.log('\n🛑 Stopping Automation Engine...');
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
        this.isRunning = false;
        console.log('✅ Automation Engine stopped\n');
    }
}

// Singleton instance
let engineInstance = null;

function getEngine() {
    if (!engineInstance) {
        engineInstance = new AutomationEngine();
    }
    return engineInstance;
}

module.exports = {
    AutomationEngine,
    getEngine
};
