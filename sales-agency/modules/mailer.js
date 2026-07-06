// Mailer — envía emails via Gmail (App Password)
import nodemailer from 'nodemailer';
import Anthropic from '@anthropic-ai/sdk';
import * as db from './db.js';
import { getPersona } from '../config/personas.js';
import { getSequence } from '../config/sequences.js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BEZ_PRICE = process.env.BEZ_PRICE_USD || '0.0075';
const SALE_URL = process.env.BEZ_SALE_URL || 'https://bez.digital/token/buy';
const MAX_PER_DAY = parseInt(process.env.MAX_EMAILS_PER_DAY || '30');

let emailsSentToday = 0;
let lastResetDate = new Date().toDateString();

function getTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function checkRateLimit() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) { emailsSentToday = 0; lastResetDate = today; }
  if (emailsSentToday >= MAX_PER_DAY) throw new Error(`Límite diario de ${MAX_PER_DAY} emails alcanzado`);
}

async function generateEmailBody(lead, step) {
  const persona = getPersona(lead.sector);
  const sequence = getSequence(lead.sector);
  const stepConfig = sequence.find(s => s.step === step);
  if (!stepConfig) throw new Error(`Step ${step} no encontrado para sector ${lead.sector}`);

  const prompt = stepConfig.bodyPrompt(lead, persona, BEZ_PRICE, SALE_URL);
  const res = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content[0].text.trim();
}

// ── Enviar email ──────────────────────────────────────────────────
export async function sendEmail(lead, step, emit = () => {}) {
  checkRateLimit();

  const persona = getPersona(lead.sector);
  const sequence = getSequence(lead.sector);
  const stepConfig = sequence.find(s => s.step === step);
  if (!stepConfig) { emit({ type: 'email_error', reason: 'step not found', step, lead: lead.empresa }); return false; }

  if (!lead.email) { emit({ type: 'email_skip', reason: 'no email', lead: lead.empresa }); return false; }

  try {
    const body = await generateEmailBody(lead, step);
    const subject = stepConfig.subject(lead);

    const transport = getTransport();
    await transport.sendMail({
      from: `"${persona.name} — BeZhas" <${process.env.GMAIL_USER}>`,
      to: lead.email,
      replyTo: process.env.REPLY_TO_EMAIL || process.env.GMAIL_USER,
      subject,
      text: body,
      html: `<div style="font-family:system-ui,sans-serif;max-width:600px;line-height:1.6;color:#333">
        ${body.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}
        <p style="margin-top:32px;color:#888;font-size:12px">
          BeZhas | bez.digital | ${process.env.REPLY_TO_EMAIL}<br>
          <a href="${SALE_URL}" style="color:#00D4FF">Comprar BEZ-Coin — $${BEZ_PRICE}/BEZ →</a>
        </p>
        <p style="color:#bbb;font-size:11px">
          Para no recibir más emails, responde con "CANCELAR".
        </p>
      </div>`,
    });

    emailsSentToday++;

    // Update lead
    const now = new Date().toISOString();
    const patch = {
      steps_sent: [...(lead.steps_sent || []), step],
      last_email_at: now,
      last_email_step: step,
      last_email_label: stepConfig.label,
    };
    if (step === 0) patch.contacted_at = now;
    if (step === 0) patch.status = 'contacted';
    db.updateLead(lead.id, patch);
    db.log({ event: 'email_sent', id: lead.id, empresa: lead.empresa, step, subject });

    emit({ type: 'email_sent', empresa: lead.empresa, step, subject });
    return true;
  } catch (err) {
    emit({ type: 'email_error', empresa: lead.empresa, step, error: err.message });
    db.log({ event: 'email_error', id: lead.id, empresa: lead.empresa, step, error: err.message });
    return false;
  }
}

// ── Enviar primer email a leads nuevos ─────────────────────────────
export async function sendFirstEmails(emit = () => {}) {
  const leads = db.getAllLeads().filter(l => l.status === 'new' && l.email);
  let sent = 0;
  for (const lead of leads) {
    if (emailsSentToday >= MAX_PER_DAY) break;
    const ok = await sendEmail(lead, 0, emit);
    if (ok) sent++;
    await sleep(3000);
  }
  return sent;
}

// ── Procesar follow-ups pendientes ────────────────────────────────
export async function processFollowUps(emit = () => {}) {
  const leads = db.getAllLeads().filter(l =>
    l.status === 'contacted' &&
    l.email &&
    !['responded_positive', 'demo_booked', 'disqualified', 'unsubscribed'].includes(l.status)
  );

  const now = Date.now();
  let fired = 0;

  for (const lead of leads) {
    if (emailsSentToday >= MAX_PER_DAY) break;

    const contactedAt = new Date(lead.contacted_at).getTime();
    const daysSince = (now - contactedAt) / 86400000;
    const sequence = getSequence(lead.sector);
    const sentSteps = lead.steps_sent || [];

    for (const stepConfig of sequence) {
      if (stepConfig.step === 0) continue; // Ya enviado
      if (sentSteps.includes(stepConfig.step)) continue;
      if (daysSince < stepConfig.dayOffset) break;

      const ok = await sendEmail(lead, stepConfig.step, emit);
      if (ok) fired++;
      await sleep(3000);
      break; // Solo un follow-up por lead por ejecución
    }
  }
  return fired;
}

export function getTodayStats() {
  return { emailsSentToday, limit: MAX_PER_DAY, remaining: MAX_PER_DAY - emailsSentToday };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
