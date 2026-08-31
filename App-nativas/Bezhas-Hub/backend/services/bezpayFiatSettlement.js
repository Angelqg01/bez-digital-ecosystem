/**
 * ============================================================================
 * BEZPAY — LIQUIDACIÓN DE PAGOS FIAT CON RETENCIÓN
 * ============================================================================
 *
 * Entregar BEZ es irreversible. Cobrar en fiat no lo es. Si se entrega en el
 * mismo instante del cobro, cualquiera puede pagar, recibir los tokens y
 * revertir el pago después.
 *
 * Por eso el cobro no entrega: RETIENE. La orden queda pagada, madura el plazo
 * propio de su medio de pago y sólo entonces se entrega, tras releer del
 * proveedor que el cobro sigue en pie.
 *
 *   cobro → holdFiatPayment (status 'processing', hold_until)
 *        → [plazo]
 *        → releaseDueSettlements → verifica en el proveedor
 *        → claimForSettlement (atómico) → dispensa BEZ → 'completed'
 *
 * Disputa o reembolso durante el plazo → blockSettlement → no se entrega nunca.
 *
 * ⚠️ Lo que la retención SÍ y NO resuelve:
 *   SÍ  — el fraude rápido: pagar, cobrar tokens y revertir el mismo día.
 *   NO  — el contracargo de tarjeta, cuyo plazo real ronda los 120 días. Contra
 *         eso lo que protege de verdad es SCA/3-D Secure, que traslada la
 *         responsabilidad del fraude al emisor. La retención sólo recorta la
 *         ventana barata de abuso; no la cierra.
 */

'use strict';

const logger = require('../utils/logger');
const PaymentPG = require('../models/pg/Payment');

// ─── PLAZOS DE RETENCIÓN POR MEDIO DE PAGO ───────────────────────────────────
// Cada medio tiene su propia ventana de reversión; el plazo se elige por eso,
// no por gusto.
const HOLD_HOURS = {
  // Tarjeta: el contracargo llega hasta ~120 días, así que ningún plazo
  // razonable lo cubre. 72 h atrapa el fraude oportunista sin castigar al
  // cliente honesto. La protección real es 3-D Secure.
  card: parseInt(process.env.BEZPAY_HOLD_HOURS_CARD || '72', 10),

  // Adeudo SEPA (Direct Debit): el pagador puede pedir devolución sin motivo
  // durante 8 semanas. Se retiene ese plazo completo.
  sepa_debit: parseInt(process.env.BEZPAY_HOLD_HOURS_SEPA_DEBIT || '1344', 10),

  // Transferencia SEPA (Credit Transfer): una vez abonada, devolverla exige el
  // consentimiento del beneficiario — es decir, el nuestro. Riesgo muy bajo,
  // no necesita retención.
  bank_transfer: parseInt(process.env.BEZPAY_HOLD_HOURS_TRANSFER || '0', 10),
};

const DEFAULT_HOLD_HOURS = parseInt(process.env.BEZPAY_HOLD_HOURS_DEFAULT || '72', 10);

/** Cada cuánto barre el liberador. */
const SWEEP_INTERVAL_MS = parseInt(process.env.BEZPAY_RELEASE_INTERVAL_MS || '600000', 10); // 10 min

function holdHoursFor(methodKind) {
  const hours = HOLD_HOURS[methodKind];
  return Number.isFinite(hours) ? hours : DEFAULT_HOLD_HOURS;
}

/** Cuándo puede entregarse un cobro de este medio, contando desde ahora. */
function holdUntilFor(methodKind, from = new Date()) {
  return new Date(from.getTime() + holdHoursFor(methodKind) * 3_600_000);
}

// ─── DEPENDENCIAS INYECTABLES ────────────────────────────────────────────────
// El dispensador y el verificador del proveedor se inyectan para poder probar
// esto sin hot wallet ni cuenta de Stripe.
// `verifyProviderCharge: undefined` significa "aún no resuelto" → se usa el
// verificador de Stripe por defecto. Ponerlo a null lo desactiva a propósito.
let _deps = { dispense: null, verifyProviderCharge: undefined };

// Se distingue "no me pasas la clave" de "me la pasas a null": lo segundo
// limpia la dependencia. Con un `if (valor)` no habría forma de desactivar un
// verificador ya puesto, y quedaría colgado para siempre.
function configure(deps = {}) {
  if ('dispense' in deps) _deps.dispense = deps.dispense;
  if ('verifyProviderCharge' in deps) _deps.verifyProviderCharge = deps.verifyProviderCharge;
}

