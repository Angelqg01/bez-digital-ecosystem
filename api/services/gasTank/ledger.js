'use strict';

/**
 * gasTank/ledger — saldo prepago por organización.
 *
 *   ensureAccount(orgId)                  crea la cuenta si no existe
 *   getBalance(orgId)                     saldo disponible + reservado en vuelo
 *   credit(orgId, credits, {...})         recarga/bono/ajuste; idempotente por externalRef
 *   reserve(orgId, maxCredits, {opHash})  retira el máximo de una operación; null si no hay saldo
 *   settle(opHash, actualCredits, {...})  cobra el coste real y devuelve el resto
 *   release(opHash)                       devuelve una reserva entera (operación no enviada/caducada)
 *   releaseExpired()                      libera las reservas vencidas
 *   activity(orgId, {limit, before})      libro de movimientos
 *
 * Todo ocurre dentro de una transacción con el saldo bloqueado por UPDATE: dos
 * reservas simultáneas nunca dejan el saldo en negativo (además lo impide un CHECK).
 */

const db = require('../../db/pool');

async function tx(fn) {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const out = await fn(client);
        await client.query('COMMIT');
        return out;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

async function ensureAccount(orgId) {
    await db.query(
        `INSERT INTO gas_tank_accounts (organization_id) VALUES ($1) ON CONFLICT (organization_id) DO NOTHING`,
        [orgId]
    );
}

async function getBalance(orgId) {
    await ensureAccount(orgId);
    const { rows } = await db.query(
        `SELECT a.status, a.balance_credits::bigint AS balance, a.auto_recharge_enabled, a.threshold_credits::bigint AS threshold,
                a.recharge_credits::bigint AS recharge, a.monthly_cap_credits::bigint AS monthly_cap, a.last_auto_error,
                COALESCE((SELECT SUM(max_cost_credits) FROM gas_tank_reservations
                           WHERE organization_id = a.organization_id AND status = 'reserved'), 0)::bigint AS reserved
           FROM gas_tank_accounts a WHERE a.organization_id = $1`,
        [orgId]
    );
    const r = rows[0];
    return {
        status: r.status,
        balanceCredits: Number(r.balance),
        reservedCredits: Number(r.reserved),
        autoRecharge: { enabled: r.auto_recharge_enabled, thresholdCredits: Number(r.threshold), rechargeCredits: Number(r.recharge) },
        monthlyCapCredits: r.monthly_cap == null ? null : Number(r.monthly_cap),
        lastAutoError: r.last_auto_error || null,
    };
}

/** Suma créditos al saldo. Devuelve { applied, balance }; applied=false si externalRef ya estaba. */
async function credit(orgId, credits, { kind = 'recharge', externalRef = null, appId = null, userRef = null } = {}) {
    if (!Number.isInteger(credits) || credits <= 0) throw new Error('credits debe ser un entero positivo');
    if (!['recharge', 'bonus', 'adjustment', 'refund'].includes(kind)) throw new Error(`kind no válido: ${kind}`);
    await ensureAccount(orgId);
    return tx(async (c) => {
        if (externalRef) {
            const dup = await c.query('SELECT 1 FROM gas_tank_ledger WHERE external_ref = $1', [externalRef]);
            if (dup.rows.length) {
                const b = await c.query('SELECT balance_credits FROM gas_tank_accounts WHERE organization_id = $1', [orgId]);
                return { applied: false, balance: Number(b.rows[0].balance_credits) };
            }
        }
        const upd = await c.query(
            `UPDATE gas_tank_accounts SET balance_credits = balance_credits + $2, updated_at = NOW()
              WHERE organization_id = $1 RETURNING balance_credits`,
            [orgId, credits]
        );
        const balance = Number(upd.rows[0].balance_credits);
        await c.query(
            `INSERT INTO gas_tank_ledger (organization_id, kind, credits, balance_after, external_ref, app_id, user_ref)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [orgId, kind, credits, balance, externalRef, appId, userRef]
        );
        return { applied: true, balance };
    });
}

/** Reserva el coste máximo de una operación. Devuelve null si la cuenta no puede cubrirla. */
async function reserve(orgId, maxCredits, { opHash, appId = null, sender = null, ttlSeconds = 600 } = {}) {
    if (!opHash) throw new Error('opHash obligatorio');
    if (!Number.isInteger(maxCredits) || maxCredits <= 0) throw new Error('maxCredits debe ser un entero positivo');
    await ensureAccount(orgId);
    return tx(async (c) => {
        const prev = await c.query('SELECT organization_id, max_cost_credits, status FROM gas_tank_reservations WHERE op_hash = $1', [opHash]);
        if (prev.rows.length) {
            const p = prev.rows[0];
            if (p.organization_id !== orgId) throw new Error('opHash ya usado por otra organización');
            return { opHash, maxCredits: Number(p.max_cost_credits), status: p.status, reused: true };
        }
        const upd = await c.query(
            `UPDATE gas_tank_accounts SET balance_credits = balance_credits - $2, updated_at = NOW()
              WHERE organization_id = $1 AND status = 'active' AND balance_credits >= $2
              RETURNING balance_credits`,
            [orgId, maxCredits]
        );
        if (!upd.rows.length) return null;
        await c.query(
            `INSERT INTO gas_tank_reservations (op_hash, organization_id, app_id, sender, max_cost_credits, valid_until)
             VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' seconds')::interval)`,
            [opHash, orgId, appId, sender, maxCredits, String(ttlSeconds)]
        );
        return { opHash, maxCredits, status: 'reserved', reused: false };
    });
}

/** Cobra el coste real (tope: lo reservado) y devuelve la diferencia. Idempotente. */
async function settle(opHash, actualCredits, { txHash = null, chainId = null, userRef = null, opType = null, gasUsed = null } = {}) {
    if (!Number.isInteger(actualCredits) || actualCredits <= 0) throw new Error('actualCredits debe ser un entero positivo');
    return tx(async (c) => {
        const r = await c.query('SELECT * FROM gas_tank_reservations WHERE op_hash = $1 FOR UPDATE', [opHash]);
        if (!r.rows.length) throw new Error('Reserva inexistente');
        const res = r.rows[0];
        if (res.status === 'settled') return { alreadySettled: true };
        if (res.status === 'released') throw new Error('La reserva ya fue liberada');
        const max = Number(res.max_cost_credits);
        const charge = Math.min(actualCredits, max);
        const back = max - charge;
        const upd = await c.query(
            `UPDATE gas_tank_accounts SET balance_credits = balance_credits + $2, updated_at = NOW()
              WHERE organization_id = $1 RETURNING balance_credits`,
            [res.organization_id, back]
        );
        await c.query(
            `INSERT INTO gas_tank_ledger (organization_id, kind, credits, balance_after, op_hash, tx_hash, chain_id, app_id, user_ref, op_type, gas_used)
             VALUES ($1, 'charge', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [res.organization_id, -charge, Number(upd.rows[0].balance_credits), opHash, txHash, chainId, res.app_id, userRef, opType, gasUsed]
        );
        await c.query(`UPDATE gas_tank_reservations SET status = 'settled', updated_at = NOW() WHERE op_hash = $1`, [opHash]);
        return { charged: charge, refunded: back, capped: actualCredits > max };
    });
}

