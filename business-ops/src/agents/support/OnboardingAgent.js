'use strict';

const BaseAgent = require('../BaseAgent');

/**
 * OnboardingAgent — lo que la gente pide al escribir por Telegram, correo o chat y que
 * no es una duda: crear su perfil (BeZhas ID), suscribirse a un plan y a la newsletter.
 *
 * Las tres cosas se resuelven SIN modelo y sin que OPERANT toque la cuenta de nadie:
 *
 *  - ALTA: se contesta con el enlace de registro. La persona elige SU contraseña en la
 *    web y es ahí donde se genera su BeZhas ID. Nunca se piden ni se guardan contraseñas
 *    en un chat, y nadie puede crear una cuenta a nombre de otro correo o de otro
 *    usuario de Telegram.
 *  - PLAN: la duda la contesta la base de conocimiento como siempre; aquí sólo se añade
 *    el enlace para contratarlo. Contratar es un pago que hace la persona, no el agente.
 *  - NEWSLETTER: doble confirmación. Pedirla NO suscribe: se registra una petición
 *    pendiente y se manda un correo con un enlace; sólo al confirmarlo desde ese correo
 *    queda suscrita (RGPD/LSSI). El correo lo manda este agente; el registro, la API.
 *
 * Detección por reglas y no por modelo: es lo que hace posible probarlo exhaustivamente y
 * que un modelo pequeño no decida por su cuenta crear suscripciones.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const NEWSLETTER = /\b(newsletter|bolet[ií]n|bolet[ií]n informativo)\b/i;
const QUIERE_SUSCRIBIRSE = /\b(suscrib|apunt|alta|subscri|sign\s*up|quiero\s+recibir|recibir|dar(?:me)?\s+de\s+alta|join)\w*/i;
const DARSE_DE_BAJA = /\b(baja|cancelar|unsubscribe|dejar\s+de\s+recibir|no\s+quiero\s+recibir|stop)\b/i;
const ALTA_CUENTA = [
  /\b(crear|abrir|hacer|quiero|necesito|registrar(?:me)?|dar(?:me)?\s+de\s+alta)\b[^.?!]{0,40}\b(cuenta|perfil|usuario|registro)\b/i,
  /\bbezhas[\s_-]?id\b/i,
  /\b(registro|registrarme|registrarse|sign\s*up|create\s+(an?\s+)?(account|profile)|open\s+an?\s+account)\b/i,
];
const PLAN = /\b(plan(?:es)?|suscripci[oó]n(?:es)?|suscribirme|contratar|tarifas?|precios?|subscription|pricing|upgrade)\b/i;

/** Detecta el idioma sin dependencias: lo suficiente para elegir entre es y en. */
function idioma(texto = '') {
  const en = (texto.match(/\b(the|and|please|want|subscribe|hello|thanks|my|you|how|would|like|to|i|me)\b/gi) || []).length;
  const es = (texto.match(/\b(el|la|los|las|quiero|cuenta|hola|gracias|precio|para|mi|por favor|c[oó]mo|una|que|con)\b/gi) || []).length;
  return en > es ? 'en' : 'es';
}

/** @returns {'newsletter_alta'|'newsletter_baja'|'alta'|'plan'|null} */
function detectarIntencion(texto = '') {
  const t = String(texto);
  if (NEWSLETTER.test(t)) {
    if (DARSE_DE_BAJA.test(t) && !QUIERE_SUSCRIBIRSE.test(t.replace(DARSE_DE_BAJA, ''))) return 'newsletter_baja';
    return 'newsletter_alta';
  }
  if (ALTA_CUENTA.some((r) => r.test(t))) return 'alta';
  if (PLAN.test(t)) return 'plan';
  return null;
}

