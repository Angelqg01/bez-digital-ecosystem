'use strict';

/**
 * apiCredits/ledger — libro del saldo prepago de la API, por app.
 *
 *   credit(appId, credits, {kind, ref, meta})   recarga, bono o ajuste
 *   charge(appId, credits, {ref, meta})         cobra un consumo ya producido
 *   reserve(appId, maxCredits, {ref, meta})     retira el máximo de una operación cara
 *   settle(appId, ref, actualCredits, {meta})   cobra el coste real y devuelve el resto
 *   release(appId, ref)                         devuelve la reserva entera
 *   getAccount(appId) / activity(appId)
 *
 * Todo pasa por una única primitiva atómica del almacén, `mover`, que bloquea
 * la cuenta, comprueba la referencia y el saldo, y escribe el movimiento. Dos
 * operaciones simultáneas no pueden dejar el saldo en negativo (lo impide
 * además un CHECK), y una referencia repetida no se aplica dos veces.
 *
 * Hay dos almacenes: Postgres (producción) y memoria (tests), con la misma
 * interfaz, igual que en la facturación del chat.
 */

const SUMAN = new Set(['recharge', 'bonus', 'adjustment', 'refund']);

const entero = (n, nombre) => {
    if (!Number.isInteger(n) || n < 0) throw new Error(`${nombre} debe ser un entero no negativo`);
    return n;
};

// ── Almacén en memoria ───────────────────────────────────────────────────────
function crearAlmacenMemoria() {
    const cuentas = new Map();   // appId -> { balance, lifetime, status }
    const libro = [];            // { id, appId, kind, credits, balanceAfter, ref, meta, at }
    let seq = 0;
    const cuenta = (appId) => {
        if (!cuentas.has(appId)) cuentas.set(appId, { balance: 0, lifetime: 0, status: 'active' });
        return cuentas.get(appId);
    };
    return {
        async mover(appId, delta, { kind, ref = null, meta = {}, parcial = false }) {
            if (ref) {
                const previo = libro.find((m) => m.ref === ref);
                if (previo) return { aplicado: false, duplicado: true, movimiento: previo, balance: cuenta(appId).balance };
            }
            const c = cuenta(appId);
            let d = delta;
            if (d < 0 && c.balance < -d) {
                if (!parcial || c.balance === 0) return { aplicado: false, insuficiente: true, balance: c.balance };
                d = -c.balance;
            }
            if (d < 0 && c.status !== 'active') return { aplicado: false, suspendida: true, balance: c.balance };
            c.balance += d;
            if (kind === 'recharge') c.lifetime += d;
            const movimiento = { id: ++seq, appId, kind, credits: d, balanceAfter: c.balance, ref, meta, at: new Date() };
            libro.push(movimiento);
            return { aplicado: true, movimiento, balance: c.balance };
        },
        async porRef(ref) { return libro.find((m) => m.ref === ref) || null; },
        async cuenta(appId) {
            const c = cuentas.get(appId);
            return c ? { appId, balance: c.balance, lifetime: c.lifetime, status: c.status } : null;
        },
        async actividad(appId, limit) {
            return libro.filter((m) => m.appId === appId).slice(-limit).reverse();
        },
        _cuentas: cuentas, _libro: libro,
    };
}

// ── Almacén Postgres ─────────────────────────────────────────────────────────
function crearAlmacenPg(db) {
    const fila = (r) => r && ({
        id: Number(r.id), appId: r.app_id, kind: r.kind, credits: Number(r.credits),
        balanceAfter: Number(r.balance_after), ref: r.ref, meta: r.meta || {}, at: r.created_at,
    });
    return {
        async mover(appId, delta, { kind, ref = null, meta = {}, parcial = false }) {
            const c = await db.getClient();
            try {
                await c.query('BEGIN');
                await c.query(
                    'INSERT INTO api_credit_accounts (app_id) VALUES ($1) ON CONFLICT (app_id) DO NOTHING', [appId]);
                // Bloqueo de la cuenta hasta el COMMIT: referencia, saldo y movimiento son atómicos.
                const acc = await c.query(
                    'SELECT balance_credits, status FROM api_credit_accounts WHERE app_id = $1 FOR UPDATE', [appId]);
                const balance = Number(acc.rows[0].balance_credits);
                if (ref) {
                    const dup = await c.query('SELECT * FROM api_credit_ledger WHERE ref = $1', [ref]);
                    if (dup.rows.length) {
                        await c.query('ROLLBACK');
                        return { aplicado: false, duplicado: true, movimiento: fila(dup.rows[0]), balance };
                    }
                }
                let d = delta;
                if (d < 0 && balance < -d) {
                    if (!parcial || balance === 0) { await c.query('ROLLBACK'); return { aplicado: false, insuficiente: true, balance }; }
                    d = -balance;
                }
                if (d < 0 && acc.rows[0].status !== 'active') {
                    await c.query('ROLLBACK');
                    return { aplicado: false, suspendida: true, balance };
                }
                const upd = await c.query(
                    `UPDATE api_credit_accounts
                        SET balance_credits = balance_credits + $2,
                            lifetime_recharged = lifetime_recharged + $3,
                            updated_at = NOW()
                      WHERE app_id = $1 RETURNING balance_credits`,
                    [appId, d, kind === 'recharge' ? d : 0]);
                const nuevo = Number(upd.rows[0].balance_credits);
                const ins = await c.query(
                    `INSERT INTO api_credit_ledger (app_id, kind, credits, balance_after, ref, meta)
                     VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING *`,
                    [appId, kind, d, nuevo, ref, JSON.stringify(meta || {})]);
                await c.query('COMMIT');
                return { aplicado: true, movimiento: fila(ins.rows[0]), balance: nuevo };
            } catch (err) {
                await c.query('ROLLBACK').catch(() => {});
                throw err;
            } finally {
                c.release();
            }
        },
        async porRef(ref) {
            const { rows } = await db.query('SELECT * FROM api_credit_ledger WHERE ref = $1', [ref]);
            return fila(rows[0]) || null;
        },
        async cuenta(appId) {
            const { rows } = await db.query(
                'SELECT app_id, balance_credits, lifetime_recharged, status FROM api_credit_accounts WHERE app_id = $1', [appId]);
            const r = rows[0];
            return r ? { appId: r.app_id, balance: Number(r.balance_credits), lifetime: Number(r.lifetime_recharged), status: r.status } : null;
        },
        async actividad(appId, limit) {
            const { rows } = await db.query(
                'SELECT * FROM api_credit_ledger WHERE app_id = $1 ORDER BY id DESC LIMIT $2', [appId, limit]);
            return rows.map(fila);
        },
    };
}

