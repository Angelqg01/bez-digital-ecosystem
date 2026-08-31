const pool = require('../../db/pool');

class PaymentPG {
    static async create(data) {
        const query = `
            INSERT INTO payments (
                payment_intent_id, session_id, stripe_customer_id, user_id,
                wallet_address, email, type, status, fiat_amount,
                fiat_currency, bez_amount, exchange_rate, metadata, distribution
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            ) RETURNING *;
        `;
        
        const values = [
            data.paymentIntentId,
            data.sessionId || null,
            data.stripeCustomerId || null,
            data.userId || null,
            data.walletAddress,
            data.email || null,
            data.type,
            data.status || 'pending',
            data.fiatAmount,
            data.fiatCurrency || 'usd',
            data.bezAmount || null,
            data.exchangeRate || null,
            data.metadata ? JSON.stringify(data.metadata) : null,
            data.distribution ? JSON.stringify(data.distribution) : null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async findByPaymentIntent(paymentIntentId) {
        const result = await pool.query('SELECT * FROM payments WHERE payment_intent_id = $1', [paymentIntentId]);
        return result.rows[0];
    }

    static async markCompleted(id, txHash, blockNumber, gasUsed) {
        const query = `
            UPDATE payments
            SET status = 'completed',
                tx_hash = $2,
                block_number = $3,
                gas_used = $4,
                distributed_at = CURRENT_TIMESTAMP,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [id, txHash, blockNumber, gasUsed]);
        return result.rows[0];
    }

    static async markFailed(id, errorMessage) {
        const query = `
            UPDATE payments
            SET status = 'failed',
                error_message = $2,
                last_retry_at = CURRENT_TIMESTAMP,
                retry_count = retry_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [id, errorMessage]);
        return result.rows[0];
    }

    static async updateByPaymentIntent(paymentIntentId, updateFields) {
        const setClauses = [];
        const values = [paymentIntentId];
        let paramIdx = 2;

        const mapField = (key) => {
            if (key === 'status') return 'status';
            if (key === 'txHash') return 'tx_hash';
            if (key === 'errorMessage') return 'error_message';
            if (key === 'completedAt') return 'completed_at';
            if (key === 'updatedAt') return 'updated_at';
            if (key === 'blockNumber') return 'block_number';
            if (key === 'paidAt') return 'paid_at';
            if (key === 'settledAt') return 'settled_at';
            if (key === 'verifiedPayer') return 'verified_payer';
            return key; // We ignore unmapped extra fields or map to metadata in production
        };

        for (const [key, val] of Object.entries(updateFields)) {
            const dbField = mapField(key);
            if (dbField === key && key !== 'status') continue; // Skip unsupported fields directly
            
            if (val === null) {
                setClauses.push(`${dbField} = NULL`);
            } else {
                setClauses.push(`${dbField} = $${paramIdx}`);
                values.push(val);
                paramIdx++;
            }
        }

        if (setClauses.length === 0) return null;
        const query = `UPDATE payments SET ${setClauses.join(', ')} WHERE payment_intent_id = $1 RETURNING *;`;
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    /**
     * Reclama una orden para liquidarla, en una sola sentencia atómica.
     *
     * Es el candado que impide dispensar dos veces por el mismo pago: sólo la
     * primera petición que llegue verá `settled_at IS NULL` y se llevará la
     * fila; el resto recibe `null` y debe responder de forma idempotente sin
     * entregar valor.
     *
     * El índice único parcial sobre tx_hash (migración 017) cubre el otro
     * flanco: la misma TX reclamada desde dos órdenes distintas revienta con
     * 23505 en vez de pagar dos veces.
     *
     * @returns {Promise<object|null>} la fila reclamada, o null si ya lo estaba
     * @throws error con code '23505' si ese tx_hash ya liquidó otra orden
     */
    static async claimForSettlement(paymentIntentId, txHash, verifiedPayer = null, blockNumber = null) {
        const query = `
            UPDATE payments
            SET status = 'processing',
                tx_hash = $2,
                verified_payer = $3,
                block_number = $4,
                settled_at = CURRENT_TIMESTAMP,
                paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
            WHERE payment_intent_id = $1
              AND settled_at IS NULL
              AND status NOT IN ('completed', 'refunded')
            RETURNING *;
        `;
        const result = await pool.query(query, [paymentIntentId, txHash, verifiedPayer, blockNumber]);
        return result.rows[0] || null;
    }

    /**
     * Devuelve una orden reclamada al estado 'failed' cuando la entrega de
     * valor falló DESPUÉS del claim (p. ej. el dispensado on-chain revirtió).
     * Deja `settled_at` puesto a propósito: el dinero del cliente sí entró, así
     * que la orden requiere revisión manual y no debe reintentarse sola.
     */
    static async markSettlementFailed(paymentIntentId, errorMessage) {
        const query = `
            UPDATE payments
            SET status = 'failed',
                error_message = $2,
                retry_count = retry_count + 1,
                last_retry_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE payment_intent_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [paymentIntentId, errorMessage]);
        return result.rows[0] || null;
    }

    /**
     * Registra un cobro fiat y lo deja RETENIDO: la orden queda pagada pero sin
     * entregar hasta `holdUntil`. No entrega nada por sí sola.
     *
     * Atómica y condicionada a que la orden no esté ya cobrada ni entregada,
     * para que dos webhooks del proveedor no dupliquen el cobro.
     *
     * @returns {Promise<object|null>} la fila retenida, o null si ya lo estaba
     * @throws error con code '23505' si ese cobro ya acreditó otra orden
     */
    static async holdFiatPayment({ paymentIntentId, providerReference, holdUntil, methodKind }) {
        const query = `
            UPDATE payments
            SET status = 'processing',
                provider_reference = $2,
                hold_until = $3,
                payment_method_kind = $4,
                paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                updated_at = CURRENT_TIMESTAMP
            WHERE payment_intent_id = $1
              AND settled_at IS NULL
              AND provider_reference IS NULL
              AND status NOT IN ('completed', 'refunded')
            RETURNING *;
        `;
        const result = await pool.query(query, [paymentIntentId, providerReference, holdUntil, methodKind]);
        return result.rows[0] || null;
    }

    /**
     * Órdenes cobradas cuyo plazo de retención ya venció y que siguen sin
     * entregar. Excluye las bloqueadas por disputa o reembolso.
     */
    static async findReleasable(limit = 50) {
        const query = `
            SELECT * FROM payments
            WHERE hold_until IS NOT NULL
              AND hold_until <= CURRENT_TIMESTAMP
              AND settled_at IS NULL
              AND settlement_blocked_reason IS NULL
              AND status = 'processing'
            ORDER BY hold_until ASC
            LIMIT $1;
        `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Marca una orden cobrada como NO entregable (disputa, reembolso, revisión).
     * Sólo actúa si aún no se entregó: un contracargo posterior a la entrega ya
     * no se puede parar aquí, se gestiona como pérdida.
     *
     * @returns {Promise<object|null>} la fila bloqueada, o null si ya se entregó
     */
    static async blockSettlement(providerReference, reason) {
        const query = `
            UPDATE payments
            SET settlement_blocked_reason = $2,
                status = 'failed',
                updated_at = CURRENT_TIMESTAMP
            WHERE provider_reference = $1
              AND settled_at IS NULL
            RETURNING *;
        `;
        const result = await pool.query(query, [providerReference, reason]);
        return result.rows[0] || null;
    }

    static async findByProviderReference(providerReference) {
        const result = await pool.query(
            'SELECT * FROM payments WHERE provider_reference = $1', [providerReference]
        );
        return result.rows[0];
    }

    static async findByTxHash(txHash) {
        const result = await pool.query('SELECT * FROM payments WHERE tx_hash = $1', [txHash]);
        return result.rows[0];
    }

    static async getStats(startDate, endDate) {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate || new Date();

        const query = `
            SELECT 
                status as _id,
                COUNT(*) as count,
                SUM(fiat_amount) as total_fiat,
                SUM(bez_amount) as total_bez
            FROM payments
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY status;
        `;
        const result = await pool.query(query, [start, end]);
        return result.rows.map(row => ({
            _id: row._id,
            count: Number(row.count),
            totalFiat: Number(row.total_fiat),
            totalBez: Number(row.total_bez)
        }));
    }
}

module.exports = PaymentPG;
