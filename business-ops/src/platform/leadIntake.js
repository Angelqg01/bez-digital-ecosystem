'use strict';

const crypto = require('crypto');

/**
 * leadIntake — validación y defensas del endpoint PÚBLICO de captación.
 *
 * Este es el único endpoint de OPERANT que escribe sin API key: lo llama el
 * formulario de la web del tenant, desde el navegador de un desconocido. Todo
 * lo que entra aquí es hostil hasta que se demuestre lo contrario, así que las
 * defensas viven en un módulo propio y testeable en lugar de dispersas en las
 * rutas.
 *
 * Defensas, y el ataque concreto que para cada una:
 *   - Campos acotados en longitud  → payload gigante que revienta el store.
 *   - Cola con techo               → inundar `intake:queue` hasta agotar disco/RAM.
 *   - Honeypot                     → bots que rellenan todos los campos del form.
 *   - Ventana mínima de envío      → envío automático en <2 s tras cargar la página.
 *   - Throttle por IP              → goteo sostenido desde un mismo origen.
 *   - Consentimiento obligatorio   → RGPD art. 6.1.a: sin base legal no se trata.
 *
 * Lo que NO hace a propósito: no puntúa, no redacta y no envía nada. Solo
 * encola. El trabajo real lo hace `LeadFunnel` bajo el orquestador, con cuota,
 * auditoría y HITL.
 */

const LIMITS = {
  company: 120,
  contact: 120,
  email: 254,          // RFC 5321
  role: 120,
  phone: 40,
  message: 2000,
  utm_source: 60,
  utm_campaign: 120,
};

/** Techo de la cola por tenant: por encima, se rechaza con 429. */
const MAX_QUEUE = 500;

/** Un humano no rellena y envía un formulario en menos de esto. */
const MIN_FILL_MS = 2000;

// Validación de email deliberadamente conservadora: preferimos rechazar un
// caso exótico válido a aceptar basura que luego rebote y queme el dominio.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

