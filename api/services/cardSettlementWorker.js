'use strict';

/**
 * cardSettlementWorker — entrega el BEZ de las compras con tarjeta cuando, y
 * sólo cuando, el dinero está en la cuenta de BeZhas.
 *
 *   webhook checkout.session.completed → compra RETENIDA (nada se entrega)
 *     → [barrido] cardFundsVerifier: importe exacto, sin reembolso ni disputa,
 *       autorizado, 3-D Secure, fondos disponibles y abonados en el banco
 *     → intención crypto_transfer desde la tesorería (capa de seguridad):
 *       política, simulación, dos aprobaciones EIP-712 de tesorería
 *     → aprobada: este proceso la ejecuta (firma el tx-signer aislado)
 *     → difundida: la compra pasa a 'completed' con su tx_hash
 *
 * Es la misma regla que BezPay aplica en el Hub (mismo cardFundsVerifier). Las
 * transferencias bancarias confirmadas por el webhook del banco (HMAC) entran
 * directamente en `fondos_confirmados` y siguen el mismo camino. La entrega
 * nunca sale de una clave en este proceso: la antigua vía `mintBezTokens` está
 * apagada (LEGACY_HOT_MINT_ENABLED).
 *
 * Estados de la ficha `entrega` (en la nota de payment_transactions):
 *   retenida → fondos_confirmados → pendiente_aprobacion → entregada
 *   ↳ bloqueada (reembolso/disputa)   ↳ revision_manual   ↳ entrega_rechazada
 */

const { verificarFondosTarjeta } = require('./cardFundsVerifier');
const logger = require('../utils/logger');

const INTERVALO_MS = Number(process.env.CARD_SETTLEMENT_INTERVAL_MS) || 10 * 60 * 1000;
const ESTADOS_ACTIVOS = ['retenida', 'fondos_confirmados', 'pendiente_aprobacion'];

function leerNota(row) {
    try { return row.note ? (typeof row.note === 'string' ? JSON.parse(row.note) : row.note) : {}; } catch { return {}; }
}

