/**
 * services/gamificationService.js — Automated achievement evaluation.
 */
const { query } = require('../db/pool');

class GamificationService {
    /**
     * Records an enterprise event and checks for newly unlocked achievements.
     */
    async recordEvent(enterpriseId, eventKey, value = 1, metadata = {}) {
        try {
            // 1. Log the event
            await query(
                'INSERT INTO enterprise_events (enterprise_id, event_key, value, metadata) VALUES ($1, $2, $3, $4)',
                [enterpriseId, eventKey, value, metadata]
            );

            // 2. Get user_id for this enterprise
            const { rows: entRows } = await query('SELECT user_id FROM enterprises WHERE id = $1', [enterpriseId]);
            if (entRows.length === 0) return;
            const userId = entRows[0].user_id;

            // 3. Find related rules
            const { rows: rules } = await query(
                'SELECT * FROM achievement_rules WHERE metric_type = $1',
                [`event:${eventKey}`]
            );

            for (const rule of rules) {
                await this.checkAndAward(userId, rule);
            }
        } catch (err) {
            console.error('GamificationService Error:', err);
        }
    }

    /**
     * Checks if a user meets a rule's criteria and awards it if not already unlocked.
     */
    async checkAndAward(userId, rule) {
        // Check if already unlocked
        const { rows: existing } = await query(
            'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_key = $2',
            [userId, rule.key]
        );
        if (existing.length > 0) return;

        let currentProgress = 0;

        // Calculate progress based on metric type
        if (rule.metric_type.startsWith('event:')) {
            const eventKey = rule.metric_type.split(':')[1];
            const { rows } = await query(
                'SELECT SUM(value) as total FROM enterprise_events ee JOIN enterprises e ON ee.enterprise_id = e.id WHERE e.user_id = $1 AND ee.event_key = $2',
                [userId, eventKey]
            );
            currentProgress = parseFloat(rows[0].total || '0');
        } else {
            // Handled by traditional count-based logic or other services
            return; 
        }

        if (currentProgress >= rule.threshold) {
            // Unlock!
            await query(
                'INSERT INTO user_achievements (user_id, achievement_key, xp_awarded) VALUES ($1, $2, $3)',
                [userId, rule.key, rule.xp]
            );

            // Notify user
            await query(
                'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
                [userId, 'reward', '¡Logro Desbloqueado!', `Has ganado el logro "${rule.name}" y +${rule.xp} XP.`]
            );

            // Record Social Activity
            const { rows: entRows } = await query('SELECT id, name FROM enterprises WHERE user_id = $1', [userId]);
            if (entRows.length > 0) {
                await this.recordActivity(
                    entRows[0].id,
                    'achievement',
                    '¡Nuevo Logro!',
                    `${entRows[0].name} ha desbloqueado "${rule.name}"`,
                    rule.xp,
                    { achievement_key: rule.key }
                );
            }

            console.log(`User ${userId} unlocked achievement: ${rule.name}`);
        }
    }

    /**
     * Records a social activity for the global feed.
     */
    async recordActivity(enterpriseId, type, title, description, xp = 0, metadata = {}) {
        try {
            await query(
                'SELECT record_gamification_activity($1, $2, $3, $4, $5, $6)',
                [enterpriseId, type, title, description, xp, metadata]
            );
        } catch (err) {
            console.error('Error recording activity:', err);
        }
    }

    /**
     * Sync achievements for a user based on current DB state (tx, nfts, etc).
     */
    async syncUserAchievements(userId) {
        // Implementation for syncing tx, nfts, etc.
    }
}

module.exports = new GamificationService();
