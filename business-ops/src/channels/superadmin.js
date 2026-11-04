'use strict';

/**
 * Canal del SuperAdmin por Telegram: el parte sale de Dirección (Chief of Staff)
 * y las órdenes de Yoel entran con prefijo `@departamento`.
 *
 * Seguridad: solo cuenta lo que llega del chat TELEGRAM_SUPERADMIN_CHAT_ID. Un
 * mensaje de cualquier otro chat nunca es una orden (iría a Soporte como cliente).
 */

const { PERSONAS } = require('../platform/personas');
const ChiefOfStaffAgent = require('../agents/executive/ChiefOfStaffAgent');
const { telegramSender } = require('./transports');

const ALIAS = {
  ventas: 'sales', marketing: 'marketing', soporte: 'support', finanzas: 'finance',
  legal: 'legal', personas: 'hr', rrhh: 'hr', operaciones: 'operations',
  blockchain: 'blockchain', tesoreria: 'treasury', tesorería: 'treasury',
  inversores: 'fundraising', direccion: 'chief', dirección: 'chief',
};

/** Chat del SuperAdmin: el propio, o el del CEO (TELEGRAM_CHAT_CEO) que ya usa el resto de la plataforma. */
function superAdminChat(env = process.env) {
  return env.TELEGRAM_SUPERADMIN_CHAT_ID || env.TELEGRAM_CHAT_CEO || null;
}

/** Bot del CEO (el del director), no el bot general de cara al cliente. Sin token → simulado. */
function ceoSender(env = process.env) {
  const token = env.TELEGRAM_CEO_BOT_TOKEN || env.TELEGRAM_TOKEN_DIRECTOR || null;
  return telegramSender(token);
}

function isSuperAdmin(chatId, env = process.env) {
  const id = superAdminChat(env);
  return Boolean(id) && String(chatId) === String(id);
}

/** "@ventas Reserva Brickken" → { department:'sales', text:'Reserva Brickken' }. Sin prefijo → Dirección. */
function parseDirective(text) {
  const m = /^@([\p{L}]+)\s+([\s\S]+)$/u.exec(String(text || '').trim());
  if (m) {
    const department = ALIAS[m[1].toLowerCase()];
    if (department) return { department, text: m[2].trim() };
  }
  return { department: 'chief', text: String(text || '').trim() };
}

/** Parte del Chief of Staff → texto de Telegram (con cola de decisiones numerada). */
function formatDigest({ digest, decisions = [], disagreements = [] }) {
  const parts = [`📋 ${PERSONAS.chief.name}\n\n${digest}`];
  if (decisions.length) {
    parts.push('Decisiones que necesito:\n' +
      decisions.map((d, i) => `${i + 1}. ${d.voice}: ${d.decision}${d.risk ? ` (riesgo: ${d.risk})` : ''}`).join('\n'));
  }
  if (disagreements.length) {
    parts.push('Desacuerdos:\n' + disagreements.map(d =>
      `• ${d.subject}: ` + d.positions.map(p => `${p.department} → ${p.position}`).join(' / ')).join('\n'));
  }
  if (decisions.length) parts.push('Responde con "1 sí", "2 no" o "@departamento instrucción".');
  return parts.join('\n\n');
}

/** Nota de voz opcional: si falla, el texto ya salió; la voz nunca tumba el parte. */
async function speak({ voice, to, text }) {
  if (!voice?.repliesEnabled || !text) return false;
  try {
    const audio = await voice.synthesize(text);
    await voice.sendVoice({ to, audio, caption: 'Dirección' });
    return true;
  } catch (err) {
    console.warn(`[superadmin:voz] no se pudo enviar la nota de voz: ${err.message}`);
    return false;
  }
}

/** Envía el parte al chat del SuperAdmin. Sin chat configurado no envía (nunca a otro). */
async function sendDigest({ chief, reports, send, tenantId, voice = null, env = process.env }) {
  const chatId = superAdminChat(env);
  if (!chatId) return { sent: false, reason: 'chat del SuperAdmin sin configurar (TELEGRAM_SUPERADMIN_CHAT_ID o TELEGRAM_CHAT_CEO)' };
  const out = await chief.run({ type: 'digest', payload: { reports } });
  await send({ tenantId, to: chatId, text: formatDigest(out) });
  await speak({ voice, to: chatId, text: out.digest });
  return { sent: true, decisions: out.decisions.length, disagreements: out.disagreements.length };
}

/** "1 sí" / "2 no" → respuesta a la cola de decisiones. null si no lo es. */
function parseDecisionReply(text) {
  const m = /^(\d+)\s+(s[ií]|no)(?![\p{L}])/iu.exec(String(text || '').trim());
  return m ? { index: Number(m[1]) - 1, approved: /^s/i.test(m[2]) } : null;
}