function crearLiquidador(inyectadas = {}) {
    const d = {
        query: require('../db/pool').query,
        stripe: null,
        orquestador: () => require('./txOrchestrator').orquestador(),
        verificar: verificarFondosTarjeta,
        notificar: (...a) => require('./providerPaymentLedger').notifyWalletOwner(...a),
        env: process.env,
        ahora: () => new Date(),
        ...inyectadas,
    };
    const env = d.env;
    const cachePayouts = new Map();

    const stripe = () => {
        if (d.stripe) return d.stripe;
        if (!env.STRIPE_SECRET_KEY) return null;
        d.stripe = require('stripe')(env.STRIPE_SECRET_KEY);
        return d.stripe;
    };

    /** App de BeZhas que ordena las entregas desde tesorería (scope treasury). */
    const appTesoreria = () => (env.BEZPAY_TREASURY_APP_ID
        ? { id: env.BEZPAY_TREASURY_APP_ID, scopes: ['treasury', 'wallet'], enterpriseId: null }
        : null);
    const planTesoreria = () => env.BEZPAY_TREASURY_PLAN || 'enterprise_vip';

    async function guardar(row, entrega, cambios = {}) {
        const nota = { ...leerNota(row), entrega: { ...entrega, actualizadaEn: d.ahora().toISOString() } };
        const sets = ['note = $2', 'updated_at = NOW()'];
        const params = [row.id, JSON.stringify(nota)];
        if (cambios.status) { params.push(cambios.status); sets.push(`status = $${params.length}`); }
        if (cambios.txHash) { params.push(cambios.txHash); sets.push(`tx_hash = $${params.length}`); }
        await d.query(`UPDATE payment_transactions SET ${sets.join(', ')} WHERE id = $1`, params);
    }

    async function crearIntencion(row, entrega) {
        const app = appTesoreria();
        if (!app) return { ...entrega, estado: 'fondos_confirmados', ultimoMotivo: 'SIN_APP_TESORERIA' };
        const titular = entrega.fondos?.titular || {};
        const nombre = titular.nombre || entrega.cliente?.nombre || null;
        const pais = titular.pais || entrega.cliente?.pais || null;
        const intento = Number(entrega.intentos || 0);
        const entrada = {
            rail: 'crypto_transfer',
            asset: 'BEZ',
            amount: String(row.amount_bez),
            network: env.BEZPAY_DELIVERY_NETWORK || 'polygon',
            source: { type: 'bezhas_treasury' },
            destination: { type: 'evm_address', value: row.wallet_address, ...(nombre ? { name: String(nombre).slice(0, 140) } : {}) },
            purpose: 'token_purchase',
            reference: `BZ-${entrega.origen === 'banco' ? 'BANK' : 'CARD'}-${row.id}`,
            idempotencyKey: `entrega-${row.id}-${intento}`,
            // Aprobar lleva tiempo humano: el día completo, no los 15 min por defecto.
            expiresInSeconds: 86400,
        };
        if (nombre && /^[A-Z]{2}$/.test(String(pais || ''))) entrada.counterparty = { legalName: String(nombre).slice(0, 140), country: pais };

        const v = await d.orquestador().crearIntencion({ entrada, app, plan: planTesoreria(), canal: 'card-settlement' });
        if (v.estado === 'denied') {
            return { ...entrega, estado: 'entrega_rechazada', intentId: v.id, motivos: v.motivos.map((m) => m.code) };
        }
        return { ...entrega, estado: 'pendiente_aprobacion', intentId: v.id, aprobacionesRequeridas: v.aprobacionesRequeridas };
    }

    async function seguirIntencion(row, entrega) {
        const app = appTesoreria();
        if (!app) return { entrega, cambios: {} };
        const orq = d.orquestador();
        let v = await orq.obtener({ id: entrega.intentId, app });

        if (v.estado === 'approved') {
            // Ya la aprobaron las personas de tesorería: ejecutarla es sólo pedir
            // la firma al tx-signer, que vuelve a comprobarlo todo.
            try {
                v = await orq.ejecutar({ id: v.id, app, plan: planTesoreria() });
            } catch (err) {
                return { entrega: { ...entrega, ultimoMotivo: err.code || 'EJECUCION_FALLIDA' }, cambios: {} };
            }
        }
        if (v.estado === 'broadcast' && v.txHash) {
            return { entrega: { ...entrega, estado: 'entregada', txHash: v.txHash }, cambios: { status: 'completed', txHash: v.txHash } };
        }
        if (v.estado === 'expired') {
            // Nadie aprobó a tiempo: se vuelve a verificar el cobro (pudo haber
            // disputa entretanto) y se crea una intención nueva.
            const siguiente = entrega.origen === 'banco' ? 'fondos_confirmados' : 'retenida';
            return { entrega: { ...entrega, estado: siguiente, intentos: Number(entrega.intentos || 0) + 1, intentId: null }, cambios: {} };
        }
        if (['rejected', 'denied'].includes(v.estado)) {
            return { entrega: { ...entrega, estado: 'entrega_rechazada' }, cambios: { status: 'failed' } };
        }
        if (v.estado === 'failed_needs_review') {
            return { entrega: { ...entrega, estado: 'revision_manual', ultimoMotivo: 'EJECUCION_REVISAR' }, cambios: {} };
        }
        return { entrega, cambios: {} };
    }

    async function procesar(row) {
        const nota = leerNota(row);
        let entrega = nota.entrega;
        if (!entrega || !ESTADOS_ACTIVOS.includes(entrega.estado)) return 'omitida';

        // Transferencia bancaria: el HMAC del banco ya confirmó el ingreso y una
        // SEPA no se revierte sin nuestro consentimiento; no hay Stripe que mirar.
        const deBanco = entrega.origen === 'banco';
        if (!deBanco && (entrega.estado === 'retenida' || entrega.estado === 'pendiente_aprobacion')) {
            // En `pendiente_aprobacion` se vuelve a mirar el cobro: una disputa
            // o un reembolso durante la aprobación cancelan la entrega.
            const r = await d.verificar({
                stripe: stripe(),
                referencia: entrega.referencia,
                esperado: { importe: entrega.importeMinor, moneda: entrega.moneda },
                ahora: d.ahora(),
                retencionHoras: Number(env.CARD_HOLD_HOURS) || 72,
                exigirAbonoBancario: env.CARD_REQUIRE_BANK_PAYOUT !== 'false',
                exigir3ds: env.CARD_REQUIRE_3DS !== 'false',
                cachePayouts,
            }).catch((err) => ({ ok: false, reintentable: true, motivo: 'STRIPE_NO_RESPONDE', detalles: { error: err.message } }));

            if (!r.ok) {
                if (r.bloquear || r.revisionManual) {
                    if (entrega.intentId) {
                        await d.orquestador().cancelar({ id: entrega.intentId, app: appTesoreria(), motivo: r.motivo }).catch(() => {});
                    }
                    const estado = r.bloquear ? 'bloqueada' : 'revision_manual';
                    await guardar(row, { ...entrega, estado, motivo: r.motivo, detalles: r.detalles }, r.bloquear ? { status: 'failed' } : {});
                    logger.warn({ paymentId: row.id, motivo: r.motivo }, `Entrega con tarjeta ${estado}`);
                    return estado;
                }
                if (entrega.estado === 'retenida') {
                    await guardar(row, { ...entrega, ultimoMotivo: r.motivo, ultimaComprobacion: d.ahora().toISOString() });
                    return 'esperando';
                }
                // pendiente_aprobacion con el cobro aún en pie pero ahora sin
                // poder confirmarlo del todo (p. ej. Stripe no responde): seguir.
            } else if (entrega.estado === 'retenida') {
                entrega = { ...entrega, estado: 'fondos_confirmados', fondos: r.detalles, confirmadosEn: d.ahora().toISOString() };
            }
        }

        if (entrega.estado === 'fondos_confirmados') {
            entrega = await crearIntencion(row, entrega);
            await guardar(row, entrega, entrega.estado === 'entrega_rechazada' ? { status: 'failed' } : {});
            if (entrega.estado === 'pendiente_aprobacion') {
                logger.info({ paymentId: row.id, intentId: entrega.intentId }, 'Fondos confirmados: entrega pendiente de aprobación de tesorería');
            }
            return entrega.estado;
        }

        if (entrega.estado === 'pendiente_aprobacion' && entrega.intentId) {
            const { entrega: nueva, cambios } = await seguirIntencion(row, entrega);
            await guardar(row, nueva, cambios);
            if (nueva.estado === 'entregada') {
                await d.notificar({
                    walletAddress: row.wallet_address, type: 'transaction', title: 'Compra de BEZ completada',
                    message: `Se han acreditado ${row.amount_bez} BEZ en tu wallet.`, metadata: { txHash: nueva.txHash, paymentId: row.id },
                }).catch(() => {});
            }
            return nueva.estado;
        }
        return entrega.estado;
    }

    async function barrer({ limite = 25 } = {}) {
        const { rows } = await d.query(
            `SELECT id, wallet_address, amount_bez, note, status
               FROM payment_transactions
              WHERE type = 'buy' AND status = 'processing'
                AND ((provider = 'stripe' AND payment_method = 'card') OR (provider = 'bank' AND payment_method = 'bank'))
                AND note LIKE '%"entrega"%'
              ORDER BY id ASC
              LIMIT $1`,
            [limite]
        );
        const resumen = {};
        for (const row of rows) {
            try {
                const r = await procesar(row);
                resumen[r] = (resumen[r] || 0) + 1;
            } catch (err) {
                resumen.error = (resumen.error || 0) + 1;
                logger.error({ paymentId: row.id, error: err.message }, 'Liquidación con tarjeta: fallo al procesar');
            }
        }
        return resumen;
    }

    /** Disputa o reembolso por webhook: bloquea si aún no se entregó. */
    async function bloquearPorReferencia(referencia, motivo) {
        if (!referencia) return { bloqueada: false, encontrada: false };
        const { rows } = await d.query(
            `SELECT id, wallet_address, amount_bez, note, status FROM payment_transactions
              WHERE provider IN ('stripe', 'bank') AND provider_charge_id = $1 AND type = 'buy'
              ORDER BY id DESC LIMIT 1`,
            [referencia]
        );
        const row = rows[0];
        const entrega = row ? leerNota(row).entrega : null;
        if (!row || !entrega) return { bloqueada: false, encontrada: Boolean(row) };
        if (!ESTADOS_ACTIVOS.includes(entrega.estado) && entrega.estado !== 'revision_manual') {
            if (entrega.estado === 'entregada') {
                logger.error({ paymentId: row.id, motivo }, 'Disputa o reembolso sobre BEZ YA entregado: pérdida a gestionar a mano');
            }
            return { bloqueada: false, encontrada: true, estado: entrega.estado };
        }
        if (entrega.intentId && appTesoreria()) {
            await d.orquestador().cancelar({ id: entrega.intentId, app: appTesoreria(), motivo }).catch(() => {});
        }
        await guardar(row, { ...entrega, estado: 'bloqueada', motivo }, { status: 'failed' });
        return { bloqueada: true, encontrada: true };
    }

    let temporizador = null;
    function iniciar() {
        if (temporizador) return false;
        temporizador = setInterval(() => {
            barrer().catch((err) => logger.error({ error: err.message }, 'Liquidación con tarjeta: barrido fallido'));
        }, INTERVALO_MS);
        temporizador.unref?.();
        return true;
    }
    function detener() { if (temporizador) clearInterval(temporizador); temporizador = null; }

    return { barrer, procesar, bloquearPorReferencia, iniciar, detener };
}

let porDefecto = null;
const liquidador = () => { porDefecto = porDefecto || crearLiquidador(); return porDefecto; };

module.exports = {
    crearLiquidador,
    liquidador,
    bloquearPorReferencia: (ref, motivo) => liquidador().bloquearPorReferencia(ref, motivo),
    iniciar: () => liquidador().iniciar(),
};
