'use strict';

/**
 * priceCatalog — catálogo de precios del tenant y cálculo de una propuesta.
 *
 * Regla que estructura todo el módulo: **el modelo redacta, el código calcula**.
 *
 * Un LLM haciendo aritmética con dinero falla de formas silenciosas — se come
 * un descuento, aplica el IVA sobre el importe equivocado, redondea a su gusto.
 * Y una propuesta con un total mal calculado que sale a un cliente es un
 * problema comercial y a veces legal. Así que los importes salen de aquí,
 * deterministas y con tests; el modelo solo escribe el texto que los envuelve.
 *
 * Corolario: si el prospecto pide algo que NO está en el catálogo, se dice.
 * Inventar una línea de precio es exactamente el fallo que este módulo evita.
 *
 * Todos los importes se manejan en CÉNTIMOS enteros. Trabajar en euros con
 * coma flotante acumula errores (0.1 + 0.2 !== 0.3) que acaban en un total
 * desviado por unos céntimos, y explicar eso a un cliente es peor que el
 * propio céntimo.
 */

class PricingError extends Error {
  constructor(message, { status = 400, code = 'invalid' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Descuento por encima del cual la propuesta necesita aprobación humana. */
const DISCOUNT_HITL_PCT = 15;
/** Descuento que no se acepta ni con aprobación desde un agente. */
const DISCOUNT_MAX_PCT = 50;

const DEFAULT_VAT_PCT = 21;   // IVA general en España

/** Valida y normaliza un artículo del catálogo. */
function validateItem({ sku, name, unitPriceCents, unit = 'unidad', recurring = false, vatPct = DEFAULT_VAT_PCT } = {}) {
  const s = String(sku || '').trim();
  if (!s) throw new PricingError('sku requerido', { code: 'sku_required' });
  const n = String(name || '').trim();
  if (!n) throw new PricingError('name requerido', { code: 'name_required' });

  const price = Number(unitPriceCents);
  if (!Number.isInteger(price) || price < 0) {
    throw new PricingError('unitPriceCents debe ser un entero de céntimos >= 0', { code: 'bad_price' });
  }
  const vat = Number(vatPct);
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    throw new PricingError('vatPct fuera de rango', { code: 'bad_vat' });
  }

  return { sku: s, name: n.slice(0, 200), unitPriceCents: price, unit: String(unit).slice(0, 40), recurring: !!recurring, vatPct: vat };
}

async function list({ store, tenantId }) {
  if (!store?.getFact) return [];
  return (await store.getFact({ tenantId, key: 'sales:price_catalog' })) || [];
}

async function upsert({ store, tenantId, item }) {
  if (!store?.setFact) throw new PricingError('almacenamiento no disponible', { status: 503, code: 'no_store' });
  const it = validateItem(item);
  const all = await list({ store, tenantId });
  const i = all.findIndex((x) => x.sku === it.sku);
  if (i >= 0) all[i] = it; else all.push(it);
  await store.setFact({ tenantId, key: 'sales:price_catalog', value: all });
  return it;
}

async function remove({ store, tenantId, sku }) {
  const all = await list({ store, tenantId });
  const next = all.filter((x) => x.sku !== sku);
  if (next.length === all.length) return { removed: false };
  await store.setFact({ tenantId, key: 'sales:price_catalog', value: next });
  return { removed: true };
}

/**
 * Calcula una propuesta a partir de líneas `{ sku, qty }` y el catálogo.
 *
 * @returns {{
 *   lines: Array, subtotalCents, discountCents, taxedBaseCents, vatCents,
 *   totalCents, discountPct, currency, requiresApproval, unknownSkus
 * }}
 * @throws {PricingError} si algún SKU no existe — nunca se inventa un precio
 */
function quote({ items = [], catalog = [], discountPct = 0, currency = 'EUR' } = {}) {
  if (!items.length) throw new PricingError('la propuesta necesita al menos una línea', { code: 'no_items' });

  const pct = Number(discountPct) || 0;
  if (pct < 0) throw new PricingError('el descuento no puede ser negativo', { code: 'bad_discount' });
  if (pct > DISCOUNT_MAX_PCT) {
    throw new PricingError(`descuento del ${pct}% por encima del máximo permitido (${DISCOUNT_MAX_PCT}%)`, { code: 'discount_too_high' });
  }

  const bySku = new Map(catalog.map((c) => [c.sku, c]));
  const unknownSkus = items.map((i) => i.sku).filter((s) => !bySku.has(s));
  if (unknownSkus.length) {
    throw new PricingError(`SKU no encontrado en el catálogo: ${unknownSkus.join(', ')}`, { code: 'unknown_sku' });
  }

  const lines = items.map(({ sku, qty = 1 }) => {
    const q = Number(qty);
    if (!Number.isInteger(q) || q <= 0) throw new PricingError(`cantidad inválida para ${sku}`, { code: 'bad_qty' });
    const c = bySku.get(sku);
    return {
      sku, name: c.name, unit: c.unit, recurring: c.recurring,
      qty: q, unitPriceCents: c.unitPriceCents, vatPct: c.vatPct,
      lineCents: c.unitPriceCents * q,
    };
  });

  const subtotalCents = lines.reduce((a, l) => a + l.lineCents, 0);

  // El descuento se reparte por línea antes del IVA: cada artículo puede tener
  // un tipo distinto (p. ej. formación al 0 %), así que aplicar el IVA sobre un
  // total ya descontado daría una cifra equivocada.
  let discountCents = 0;
  let vatCents = 0;
  for (const l of lines) {
    const lineDiscount = Math.round(l.lineCents * pct / 100);
    l.discountCents = lineDiscount;
    l.netCents = l.lineCents - lineDiscount;
    l.vatCents = Math.round(l.netCents * l.vatPct / 100);
    discountCents += lineDiscount;
    vatCents += l.vatCents;
  }
  const taxedBaseCents = subtotalCents - discountCents;

  return {
    lines,
    currency,
    discountPct: pct,
    subtotalCents,
    discountCents,
    taxedBaseCents,
    vatCents,
    totalCents: taxedBaseCents + vatCents,
    // Un descuento fuerte no lo decide un agente solo: es margen de la empresa.
    requiresApproval: pct > DISCOUNT_HITL_PCT,
    unknownSkus: [],
  };
}

/** Formatea céntimos como importe legible ("1.234,50 €"). */
function formatCents(cents, currency = 'EUR') {
  const simbolo = { EUR: '€', USD: '$', GBP: '£' }[currency] || currency;
  const n = (Number(cents) || 0) / 100;
  const [ent, dec] = n.toFixed(2).split('.');
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${miles},${dec} ${simbolo}`;
}

/** Tabla en texto plano de la propuesta, lista para meter en el correo. */
function renderLines(q) {
  return q.lines.map((l) => {
    const base = `· ${l.name} × ${l.qty} — ${formatCents(l.netCents, q.currency)}`;
    return l.recurring ? `${base} (recurrente por ${l.unit})` : base;
  }).join('\n');
}

module.exports = {
  list, upsert, remove, validateItem, quote, formatCents, renderLines,
  PricingError, DISCOUNT_HITL_PCT, DISCOUNT_MAX_PCT, DEFAULT_VAT_PCT,
};
