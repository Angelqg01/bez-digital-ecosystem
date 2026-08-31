'use strict';

/**
 * macros — respuestas guardadas del tenant y su emparejamiento con un ticket.
 *
 * "Macro" es el término del sector (Zendesk, Intercom): un texto reutilizable
 * que el equipo ya ha aprobado. Preferirlo a generar uno nuevo no es tacañería
 * de tokens: es que el texto guardado ya pasó por una persona, dice siempre lo
 * mismo y no puede inventarse una política que la empresa no tiene.
 *
 * El emparejamiento es DETERMINISTA (categoría + solapamiento de términos +
 * señales) a propósito. Si un modelo eligiera la macro, la misma consulta
 * podría recibir respuestas distintas según el día, y el motivo de tener
 * respuestas guardadas es justo el contrario.
 */

const MAX_MACROS = 200;
const MAX_BODY = 4000;

/** Umbral por debajo del cual no se propone macro: mejor nada que una mala. */
const MIN_SCORE = 0.35;

class MacroError extends Error {
  constructor(message, { status = 400, code = 'invalid' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Tokeniza a términos significativos (mismo criterio que KnowledgeBase). */
function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]+/g)?.filter((w) => w.length > 2) || []
  );
}

/** Valida y normaliza una macro antes de guardarla. */
function validate({ id, title, body, category = 'general', keywords = [], signals = [] } = {}) {
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t) throw new MacroError('title requerido', { code: 'title_required' });
  if (!b) throw new MacroError('body requerido', { code: 'body_required' });
  if (b.length > MAX_BODY) throw new MacroError(`body supera ${MAX_BODY} caracteres`, { code: 'body_too_long' });

  return {
    id: String(id || `m_${t.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`),
    title: t.slice(0, 200),
    body: b,
    category: String(category || 'general').toLowerCase(),
    keywords: (Array.isArray(keywords) ? keywords : []).map((k) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 30),
    // Señales de `sentimentLexicon` para las que esta macro es apropiada.
    signals: (Array.isArray(signals) ? signals : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 10),
    uses: 0,
  };
}

async function list({ store, tenantId }) {
  if (!store?.getFact) return [];
  return (await store.getFact({ tenantId, key: 'support:macros' })) || [];
}

async function save({ store, tenantId, macro }) {
  if (!store?.getFact || !store?.setFact) {
    throw new MacroError('almacenamiento no disponible', { status: 503, code: 'no_store' });
  }
  const m = validate(macro);
  const all = await list({ store, tenantId });

  const i = all.findIndex((x) => x.id === m.id);
  if (i >= 0) {
    // Conserva el contador de uso al editar: se pierde el histórico si no.
    all[i] = { ...m, uses: all[i].uses || 0 };
  } else {
    if (all.length >= MAX_MACROS) {
      throw new MacroError(`límite de ${MAX_MACROS} macros alcanzado`, { status: 429, code: 'too_many' });
    }
    all.push(m);
  }
  await store.setFact({ tenantId, key: 'support:macros', value: all });
  return m;
}

async function remove({ store, tenantId, id }) {
  const all = await list({ store, tenantId });
  const next = all.filter((m) => m.id !== id);
  if (next.length === all.length) return { removed: false };
  await store.setFact({ tenantId, key: 'support:macros', value: next });
  return { removed: true };
}

/** Suma un uso a la macro (para saber cuáles sirven de verdad). */
async function markUsed({ store, tenantId, id }) {
  const all = await list({ store, tenantId });
  const m = all.find((x) => x.id === id);
  if (!m) return { ok: false };
  m.uses = (m.uses || 0) + 1;
  await store.setFact({ tenantId, key: 'support:macros', value: all });
  return { ok: true, uses: m.uses };
}

/**
 * Puntúa cuánto encaja una macro con el ticket. 0..1.
 *
 * Reparto: términos 0.55, categoría 0.30, señales 0.15.
 *
 * Las palabras clave pesan más que la categoría porque las escribe el equipo a
 * mano para esa macro concreta, mientras que la categoría la asigna el triage
 * automático y solo tiene cuatro valores. Con el reparto anterior (categoría
 * 0.4) pasaba esto: "No puedo entrar, mi acceso está bloqueado" se clasificaba
 * como `general` —no dice "error" ni "no funciona"— y la macro de acceso, que
 * casaba con 3 de sus 5 palabras clave, se quedaba en 0.2 y no se proponía.
 *
 * Calibración resultante:
 *   - 3 términos acertados bastan solos (≈0.48) aunque falle la categoría.
 *   - La categoría sola NO basta (0.30 < umbral): sin coincidencia de términos
 *     no hay motivo para proponer un texto concreto.
 *   - 1 término + categoría correcta sí (≈0.58).
 *
 * Los aciertos se cuentan con rendimientos decrecientes y SIN normalizar por
 * el tamaño de la macro. Normalizar por tamaño creaba un incentivo perverso:
 * al añadirle sinónimos a una macro para que cubriera más casos, cada acierto
 * valía menos y dejaba de proponerse en tickets que antes sí cubría. Enriquecer
 * una macro debe ser siempre neutro o bueno, nunca un castigo.
 */
const TERM_WEIGHT = 0.55;
const CATEGORY_WEIGHT = 0.30;
const SIGNAL_WEIGHT = 0.15;

function score(macro, { text = '', category = null, signals = [] } = {}) {
  if (!macro) return 0;
  let s = 0;

  // `keywords`/`signals` son opcionales: una macro guardada con un formato
  // anterior, o construida a mano, no tiene por qué traerlas. Sin estos
  // valores por defecto, una sola macro incompleta tiraba el emparejamiento
  // entero y el humano se quedaba sin ninguna sugerencia.
  const mKeywords = Array.isArray(macro.keywords) ? macro.keywords : [];
  const mSignals = Array.isArray(macro.signals) ? macro.signals : [];

  if (category && macro.category === String(category).toLowerCase()) s += CATEGORY_WEIGHT;

  const qt = tokens(text);
  if (qt.size) {
    const mt = new Set([...tokens(macro.title), ...mKeywords.flatMap((k) => [...tokens(k)])]);
    if (mt.size) {
      let hits = 0;
      for (const t of qt) if (mt.has(t)) hits++;
      // Rendimientos decrecientes: 1 acierto 0.28, 2 → 0.41, 3 → 0.48, 4 → 0.52.
      // El primero informa mucho; el cuarto ya casi nada.
      if (hits) s += TERM_WEIGHT * (1 - Math.pow(0.5, hits));
    }
  }

  if (mSignals.length && signals.length) {
    const comunes = mSignals.filter((x) => signals.includes(x)).length;
    if (comunes) s += SIGNAL_WEIGHT * Math.min(1, comunes / mSignals.length);
  }

  return Number(Math.min(1, s).toFixed(3));
}

/**
 * Mejor macro para un ticket, o `null` si ninguna llega al umbral.
 * Devolver `null` es una respuesta legítima: una macro que no encaja hace
 * perder más tiempo del que ahorra, porque el humano tiene que leerla y
 * descartarla.
 */
function bestMatch(macros, ctx, { minScore = MIN_SCORE } = {}) {
  if (!macros?.length) return null;
  const puntuadas = macros
    .map((m) => ({ macro: m, score: score(m, ctx) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score || (b.macro.uses || 0) - (a.macro.uses || 0));
  return puntuadas[0] || null;
}

module.exports = {
  list, save, remove, markUsed, validate, score, bestMatch, tokens,
  MacroError, MIN_SCORE, MAX_MACROS, MAX_BODY,
};
