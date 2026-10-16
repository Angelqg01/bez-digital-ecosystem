'use strict';

/**
 * MailboxReader — lectura de la bandeja del buzón de Hostinger por IMAP.
 *
 * Es la otra mitad de `EmailConnector` (que solo envía): lista, busca y abre los
 * correos de `yoelceo@bezhas.com` para el panel de OPERANT. Las credenciales son
 * las mismas que las de envío (SMTP_* / HOSTINGER_SMTP_*) y el servidor IMAP se
 * deduce como `imap.hostinger.com:993`.
 *
 * Reglas, tomadas del diseño de la bandeja de newsletters de mreflow/control-center
 * (MIT) y adaptadas a este stack:
 *   - Lectura primero: nunca borra, mueve ni envía. Lo único que escribe es
 *     marcar como leído (`\Seen`), y solo si se pide.
 *   - Cola acotada: se devuelven lotes de 30 (`limit`), con `hasMore`, en vez de
 *     volcar el buzón entero.
 *   - Orden y búsqueda: `newest` | `oldest` | `unread` + texto libre.
 *   - Honestidad ante el fallo: sin credenciales o con el servidor caído se dice
 *     (`configured: false` / `error`), nunca se devuelve una bandeja vacía fingida.
 *   - El cuerpo HTML se entrega como texto plano: el panel no ejecuta HTML ajeno.
 */

const PAGE_SIZE = 30;
const MAX_LIMIT = 100;
const SORTS = new Set(['newest', 'oldest', 'unread']);
const IMAP_TIMEOUTS = { connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 };

