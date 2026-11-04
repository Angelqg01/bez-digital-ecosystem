'use strict';

/**
 * chiefMail — le da a Dirección el contexto del buzón (yoelceo@bezhas.com y sus alias).
 *
 * Solo lectura: lista los correos recientes sin leer (MailboxReader nunca borra,
 * mueve ni envía) y los resume por remitente, dejando fuera avisos automáticos.
 * Nunca pide decisiones (esas siguen siendo las aprobaciones HITL): el correo
 * aparece en "Hecho"/"Bloqueado" para que Dirección lo cuente, no para que lo ejecute.
 * Si el buzón no responde, lo dice; nunca devuelve un buzón vacío fingido.
 */

const RUIDO = /(^|[^a-z])(no-?reply|noreply|donotreply|notifications?|newsletter|mailer-daemon|postmaster|marketing@|info@(google|github|meta|spotify))/i;
const DOMINIOS_RUIDO = /(google\.com|googlemail\.com|facebookmail\.com|meta\.com|spotify\.com|linkedin\.com|github\.com|stripe\.com|polygon\.technology)$/i;

function esPersona(m) {
  const from = String(m.from || '');
  if (!from || RUIDO.test(from)) return false;
  return !DOMINIOS_RUIDO.test(from.split('@')[1] || '');
}

async function mailReport(mailbox, { limit = 40, dias = 2, ahora = Date.now() } = {}) {
  const base = { department: 'mail', decision: 'Ninguna' };
  if (!mailbox?.configured) return { ...base, done: '—', blocked: 'El buzón no está configurado en este entorno.', risk: null };
  try {
    const r = await mailbox.list({ folder: 'INBOX', sort: 'unread', limit });
    const desde = ahora - dias * 24 * 3600 * 1000;
    const recientes = r.messages.filter(m => m.unread && (!m.date || new Date(m.date).getTime() >= desde));
    const personas = recientes.filter(esPersona);
    if (!personas.length) return { ...base, done: `Sin correos nuevos de personas (${recientes.length} automáticos).`, blocked: '—', risk: null };
    const lista = personas.slice(0, 5).map(m => `${m.fromName || m.from}: ${m.subject}`).join(' | ');
    return { ...base, done: `${personas.length} correo(s) de personas sin leer.`, blocked: lista, risk: personas.length > 5 ? `Hay ${personas.length - 5} más sin mostrar.` : null };
  } catch (err) {
    return { ...base, done: '—', blocked: `No pude leer el buzón: ${err.message}`, risk: 'Correo sin revisar' };
  }
}

module.exports = { mailReport, esPersona };
