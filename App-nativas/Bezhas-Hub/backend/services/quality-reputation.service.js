const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Quality Reputation System
 * Tracks provider reputation based on service quality, completion rate, and disputes
 */
class QualityReputationSystem {
    constructor() {
        // In-memory storage (in production, use database)
        this.reputations = new Map();

        // Reputation tiers
        this.tiers = {
            LEGENDARY: { min: 950, name: 'Legendary', color: '#fbbf24', badge: '👑' },
            MASTER: { min: 900, name: 'Master', color: '#a855f7', badge: '⭐' },
            EXPERT: { min: 850, name: 'Expert', color: '#3b82f6', badge: '💎' },
            PROFESSIONAL: { min: 800, name: 'Professional', color: '#10b981', badge: '✨' },
            INTERMEDIATE: { min: 700, name: 'Intermediate', color: '#6b7280', badge: '📊' },
            BEGINNER: { min: 0, name: 'Beginner', color: '#9ca3af', badge: '🌱' }
        };

        // Weight factors
        this.weights = {
            qualityScore: 0.4,        // 40% weight on quality
            completionRate: 0.25,     // 25% weight on completion
            consistency: 0.15,        // 15% weight on consistency
            disputeResolution: 0.15,  // 15% weight on disputes
            longevity: 0.05          // 5% weight on time
        };
    }

    /**
     * Get or initialize reputation for provider
     */
    getReputation(provider) {
        if (!this.reputations.has(provider)) {
            this.reputations.set(provider, {
                provider,
                score: 600, // Starting score
                tier: 'BEGINNER',
                stats: {
                    totalServices: 0,
                    completedServices: 0,
                    disputedServices: 0,
                    avgQuality: 0,
                    totalCollateralEarned: 0,
                    totalPenalties: 0,
                    qualityHistory: [],
                    lastServiceDate: null,
                    firstServiceDate: null
                },
                achievements: [],
                history: []
            });
        }
        return this.reputations.get(provider);
    }

    /**
     * Update reputation after service completion
     */
    updateAfterService(provider, serviceData) {
        const { serviceId, finalQuality, collateralReturned, penaltyApplied, isDisputed } = serviceData;

        const reputation = this.getReputation(provider);
        const oldScore = reputation.score;

        // Update stats
        reputation.stats.totalServices++;
        reputation.stats.completedServices++;
        reputation.stats.totalCollateralEarned += collateralReturned;
        reputation.stats.totalPenalties += penaltyApplied;
        reputation.stats.qualityHistory.push(finalQuality);
        reputation.stats.lastServiceDate = new Date().toISOString();

        if (!reputation.stats.firstServiceDate) {
            reputation.stats.firstServiceDate = new Date().toISOString();
        }

        // Calculate new average quality
        reputation.stats.avgQuality =
            reputation.stats.qualityHistory.reduce((a, b) => a + b, 0) /
            reputation.stats.qualityHistory.length;

        // Calculate new reputation score
        const newScore = this._calculateScore(reputation);
        reputation.score = Math.max(0, Math.min(1000, newScore));

        // Update tier
        reputation.tier = this._getTierName(reputation.score);

        // Check achievements
        this._checkAchievements(reputation);

        // Record history
        reputation.history.push({
            timestamp: new Date().toISOString(),
            serviceId,
            action: 'service_completed',
            oldScore,
            newScore: reputation.score,
            scoreDelta: reputation.score - oldScore,
            finalQuality,
            penaltyApplied
        });

        logger.info({
            provider,
            serviceId,
            oldScore,
            newScore: reputation.score,
            tier: reputation.tier
        }, 'Reputation updated after service');

        return reputation;
    }

    /**
     * Update reputation after dispute
     */
    updateAfterDispute(provider, disputeData) {
        const { serviceId, wasProviderFault, refundAmount } = disputeData;

        const reputation = this.getReputation(provider);
        const oldScore = reputation.score;

        reputation.stats.disputedServices++;

        // Heavy penalty for provider-fault disputes
        if (wasProviderFault) {
            reputation.score = Math.max(0, reputation.score - 100);

            reputation.history.push({
                timestamp: new Date().toISOString(),
                serviceId,
                action: 'dispute_lost',
                oldScore,
                newScore: reputation.score,
                scoreDelta: reputation.score - oldScore,
                refundAmount
            });
        } else {
            // Minor penalty for any dispute (even if won)
            reputation.score = Math.max(0, reputation.score - 20);

            reputation.history.push({
                timestamp: new Date().toISOString(),
                serviceId,
                action: 'dispute_won',
                oldScore,
                newScore: reputation.score,
                scoreDelta: reputation.score - oldScore
            });
        }

        // Update tier
        reputation.tier = this._getTierName(reputation.score);

        logger.warn({
            provider,
            serviceId,
            wasProviderFault,
            oldScore,
            newScore: reputation.score
        }, 'Reputation updated after dispute');

        return reputation;
    }

    /**
     * Calculate reputation score
     */
    _calculateScore(reputation) {
        const stats = reputation.stats;

        if (stats.totalServices === 0) {
            return 600; // Starting score
        }

        // 1. Quality Score (0-1000)
        const qualityScore = (stats.avgQuality / 100) * 1000;

        // 2. Completion Rate (0-1000)
        const completionRate = (stats.completedServices / stats.totalServices) * 1000;

        // 3. Consistency Score (0-1000) - based on variance in quality
        const consistency = this._calculateConsistency(stats.qualityHistory);

        // 4. Dispute Resolution (0-1000)
        const disputeRate = stats.disputedServices / stats.totalServices;
        const disputeScore = Math.max(0, 1000 * (1 - disputeRate * 5)); // Heavy penalty for disputes

        // 5. Longevity Bonus (0-100)
        const longevityBonus = this._calculateLongevityBonus(stats.firstServiceDate);

        // Weighted average
        const score =
            qualityScore * this.weights.qualityScore +
            completionRate * this.weights.completionRate +
            consistency * this.weights.consistency +
            disputeScore * this.weights.disputeResolution +
            longevityBonus * this.weights.longevity;

        return Math.round(score);
    }

