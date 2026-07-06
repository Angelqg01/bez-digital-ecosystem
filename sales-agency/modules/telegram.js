// Telegram — reportes diarios y alertas de leads calientes
import TelegramBot from 'node-telegram-bot-api';
import * as db from './db.js';

let bot = null;

function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  }
  return bot;
}

async function send(text) {
  const b = getBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!b || !chatId) { console.log('[Telegram OFF]', text); return; }
  try {
    await b.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('[Telegram error]', err.message);
  }
}

// ── Reporte diario ────────────────────────────────────────────────
export async function sendDailyReport(scoutedToday, emailsSent, followupsSent) {
  const stats = db.getStats();
  const hotLeads = db.getAllLeads()
    .filter(l => l.tier === 'HOT' && !['demo_booked', 'disqualified'].includes(l.status))
    .slice(0, 5)
    .map(l => `  • ${l.empresa} (${l.ubicacion}) — Score: ${l.score}`)
    .join('\n') || '  Ninguno aún';

  const msg = `
🤖 *BeZhas Sales Agency — Reporte Diario*
📅 ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}

━━━━━━━━━━━━━━━━━
📊 *HOY*
• Leads encontrados: ${scoutedToday}
• Emails enviados: ${emailsSent}
• Follow-ups enviados: ${followupsSent}

━━━━━━━━━━━━━━━━━
📈 *ACUMULADO*
• Total leads: ${stats.total}
• HOT leads: ${stats.hot}
• Emails totales: ${stats.emailsSent}
• En pipeline: ${stats.byStatus?.contacted || 0}
• Respondieron positivo: ${stats.byStatus?.responded_positive || 0}
• Demo agendada: ${stats.byStatus?.demo_booked || 0}

━━━━━━━━━━━━━━━━━
🔥 *LEADS HOT ACTIVOS*
${hotLeads}

━━━━━━━━━━━━━━━━━
💰 *VENTAS POTENCIALES*
• Si 10% convierte Pack Starter ($100): $${Math.round(stats.total * 0.1 * 100)}
• Si 3% convierte Pack Enterprise ($2K): $${Math.round(stats.total * 0.03 * 2000)}

[Ver todos los leads → bez.digital/dashboard](https://bez.digital/dashboard)
  `.trim();

  await send(msg);
}

// ── Alerta lead caliente ──────────────────────────────────────────
export async function alertHotLead(lead) {
  const msg = `
🔥 *LEAD HOT DETECTADO*
━━━━━━━━━━━━━━━━━
🏢 *${lead.empresa}*
📍 ${lead.ubicacion}
📊 Score: ${lead.score}/100
🎯 Sector: ${lead.sector}
📧 Email: ${lead.email || 'No encontrado'}
👤 Contacto: ${lead.contacto || 'Desconocido'}

💡 *Por qué es HOT:*
${lead.razon_score}

📝 *Señal urgencia:*
${lead.señal_urgencia}

→ _Email enviado automáticamente_
  `.trim();
  await send(msg);
}

// ── Alerta respuesta recibida ─────────────────────────────────────
export async function alertReply(lead, sentiment) {
  const emoji = sentiment === 'positive' ? '✅' : sentiment === 'neutral' ? '🟡' : '❌';
  const msg = `
${emoji} *RESPUESTA RECIBIDA*
━━━━━━━━━━━━━━━━━
🏢 *${lead.empresa}*
📧 ${lead.email}
Sentimiento: *${sentiment.toUpperCase()}*
Sector: ${lead.sector} | Score: ${lead.score}

→ _Acción requerida: revisar y responder_
  `.trim();
  await send(msg);
}

// ── Alerta error crítico ──────────────────────────────────────────
export async function alertError(context, error) {
  await send(`⚠️ *Error en Sales Agency*\nContexto: ${context}\nError: ${error}`);
}

// ── Reporte de inicio ─────────────────────────────────────────────
export async function sendStartupMessage(sectors) {
  await send(`🚀 *BeZhas Sales Agency iniciada*\nSectores activos: ${sectors.join(', ')}\nPrecio BEZ: $${process.env.BEZ_PRICE_USD}\nLímite diario: ${process.env.MAX_EMAILS_PER_DAY} emails`);
}
