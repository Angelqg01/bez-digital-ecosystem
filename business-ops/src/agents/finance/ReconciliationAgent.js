'use strict';

const BaseAgent = require('../BaseAgent');
const reconciliation = require('../../platform/reconciliation');

/**
 * ReconciliationAgent — cruza movimientos bancarios con facturas emitidas.
 *
 * El emparejamiento es determinista (`platform/reconciliation.js`): importe,
 * moneda y ventana de fechas. El agente aquí solo aporta persistencia
 * idempotente y aviso al humano de lo que necesita mirar — nunca decide entre
 * candidatas ambiguas ni convierte un pago parcial en "factura saldada".
 *
 * Idempotencia entre ejecuciones: una transacción o factura ya conciliada en
 * una corrida anterior se excluye del pool antes de volver a emparejar. Sin
 * esto, ejecutar el trabajo dos veces sobre un extracto que se solapa
 * duplicaría conciliaciones ya hechas.
 */
class ReconciliationAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.reconciliation',
      name: 'Reconciliation',
      department: 'finance',
      modelTier: 'fast',
      capabilities: ['finance:reconcile'],
      systemPrompt: 'Concilias movimientos bancarios con facturas. No decides tú qué casa con qué: reportas lo que ya se emparejó y lo que necesita revisión.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const transactions = p.transactions || [];
    const invoices = p.invoices || [];

    if (!transactions.length || !invoices.length) {
      return { status: 'blocked', reason: 'se necesitan transactions e invoices para conciliar' };
    }

    const state = this.store
      ? ((await this.store.getFact({ tenantId: this.tenantId, key: 'finance:reconciliation_state' })) || { txnIds: [], invoiceIds: [] })
      : { txnIds: [], invoiceIds: [] };
    const yaTxn = new Set(state.txnIds);
    const yaInv = new Set(state.invoiceIds);

    // Se excluye lo ya conciliado en corridas anteriores: sin esto, un
    // extracto que se solapa con el de la vez pasada duplicaría conciliaciones.
    const txnsPendientes = transactions.filter((t) => !yaTxn.has(t.id));
    const invoicesPendientes = invoices.filter((i) => !yaInv.has(i.id));

    const result = reconciliation.match(txnsPendientes, invoicesPendientes, {
      toleranceCents: p.toleranceCents,
      windowDays: p.windowDays,
    });

    // Solo lo emparejado con certeza (exacto) retira la transacción/factura
    // del pool para siempre. Lo parcial NO: la factura sigue abierta por el
    // resto, y esa misma transacción no debe releerse como si fuera nueva.
    const nuevosTxn = [...result.matched, ...result.partial].map((m) => m.transactionId);
    const nuevosInv = result.matched.map((m) => m.invoiceId);

    if (this.store && (nuevosTxn.length || nuevosInv.length)) {
      await this.store.setFact({
        tenantId: this.tenantId, key: 'finance:reconciliation_state',
        value: { txnIds: [...state.txnIds, ...nuevosTxn], invoiceIds: [...state.invoiceIds, ...nuevosInv] },
      });
    }

    // Cada caso que necesita ojos humanos se avisa por separado: una
    // ambigüedad y un pago parcial son decisiones distintas para quien revisa.
    for (const a of result.ambiguous) {
      this.bus?.emit('finance:reconciliation_ambiguous', {
        tenantId: this.tenantId, transactionId: a.transactionId, type: a.type, candidates: a.candidates,
      });
    }
    for (const partial of result.partial) {
      this.bus?.emit('finance:reconciliation_partial', {
        tenantId: this.tenantId, ...partial,
      });
    }

    await this.remember({
      task: 'finance:reconcile',
      summary: `Conciliación: ${result.matched.length} emparejadas, ${result.ambiguous.length} ambiguas, ${result.partial.length} parciales`,
      outcome: 'ok',
    });

    return {
      status: 'ok',
      matched: result.matched,
      partial: result.partial,
      ambiguous: result.ambiguous,
      unmatchedTransactions: result.unmatchedTransactions,
      unmatchedInvoices: result.unmatchedInvoices,
    };
  }
}

module.exports = ReconciliationAgent;
