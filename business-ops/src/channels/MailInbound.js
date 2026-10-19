'use strict';

/**
 * MailInbound — atiende el correo que entra por los alias de atención (support@, ventas@,
 * facturacion@, marketing@, infrastructure@) pasándolo por OPERANT como cualquier otro canal.
 *
 * Es un auto-respondedor, así que lo importante es lo que NO hace:
 *
 *  - Sólo toca lo dirigido a uno de sus alias. El resto del buzón (yoelceo@bezhas.com personal,
 *    proveedores, informes DMARC) ni se lee de más ni se marca ni se contesta.
 *  - Sólo atiende correo llegado DESDE `since` (la fecha de activación): el histórico no recibe
 *    de pronto una respuesta automática.
 *  - No contesta a máquinas: Auto-Submitted, Precedence bulk/junk/list, List-Id/List-Unsubscribe,
 *    no-reply, mailer-daemon, avisos de ausencia, rebotes, y nada que venga de @bezhas.com (dos
 *    auto-respondedores contestándose entre sí son un bucle de correo).
 *  - Tope por remitente (3 respuestas/24 h) y global (60/h): un bucle o una ráfaga se corta solo.
 *  - Lo ya atendido lleva la marca IMAP `OperantHandled`, así un reinicio no repite respuestas.
 *    La marca va incluso en lo que se descarta por ser de una máquina: no se vuelve a evaluar.
 *  - Contesta desde el alias al que escribieron, con In-Reply-To/References y
 *    `Auto-Submitted: auto-replied` para que cualquier otro auto-respondedor calle.
 */

const ALIAS_A_AREA = {
  'support@bezhas.com': 'support',
  'ventas@bezhas.com': 'sales',
  'facturacion@bezhas.com': 'finance',
  'marketing@bezhas.com': 'marketing',
  'infrastructure@bezhas.com': 'blockchain',
};

const REMITENTE_MAQUINA = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|notifications?|alerts?|noreply-dmarc|abuse)([+._-].*)?$/i;
const ASUNTO_AUTOMATICO = /(out of office|automatic reply|auto[- ]?reply|respuesta autom[áa]tica|fuera de (la )?oficina|undeliverable|delivery (status|failure)|mail delivery|no se pudo entregar|returned mail)/i;

/** ¿Es el correo de una máquina o de algo a lo que no se debe contestar? @returns {string|null} el motivo */
function motivoParaNoResponder(msg, { dominioPropio = 'bezhas.com' } = {}) {
  const h = msg.headers || {};
  const autoSub = (h.autoSubmitted || '').trim().toLowerCase();
  if (autoSub && autoSub !== 'no') return 'Auto-Submitted';
  if (/^(bulk|junk|list|auto_reply)$/i.test((h.precedence || '').trim())) return 'Precedence';
  if (h.listId || h.listUnsubscribe) return 'lista de correo';
  if (h.xAutoreply || h.autoResponseSuppress) return 'respuesta automática';
  if (h.returnPath != null && /^<>?$/.test(h.returnPath.trim())) return 'rebote (Return-Path vacío)';
  const from = (msg.from || '').toLowerCase();
  if (!from.includes('@')) return 'sin remitente válido';
  const [local, dominio] = from.split('@');
  if (REMITENTE_MAQUINA.test(local)) return 'remitente automático';
  if (dominio === dominioPropio || dominio.endsWith(`.${dominioPropio}`)) return 'remitente interno (evita bucles)';
  if (ASUNTO_AUTOMATICO.test(msg.subject || '')) return 'asunto automático';
  return null;
}

/** Cuerpo sin citas de mensajes anteriores ni firma larga; acotado. */
function limpiarCuerpo(texto = '') {
  const lineas = String(texto).split(/\r?\n/);
  const corte = lineas.findIndex((l) => /^\s*(on .+ wrote:|el .+ escribi[óo]:|-{2,}\s*(original message|mensaje original)|_{5,}|de:\s.+|from:\s.+)\s*$/i.test(l));
  const utiles = (corte >= 0 ? lineas.slice(0, corte) : lineas).filter((l) => !/^\s*>/.test(l));
  return utiles.join('\n').trim().slice(0, 4000);
}

function aliasDe(recipients = [], aliases = ALIAS_A_AREA) {
  return recipients.map((r) => r.toLowerCase()).find((r) => aliases[r]) || null;
}

class MailInbound {
  /**
   * @param {object} o
   * @param {object} o.reader      MailboxReader (fetchUnhandled / markHandled)
   * @param {object} o.tenants     TenantManager (handleAndWait)
   * @param {object} o.channel     EmailChannel (parseInbound / deliver)
   * @param {string} o.tenantId
   * @param {Date|string} o.since  sólo se atiende lo llegado desde esta fecha
   */
  constructor({
    reader, tenants, channel, tenantId = 'bezhas', since, aliases = ALIAS_A_AREA,
    intervalMs = 60_000, maxPorRemitenteDia = 3, maxPorHora = 60, maxIntentos = 2,
    now = () => Date.now(), log = console,
  } = {}) {
    if (!since || Number.isNaN(new Date(since).getTime())) throw new Error('MailInbound: falta `since` (fecha de activación)');
    Object.assign(this, { reader, tenants, channel, tenantId, aliases, intervalMs, maxPorRemitenteDia, maxPorHora, maxIntentos, now, log });
    this.since = new Date(since);
    this._respondidos = new Map();     // remitente -> [timestamps]
    this._global = [];                 // timestamps de respuestas enviadas
    this._ajenos = new Set();          // UIDs que no son de ningún alias: no se vuelven a bajar
    this._intentos = new Map();        // uid -> fallos
    this._timer = null;
    this._enCurso = false;
  }

