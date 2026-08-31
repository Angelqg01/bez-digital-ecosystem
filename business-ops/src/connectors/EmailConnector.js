'use strict';
const BaseConnector = require('./BaseConnector');

/** Tiempo que se da por buena una comprobación de alcanzabilidad. */
const VERIFY_TTL_MS = 5 * 60 * 1000;

/**
 * EmailConnector — envío de correo REAL.
 *
 * Dos vías, la primera disponible gana:
 *   1. Resend (RESEND_API_KEY): API HTTP, sin dependencias.
 *   2. SMTP propio (SMTP_HOST, nodemailer): servidor Stalwart auto-alojado u otro.
 * Sin ninguna configuración → modo simulado (registra en consola).
 *
 * El envío en frío pasa SIEMPRE por HITL antes de llegar aquí (línea roja
 * cold_outbound): este conector solo ejecuta el "sí" ya aprobado.
 *
 * ── Estar configurado no es estar operativo ────────────────────────────────
 *
 * Con `SMTP_HOST` puesto, el conector se declaraba en modo `smtp` y
 * `simulated: false` aunque al otro lado no hubiera nadie escuchando. La
 * plataforma se comportaba como si el correo funcionara y solo se descubría lo
 * contrario cuando un envío YA APROBADO por un humano moría en la cola de
 * fallos. Peor que no tener correo configurado, porque el caso "sin configurar"
 * sí tenía un camino honesto.
 *
 * Ahora `verify()` comprueba la conexión SIN enviar nada (SMTP: handshake +
 * autenticación; Resend: la clave contra su API), se cachea con un TTL corto
 * para que el servicio se recupere solo en cuanto el servidor aparezca, y si no
 * responde el conector queda `degraded`: no finge, y `send()` devuelve
 * `sent: false` con el motivo.
 *
 * ── Un envío simulado NO es un envío ───────────────────────────────────────
 *
 * El modo simulado devolvía `sent: true`, y quien lo consume (`LeadFunnel`,
 * `FollowUpAgent`, `VendorCommsAgent`) lo toma como entregado: el embudo
 * registraba `delivered` y reentrenaba sus pesos con correos que nunca
 * salieron. Un simulado devuelve `sent: false` — no se ha enviado nada, y
 * decirlo es lo único honesto.
 */
class EmailConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'email';
    // Resend (HTTP)
    this.resendKey = config.resendKey || process.env.RESEND_API_KEY || '';
    // SMTP (nodemailer)
    this.host = config.host || process.env.SMTP_HOST || '';
    this.port = Number(config.port || process.env.SMTP_PORT || 587);
    this.user = config.user || process.env.SMTP_USER || '';
    this.pass = config.pass || process.env.SMTP_PASS || '';
    this.from = config.from || process.env.MAIL_FROM || process.env.EMAIL_FROM || `no-reply@${tenantId || 'operant'}.local`;
    // Servidor propio (Stalwart) sin certificado público: permite desactivar la
    // validación TLS explícitamente (nunca por defecto) vía SMTP_TLS_REJECT_UNAUTHORIZED=false.
    this.tlsRejectUnauthorized = config.tlsRejectUnauthorized ?? (process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false');
    this._fetch = config.fetch || globalThis.fetch;
    this._transport = null;
    this.mode = this.resendKey ? 'resend' : (this.host ? 'smtp' : 'simulado');
    this.simulated = this.mode === 'simulado';
    this.verifyTtlMs = config.verifyTtlMs ?? VERIFY_TTL_MS;
    this._lastVerify = null;   // { ok, detail, at }
  }

  _getTransport() {
    if (this._transport) return this._transport;
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch { return null; }
    this._transport = nodemailer.createTransport({
      host: this.host, port: this.port, secure: this.port === 465,
      auth: this.user ? { user: this.user, pass: this.pass } : undefined,
      tls: { rejectUnauthorized: this.tlsRejectUnauthorized },
    });
    return this._transport;
  }

  /** Descripción del canal para health/observabilidad, sin secretos. */
  describe() {
    const destino = this.mode === 'resend' ? 'api.resend.com'
      : this.mode === 'smtp' ? `${this.host}:${this.port}`
        : '(ninguno)';
    return {
      mode: this.mode,
      target: destino,
      from: this.from,
      reachable: this._lastVerify ? this._lastVerify.ok : null,
      detail: this._lastVerify?.detail || null,
    };
  }

  /**
   * ¿Se puede enviar de verdad? No envía nada: SMTP hace el handshake y la
   * autenticación (`transport.verify()`), Resend consulta sus dominios.
   * @param {boolean} [force] - ignora la caché
   */
  async verify({ force = false } = {}) {
    const fresco = this._lastVerify && (Date.now() - this._lastVerify.at) < this.verifyTtlMs;
    if (fresco && !force) return { ...this._lastVerify, cached: true };

    let resultado;
    if (this.mode === 'simulado') {
      // No hay nada que alcanzar, y tampoco se está engañando a nadie: el modo
      // simulado es honesto por definición.
      resultado = { ok: true, detail: 'sin correo configurado (modo simulado)' };
    } else if (this.mode === 'resend') {
      try {
        const r = await this._fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${this.resendKey}` },
        });
        resultado = r.ok
          ? { ok: true, detail: 'clave de Resend válida' }
          : { ok: false, detail: `Resend respondió HTTP ${r.status}${r.status === 401 ? ' (clave inválida)' : ''}` };
      } catch (err) {
        resultado = { ok: false, detail: `no se pudo hablar con Resend: ${err.message}` };
      }
    } else {
      const transport = this._getTransport();
      if (!transport) {
        resultado = { ok: false, detail: 'SMTP configurado pero falta nodemailer (npm i nodemailer)' };
      } else {
        try {
          await transport.verify();
          resultado = { ok: true, detail: `SMTP responde en ${this.host}:${this.port}` };
        } catch (err) {
          resultado = { ok: false, detail: `SMTP ${this.host}:${this.port} no responde — ${err.message}` };
        }
      }
    }

    this._lastVerify = { ...resultado, at: Date.now() };
    return { ...this._lastVerify, cached: false };
  }

  /** ¿Está configurado para enviar pero sin poder hacerlo? */
  get degraded() {
    return this.mode !== 'simulado' && this._lastVerify?.ok === false;
  }

  async execute(method, args) {
    if (method !== 'send') throw new Error(`email: método desconocido ${method}`);
    return this.send(args);
  }

  /**
   * @param {object} args
   * @param {string} [args.from] - remitente de esta llamada (el buzón del
   *   departamento, que inyecta BaseAgent desde el perfil de negocio). Sin él
   *   se usa el global (MAIL_FROM).
   */
  async send({ to, subject, body, html, from } = {}) {
    if (!to) throw new Error('email: destinatario requerido');
    const remitente = from || this.from;

    // Con el canal caído, no se intenta el envío: se dice. Reintentar contra un
    // servidor que no está no aporta nada y enmascara el problema. La caché
    // tiene TTL, así que en cuanto el servidor vuelva, el siguiente envío lo
    // detecta solo — no hace falta reiniciar la plataforma.
    if (this.mode !== 'simulado') {
      const estado = await this.verify();
      if (!estado.ok) {
        console.warn(`[email:${this.tenantId}] canal degradado, NO se envía a ${to}: ${estado.detail}`);
        return { sent: false, degraded: true, provider: this.mode, reason: estado.detail, from: remitente, to, subject };
      }
    }

    if (this.mode === 'resend') {
      const r = await this._fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: remitente, to, subject: subject || '(sin asunto)', text: body, html: html || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`email(resend): HTTP ${r.status} ${data?.message || ''}`.trim());
      return { sent: true, provider: 'resend', id: data.id, from: remitente, to, subject };
    }

    if (this.mode === 'smtp') {
      const transport = this._getTransport();
      if (!transport) throw new Error('email: SMTP configurado pero falta nodemailer (npm i nodemailer)');
      const info = await transport.sendMail({ from: remitente, to, subject, text: body, html: html || undefined });
      return { sent: true, provider: 'smtp', messageId: info.messageId, from: remitente, to, subject };
    }

    console.log(`[email:${this.tenantId}] (simulado) ${remitente} → ${to}: ${subject}`);
    // sent: false a propósito — no ha salido ningún correo. Ver cabecera.
    return { sent: false, simulated: true, reason: 'sin correo configurado: no se ha enviado nada', from: remitente, to, subject };
  }
}

module.exports = EmailConnector;
