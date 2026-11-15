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
const Post = require('../models/pg/Post');
const { getOracle } = require('./oracle.service');
const rewardLedger = require('./rewardLedger.service');
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

            const unanalyzedPosts = await Post.findUnanalyzed({ sinceHours: 24, limit: 20 }); // Últimas 24 horas

            console.log(`   Found ${unanalyzedPosts.length} unanalyzed posts`);

            for (const post of unanalyzedPosts) {
                try {
                    await this.oracle.processContent(post.id, post.content, post.author);
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

            const activeUsers = await Post.activeAuthors({ sinceHours: 24, minQuality: 50 });

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
                        // Un bono por persona y día (clave de idempotencia): si el job se repite no se paga dos veces.
                        const r = await rewardLedger.rewardDaily({ identity: userData._id, amount: bonus });
                        console.log(r.credited ? `   ✅ ${bonus} BEZ → ${userData._id}` : `   ⏭️  ${userData._id}: ${r.reason}`);
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

            const hidden = await Post.hideLowQuality({ threshold: 30 });

            console.log(`   Hidden ${hidden} low-quality posts`);

            if (hidden > 0) {
                await notifyMedium(
                    'Content Cleanup',
                    `Hidden ${hidden} low-quality posts`
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
                // Logro + asiento en una transacción; cada usuario lo desbloquea una sola vez (UNIQUE usuario+insignia).
                const unlocked = await rewardLedger.unlockPostMilestone(milestone);
                for (const u of unlocked) console.log(`   🏆 ${milestone.badge} → ${u.author}`);
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

            const m = await rewardLedger.platformMetrics();
            const { totalUsers, totalPosts, activeUsersToday, totalRewardsDistributed } = m;
            const avgQualityScore = m.avgQualityScore;

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

            // Desactivado a propósito: la tabla `users` no guarda la última actividad (`last_active`/`is_active` eran de Mongo), así que no
            // se puede saber quién está inactivo. El job regalaba 10 BEZ a cada «inactivo» en CADA ejecución, sin ninguna barrera. Para
            // reactivarlo hace falta primero registrar la actividad y un tope (un incentivo por usuario y mes, con idempotencyKey).
            console.log('   ⏭️  Sin datos de actividad de usuarios: no se reparte ningún incentivo');

            console.log('   ✅ Re-engagement omitted\n');

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
