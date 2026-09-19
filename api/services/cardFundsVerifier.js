'use strict';

/**
 * cardFundsVerifier — ¿se puede entregar BEZ por este pago con tarjeta?
 *
 * ESTE FICHERO ES IDÉNTICO en api/services/ y en
 * App-nativas/Bezhas-Hub/backend/services/. Las dos vías de venta con tarjeta
 * (Payment Links → API, BezPay → Hub) aplican la MISMA regla, y un test falla si
 * las dos copias divergen. No tiene `require`: recibe el cliente de Stripe.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA REGLA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Entregar BEZ es irreversible; un cobro con tarjeta no. Sólo se entrega cuando
 * el dinero está, de verdad, en la cuenta de BeZhas:
 *
 *   1. El PaymentIntent está cobrado y el importe y la moneda son EXACTAMENTE
 *      los de la orden. Ni un céntimo menos, ni otra divisa.
 *   2. El cargo sigue en pie: sin reembolso (ni parcial) y sin disputa.
 *   3. El emisor lo autorizó y Stripe Radar no lo marca como riesgo elevado.
 *   4. La tarjeta se autenticó con 3-D Secure (o Apple Pay / Google Pay): es lo
 *      que traslada al emisor la responsabilidad de un fraude.
 *   5. Ha pasado la retención mínima del medio de pago.
 *   6. Los fondos están DISPONIBLES en el saldo de Stripe (la tarjeta tenía el
 *      dinero y se liquidó; `pending` no basta).
 *   7. Esos fondos han llegado a la cuenta bancaria de BeZhas: el movimiento
 *      está dentro de un payout de Stripe en estado `paid`.
 *
 * Tres tipos de «no»:
 *   bloquear        no se entregará nunca (reembolso, disputa, cancelado).
 *   revisionManual  lo decide una persona (importe distinto, riesgo, sin 3DS).
 *   reintentable    todavía no (fondos pendientes, en camino al banco…).
 *
 * Un error al consultar Stripe NO es un sí: lo trata quien llama como
 * reintentable. Nunca se entrega sin haber podido comprobar.
 */

const MOTIVOS_BLOQUEO = new Set(['REEMBOLSADO', 'DISPUTADO', 'PAGO_CANCELADO']);
const MOTIVOS_REVISION = new Set([
    'IMPORTE_NO_COINCIDE', 'MONEDA_NO_COINCIDE', 'NO_AUTORIZADO', 'RIESGO_ELEVADO', 'SIN_3DS', 'REFERENCIA_NO_VALIDA',
]);
const CARTERAS_AUTENTICADAS = new Set(['apple_pay', 'google_pay']);
const MAX_PAYOUTS = 30;
const MAX_MOVIMIENTOS_POR_PAYOUT = 5000;

function no(motivo, detalles) {
    const bloquear = MOTIVOS_BLOQUEO.has(motivo);
    const revisionManual = MOTIVOS_REVISION.has(motivo);
    return { ok: false, motivo, bloquear, revisionManual, reintentable: !bloquear && !revisionManual, detalles: detalles || null };
}

const idDe = (v) => (v && typeof v === 'object' ? v.id : v);

/** Paginación manual: funciona igual con el SDK real y con un doble de pruebas. */
async function listarTodo(listar, parametros, maximo) {
    const todos = [];
    let desde;
    for (;;) {
        const pagina = await listar({ ...parametros, limit: 100, ...(desde ? { starting_after: desde } : {}) });
        const datos = pagina?.data || [];
        todos.push(...datos);
        if (!pagina?.has_more || !datos.length || todos.length >= maximo) break;
        desde = datos[datos.length - 1].id;
    }
    return todos;
}

/**
 * Payout pagado que contiene el movimiento `balanceTxId`, o null.
 * `cache` (Map payoutId → Set de movimientos) evita releer payouts ya vistos.
 */
async function payoutPagadoQueContiene(stripe, balanceTxId, disponibleDesde, cache) {
    const payouts = await stripe.payouts.list({
        status: 'paid',
        created: { gte: Math.max(0, Number(disponibleDesde || 0) - 86400) },
        limit: MAX_PAYOUTS,
    });
    for (const po of payouts?.data || []) {
        let ids = cache ? cache.get(po.id) : null;
        if (!ids) {
            const movs = await listarTodo((q) => stripe.balanceTransactions.list(q), { payout: po.id }, MAX_MOVIMIENTOS_POR_PAYOUT);
            ids = new Set(movs.map((m) => m.id));
            if (cache) cache.set(po.id, ids);
        }
        if (ids.has(balanceTxId)) return po;
    }
    return null;
}

/**
 * @param {object} p
 * @param {object} p.stripe              cliente de Stripe (o doble)
 * @param {string} p.referencia          pi_… o cs_…
 * @param {{importe:number, moneda:string}} p.esperado  importe en unidades mínimas y moneda ISO
 * @param {Date}   [p.ahora]
 * @param {number} [p.retencionHoras=72]
 * @param {boolean}[p.exigirAbonoBancario=true]
 * @param {boolean}[p.exigir3ds=true]
 * @param {Map}    [p.cachePayouts]
 */