function _dispense(to, amount) {
  if (!_deps.dispense) {
    // Por defecto, el dispensador real de BezPay. Se resuelve tarde para no
    // crear un ciclo de require entre ambos módulos.
    _deps.dispense = require('./bezpay.service').dispense;
  }
  return _deps.dispense(to, amount);
}

let _warnedNoVerifier = false;

/**
 * Verificador por defecto: relee el PaymentIntent en Stripe.
 *
 * No basta con fiarse de los webhooks de disputa. Un reembolso hecho a mano
 * desde el panel de Stripe, o un webhook que se perdió, dejarían la orden
 * "limpia" y se entregaría igual. Esto es la última comprobación antes de que
 * el BEZ salga del hot wallet.
 */
async function _defaultStripeVerifier(order) {
  if (!process.env.STRIPE_SECRET_KEY) {
    if (!_warnedNoVerifier) {
      _warnedNoVerifier = true;
      logger.warn('[BezPayFiat] Sin STRIPE_SECRET_KEY no se puede reverificar el cobro antes de entregar — sólo protegen los webhooks');
    }
    return { ok: true };
  }
  const ref = order.provider_reference;
  if (!ref || !String(ref).startsWith('pi_')) return { ok: true };

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const pi = await stripe.paymentIntents.retrieve(ref, { expand: ['latest_charge'] });

  if (pi.status !== 'succeeded') {
    return { ok: false, reason: `PI_STATUS_${pi.status}` };
  }
  const charge = pi.latest_charge;
  if (charge && typeof charge === 'object') {
    if (charge.refunded || (charge.amount_refunded || 0) > 0) {
      return { ok: false, reason: 'REFUNDED' };
    }
    if (charge.disputed) {
      return { ok: false, reason: 'DISPUTED' };
    }
  }
  return { ok: true };
}

/**
 * Relee el cobro en el proveedor justo antes de entregar.
 * Devuelve { ok: true } o { ok: false, reason }.
 */