class MailboxReader {
  constructor({ config = {}, imapFactory = null } = {}) {
    const e = process.env;
    const var_ = (...nombres) => { const n = nombres.find((k) => e[k] !== undefined); return n ? e[n] : undefined; };
    this.user = config.user || var_('IMAP_USER', 'SMTP_USER', 'HOSTINGER_SMTP_USER') || '';
    this.pass = config.pass || var_('IMAP_PASS', 'SMTP_PASS', 'HOSTINGER_SMTP_PASS') || '';
    const smtpHost = var_('SMTP_HOST', 'HOSTINGER_SMTP_HOST')?.replace(/^mail\.hostinger\.com$/i, 'smtp.hostinger.com');
    this.host = config.host || e.IMAP_HOST
      || (/^smtp\./i.test(smtpHost || '') ? smtpHost.replace(/^smtp\./i, 'imap.')
        : (smtpHost === undefined && this.user && this.pass ? 'imap.hostinger.com' : ''));
    this.port = Number(config.port || e.IMAP_PORT || 993);
    this.tlsRejectUnauthorized = config.tlsRejectUnauthorized ?? (e.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false');
    this._imapFactory = imapFactory;
  }

  get configured() { return !!(this.host && this.user && this.pass); }

  /** Descripción sin secretos, para health y para el panel. */
  describe() {
    return { configured: this.configured, mailbox: this.user || null, target: this.configured ? `${this.host}:${this.port}` : null };
  }

  _client() {
    if (this._imapFactory) return this._imapFactory();
    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host: this.host, port: this.port, secure: this.port === 993,
      auth: { user: this.user, pass: this.pass },
      tls: { rejectUnauthorized: this.tlsRejectUnauthorized },
      logger: false, ...IMAP_TIMEOUTS,
    });
    client.on('error', () => {});   // los errores llegan por las promesas
    return client;
  }

  /** Abre, ejecuta `fn(client)` con la carpeta bloqueada y siempre cierra. */
  async _withMailbox(folder, fn, { readOnly = true } = {}) {
    if (!this.configured) {
      const err = new Error('buzón sin configurar: faltan SMTP_USER/SMTP_PASS (o HOSTINGER_SMTP_*)');
      err.code = 'MAILBOX_NOT_CONFIGURED';
      throw err;
    }
    const client = this._client();
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder, { readOnly });
      try { return await fn(client); } finally { lock.release(); }
    } finally {
      try { await client.logout(); } catch { try { client.close(); } catch { /* ya cerrado */ } }
    }
  }

  static #resumen(m) {
    const from = m.envelope?.from?.[0] || {};
    return {
      uid: m.uid,
      subject: m.envelope?.subject || '(sin asunto)',
      from: from.address || '',
      fromName: from.name || '',
      date: (m.envelope?.date || m.internalDate || null) && new Date(m.envelope?.date || m.internalDate).toISOString(),
      unread: !m.flags?.has('\\Seen'),
    };
  }

  /**
   * Lista un lote de la bandeja.
   * @param {object} o
   * @param {string} [o.folder='INBOX']
   * @param {string} [o.q]        texto libre (asunto, remitente o cuerpo)
   * @param {string} [o.sort]     newest | oldest | unread
   * @param {number} [o.limit]    tamaño del lote (30 por defecto, máx. 100)
   * @param {number} [o.offset]   cuántos saltar
   */
  async list({ folder = 'INBOX', q = '', sort = 'newest', limit = PAGE_SIZE, offset = 0 } = {}) {
    const orden = SORTS.has(sort) ? sort : 'newest';
    const tam = Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), MAX_LIMIT);
    const salto = Math.max(Number(offset) || 0, 0);
    const texto = String(q || '').trim();

    return this._withMailbox(folder, async (client) => {
      const criterio = texto ? { or: [{ subject: texto }, { from: texto }, { body: texto }] } : { all: true };
      const uids = (await client.search(criterio, { uid: true })) || [];
      // Los UID crecen con la llegada: ordenar por UID equivale a ordenar por fecha de entrada.
      uids.sort((a, b) => a - b);

      let items;
      if (orden === 'unread') {
        const sinLeer = new Set((await client.search({ seen: false }, { uid: true })) || []);
        const filtrados = uids.filter((u) => sinLeer.has(u)).reverse();
        items = filtrados;
      } else {
        items = orden === 'oldest' ? uids : uids.slice().reverse();
      }

      const total = items.length;
      const lote = items.slice(salto, salto + tam);
      const messages = [];
      if (lote.length) {
        for await (const m of client.fetch(lote, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true })) {
          messages.push(MailboxReader.#resumen(m));
        }
      }
      // fetch no garantiza el orden pedido
      const posicion = new Map(lote.map((u, i) => [u, i]));
      messages.sort((a, b) => posicion.get(a.uid) - posicion.get(b.uid));
      return { configured: true, folder, sort: orden, total, offset: salto, limit: tam, hasMore: salto + tam < total, messages };
    });
  }

  /** Abre un correo completo (texto plano). Sin marcarlo como leído. */
  async get({ folder = 'INBOX', uid } = {}) {
    const id = Number(uid);
    if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('uid inválido'), { code: 'BAD_UID' });

    return this._withMailbox(folder, async (client) => {
      const m = await client.fetchOne(id, { uid: true, source: true, flags: true, envelope: true, internalDate: true }, { uid: true });
      if (!m) throw Object.assign(new Error('correo no encontrado'), { code: 'NOT_FOUND' });
      const { simpleParser } = require('mailparser');
      const p = await simpleParser(m.source);
      const lista = (campo) => (campo?.value || []).map((a) => ({ name: a.name || '', address: a.address || '' }));
      return {
        ...MailboxReader.#resumen(m),
        to: lista(p.to),
        cc: lista(p.cc),
        replyTo: lista(p.replyTo),
        messageId: p.messageId || null,
        text: (p.text || (p.html ? stripHtml(p.html) : '') || '').trim(),
        attachments: (p.attachments || []).map((a) => ({ filename: a.filename || '(sin nombre)', contentType: a.contentType, size: a.size })),
      };
    });
  }

  /** Marca como leído. Es la única escritura que hace este lector. */
  async markSeen({ folder = 'INBOX', uid } = {}) {
    const id = Number(uid);
    if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('uid inválido'), { code: 'BAD_UID' });
    return this._withMailbox(folder, async (client) => {
      await client.messageFlagsAdd(id, ['\\Seen'], { uid: true });
      return { uid: id, unread: false };
    }, { readOnly: false });
  }
}

/** HTML → texto plano mínimo (no se renderiza nunca HTML de terceros). */
function stripHtml(html) {
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n');
}

module.exports = MailboxReader;
module.exports.PAGE_SIZE = PAGE_SIZE;
