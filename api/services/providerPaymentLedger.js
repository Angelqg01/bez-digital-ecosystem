'use strict';

/**
 * Libro mayor de los pagos cobrados por un proveedor externo (Stripe, banco).
 *
 * Hasta la migración 034 el flujo de Stripe minteaba BEZ contra la cadena sin
 * dejar rastro en payment_transactions. Eso dejaba tres agujeros:
 *
 *   · un pago con tarjeta no salía en el histórico del usuario;
 *   · `payment_intent.payment_failed` no tenía ninguna orden que marcar;
 *   · `charge.refunded` no podía llamar a refundPayment() porque no había forma
 *     de resolver un cargo de Stripe a un paymentId.
 *
 * Este servicio es la pieza que faltaba. No reimplementa el reembolso: para eso
 * ya está refundPayment() en paymentSettlement.js, que además emite el webhook
 * payment.refunded. Aquí sólo se registra y se resuelve.
 */

const { query } = require('../db/pool');

/** Las filas del mock de DB de los tests llegan como `{}`: sin id no hay fila. */
const realRow = (rows) => {
    const row = rows && rows[0];
    return row && row.id ? row : null;
};

/**
 * Registra una compra ya cobrada y minteada.
 *
 * Idempotente por (provider, provider_event_id): Stripe reenvía el mismo evento
 * hasta recibir un 2xx y el guard en memoria de webhooks.js no sobrevive a un
 * redespliegue, así que la garantía tiene que estar en la base de datos.
 */
async function recordCompletedPurchase({
    provider = 'stripe',
    eventId,
    chargeId = null,
    walletAddress,
    amountUsd,
    amountBez = null,
    txHash = null,
    note = null,
}) {
    if (!eventId || !walletAddress) {
        throw new Error('recordCompletedPurchase requiere eventId y walletAddress');
    }

    const { rows } = await query(
        `INSERT INTO payment_transactions
             (wallet_address, amount_usd, amount_bez, payment_method, type, status,
              note, tx_hash, provider, provider_event_id, provider_charge_id)
         VALUES ($1, $2, $3, $4, 'buy', 'completed', $5, $6, $4, $7, $8)
         ON CONFLICT (provider, provider_event_id)
             WHERE provider_event_id IS NOT NULL
             DO UPDATE SET tx_hash = COALESCE(payment_transactions.tx_hash, EXCLUDED.tx_hash),
                           updated_at = NOW()
         RETURNING id, status, wallet_address`,
        [walletAddress, amountUsd, amountBez, provider,
            note ? JSON.stringify(note) : null, txHash, eventId, chargeId]
    );

    return realRow(rows);
}

/**
 * Registra un intento de cobro fallido.
 *
 * Se guarda como orden en estado 'failed' en lugar de descartarse: un pago que
 * el banco rechaza es información que el usuario y soporte necesitan ver, y
 * hasta ahora sólo quedaba en una línea de log.
 */
async function recordFailedPurchase({
    provider = 'stripe',
    eventId,
    chargeId = null,
    walletAddress,
    amountUsd = null,
    reason = null,
}) {
    if (!eventId) throw new Error('recordFailedPurchase requiere eventId');

    const { rows } = await query(
        `INSERT INTO payment_transactions
             (wallet_address, amount_usd, payment_method, type, status, note,
              provider, provider_event_id, provider_charge_id)
         VALUES ($1, $2, $3, 'buy', 'failed', $4, $3, $5, $6)
         ON CONFLICT (provider, provider_event_id)
             WHERE provider_event_id IS NOT NULL
             DO UPDATE SET status = 'failed',
                           note = EXCLUDED.note,
                           updated_at = NOW()
         RETURNING id, status`,
        [walletAddress || 'unknown', amountUsd, provider,
            JSON.stringify({ failure: { reason, at: new Date().toISOString() } }),
            eventId, chargeId]
    );

    return realRow(rows);
}

/** Resuelve un cargo del proveedor a la orden del libro mayor. */
async function findByChargeId(chargeId, provider = 'stripe') {
    if (!chargeId) return null;

    const { rows } = await query(
        `SELECT id, wallet_address, amount_usd, amount_bez, status
           FROM payment_transactions
          WHERE provider = $1 AND provider_charge_id = $2
          ORDER BY id DESC
          LIMIT 1`,
        [provider, chargeId]
    );

    return realRow(rows);
}

/**
 * Deja una notificación en la bandeja del usuario dueño de la wallet.
 *
 * Devuelve false —sin lanzar— si la wallet no corresponde a ningún usuario
 * registrado: un pago puede venir de una wallet que aún no tiene cuenta, y eso
 * no debe tumbar el procesamiento del webhook.
 */
async function notifyWalletOwner({ walletAddress, type, title, message, metadata = null }) {
    if (!walletAddress) return false;

    const { rows } = await query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         SELECT u.id, $2, $3, $4, $5
           FROM users u
          WHERE LOWER(u.wallet_address) = LOWER($1)
         RETURNING id`,
        [walletAddress, type, title, message, metadata ? JSON.stringify(metadata) : null]
    );

    return Boolean(rows && rows.length > 0);
}

module.exports = {
    recordCompletedPurchase,
    recordFailedPurchase,
    findByChargeId,
    notifyWalletOwner,
};