async function _verifyStillGood(order) {
  if (_deps.verifyProviderCharge === undefined) {
    _deps.verifyProviderCharge = _defaultStripeVerifier;
  }
  if (!_deps.verifyProviderCharge) return { ok: true };
  try {
    return await _deps.verifyProviderCharge(order);
  } catch (err) {
    // No poder comprobarlo NO es permiso para entregar: se reintenta luego.
    logger.warn({ err: err.message, paymentId: order.payment_intent_id },
      '[BezPayFiat] No se pudo reverificar el cobro — se pospone');
    return { ok: false, reason: 'PROVIDER_CHECK_FAILED', retryable: true };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// REGISTRAR UN COBRO (no entrega nada)
// ═════════════════════════════════════════════════════════════════════════════
/**
 * @param {object} p
 * @param {string} p.paymentId          payment_intent_id de la orden BezPay
 * @param {string} p.providerReference  id del cobro en el proveedor
 * @param {string} p.methodKind         card | sepa_debit | bank_transfer
 * @returns {Promise<{held: boolean, alreadyHeld?: boolean, holdUntil?: Date, order?: object}>}
 */
async function recordFiatPayment({ paymentId, providerReference, methodKind = 'card' }) {
  if (!paymentId) throw new Error('paymentId requerido');
  if (!providerReference) throw new Error('providerReference requerido');

  const holdUntil = holdUntilFor(methodKind);

  let order;
  try {
    order = await PaymentPG.holdFiatPayment({
      paymentIntentId: paymentId, providerReference, holdUntil, methodKind,
    });
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      logger.warn({ paymentId, providerReference },
        '[BezPayFiat] Ese cobro ya acreditó otra orden');
      return { held: false, duplicate: true };
    }
    throw dbErr;
  }

  if (!order) {
    // Ya estaba cobrada (reintento del webhook del proveedor) o ya entregada.
    logger.info({ paymentId, providerReference }, '[BezPayFiat] Cobro ya registrado');
    return { held: false, alreadyHeld: true };
  }

  logger.info({ paymentId, providerReference, methodKind, holdUntil: holdUntil.toISOString() },
    '⏳ [BezPayFiat] Cobro retenido — se entregará al vencer el plazo');

  return { held: true, holdUntil, order };
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOQUEAR (disputa / reembolso)
// ═════════════════════════════════════════════════════════════════════════════
async function cancelFiatSettlement({ providerReference, reason }) {
  if (!providerReference) throw new Error('providerReference requerido');

  const blocked = await PaymentPG.blockSettlement(providerReference, reason || 'DISPUTED');

  if (!blocked) {
    // O no existe, o ya se entregó. Si ya se entregó, el token está fuera y
    // esto es una pérdida a gestionar, no algo que el código pueda deshacer.
    const existing = await PaymentPG.findByProviderReference(providerReference).catch(() => null);
    if (existing?.settled_at) {
      logger.error({ providerReference, paymentId: existing.payment_intent_id, reason },
        '🔥 [BezPayFiat] Disputa sobre un pago YA entregado — pérdida, requiere gestión manual');
      return { blocked: false, alreadyDelivered: true, order: existing };
    }
    return { blocked: false, notFound: true };
  }

  logger.warn({ providerReference, paymentId: blocked.payment_intent_id, reason },
    '🚫 [BezPayFiat] Cobro bloqueado antes de entregar');
  return { blocked: true, order: blocked };
}

// ═════════════════════════════════════════════════════════════════════════════
// LIBERAR LO QUE YA CUMPLIÓ PLAZO
// ═════════════════════════════════════════════════════════════════════════════
async function releaseDueSettlements({ limit = 50 } = {}) {
  const due = await PaymentPG.findReleasable(limit);
  const result = { checked: due.length, delivered: 0, skipped: 0, failed: 0 };

  for (const order of due) {
    const paymentId = order.payment_intent_id;

    const check = await _verifyStillGood(order);
    if (!check.ok) {
      if (!check.retryable) {
        await PaymentPG.blockSettlement(order.provider_reference, check.reason || 'PROVIDER_REJECTED')
          .catch(() => {});
      }
      result.skipped++;
      continue;
    }

    // Claim atómico: el mismo candado que usa la vía cripto. Si hay dos
    // liberadores corriendo, sólo uno entrega.
    let claimed;
    try {
      claimed = await PaymentPG.claimForSettlement(paymentId, order.tx_hash || null, null, null);
    } catch (dbErr) {
      logger.error({ err: dbErr.message, paymentId }, '[BezPayFiat] Claim falló');
      result.failed++;
      continue;
    }
    if (!claimed) { result.skipped++; continue; }

    const bezAmount = Number(claimed.bez_amount || 0);
    if (!(bezAmount > 0)) {
      logger.error({ paymentId }, '[BezPayFiat] Orden sin bezAmount — no se entrega');
      await PaymentPG.markSettlementFailed(paymentId, 'NO_BEZ_AMOUNT').catch(() => {});
      result.failed++;
      continue;
    }

    try {
      // Se entrega el BEZ congelado al crear la orden, NO uno recalculado al
      // precio de hoy: el cliente compró a un precio y ese es el que vale.
      const disp = await _dispense(claimed.wallet_address, bezAmount);
      await PaymentPG.updateByPaymentIntent(paymentId, {
        status: 'completed',
        txHash: disp.txHash,
        completedAt: new Date(),
        updatedAt: new Date(),
      });
      logger.info({ paymentId, wallet: claimed.wallet_address, bezAmount, txHash: disp.txHash },
        '✅ [BezPayFiat] BEZ entregado tras la retención');
      result.delivered++;
    } catch (err) {
      logger.error({ err: err.message, paymentId }, '🔥 [BezPayFiat] Cobrado pero no entregado');
      await PaymentPG.markSettlementFailed(paymentId, `DELIVERY_FAILED: ${err.message}`).catch(() => {});
      result.failed++;
    }
  }

  if (result.delivered || result.failed) {
    logger.info(result, '[BezPayFiat] Barrido de liberación');
  }
  return result;
}

// ─── BARRIDO PERIÓDICO ───────────────────────────────────────────────────────
let _timer = null;

function start() {
  if (_timer) return;
  _timer = setInterval(() => {
    releaseDueSettlements().catch(err =>
      logger.error({ err: err.message }, '[BezPayFiat] Barrido falló'));
  }, SWEEP_INTERVAL_MS);
  if (_timer.unref) _timer.unref();
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, '⏱️  [BezPayFiat] Liberador de retenciones arrancado');
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = {
  recordFiatPayment,
  cancelFiatSettlement,
  releaseDueSettlements,
  holdUntilFor,
  holdHoursFor,
  configure,
  start,
  stop,
  HOLD_HOURS,
};
