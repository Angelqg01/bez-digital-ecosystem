'use strict';

/**
 * expenseCategories — plan contable del tenant y clasificación de gastos.
 *
 * El fallo caro de un categorizador automático no es que se equivoque una vez:
 * es que **invente una categoría** que no existe en la contabilidad real de la
 * empresa, o que decida por su cuenta si un gasto lleva IVA deducible. Ambas
 * cosas las decide el asesor fiscal del tenant al dar de alta la categoría,
 * nunca el agente por transacción.
 *
 * De ahí el diseño:
 *   - Categorías con `vatDeductible` fijo en el catálogo: el agente NUNCA
 *     decide esto gasto a gasto.
 *   - Emparejamiento determinista (igual que `macros.js`): mismo motivo — si
 *     lo decidiera un modelo, el mismo gasto podría caer en categorías
 *     distintas según el día.
 *   - **Confianza explícita.** Por debajo del umbral, no se categoriza sola:
 *     se marca para revisión humana. Una categorización "segura" que en
 *     realidad es un acierto de suerte contamina la contabilidad en silencio.
 */

const MAX_CATEGORIES = 200;

/** Por debajo de esto, la clasificación se marca para revisión humana. */
const MIN_CONFIDENCE = 0.5;

class ExpenseError extends Error {
  constructor(message, { status = 400, code = 'invalid' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quita diacríticos
      .match(/[a-z0-9]+/g)?.filter((w) => w.length > 2) || []
  );
}

/** Valida y normaliza una categoría del plan contable. */
function validateCategory({ id, name, vatDeductible = false, keywords = [], vendors = [] } = {}) {
  const n = String(name || '').trim();
  if (!n) throw new ExpenseError('name requerido', { code: 'name_required' });
  return {
    id: String(id || `cat_${n.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`),
    name: n.slice(0, 120),
    vatDeductible: !!vatDeductible,
    keywords: (Array.isArray(keywords) ? keywords : []).map((k) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 30),
    vendors: (Array.isArray(vendors) ? vendors : []).map((v) => String(v).toLowerCase().trim()).filter(Boolean).slice(0, 30),
  };
}

async function list({ store, tenantId }) {
  if (!store?.getFact) return [];
  return (await store.getFact({ tenantId, key: 'finance:expense_categories' })) || [];
}

async function upsert({ store, tenantId, category }) {
  if (!store?.setFact) throw new ExpenseError('almacenamiento no disponible', { status: 503, code: 'no_store' });
  const c = validateCategory(category);
  const all = await list({ store, tenantId });
  const i = all.findIndex((x) => x.id === c.id);
  if (i >= 0) all[i] = c;
  else {
    if (all.length >= MAX_CATEGORIES) throw new ExpenseError(`límite de ${MAX_CATEGORIES} categorías`, { status: 429, code: 'too_many' });
    all.push(c);
  }
  await store.setFact({ tenantId, key: 'finance:expense_categories', value: all });
  return c;
}

async function remove({ store, tenantId, id }) {
  const all = await list({ store, tenantId });
  const next = all.filter((c) => c.id !== id);
  if (next.length === all.length) return { removed: false };
  await store.setFact({ tenantId, key: 'finance:expense_categories', value: next });
  return { removed: true };
}

/**
 * Puntúa el encaje de una categoría con una transacción. 0..1.
 * El proveedor exacto (`vendors`) es la señal más fiable —el mismo proveedor
 * casi siempre cae en la misma categoría—; las palabras clave del concepto
 * afinan cuando el proveedor no está en la lista.
 */
function score(category, { vendor = '', description = '' } = {}) {
  if (!category) return 0;
  let s = 0;
  const v = String(vendor || '').toLowerCase().trim();
  if (v && category.vendors.includes(v)) s += 0.6;

  const dt = tokens(description);
  if (dt.size && category.keywords.length) {
    const kw = new Set(category.keywords.flatMap((k) => [...tokens(k)]));
    let hits = 0;
    for (const t of dt) if (kw.has(t)) hits++;
    if (hits) s += 0.4 * (1 - Math.pow(0.5, hits));   // rendimientos decrecientes
  }
  return Number(Math.min(1, s).toFixed(3));
}

/**
 * Clasifica una transacción contra el plan contable del tenant.
 * @returns {{category: object|null, confidence: number, needsReview: boolean}}
 */
function classify(categories, txn, { minConfidence = MIN_CONFIDENCE } = {}) {
  if (!categories?.length) {
    return { category: null, confidence: 0, needsReview: true, reason: 'sin plan contable cargado' };
  }
  const puntuadas = categories
    .map((c) => ({ category: c, score: score(c, txn) }))
    .sort((a, b) => b.score - a.score);

  const best = puntuadas[0];
  if (!best || best.score < minConfidence) {
    return {
      category: null, confidence: best?.score || 0, needsReview: true,
      reason: `confianza insuficiente (${best?.score || 0} < ${minConfidence}): no se inventa una categoría`,
    };
  }
  return { category: best.category, confidence: best.score, needsReview: false };
}

// ── Registro de decisiones (idempotente por transacción) ──────────────────

async function recordDecision({ store, tenantId, transactionId, categoryId, confidence, source, now = Date.now() }) {
  if (!store?.getFact || !store?.setFact) return { recorded: false };
  const key = 'finance:expense_decisions';
  const all = (await store.getFact({ tenantId, key })) || {};
  // Idempotente: una transacción ya categorizada no se recategoriza sola en
  // un reintento. Un humano SÍ puede corregirla (source: 'human').
  if (all[transactionId] && source !== 'human') {
    return { recorded: false, reason: 'ya categorizada', existing: all[transactionId] };
  }
  all[transactionId] = { categoryId, confidence, source, at: now };
  await store.setFact({ tenantId, key, value: all });
  return { recorded: true };
}

module.exports = {
  validateCategory, list, upsert, remove, score, classify, recordDecision,
  ExpenseError, MIN_CONFIDENCE, MAX_CATEGORIES,
};
