const pool = require('../../db/pool');

class VIPSubscriptionPG {
    static async create(data) {
        const query = `
            INSERT INTO vip_subscriptions (
                user_id, wallet_address, tier, status, start_date, end_date,
                stripe_customer_id, stripe_subscription_id, stripe_payment_method,
                benefits, billing, metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            ) RETURNING *;
        `;
        
        const values = [
            data.userId,
            data.walletAddress.toLowerCase(),
            data.tier,
            data.status || 'active',
            data.startDate || new Date(),
            data.endDate,
            data.stripeCustomerId || null,
            data.stripeSubscriptionId || null,
            data.stripePaymentMethod || null,
            JSON.stringify(data.benefits || {}),
            JSON.stringify(data.billing),
            JSON.stringify(data.metadata || {})
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async getActiveSubscription(walletAddress) {
        const query = `
            SELECT * FROM vip_subscriptions
            WHERE wallet_address = $1
              AND status = 'active'
              AND end_date > CURRENT_TIMESTAMP
            ORDER BY
              CASE tier
                WHEN 'platinum' THEN 4
                WHEN 'gold' THEN 3
                WHEN 'silver' THEN 2
                WHEN 'bronze' THEN 1
                ELSE 0
              END DESC
            LIMIT 1;
        `;
        const result = await pool.query(query, [walletAddress.toLowerCase()]);
        return result.rows[0];
    }

    static async addSaving(id, amount, description, transactionType) {
        // Appends to the jsonb savings_history array and updates stats.totalSavings.
        const query = `
            UPDATE vip_subscriptions
            SET savings_history = savings_history || $2::jsonb,
                stats = jsonb_set(
                    stats, 
                    '{totalSavings}', 
                    to_jsonb((stats->>'totalSavings')::numeric + $3::numeric)
                ),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        const savingEntry = JSON.stringify([{
            amount,
            description,
            transactionType,
            date: new Date().toISOString()
        }]);

        const result = await pool.query(query, [id, savingEntry, amount]);
        return result.rows[0];
    }

    static async cancel(id, reason, cancelledBy = 'user') {
        const query = `
            UPDATE vip_subscriptions
            SET status = 'cancelled',
                cancellation = $2::jsonb,
                billing = jsonb_set(billing, '{autoRenew}', 'false'::jsonb),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        const cancellationData = JSON.stringify({
            cancelledAt: new Date().toISOString(),
            reason,
            cancelledBy
        });

        const result = await pool.query(query, [id, cancellationData]);
        return result.rows[0];
    }

    static async updateStatusForExpired() {
        // Find subscriptions where status is 'active' but end_date has passed
        const query = `
            UPDATE vip_subscriptions
            SET status = 'expired',
                updated_at = CURRENT_TIMESTAMP
            WHERE status = 'active' AND end_date < CURRENT_TIMESTAMP
            RETURNING id, wallet_address, tier;
        `;
        const result = await pool.query(query);
        return result.rows;
    }
}

module.exports = VIPSubscriptionPG;
