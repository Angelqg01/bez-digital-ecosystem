const pool = require('../../db/pool');

const num = (v) => (v == null ? 0 : Number(v));

/**
 * Saldo publicitario del usuario (migración 023). Sustituye a models/adBalance.model.js (Mongoose).
 *
 * Todas las operaciones que cambian dinero son UNA sentencia SQL atómica (o una transacción): nunca leer-modificar-guardar,
 * que es como se perdían abonos y se podía gastar el mismo saldo dos veces con peticiones simultáneas.
 * Los saldos viven en su moneda: `fiatBalance` en EUR y `bezBalance` en BEZ. Para sumarlos hace falta el precio BEZ/EUR.
 */
class AdBalancePG {
    static hydrate(r) {
        if (!r) return null;
        return {
            _id: r.id, id: r.id, userId: r.user_id, walletAddress: r.wallet_address,
            fiatBalance: num(r.fiat_balance), bezBalance: num(r.bez_balance),
            totalDeposited: num(r.total_deposited), totalSpent: num(r.total_spent), totalRefunded: num(r.total_refunded),
            pendingCharges: num(r.pending_charges), lastDepositAt: r.last_deposit_at, lastChargeAt: r.last_charge_at,
            createdAt: r.created_at, updatedAt: r.updated_at,
        };
    }

    /** Saldo disponible en EUR: fiat + BEZ convertido al precio dado. */
    static availableEur(balance, bezEurPrice) {
        return balance.fiatBalance + balance.bezBalance * (Number.isFinite(bezEurPrice) && bezEurPrice > 0 ? bezEurPrice : 0);
    }

    /** Devuelve el saldo del usuario, creándolo a cero la primera vez (idempotente y sin carrera). */
    static async ensure(userId, walletAddress, db = pool) {
        await db.query('INSERT INTO ad_balances (user_id, wallet_address) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, walletAddress]);
        const { rows } = await db.query('SELECT * FROM ad_balances WHERE user_id = $1', [userId]);
        return AdBalancePG.hydrate(rows[0]);
    }

    static async findByUserId(userId) {
        const { rows } = await pool.query('SELECT * FROM ad_balances WHERE user_id = $1', [userId]);
        return AdBalancePG.hydrate(rows[0]);
    }

    /**
     * Abona un depósito: suma a fiat y/o BEZ y a `total_deposited` (en EUR). Crea el saldo si no existe. Acepta un cliente de
     * transacción para hacerlo en la misma transacción que marca la recarga como completada.
     */
    static async credit(userId, walletAddress, { fiat = 0, bez = 0, depositedEur = 0 }, db = pool) {
        if (!(fiat >= 0 && bez >= 0 && depositedEur >= 0) || (fiat === 0 && bez === 0)) throw new Error('Abono inválido');
        // Primero se garantiza la fila: `ON CONFLICT DO NOTHING` sin destino cubre CUALQUIER índice único (user_id y wallet), así
        // dos primeros abonos simultáneos no chocan; después el abono es un UPDATE atómico sobre la fila.
        await db.query('INSERT INTO ad_balances (user_id, wallet_address) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, walletAddress]);
        const { rows } = await db.query(
            `UPDATE ad_balances SET
                 fiat_balance = fiat_balance + $2, bez_balance = bez_balance + $3, total_deposited = total_deposited + $4,
                 last_deposit_at = NOW(), updated_at = NOW()
              WHERE user_id = $1 RETURNING *`, [userId, fiat, bez, depositedEur]);
        return AdBalancePG.hydrate(rows[0]);
    }

    /**
     * Cobra `amountEur`: primero del saldo fiat y el resto de BEZ al precio dado. ATÓMICO y sin saldo negativo: si no alcanza no
     * se descuenta nada y devuelve null. (Antes, deductBalance modificaba el documento en memoria y lo guardaba después.)
     */
    static async deduct(userId, amountEur, bezEurPrice) {
        if (!(amountEur > 0)) throw new Error('Importe inválido');
        const precio = Number.isFinite(bezEurPrice) && bezEurPrice > 0 ? bezEurPrice : 0;
        const { rows } = await pool.query(
            `UPDATE ad_balances SET
                 fiat_balance = fiat_balance - LEAST(fiat_balance, $2::numeric),
                 bez_balance = GREATEST(0, bez_balance - CASE WHEN $3::numeric > 0 THEN (($2::numeric - LEAST(fiat_balance, $2::numeric)) / $3::numeric) ELSE 0 END),
                 total_spent = total_spent + $2::numeric, last_charge_at = NOW(), updated_at = NOW()
              WHERE user_id = $1 AND fiat_balance + bez_balance * $3::numeric >= $2::numeric
              RETURNING *`, [userId, amountEur, precio]);
        return AdBalancePG.hydrate(rows[0]);
    }
}

module.exports = AdBalancePG;