const TEXTOS = {
  es: {
    alta: (url) => `¡Encantado! Para crear tu perfil y tu BeZhas ID entra aquí: ${url}\n\n`
      + 'Elegirás tú mismo tu contraseña en esa página. Por seguridad, nunca te la pediremos por este chat ni por correo.',
    planCta: (url) => `\n\nCuando quieras contratar un plan, primero crea tu cuenta aquí: ${url} y desde tu panel podrás suscribirte. `
      + 'El pago lo haces tú; yo no cobro ni suscribo nada por ti.',
    newsletterPide: 'Con gusto. Escríbeme el correo al que quieres recibir la newsletter (por ejemplo: «newsletter tu@correo.com») '
      + 'y te enviaré un mensaje para que confirmes la suscripción.',
    newsletterEnviado: (email) => `Listo: te he enviado un correo a ${email} para confirmar la suscripción. `
      + 'No quedarás suscrito hasta que pulses el botón de confirmación de ese mensaje. Si no lo ves, revisa el spam.',
    newsletterYa: 'Esa dirección ya está suscrita a la newsletter. ¡Gracias!',
    newsletterReciente: (email) => `Ya te envié hace unos minutos un correo de confirmación a ${email}. Revisa tu bandeja y el spam.`,
    newsletterBaja: 'Para darte de baja usa el enlace «Darme de baja» que aparece al final de cualquier envío de la newsletter. '
      + 'Si no lo tienes a mano, dime y una persona del equipo lo gestionará.',
    newsletterFallo: 'Ahora mismo no puedo registrar tu suscripción. Una persona del equipo lo revisará y te escribirá.',
    limite: 'Has hecho varias solicitudes seguidas. Por favor, inténtalo de nuevo más tarde.',
    asuntoConfirmacion: 'Confirma tu suscripción a la newsletter de BeZhas',
    cuerpoConfirmacion: (url, baja) => `Hola,\n\nAlguien (esperamos que tú) pidió recibir la newsletter de BeZhas en esta dirección.\n\n`
      + `Para confirmarlo pulsa aquí: ${url}\n\nSi no lo pediste, ignora este mensaje: no se te suscribirá a nada.\n`
      + `Si ya estás suscrito y quieres darte de baja: ${baja}\n\nEl equipo de BeZhas`,
  },
  en: {
    alta: (url) => `Happy to help! Create your profile and BeZhas ID here: ${url}\n\n`
      + 'You will choose your own password on that page. For your safety, we will never ask for it in chat or by email.',
    planCta: (url) => `\n\nWhen you are ready to subscribe to a plan, first create your account here: ${url} and subscribe from your dashboard. `
      + 'You make the payment yourself; I never charge or subscribe anything on your behalf.',
    newsletterPide: 'Sure. Send me the email address where you want the newsletter (for example: "newsletter you@mail.com") '
      + 'and I will email you a link to confirm.',
    newsletterEnviado: (email) => `Done: I sent a confirmation email to ${email}. You will not be subscribed until you click the confirm button in it. Check spam if you do not see it.`,
    newsletterYa: 'That address is already subscribed to the newsletter. Thank you!',
    newsletterReciente: (email) => `I already sent a confirmation email to ${email} a few minutes ago. Please check your inbox and spam.`,
    newsletterBaja: 'To unsubscribe, use the "Unsubscribe" link at the bottom of any newsletter issue. If you do not have it, tell me and a team member will handle it.',
    newsletterFallo: 'I cannot register your subscription right now. A team member will review it and get back to you.',
    limite: 'You have made several requests in a row. Please try again later.',
    asuntoConfirmacion: 'Confirm your BeZhas newsletter subscription',
    cuerpoConfirmacion: (url, baja) => `Hello,\n\nSomeone (hopefully you) asked to receive the BeZhas newsletter at this address.\n\n`
      + `To confirm, click here: ${url}\n\nIf you did not ask for it, ignore this message: you will not be subscribed to anything.\n`
      + `If you are already subscribed and want to unsubscribe: ${baja}\n\nThe BeZhas team`,
  },
};

class OnboardingAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'support.onboarding-agent',
      name: 'Onboarding Agent',
      department: 'support',
      modelTier: 'fast',
      capabilities: ['support:onboarding'],
      systemPrompt: 'Guías a la gente para crear su perfil, contratar un plan y suscribirse a la newsletter, sin hacerlo por ella.',
    });
    this.signupUrl = ctx.signupUrl || process.env.SIGNUP_URL || 'https://www.bezhas.com/register';
    this.apiUrl = (ctx.apiUrl || process.env.BEZHAS_API_URL || 'https://api.bezhas.com').replace(/\/$/, '');
    this.internalKey = ctx.internalKey ?? process.env.INTERNAL_API_KEY ?? '';
    this.fetch = ctx.fetch || ((...a) => fetch(...a));
    this.fromAddress = ctx.newsletterFrom || process.env.NEWSLETTER_FROM || 'marketing@bezhas.com';
    this._ventana = new Map();                 // customerId -> [timestamps]; protege la salida de correo
    this.maxPorHora = ctx.maxPorHora || 3;
  }

  static detectarIntencion(texto) { return detectarIntencion(texto); }
  static idioma(texto) { return idioma(texto); }

  /** ¿Este mensaje es asunto de este agente? */
  static atiende(texto) { return detectarIntencion(texto) !== null; }

  _limitado(customerId) {
    const ahora = Date.now();
    const lista = (this._ventana.get(customerId) || []).filter((t) => ahora - t < 3600_000);
    if (lista.length >= this.maxPorHora) { this._ventana.set(customerId, lista); return true; }
    lista.push(ahora); this._ventana.set(customerId, lista);
    return false;
  }

  /**
   * @returns {Promise<{handled:boolean, intent?:string, reply?:string, escalate?:boolean, appendToReply?:string}>}
   * `plan` NO se resuelve aquí: devuelve `appendToReply` para que la respuesta de la base de
   * conocimiento lleve el enlace al final.
   */
  async run(task) {
    const p = task.payload || {};
    const texto = String(p.text || '');
    const intent = detectarIntencion(texto);
    if (!intent) return { handled: false };
    const t = TEXTOS[idioma(texto)];

    if (intent === 'alta') return { handled: true, intent, reply: t.alta(this.signupUrl), escalate: false };
    if (intent === 'plan') return { handled: false, intent, appendToReply: t.planCta(this.signupUrl) };
    if (intent === 'newsletter_baja') return { handled: true, intent, reply: t.newsletterBaja, escalate: true, escalateReason: 'baja de newsletter solicitada por chat' };

    // ── newsletter_alta ──
    // El correo: el que se escribe en el mensaje; en un mail entrante, el remitente. Nunca se
    // acepta uno distinto del que la persona dio, y nada se suscribe sin confirmar.
    const delTexto = texto.match(EMAIL_RE)?.[0];
    const delRemitente = p.channel === 'email' ? (p.meta?.from || '').match(EMAIL_RE)?.[0] : null;
    const email = (delTexto || delRemitente || '').toLowerCase();
    if (!email) return { handled: true, intent, reply: t.newsletterPide, escalate: false };

    if (this._limitado(p.customerId || email)) return { handled: true, intent, reply: t.limite, escalate: false };

    let r;
    try {
      const res = await this.fetch(`${this.apiUrl}/api/newsletter/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.internalKey },
        body: JSON.stringify({ email, source: p.channel === 'telegram' ? 'telegram' : (p.channel === 'email' ? 'email' : 'chat'), language: idioma(texto) }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      r = await res.json();
    } catch (err) {
      return { handled: true, intent, reply: t.newsletterFallo, escalate: true, escalateReason: `newsletter: ${err.message}` };
    }

    if (r.status === 'already_confirmed') return { handled: true, intent, reply: t.newsletterYa, escalate: false };
    if (r.status === 'pending_recent') return { handled: true, intent, reply: t.newsletterReciente(email), escalate: false };
    if (r.status !== 'pending' || !r.confirmUrl) {
      return { handled: true, intent, reply: t.newsletterFallo, escalate: true, escalateReason: 'newsletter: respuesta inesperada de la API' };
    }

    const mail = this.tools.email
      ? await this.tools.email.execute('send', {
        to: email, from: this.fromAddress,
        subject: t.asuntoConfirmacion, body: t.cuerpoConfirmacion(r.confirmUrl, r.unsubscribeUrl),
        headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
      })
      : { sent: false, reason: 'sin conector de correo' };
    // Si el correo de confirmación no salió, NO se le dice a la persona que sí: sin él no hay suscripción.
    if (!mail?.sent) {
      return { handled: true, intent, reply: t.newsletterFallo, escalate: true, escalateReason: `newsletter: no salió el correo de confirmación (${mail?.reason || 'sin detalle'})` };
    }
    return { handled: true, intent, reply: t.newsletterEnviado(email), escalate: false };
  }
}

module.exports = OnboardingAgent;
module.exports.detectarIntencion = detectarIntencion;
module.exports.idioma = idioma;