    /**
     * Calculate consistency score from quality history
     */
    _calculateConsistency(qualityHistory) {
        if (qualityHistory.length < 2) return 1000;

        // Calculate standard deviation
        const mean = qualityHistory.reduce((a, b) => a + b, 0) / qualityHistory.length;
        const variance = qualityHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / qualityHistory.length;
        const stdDev = Math.sqrt(variance);

        // Lower std dev = higher consistency
        // Map 0-20 std dev to 1000-0 score
        return Math.max(0, 1000 - (stdDev / 20) * 1000);
    }

    /**
     * Calculate longevity bonus
     */
    _calculateLongevityBonus(firstServiceDate) {
        if (!firstServiceDate) return 0;

        const daysSinceFirst = (Date.now() - new Date(firstServiceDate).getTime()) / (1000 * 60 * 60 * 24);

        // Max bonus of 100 at 365 days
        return Math.min(100, (daysSinceFirst / 365) * 100);
    }

    /**
     * Get tier name from score
     */
    _getTierName(score) {
        for (const [tierKey, tier] of Object.entries(this.tiers)) {
            if (score >= tier.min) {
                return tierKey;
            }
        }
        return 'BEGINNER';
    }

    /**
     * Get tier info
     */
    getTierInfo(tierName) {
        return this.tiers[tierName];
    }

    /**
     * Check and award achievements
     */
    _checkAchievements(reputation) {
        const stats = reputation.stats;
        const achievements = reputation.achievements;

        // First Service
        if (stats.totalServices === 1 && !achievements.includes('FIRST_SERVICE')) {
            achievements.push('FIRST_SERVICE');
        }

        // 10 Services
        if (stats.totalServices === 10 && !achievements.includes('VETERAN_10')) {
            achievements.push('VETERAN_10');
        }

        // 50 Services
        if (stats.totalServices === 50 && !achievements.includes('VETERAN_50')) {
            achievements.push('VETERAN_50');
        }

        // 100 Services
        if (stats.totalServices === 100 && !achievements.includes('CENTURION')) {
            achievements.push('CENTURION');
        }

        // Perfect Quality (100%) service
        if (stats.qualityHistory.includes(100) && !achievements.includes('PERFECTIONIST')) {
            achievements.push('PERFECTIONIST');
        }

        // 10 consecutive high quality (>90%)
        const recent10 = stats.qualityHistory.slice(-10);
        if (recent10.length === 10 && recent10.every(q => q >= 90) && !achievements.includes('CONSISTENT_EXCELLENCE')) {
            achievements.push('CONSISTENT_EXCELLENCE');
        }

        // No disputes in 50 services
        if (stats.totalServices >= 50 && stats.disputedServices === 0 && !achievements.includes('DISPUTE_FREE')) {
            achievements.push('DISPUTE_FREE');
        }

        // Reached Master tier
        if (reputation.score >= 900 && !achievements.includes('MASTER_TIER')) {
            achievements.push('MASTER_TIER');
        }

        // Reached Legendary tier
        if (reputation.score >= 950 && !achievements.includes('LEGENDARY_TIER')) {
            achievements.push('LEGENDARY_TIER');
        }
    }

    /**
     * Get achievement info
     */
    getAchievementInfo(achievementId) {
        const achievements = {
            FIRST_SERVICE: { name: 'First Steps', icon: '🎯', description: 'Completed first service' },
            VETERAN_10: { name: 'Veteran', icon: '🛡️', description: 'Completed 10 services' },
            VETERAN_50: { name: 'Seasoned', icon: '⚔️', description: 'Completed 50 services' },
            CENTURION: { name: 'Centurion', icon: '👑', description: 'Completed 100 services' },
            PERFECTIONIST: { name: 'Perfectionist', icon: '💯', description: 'Achieved 100% quality' },
            CONSISTENT_EXCELLENCE: { name: 'Consistent Excellence', icon: '🌟', description: '10 consecutive high-quality services' },
            DISPUTE_FREE: { name: 'Dispute Free', icon: '🕊️', description: '50 services without disputes' },
            MASTER_TIER: { name: 'Master', icon: '⭐', description: 'Reached Master tier' },
            LEGENDARY_TIER: { name: 'Legendary', icon: '👑', description: 'Reached Legendary tier' }
        };
        return achievements[achievementId] || { name: achievementId, icon: '🏆', description: 'Unknown achievement' };
    }

    /**
     * Get leaderboard
     */
    getLeaderboard(limit = 100) {
        const providers = Array.from(this.reputations.values());

        return providers
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((rep, index) => ({
                rank: index + 1,
                provider: rep.provider,
                score: rep.score,
                tier: rep.tier,
                totalServices: rep.stats.totalServices,
                avgQuality: rep.stats.avgQuality,
                achievements: rep.achievements.length
            }));
    }

    /**
     * Get reputation summary
     */
    getSummary(provider) {
        const reputation = this.getReputation(provider);
        const tierInfo = this.getTierInfo(reputation.tier);

        return {
            provider,
            score: reputation.score,
            tier: {
                name: tierInfo.name,
                color: tierInfo.color,
                badge: tierInfo.badge,
                min: tierInfo.min
            },
            stats: reputation.stats,
            achievements: reputation.achievements.map(id => this.getAchievementInfo(id)),
            recentHistory: reputation.history.slice(-5)
        };
    }
}

module.exports = QualityReputationSystem;
