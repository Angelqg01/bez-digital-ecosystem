'use strict';

/**
 * Cola de reintentos persistente para los webhooks de pago.
 *
 * Sustituye a la cola en memoria de routes/webhooks.js ([REL-3], rotulada allí
 * como "stub BullMQ"). Aquella guardaba los minteos fallidos en un array del
 * proceso, de modo que un redespliegue de Cloud Run perdía sin ruido los pagos
 * ya cobrados a los que todavía no se les había entregado el BEZ: el cliente
 * había pagado y nadie volvía a intentarlo nunca.
 *
 * Aquí el estado vive en Postgres (migración 034). No se introduce BullMQ ni
 * Redis: la cola necesita sobrevivir al reinicio, y eso ya lo hace Postgres. El
 * reparto entre instancias se resuelve con FOR UPDATE SKIP LOCKED, así que dos
 * réplicas de Cloud Run nunca cogen el mismo trabajo.
 */

const { query } = require('../db/pool');

const DEFAULT_MAX_ATTEMPTS = Number(process.env.WEBHOOK_RETRY_MAX_ATTEMPTS || 5);
const BASE_DELAY_MS = Number(process.env.WEBHOOK_RETRY_BASE_DELAY_MS || 2000);
const TICK_MS = Number(process.env.WEBHOOK_RETRY_TICK_MS || 15000);

/** Handlers por tipo de trabajo. El de 'mint' lo registra routes/webhooks.js. */
const handlers = new Map();

let timer = null;
let ticking = false;

function registerHandler(kind, fn) {
    handlers.set(kind, fn);
}

/** Backoff exponencial: 2s, 4s, 8s, 16s… Igual que la cola anterior. */
function backoffMs(attempt) {
    return BASE_DELAY_MS * 2 ** attempt;
}

/**
 * Encola un trabajo. Idempotente por (kind, event_id): si Stripe reenvía el
 * mismo evento no se duplica el reintento, sólo se refresca el error.
 */
async function enqueue({
    kind = 'mint',
    eventId,
    walletAddress,
    amountUsdCents,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    lastError = null,
}) {
    if (!eventId || !walletAddress) {
        throw new Error('enqueue requiere eventId y walletAddress');
    }

    const { rows } = await query(
        `INSERT INTO webhook_retry_jobs
             (kind, event_id, wallet_address, amount_usd_cents, max_attempts,
              next_attempt_at, last_error)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' milliseconds')::interval, $7)
         ON CONFLICT (kind, event_id) DO UPDATE
             SET last_error = EXCLUDED.last_error,
                 updated_at = NOW()
         RETURNING id, attempt, status`,
        [kind, eventId, walletAddress, String(amountUsdCents), maxAttempts,
            String(backoffMs(0)), lastError]
    );

    return rows[0] || null;
}

/**
 * Reclama un trabajo vencido y lo marca 'running' en la misma transacción.
 * SKIP LOCKED es lo que permite que varias instancias tiren de la cola a la vez.
 */
async function claimNextDueJob() {
    const { rows } = await query(
        `UPDATE webhook_retry_jobs
            SET status = 'running', updated_at = NOW()
          WHERE id = (
              SELECT id FROM webhook_retry_jobs
               WHERE status = 'pending' AND next_attempt_at <= NOW()
               ORDER BY next_attempt_at
               FOR UPDATE SKIP LOCKED
               LIMIT 1
          )
      RETURNING id, kind, event_id, wallet_address, amount_usd_cents,
                attempt, max_attempts`
    );

    const job = rows[0];
    // El mock de DB de los tests devuelve `{ rows: [{}] }`: sin id no hay trabajo.
    return job && job.id ? job : null;
}

async function markSucceeded(job, txHash) {
    await query(
        `UPDATE webhook_retry_jobs
            SET status = 'succeeded', result_tx_hash = $2, last_error = NULL,
                attempt = attempt + 1, updated_at = NOW()
          WHERE id = $1`,
        [job.id, txHash || null]
    );
}

/**
 * Devuelve el trabajo a 'pending' con el siguiente backoff, o lo agota.
 * Un trabajo agotado NO se borra: es un pago cobrado sin entregar y tiene que
 * quedar visible para reconciliarlo a mano.
 */
async function markFailed(job, error) {
    const attempt = Number(job.attempt) + 1;
    const exhausted = attempt >= Number(job.max_attempts);

    await query(
        `UPDATE webhook_retry_jobs
            SET attempt = $2,
                status = $3,
                last_error = $4,
                next_attempt_at = NOW() + ($5 || ' milliseconds')::interval,
                updated_at = NOW()
          WHERE id = $1`,
        [job.id, attempt, exhausted ? 'exhausted' : 'pending',
            String(error && error.message ? error.message : error).slice(0, 2000),
            String(backoffMs(attempt))]
    );

    return { attempt, exhausted };
}

/**
 * Procesa todos los trabajos vencidos. Devuelve un resumen para que quien lo
 * llame (el tick o un test) pueda comprobar qué ha pasado sin leer la tabla.
 */
async function processDueJobs({ limit = 25 } = {}) {
    const summary = { processed: 0, succeeded: 0, retried: 0, exhausted: 0 };

    for (let i = 0; i < limit; i++) {
        const job = await claimNextDueJob();
        if (!job) break;

        summary.processed++;
        const handler = handlers.get(job.kind);

        if (!handler) {
            await markFailed(job, new Error(`Sin handler registrado para "${job.kind}"`));
            summary.retried++;
            continue;
        }

        try {
            const result = await handler({
                walletAddress: job.wallet_address,
                amountUsdCents: Number(job.amount_usd_cents),
                eventId: job.event_id,
            });
            await markSucceeded(job, result && result.txHash);
            summary.succeeded++;
        } catch (err) {
            const { exhausted } = await markFailed(job, err);
            if (exhausted) summary.exhausted++;
            else summary.retried++;
        }
    }

    return summary;
}

function start({ intervalMs = TICK_MS } = {}) {
    if (timer) return timer;

    timer = setInterval(async () => {
        if (ticking) return;
        ticking = true;
        try {
            await processDueJobs();
        } catch {
            // Un fallo de la propia cola no debe tumbar el proceso: el siguiente
            // tick lo reintenta y los trabajos siguen en la tabla.
        } finally {
            ticking = false;
        }
    }, intervalMs);

    // No mantener vivo el event loop sólo por la cola.
    if (typeof timer.unref === 'function') timer.unref();
    return timer;
}

function stop() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

module.exports = {
    enqueue,
    registerHandler,
    processDueJobs,
    claimNextDueJob,
    start,
    stop,
    backoffMs,
    DEFAULT_MAX_ATTEMPTS,
};
