'use strict';

const BaseAgent = require('../BaseAgent');
const expenseCategories = require('../../platform/expenseCategories');

/**
 * ExpenseCategorizerAgent — clasifica un gasto contra el plan contable real
 * del tenant, nunca inventa una categoría nueva.
 *
 * La decisión es determinista (`platform/expenseCategories.js`): proveedor
 * exacto y palabras clave del concepto, con una confianza explícita. Por
 * debajo del umbral no se categoriza sola — se marca para revisión humana.
 * Una categorización seguro-que-no que se trata como segura contamina la
 * contabilidad en silencio, y el vatDeductible de la categoría acaba mal
 * aplicado en la declaración.
 *
 * El modelo NUNCA elige la categoría. Solo interviene en el caso dudoso, para
 * sugerir —entre las categorías YA existentes— cuál parece más plausible y
 * por qué, como ayuda a quien tenga que revisar. Esa sugerencia queda marcada
 * como tal y no se aplica sola.
 */
class ExpenseCategorizerAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.expense-categorizer',
      name: 'Expense Categorizer',
      department: 'finance',
      modelTier: 'fast',
      capabilities: ['finance:categorize-expense'],
      systemPrompt:
        'Recibes una transacción y la lista CERRADA de categorías contables del tenant. '
        + 'Si alguna encaja, di cuál (por su id EXACTO) y por qué en una frase. Si ninguna '
        + 'encaja bien, dilo claramente — NUNCA inventes una categoría que no esté en la lista.',
    });
  }

  async run(task) {
    const p = task.payload || {};
    const txn = { vendor: p.vendor || '', description: p.description || p.text || '' };
    const transactionId = p.transactionId;

    if (!transactionId) {
      return { status: 'blocked', reason: 'transactionId requerido (para no recategorizar en cada reintento)' };
    }

    const categories = this.store ? await expenseCategories.list({ store: this.store, tenantId: this.tenantId }) : (p.categories || []);
    if (!categories.length) {
      return {
        status: 'blocked',
        reason: 'sin plan contable cargado (PUT /tenants/:id/finance/expense-categories). No se inventa una categoría.',
      };
    }

    const result = expenseCategories.classify(categories, txn);

    if (!result.needsReview) {
      // Confianza suficiente: se registra sola. Idempotente — un reintento de
      // la misma transacción no la recategoriza ni la duplica.
      const rec = this.store
        ? await expenseCategories.recordDecision({
          store: this.store, tenantId: this.tenantId, transactionId,
          categoryId: result.category.id, confidence: result.confidence, source: 'auto',
        })
        : { recorded: true };

      return {
        status: 'ok',
        transactionId,
        category: { id: result.category.id, name: result.category.name, vatDeductible: result.category.vatDeductible },
        confidence: result.confidence,
        needsReview: false,
        recorded: rec.recorded,
        alreadyCategorized: rec.recorded === false,
      };
    }

    // Confianza insuficiente: el modelo puede sugerir, entre las categorías
    // reales, cuál mirar primero — nunca decide por su cuenta.
    let suggestion = null;
    try {
      const catalogo = categories.map((c) => `${c.id}: ${c.name}`).join('\n');
      const out = await this.think(
        `Transacción: proveedor="${txn.vendor || 'desconocido'}", concepto="${txn.description}".\n\n`
        + `CATEGORÍAS DISPONIBLES (elige solo de aquí, o di que ninguna encaja):\n${catalogo}`,
        { useMemory: false, maxTokens: 150 },
      );
      suggestion = out.trim();
    } catch { /* la sugerencia es un extra; la revisión humana no depende de ella */ }

    this.bus?.emit('finance:expense_needs_review', {
      tenantId: this.tenantId, transactionId, vendor: txn.vendor, description: txn.description,
      bestGuess: result.category?.id || null, confidence: result.confidence, suggestion,
    });

    return {
      status: 'ok',
      transactionId,
      category: null,
      confidence: result.confidence,
      needsReview: true,
      reason: result.reason,
      modelSuggestion: suggestion,
    };
  }
}

module.exports = ExpenseCategorizerAgent;
