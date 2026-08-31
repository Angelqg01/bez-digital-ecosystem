'use strict';

/**
 * reconciliation — cruza movimientos bancarios con facturas emitidas.
 *
 * El fallo caro no es dejar algo sin conciliar (eso se ve y se revisa a mano);
 * es **conciliar mal**: casar un ingreso con la factura equivocada. Eso deja
 * dos rastros falsos a la vez — una factura que el sistema cree cobrada sin
 * que el dinero esté, y otra de verdad cobrada que sigue "pendiente" y que
 * Collections reclama a un cliente que ya pagó.
 *
 * Reglas, en orden de importancia:
 *   1. **Ambigüedad → no se concilia sola.** Si dos o más facturas abiertas
 *      casan igual de bien con un mismo movimiento (exactas o parciales),
 *      NINGUNA se marca automáticamente — y se dice explícitamente que había
 *      candidatas, en vez de reportarlo como "no se encontró nada". Adivinar
 *      entre iguales es peor que no decidir, y no decir que había opciones es
 *      peor que decidir mal: el humano necesita saber que ahí hay algo que
 *      mirar, no solo que quedó suelto.
 *   2. **Pago parcial ≠ factura pagada.** Un importe menor al de la factura se
 *      separa en su propio cajón; nunca se marca como saldada.
 *   3. **Sin inventar tipo de cambio.** Monedas distintas no se cruzan salvo
 *      que el movimiento ya traiga su importe convertido.
 *   4. **Uso único.** Una factura conciliada sale del pool: no puede volver a
 *      casar con un segundo movimiento (evita duplicar el cobro en libros).
 *
 * Función pura: sin red, sin store. La persistencia y los efectos (marcar la
 * factura, avisar) los hace el agente que la envuelve.
 */

/** Tolerancia por redondeo de comisiones bancarias, en céntimos. */
const DEFAULT_TOLERANCE_CENTS = 50;
/** Ventana en días entre la fecha del movimiento y la de la factura. */
const DEFAULT_WINDOW_DAYS = 45;
const DAY_MS = 86_400_000;

function daysBetween(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY_MS;
}

/**
 * @param {Array<{id, amountCents, currency, date, reference?}>} transactions
 * @param {Array<{id, amountCents, currency, dueDate|date, reference?}>} invoices
 * @param {object} opts
 * @returns {{
 *   matched: Array<{transactionId, invoiceId, amountCents, exact}>,
 *   partial: Array<{transactionId, invoiceId, paidCents, dueCents}>,
 *   ambiguous: Array<{transactionId, candidates: string[]}>,
 *   unmatchedTransactions: string[],
 *   unmatchedInvoices: string[],
 * }}
 */
function match(transactions = [], invoices = [], {
  toleranceCents = DEFAULT_TOLERANCE_CENTS,
  windowDays = DEFAULT_WINDOW_DAYS,
} = {}) {
  const matched = [];
  const partial = [];
  const ambiguous = [];
  const usedInvoices = new Set();

  // Se procesa por importe descendente: los pagos grandes son los que más
  // duele conciliar mal, y resolverlos primero deja el pool más limpio para
  // los pequeños (menos candidatos compitiendo).
  const pendientes = [...transactions].sort((a, b) => (b.amountCents || 0) - (a.amountCents || 0));

  for (const txn of pendientes) {
    const candidatosExactos = [];
    const candidatosParciales = [];

    for (const inv of invoices) {
      if (usedInvoices.has(inv.id)) continue;
      if (txn.currency && inv.currency && txn.currency !== inv.currency) continue;   // sin inventar FX

      const fechaInv = inv.dueDate || inv.date;
      if (fechaInv && txn.date && daysBetween(txn.date, fechaInv) > windowDays) continue;

      const diff = Math.abs((txn.amountCents || 0) - (inv.amountCents || 0));
      if (diff <= toleranceCents) {
        candidatosExactos.push(inv);
      } else if ((txn.amountCents || 0) > 0 && (txn.amountCents || 0) < (inv.amountCents || 0)) {
        candidatosParciales.push(inv);
      }
    }

    if (candidatosExactos.length === 1) {
      const inv = candidatosExactos[0];
      usedInvoices.add(inv.id);
      matched.push({
        transactionId: txn.id, invoiceId: inv.id, amountCents: txn.amountCents,
        exact: (txn.amountCents || 0) === (inv.amountCents || 0),
      });
    } else if (candidatosExactos.length > 1) {
      // Dos o más facturas casan igual de bien: no se elige por azar.
      ambiguous.push({ transactionId: txn.id, type: 'exact', candidates: candidatosExactos.map((i) => i.id) });
    } else if (candidatosParciales.length === 1) {
      const inv = candidatosParciales[0];
      partial.push({ transactionId: txn.id, invoiceId: inv.id, paidCents: txn.amountCents, dueCents: inv.amountCents });
      // Un pago parcial NO agota la factura: sigue disponible para el resto.
    } else if (candidatosParciales.length > 1) {
      // Varias facturas podrían ser un pago parcial del mismo movimiento: sin
      // esto, se perdían en silencio como "sin conciliar" sin decir que había
      // opciones que un humano sí podría distinguir (p. ej. por el concepto).
      ambiguous.push({ transactionId: txn.id, type: 'partial', candidates: candidatosParciales.map((i) => i.id) });
    }
    // Sin ningún candidato: queda sin conciliar (se calcula al final por diferencia).
  }

  const matchedTxnIds = new Set(matched.map((m) => m.transactionId));
  const partialTxnIds = new Set(partial.map((m) => m.transactionId));
  const ambiguousTxnIds = new Set(ambiguous.map((m) => m.transactionId));

  return {
    matched,
    partial,
    ambiguous,
    unmatchedTransactions: transactions
      .map((t) => t.id)
      .filter((id) => !matchedTxnIds.has(id) && !partialTxnIds.has(id) && !ambiguousTxnIds.has(id)),
    unmatchedInvoices: invoices.map((i) => i.id).filter((id) => !usedInvoices.has(id)),
  };
}

module.exports = { match, daysBetween, DEFAULT_TOLERANCE_CENTS, DEFAULT_WINDOW_DAYS };