/** Aprobaciones HITL pendientes → un informe por aprobación (así "1 sí" apunta a una sola). */
function reportsFromPending(pending = []) {
  return pending
    .filter(p => p.decidableAqui !== false)
    .map(p => ({
      department: String(p.agentId || '').split('.')[0] || 'operations',
      done: '—', blocked: p.reason || '—',
      decision: `Aprobar: ${typeof p.action === 'string' ? p.action : (p.action?.method || p.action?.tool || 'acción')}`,
      risk: p.reason || null,
      approvalId: p.approvalId,
    }));
}

const QUEUE_KEY = 'chief:queue';

/** Parte diario: lee las aprobaciones pendientes, las guarda como cola y envía el parte. */
async function runDigestJob({ tenantId, space, chief, send, store, voice = null, env = process.env }) {
  const reports = reportsFromPending(space.hitl.listPending(tenantId));
  const res = await sendDigest({ chief, reports, send, tenantId, voice, env });
  if (res.sent && store?.setFact) {
    const ids = reports.filter(r => ChiefOfStaffAgent.isPending(r.decision)).map(r => r.approvalId);
    await store.setFact({ tenantId, key: QUEUE_KEY, value: ids });
  }
  return res;
}

/**
 * Mensaje entrante de Telegram. Devuelve { handled:false } si no es del SuperAdmin
 * (entonces sigue el flujo normal de cliente); si lo es, ejecuta y responde.
 */
async function handleInbound({ update, tenantId, space, chief, send, store, runDirective, voice = null, env = process.env }) {
  const msg = update?.message || update?.edited_message;
  const chatId = msg?.chat?.id;
  if (!msg || !isSuperAdmin(chatId, env)) return { handled: false };

  const reply = (t, { spoken = false } = {}) =>
    send({ tenantId, to: chatId, text: t }).then(() => spoken ? speak({ voice, to: chatId, text: t }) : null);

  // Nota de voz: se transcribe y sigue como si fuera texto. Sin transcriptor, se dice la verdad.
  let text = (msg.text || '').trim();
  let viaVoice = false;
  if (!text && (msg.voice || msg.audio)) {
    if (!voice?.canTranscribe) {
      await reply('Recibí tu nota de voz, pero todavía no puedo transcribirla desde aquí. Escríbemelo por ahora.');
      return { handled: true, ok: false, reason: 'sin_transcriptor' };
    }
    try {
      const buf = await voice.download((msg.voice || msg.audio).file_id);
      text = ((await voice.transcribe(buf)) || '').trim();
    } catch (err) {
      await reply(`No pude transcribir tu nota de voz (${err.message}). Escríbemelo, por favor.`);
      return { handled: true, ok: false, reason: 'error_transcripcion' };
    }
    if (!text) { await reply('No entendí la nota de voz. ¿Puedes repetirla?'); return { handled: true, ok: false, reason: 'vacia' }; }
    viaVoice = true;
    await send({ tenantId, to: chatId, text: `🎙 Entendí: «${text}»` });
  }
  if (!text) return { handled: false };

  const decision = parseDecisionReply(text);
  if (decision) {
    const queue = (store?.getFact && await store.getFact({ tenantId, key: QUEUE_KEY })) || [];
    const approvalId = queue[decision.index];
    if (!approvalId) { await reply('No tengo esa decisión en la cola. Pídeme el parte con "¿cómo vamos?".'); return { handled: true, ok: false }; }
    const ok = space.hitl.resolve(approvalId, decision.approved, 'Decisión del SuperAdmin vía Telegram');
    await reply(ok ? `${decision.approved ? 'Aprobada' : 'Rechazada'} la decisión ${decision.index + 1}.` : 'Esa decisión ya no estaba pendiente.', { spoken: viaVoice });
    return { handled: true, ok };
  }

  const d = parseDirective(text);
  if (d.department === 'chief') {
    await sendDigest({ chief, reports: reportsFromPending(space.hitl.listPending(tenantId)), send, tenantId, voice: viaVoice ? voice : null, env });
    return { handled: true, ok: true, to: 'chief' };
  }
  const task = await runDirective({ text: d.text, department: d.department, channel: 'telegram' });
  await reply(`${(PERSONAS[d.department] || {}).name || d.department}: ${task?.result?.summary || 'recibido, en curso.'}`, { spoken: viaVoice });
  return { handled: true, ok: true, to: d.department };
}

module.exports = {
  superAdminChat, ceoSender, isSuperAdmin, parseDirective, formatDigest, sendDigest, parseDecisionReply,
  reportsFromPending, runDigestJob, handleInbound, ALIAS, QUEUE_KEY,
};
