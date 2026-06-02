const pool = require('../../db/pool');

class BEZCoinTransactionPG {
    static async create(data) {
        const query = `
            INSERT INTO bezcoin_transactions (
                user_id, wallet_address, type, amount, currency, fiat_amount, exchange_rate, tx_hash, status, metadata
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
            ) RETURNING *;
        `;
        const values = [
            data.user || data.userId,
            data.walletAddress,
            data.type,
            data.amount,
            data.currency || 'EUR',
            data.fiatAmount,
            data.exchangeRate,
            data.txHash,
            data.status || 'completed',
            JSON.stringify(data.metadata || {})
        ];
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findByWallet(walletAddress, limit = 50) {
        const query = `
            SELECT * FROM bezcoin_transactions 
            WHERE wallet_address = $1 
            ORDER BY created_at DESC 
            LIMIT $2;
        `;
        const result = await pool.query(query, [walletAddress, limit]);
        return result.rows;
    }
}

module.exports = BEZCoinTransactionPG;