async function verificarFondosTarjeta({
    stripe, referencia, esperado, ahora = new Date(), retencionHoras = 72,
    exigirAbonoBancario = true, exigir3ds = true, cachePayouts = null,
}) {
    if (!stripe) return no('SIN_VERIFICADOR');
    if (!esperado || !Number.isInteger(Number(esperado.importe)) || Number(esperado.importe) <= 0 || !esperado.moneda) {
        return no('IMPORTE_NO_COINCIDE', { motivo: 'la orden no tiene importe o moneda esperados' });
    }

    let piId = referencia;
    if (String(referencia || '').startsWith('cs_')) {
        const sesion = await stripe.checkout.sessions.retrieve(referencia);
        piId = idDe(sesion?.payment_intent);
    }
    if (!String(piId || '').startsWith('pi_')) return no('REFERENCIA_NO_VALIDA', { referencia });

    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge.balance_transaction'] });

    // 1. Cobrado, por el importe y la moneda de la orden.
    if (pi.status === 'canceled') return no('PAGO_CANCELADO');
    if (pi.status !== 'succeeded') return no('PAGO_NO_COMPLETADO', { estado: pi.status });
    const moneda = String(esperado.moneda).toLowerCase();
    if (String(pi.currency).toLowerCase() !== moneda) {
        return no('MONEDA_NO_COINCIDE', { esperada: moneda, cobrada: pi.currency });
    }
    if (Number(pi.amount_received) !== Number(esperado.importe)) {
        return no('IMPORTE_NO_COINCIDE', { esperado: Number(esperado.importe), cobrado: pi.amount_received });
    }

    // 2. El cargo sigue en pie.
    const cargo = pi.latest_charge;
    if (!cargo || typeof cargo !== 'object') return no('COBRO_NO_DISPONIBLE');
    if (cargo.refunded || Number(cargo.amount_refunded || 0) > 0) return no('REEMBOLSADO');
    if (cargo.disputed) return no('DISPUTADO');
    if (!cargo.paid || !cargo.captured || cargo.status !== 'succeeded') {
        return no('PAGO_NO_COMPLETADO', { estadoCargo: cargo.status });
    }

    // 3. Autorizado por el emisor, sin riesgo elevado.
    if (cargo.outcome && cargo.outcome.type !== 'authorized') return no('NO_AUTORIZADO', { tipo: cargo.outcome.type });
    if (['elevated', 'highest'].includes(cargo.outcome?.risk_level)) {
        return no('RIESGO_ELEVADO', { nivel: cargo.outcome.risk_level, puntuacion: cargo.outcome.risk_score ?? null });
    }

    // 4. Titular autenticado.
    const detallesPago = cargo.payment_method_details || {};
    let autenticacion = null;
    if (detallesPago.type === 'card') {
        const cartera = detallesPago.card?.wallet?.type;
        if (detallesPago.card?.three_d_secure?.result === 'authenticated') autenticacion = '3ds';
        else if (CARTERAS_AUTENTICADAS.has(cartera)) autenticacion = cartera;
        if (exigir3ds && !autenticacion) return no('SIN_3DS');
    }

    // 5. Retención mínima.
    const liberableDesde = Number(cargo.created) * 1000 + Number(retencionHoras) * 3_600_000;
    if (ahora.getTime() < liberableDesde) {
        return no('RETENCION_EN_CURSO', { liberableDesde: new Date(liberableDesde).toISOString() });
    }

    // 6. Fondos disponibles en el saldo de Stripe.
    const movimiento = cargo.balance_transaction;
    if (!movimiento || typeof movimiento !== 'object') return no('FONDOS_PENDIENTES');
    if (movimiento.status !== 'available') {
        return no('FONDOS_PENDIENTES', { disponibleEl: movimiento.available_on ? new Date(movimiento.available_on * 1000).toISOString() : null });
    }
    if (!(Number(movimiento.net) > 0)) return no('IMPORTE_NO_COINCIDE', { neto: movimiento.net });

    // 7. Abonado en la cuenta bancaria.
    let payout = null;
    if (exigirAbonoBancario) {
        payout = await payoutPagadoQueContiene(stripe, movimiento.id, movimiento.available_on, cachePayouts);
        if (!payout) return no('EN_CAMINO_AL_BANCO', { movimiento: movimiento.id });
    }

    return {
        ok: true,
        motivo: null,
        bloquear: false,
        revisionManual: false,
        reintentable: false,
        detalles: {
            paymentIntent: pi.id,
            cargo: cargo.id,
            importe: Number(pi.amount_received),
            moneda: String(pi.currency).toLowerCase(),
            neto: Number(movimiento.net),
            monedaLiquidacion: movimiento.currency,
            autenticacion,
            payout: payout ? payout.id : null,
            abonadoEl: payout?.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
            titular: {
                nombre: cargo.billing_details?.name || null,
                pais: cargo.billing_details?.address?.country || null,
                email: cargo.billing_details?.email || null,
            },
        },
    };
}

module.exports = { verificarFondosTarjeta, payoutPagadoQueContiene, MOTIVOS_BLOQUEO, MOTIVOS_REVISION };
