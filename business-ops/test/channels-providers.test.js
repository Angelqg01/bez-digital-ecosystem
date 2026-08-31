'use strict';

/**
 * Tests de los canales de proveedor: parseo del webhook, verificación y entrega
 * de la respuesta (con un "send" falso que captura el envío — sin red).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const TelegramChannel = require('../src/channels/TelegramChannel');
const WhatsAppChannel = require('../src/channels/WhatsAppChannel');
const EmailChannel = require('../src/channels/EmailChannel');
const { createTransports } = require('../src/channels/transports');

const taskResolved = { id: 't', tenantId: 'acme', status: 'completed', result: { outcome: 'ok', resolution: { reply: '¡Listo!' } } };

// ── Telegram ────────────────────────────────────────────────────

test('Telegram: parsea el update y entrega la respuesta al chat de origen', async () => {
  const sent = [];
  const ch = new TelegramChannel({ send: async (m) => { sent.push(m); return { sent: true }; } });

  const input = ch.parseInbound({ message: { text: ' hola ', chat: { id: 55 }, from: { id: 99 } } });
  assert.deepEqual(input, { text: 'hola', customerId: 'tg:99', channel: 'telegram', meta: { chatId: 55 } });

  await ch.deliver({ input, task: taskResolved });
  assert.equal(sent[0].to, 55);
  assert.equal(sent[0].text, '¡Listo!');

  assert.throws(() => ch.parseInbound({ message: { chat: { id: 1 } } }), /sin texto/);
});

test('Telegram: verify exige el secreto si está configurado', () => {
  const ch = new TelegramChannel({ secret: 's3cr3t' });
  assert.equal(ch.verify({ headers: { 'x-telegram-bot-api-secret-token': 's3cr3t' } }), true);
  assert.equal(ch.verify({ headers: {} }), false);
  assert.equal(new TelegramChannel({}).verify({ headers: {} }), true, 'sin secreto → abierto');
});

// ── WhatsApp ────────────────────────────────────────────────────

test('WhatsApp: parsea el webhook de Meta y responde al remitente', async () => {
  const sent = [];
  const ch = new WhatsAppChannel({ send: async (m) => { sent.push(m); return { sent: true }; } });

  const raw = { entry: [{ changes: [{ value: { messages: [{ from: '34600111222', text: { body: 'no funciona' } }] } }] }] };
  const input = ch.parseInbound(raw);
  assert.equal(input.text, 'no funciona');
  assert.equal(input.customerId, 'wa:34600111222');

  await ch.deliver({ input, task: taskResolved });
  assert.equal(sent[0].to, '34600111222');
});

test('WhatsApp: handshake de verificación GET', () => {
  const ch = new WhatsAppChannel({ verifyToken: 'tok' });
  let code, body;
  const res = { status(c) { code = c; return this; }, send(b) { body = b; return this; }, end() { return this; } };

  ch.handleVerification({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': 'C1' } }, res);
  assert.equal(code, 200); assert.equal(body, 'C1');

  ch.handleVerification({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'malo', 'hub.challenge': 'C1' } }, res);
  assert.equal(code, 403);
});

// ── Email ───────────────────────────────────────────────────────

test('Email: parsea el inbound y responde con asunto Re:', async () => {
  const sent = [];
  const ch = new EmailChannel({ send: async (m) => { sent.push(m); return { sent: true }; } });

  const input = ch.parseInbound({ from: 'cliente@empresa.com', subject: 'Ayuda', text: 'tengo una duda' });
  assert.equal(input.customerId, 'email:cliente@empresa.com');

  await ch.deliver({ input, task: taskResolved });
  assert.equal(sent[0].to, 'cliente@empresa.com');
  assert.equal(sent[0].meta.subject, 'Ayuda');

  assert.throws(() => ch.parseInbound({ from: 'x@y.com' }), /from.*text|text/);
});

// ── Transportes ─────────────────────────────────────────────────

test('Transportes sin credenciales caen a modo simulado', async () => {
  const t = createTransports({}); // entorno vacío
  const r = await t.telegram({ to: 1, text: 'hola' });
  assert.equal(r.simulated, true);
});