  _cupo(remitente) {
    const ahora = this.now();
    this._global = this._global.filter((t) => ahora - t < 3_600_000);
    const propios = (this._respondidos.get(remitente) || []).filter((t) => ahora - t < 86_400_000);
    this._respondidos.set(remitente, propios);
    if (this._global.length >= this.maxPorHora) return 'tope global por hora';
    if (propios.length >= this.maxPorRemitenteDia) return 'tope por remitente en 24 h';
    return null;
  }

  _anotar(remitente) {
    const ahora = this.now();
    this._global.push(ahora);
    this._respondidos.set(remitente, [...(this._respondidos.get(remitente) || []), ahora]);
  }

  /** Una pasada. Devuelve el resumen de lo hecho (para logs y tests). */
  async pollOnce() {
    const resumen = { vistos: 0, respondidos: 0, descartados: 0, ajenos: 0, fallos: 0 };
    const mensajes = await this.reader.fetchUnhandled({ since: this.since, skipUids: this._ajenos });
    for (const msg of mensajes) {
      resumen.vistos += 1;
      // El filtro por día del IMAP es grueso: aquí el exacto.
      if (msg.internalDate && msg.internalDate < this.since) { this._ajenos.add(msg.uid); continue; }

      const alias = aliasDe(msg.recipients, this.aliases);
      if (!alias) { this._ajenos.add(msg.uid); resumen.ajenos += 1; continue; }   // no es nuestro: ni se marca

      const motivo = motivoParaNoResponder(msg);
      if (motivo) {
        this.log.info?.(`[mail-inbound] uid ${msg.uid} descartado: ${motivo}`);
        await this.reader.markHandled({ uid: msg.uid });
        resumen.descartados += 1;
        continue;
      }
      const tope = this._cupo(msg.from);
      if (tope) {
        // Sin contestar y sin reintentar: un humano lo verá (no se marcó como leído).
        this.log.warn?.(`[mail-inbound] uid ${msg.uid} sin respuesta automática: ${tope}`);
        await this.reader.markHandled({ uid: msg.uid });
        resumen.descartados += 1;
        continue;
      }

      const texto = limpiarCuerpo(msg.text) || msg.subject;
      try {
        const input = this.channel.parseInbound({
          from: msg.from,
          subject: msg.subject, text: `${msg.subject ? `${msg.subject}\n` : ''}${texto}`.slice(0, 4200),
          alias, messageId: msg.messageId, references: msg.references,
        });
        input.meta.area = this.aliases[alias];
        require('./routing').enrutarCanalDeCliente('email', input);
        const task = await this.tenants.handleAndWait(this.tenantId, input, { timeoutMs: 45_000 });
        await this.channel.deliver({ tenantId: this.tenantId, input, task });
        this._anotar(msg.from);
        await this.reader.markHandled({ uid: msg.uid });
        resumen.respondidos += 1;
      } catch (err) {
        const n = (this._intentos.get(msg.uid) || 0) + 1;
        this._intentos.set(msg.uid, n);
        resumen.fallos += 1;
        this.log.warn?.(`[mail-inbound] uid ${msg.uid} falló (${n}/${this.maxIntentos}): ${err.message}`);
        // Tras los reintentos se marca igualmente: peor que no contestar es contestar dos veces.
        if (n >= this.maxIntentos) await this.reader.markHandled({ uid: msg.uid }).catch(() => {});
      }
    }
    return resumen;
  }

  start() {
    if (this._timer) return;
    const tick = async () => {
      if (this._enCurso) return;
      this._enCurso = true;
      try {
        const r = await this.pollOnce();
        if (r.respondidos || r.descartados || r.fallos) this.log.info?.(`[mail-inbound] ${JSON.stringify(r)}`);
      } catch (err) {
        this.log.warn?.(`[mail-inbound] pasada fallida: ${err.message}`);
      } finally { this._enCurso = false; }
    };
    this._timer = setInterval(tick, this.intervalMs);
    this._timer.unref?.();
    tick();
  }

  stop() { if (this._timer) clearInterval(this._timer); this._timer = null; }
}

module.exports = MailInbound;
module.exports.motivoParaNoResponder = motivoParaNoResponder;
module.exports.limpiarCuerpo = limpiarCuerpo;
module.exports.aliasDe = aliasDe;
module.exports.ALIAS_A_AREA = ALIAS_A_AREA;