async function release(opHash) {
    return tx(async (c) => {
        const r = await c.query('SELECT * FROM gas_tank_reservations WHERE op_hash = $1 FOR UPDATE', [opHash]);
        if (!r.rows.length || r.rows[0].status !== 'reserved') return { released: false };
        const res = r.rows[0];
        await c.query(
            `UPDATE gas_tank_accounts SET balance_credits = balance_credits + $2, updated_at = NOW() WHERE organization_id = $1`,
            [res.organization_id, Number(res.max_cost_credits)]
        );
        await c.query(`UPDATE gas_tank_reservations SET status = 'released', updated_at = NOW() WHERE op_hash = $1`, [opHash]);
        return { released: true, credits: Number(res.max_cost_credits) };
    });
}

async function releaseExpired() {
    const { rows } = await db.query(`SELECT op_hash FROM gas_tank_reservations WHERE status = 'reserved' AND valid_until < NOW() LIMIT 200`);
    let n = 0;
    for (const r of rows) if ((await release(r.op_hash)).released) n += 1;
    return n;
}

async function activity(orgId, { limit = 50, before = null } = {}) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const { rows } = await db.query(
        `SELECT id, kind, credits::bigint AS credits, balance_after::bigint AS balance_after, op_hash, tx_hash, chain_id,
                app_id, op_type, gas_used, external_ref, created_at
           FROM gas_tank_ledger
          WHERE organization_id = $1 AND ($2::timestamptz IS NULL OR created_at < $2)
          ORDER BY created_at DESC LIMIT $3`,
        [orgId, before, lim]
    );
    return rows.map((r) => ({ ...r, credits: Number(r.credits), balance_after: Number(r.balance_after) }));
}

module.exports = { ensureAccount, getBalance, credit, reserve, settle, release, releaseExpired, activity };