class IntakeError extends Error {
  constructor(message, { status = 400, code = 'invalid' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Recorta, normaliza espacios y quita caracteres de control. */
function clean(value, max) {
  if (value == null) return null;
  const s = String(value)
    // Caracteres de control fuera: un CRLF colado en un campo que luego
    // acaba en una cabecera de correo es inyección de cabeceras.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * Valida y normaliza el cuerpo de un envío del formulario público.
 * @returns lead normalizado, listo para `intake:queue`
 * @throws {IntakeError}
 */
function validate(body = {}, { now = Date.now() } = {}) {
  // 1. Honeypot: campo oculto que un humano nunca ve ni rellena.
  //    Se responde 200 (no 400) para no enseñarle al bot que lo detectamos.
  if (clean(body.website, 200) || clean(body.fax, 200)) {
    throw new IntakeError('descartado', { status: 200, code: 'honeypot' });
  }

  // 2. Tiempo de relleno: el formulario envía `renderedAt` (ms epoch).
  if (body.renderedAt != null) {
    const elapsed = now - Number(body.renderedAt);
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < MIN_FILL_MS) {
      throw new IntakeError('descartado', { status: 200, code: 'too_fast' });
    }
  }

  // 3. Consentimiento RGPD explícito. Sin base legal no se trata el dato,
  //    y desde luego no se le manda un correo comercial.
  if (body.consent !== true && body.consent !== 'true' && body.consent !== 'on') {
    throw new IntakeError('se requiere consentimiento explícito para el tratamiento de datos', {
      status: 400, code: 'consent_required',
    });
  }

  // 4. Campos mínimos: sin email no hay a quién contactar.
  const email = clean(body.email, LIMITS.email)?.toLowerCase() || null;
  if (!email) throw new IntakeError('email requerido', { code: 'email_required' });
  if (!EMAIL_RE.test(email)) throw new IntakeError('email inválido', { code: 'email_invalid' });

  const company = clean(body.company, LIMITS.company);
  const contact = clean(body.contact || body.name, LIMITS.contact);
  if (!company && !contact) {
    throw new IntakeError('company o contact requerido', { code: 'identity_required' });
  }

  return {
    company,
    contact,
    email,
    role: clean(body.role, LIMITS.role),
    phone: clean(body.phone, LIMITS.phone),
    notes: clean(body.message || body.notes, LIMITS.message),
    utm_source: clean(body.utm_source, LIMITS.utm_source)?.toLowerCase() || null,
    utm_campaign: clean(body.utm_campaign, LIMITS.utm_campaign),
    // Trazabilidad del consentimiento — RGPD art. 7.1: hay que poder demostrarlo.
    consent: true,
    consentAt: new Date(now).toISOString(),
    receivedAt: now,
  };
}

/**
 * Throttle por IP en memoria: ventana deslizante simple.
 *
 * Deliberadamente en memoria y no en el store: si un atacante inunda, no
 * queremos que cada intento rechazado provoque además una escritura. Con varios
 * nodos cada uno limita lo suyo, que para un formulario público es suficiente
 * (delante debería haber un WAF/CDN de todas formas).
 */
class IpThrottle {
  constructor({ max = 5, windowMs = 60_000, clock = () => Date.now() } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.clock = clock;
    this._hits = new Map();     // ip -> number[] (timestamps)
  }

  /** @returns {{allowed: boolean, retryAfterMs: number}} */
  consume(ip) {
    const now = this.clock();
    const cutoff = now - this.windowMs;
    const hits = (this._hits.get(ip) || []).filter((t) => t > cutoff);

    if (hits.length >= this.max) {
      this._hits.set(ip, hits);
      return { allowed: false, retryAfterMs: hits[0] + this.windowMs - now };
    }
    hits.push(now);
    this._hits.set(ip, hits);

    // Poda perezosa: sin esto el Map crece con cada IP vista, que es una fuga
    // lenta en un endpoint público.
    if (this._hits.size > 10_000) this._prune(cutoff);
    return { allowed: true, retryAfterMs: 0 };
  }

  _prune(cutoff) {
    for (const [ip, ts] of this._hits) {
      const live = ts.filter((t) => t > cutoff);
      if (live.length) this._hits.set(ip, live);
      else this._hits.delete(ip);
    }
  }
}

/**
 * Encola un lead validado en `intake:queue` del tenant.
 * @throws {IntakeError} si la cola está llena (backpressure honesto)
 */
async function enqueue({ store, tenantId, lead, maxQueue = MAX_QUEUE }) {
  if (!store?.getFact || !store?.setFact) {
    throw new IntakeError('almacenamiento no disponible', { status: 503, code: 'no_store' });
  }
  const queue = (await store.getFact({ tenantId, key: 'intake:queue' })) || [];
  if (queue.length >= maxQueue) {
    throw new IntakeError('cola de captación llena; inténtalo más tarde', {
      status: 429, code: 'queue_full',
    });
  }
  // Deduplicar por email: un mismo interesado que envía el formulario tres
  // veces no debe generar tres contactos comerciales.
  const dup = queue.find((r) => r.email === lead.email);
  if (dup) return { queued: false, duplicate: true, size: queue.length };

  queue.push(lead);
  await store.setFact({ tenantId, key: 'intake:queue', value: queue });
  return { queued: true, duplicate: false, size: queue.length };
}

/**
 * Verifica la firma HMAC-SHA256 de un webhook de resultados.
 * Formato de cabecera: `sha256=<hex>` sobre el cuerpo crudo.
 */
function verifySignature(rawBody, header, secret) {
  if (!rawBody || !header || !secret) return false;
  const provided = String(header).replace(/^sha256=/, '');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;   // longitud distinta o hex inválido → firma inválida
  }
}

module.exports = {
  validate, enqueue, verifySignature,
  IpThrottle, IntakeError,
  LIMITS, MAX_QUEUE, MIN_FILL_MS,
};
