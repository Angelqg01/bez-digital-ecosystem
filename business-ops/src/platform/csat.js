'use strict';

const crypto = require('crypto');

/**
 * csat — encuesta de satisfacción real del cliente final.
 *
 * Hasta ahora Soporte solo medía señales INTERNAS (tasa de resolución, de
 * escalado, latencia). Eso dice si el sistema hizo su trabajo, no si el cliente
 * quedó satisfecho: un ticket cerrado sin escalar puede ser una respuesta
 * inútil que el cliente abandonó. El CSAT es la única señal que viene de fuera.
 *
 * Token FIRMADO Y SIN ESTADO (`tenantId.taskId.emitidoEn.firma`):
 *   - No hace falta guardar una fila por cada encuesta enviada para poder
 *     verificarla después; la firma HMAC ya prueba que la emitimos nosotros.
 *   - No se puede falsificar ni cambiar el taskId sin romper la firma.
 *   - Caduca: una encuesta contestada tres meses tarde no mide nada útil y
 *     además permitiría rellenar el histórico a posteriori.
 *
 * El estado que SÍ se guarda es la respuesta, y sirve para dos cosas: calcular
 * las métricas y rechazar votos repetidos del mismo ticket.
 *
 * Escala 1-5. El CSAT se reporta como *top-2-box* (4 y 5 sobre el total), que
 * es la convención del sector; publicar la media a secas infla la percepción
 * porque un 3 ("me da igual") suma casi tanto como un 4.
 */

const MIN_RATING = 1;
const MAX_RATING = 5;
const SATISFIED_FROM = 4;          // top-2-box
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;   // 14 días
const MAX_COMMENT = 1000;

class CsatError extends Error {
  constructor(message, { status = 400, code = 'invalid' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Emite el token que viaja en el enlace de la encuesta.
 * @returns {string} `<tenantId>.<taskId>.<emitidoEn>.<firma>`
 */
function issueToken({ tenantId, taskId, secret, now = Date.now() }) {
  if (!secret) throw new CsatError('CSAT_SECRET no configurado', { status: 503, code: 'no_secret' });
  if (!tenantId || !taskId) throw new CsatError('tenantId y taskId requeridos');
  // El separador es '.', así que ni tenantId ni taskId pueden contenerlo o el
  // parseo se desalinearía y un taskId elegido a mano podría suplantar a otro.
  if (String(tenantId).includes('.') || String(taskId).includes('.')) {
    throw new CsatError('tenantId/taskId no pueden contener puntos', { code: 'bad_id' });
  }
  const payload = `${tenantId}.${taskId}.${now}`;
  return `${payload}.${sign(payload, secret)}`;
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifica el token y devuelve su contenido.
 * @throws {CsatError} si la firma no cuadra o ha caducado
 */
function verifyToken(token, { secret, now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!secret) throw new CsatError('CSAT_SECRET no configurado', { status: 503, code: 'no_secret' });
  const parts = String(token || '').split('.');
  if (parts.length !== 4) throw new CsatError('enlace inválido', { status: 400, code: 'malformed' });

  const [tenantId, taskId, issuedAtRaw, provided] = parts;
  const expected = sign(`${tenantId}.${taskId}.${issuedAtRaw}`, secret);

  let ok = false;
  try {
    ok = crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    ok = false;   // longitud distinta o hex inválido
  }
  if (!ok) throw new CsatError('enlace inválido', { status: 401, code: 'bad_signature' });

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) throw new CsatError('enlace inválido', { status: 400, code: 'malformed' });
  if (now - issuedAt > ttlMs) throw new CsatError('el enlace de la encuesta ha caducado', { status: 410, code: 'expired' });

  return { tenantId, taskId, issuedAt };
}

/** Valida la respuesta del cliente (nota + comentario opcional). */
function validateResponse({ rating, comment } = {}) {
  const n = Number(rating);
  if (!Number.isInteger(n) || n < MIN_RATING || n > MAX_RATING) {
    throw new CsatError(`la valoración debe ser un entero entre ${MIN_RATING} y ${MAX_RATING}`, { code: 'bad_rating' });
  }
  let text = null;
  if (comment != null) {
    text = String(comment)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_COMMENT) || null;
  }
  return { rating: n, comment: text };
}

/**
 * Registra la respuesta. Rechaza el segundo voto del mismo ticket: sin esto,
 * un cliente enfadado (o un bot con el enlace) podría votar en bucle y torcer
 * la métrica de todo el tenant.
 */
async function recordResponse({ store, tenantId, taskId, rating, comment, now = Date.now() }) {
  if (!store?.getFact || !store?.setFact) {
    throw new CsatError('almacenamiento no disponible', { status: 503, code: 'no_store' });
  }
  const key = 'support:csat';
  const data = (await store.getFact({ tenantId, key })) || { responses: [], issued: 0 };

  if (data.responses.some((r) => r.taskId === taskId)) {
    throw new CsatError('esta encuesta ya fue respondida', { status: 409, code: 'already_answered' });
  }

  data.responses.push({ taskId, rating, comment, at: new Date(now).toISOString() });
  await store.setFact({ tenantId, key, value: data });
  return { recorded: true, total: data.responses.length };
}

/** Cuenta una encuesta ENVIADA (para poder calcular la tasa de respuesta). */
async function markIssued({ store, tenantId }) {
  if (!store?.getFact || !store?.setFact) return { issued: 0 };
  const key = 'support:csat';
  const data = (await store.getFact({ tenantId, key })) || { responses: [], issued: 0 };
  data.issued = (data.issued || 0) + 1;
  await store.setFact({ tenantId, key, value: data });
  return { issued: data.issued };
}

/**
 * Informe de CSAT. Devuelve `null` en las tasas cuando no hay muestras, en vez
 * de 0: un tenant sin respuestas no tiene 0% de satisfacción, no tiene dato.
 * Confundir "sin datos" con "muy mal" dispara alertas falsas el primer día.
 */
async function report({ store, tenantId }) {
  const data = (store?.getFact ? await store.getFact({ tenantId, key: 'support:csat' }) : null)
    || { responses: [], issued: 0 };

  const rs = data.responses || [];
  const n = rs.length;
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of rs) { distribution[r.rating] = (distribution[r.rating] || 0) + 1; sum += r.rating; }

  const satisfied = rs.filter((r) => r.rating >= SATISFIED_FROM).length;
  return {
    responses: n,
    surveysIssued: data.issued || 0,
    responseRate: data.issued ? n / data.issued : null,
    csat: n ? satisfied / n : null,          // top-2-box
    avgRating: n ? Number((sum / n).toFixed(2)) : null,
    distribution,
    detractors: rs.filter((r) => r.rating <= 2).length,
    recentComments: rs.filter((r) => r.comment).slice(-10).map((r) => ({ rating: r.rating, comment: r.comment, at: r.at })),
  };
}

module.exports = {
  issueToken, verifyToken, validateResponse, recordResponse, markIssued, report,
  CsatError,
  MIN_RATING, MAX_RATING, SATISFIED_FROM, DEFAULT_TTL_MS, MAX_COMMENT,
};