// ── Operaciones ──────────────────────────────────────────────────────────────
function crearLibro(almacen) {
    const refDe = (tipo, appId, ref) => (ref ? `${tipo}:${appId}:${ref}` : null);

    /** Suma saldo. `ref` hace la operación idempotente (p. ej. el id de la sesión de Stripe). */
    async function credit(appId, credits, { kind = 'recharge', ref = null, meta = {} } = {}) {
        if (!SUMAN.has(kind)) throw new Error(`kind no válido: ${kind}`);
        if (entero(credits, 'credits') === 0) throw new Error('credits debe ser mayor que cero');
        const r = await almacen.mover(appId, credits, { kind, ref, meta });
        return { applied: r.aplicado, balance: r.balance };
    }

    /**
     * Cobra un consumo que YA se ha producido. Si el saldo no alcanza cobra lo
     * que quede (el servicio ya se prestó) y devuelve la diferencia en `shortfall`.
     */
    async function charge(appId, credits, { ref = null, meta = {} } = {}) {
        if (entero(credits, 'credits') === 0) return { charged: 0, shortfall: 0, balance: (await getAccount(appId)).balance };
        const r = await almacen.mover(appId, -credits, { kind: 'charge', ref: refDe('charge', appId, ref), meta, parcial: true });
        if (r.duplicado) return { charged: -r.movimiento.credits, shortfall: 0, balance: r.balance, duplicate: true };
        if (!r.aplicado) return { charged: 0, shortfall: credits, balance: r.balance };
        const cobrado = -r.movimiento.credits;
        return { charged: cobrado, shortfall: credits - cobrado, balance: r.balance };
    }

    /** Retira el máximo que puede costar una operación. null si no hay saldo para cubrirlo. */
    async function reserve(appId, maxCredits, { ref, meta = {} } = {}) {
        if (!ref) throw new Error('ref obligatoria');
        if (entero(maxCredits, 'maxCredits') === 0) throw new Error('maxCredits debe ser mayor que cero');
        const r = await almacen.mover(appId, -maxCredits, { kind: 'hold', ref: refDe('hold', appId, ref), meta });
        if (r.duplicado) return { ref, maxCredits: -r.movimiento.credits, reused: true, balance: r.balance };
        if (!r.aplicado) return null;
        return { ref, maxCredits, reused: false, balance: r.balance };
    }

    /** Cobra el coste real de una reserva (tope: lo reservado) y devuelve el resto. Idempotente. */
    async function settle(appId, ref, actualCredits, { meta = {} } = {}) {
        entero(actualCredits, 'actualCredits');
        const hold = await almacen.porRef(refDe('hold', appId, ref));
        if (!hold) throw new Error('Reserva inexistente');
        const max = -hold.credits;
        const cobrado = Math.min(actualCredits, max);
        const r = await almacen.mover(appId, max - cobrado, {
            kind: 'settle', ref: refDe('settle', appId, ref), meta: { ...meta, charged: cobrado, reserved: max },
        });
        if (r.duplicado) return { alreadySettled: true, charged: r.movimiento.meta.charged, balance: r.balance };
        return { charged: cobrado, refunded: max - cobrado, capped: actualCredits > max, balance: r.balance };
    }

    /** Devuelve una reserva entera: la operación no llegó a ejecutarse. */
    const release = (appId, ref) => settle(appId, ref, 0, { meta: { released: true } });

    async function getAccount(appId) {
        const c = await almacen.cuenta(appId);
        return c || { appId, balance: 0, lifetime: 0, status: 'active' };
    }

    async function activity(appId, { limit = 50 } = {}) {
        return almacen.actividad(appId, Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200));
    }

    return { credit, charge, reserve, settle, release, getAccount, activity };
}

module.exports = { crearLibro, crearAlmacenMemoria, crearAlmacenPg };
