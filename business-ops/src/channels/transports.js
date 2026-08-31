'use strict';

/**
 * Transportes de salida por canal. Construye un "sender" por canal a partir de
 * variables de entorno. Sin credenciales → modo SIMULADO (registra en consola),
 * igual que el ModelGateway sin API key. Así todo funciona en desarrollo y se
 * activa el envío real al rellenar las claves.
 *
 * Cada sender: async ({ tenantId, to, text, meta }) => { sent, ... }
 */
function createTransports(env = process.env) {
  return {
    telegram: makeTelegram(env),
    whatsapp: makeWhatsApp(env),
    email: makeEmail(env),
  };
}

function makeTelegram(env) {
  return telegramSender(env.TELEGRAM_BOT_TOKEN);
}

/** Sender de Telegram para un token concreto (sin token → simulado). */
function telegramSender(token) {
  if (!token) return simulated('telegram');
  return async ({ to, text, replyMarkup }) => {
    const body = { chat_id: to, text };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`telegram sendMessage ${r.status}`);
    return { sent: true };
  };
}

function makeWhatsApp(env) {
  const token = env.WHATSAPP_TOKEN;
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return simulated('whatsapp');
  return async ({ to, text }) => {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    });
    if (!r.ok) throw new Error(`whatsapp messages ${r.status}`);
    return { sent: true };
  };
}

function makeEmail(env) {
  const key = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!key || !from) return simulated('email');
  return async ({ to, text, meta }) => {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: meta?.subject ? `Re: ${meta.subject}` : 'Tu consulta', text }),
    });
    if (!r.ok) throw new Error(`email send ${r.status}`);
    return { sent: true };
  };
}

function simulated(name) {
  return async ({ to, text, replyMarkup }) => {
    console.log(`[${name}:salida] (simulado) → ${to}: ${String(text).slice(0, 60)} ${replyMarkup ? `[Buttons: ${JSON.stringify(replyMarkup)}]` : ''}`);
    return { sent: true, simulated: true };
  };
}

module.exports = { createTransports, telegramSender };
