'use strict';

/**
 * Tests del push de aprobaciones HITL: enrutado por departamento a bots
 * distintos, formato, fallback y la integración con el HITLGate.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const HitlNotifier = require('../src/platform/HitlNotifier');
const HITLGate = require('../src/core/HITLGate');
const EventBus = require('../src/core/EventBus');

/** Notificador con un "send" capturador por departamento. */
function build() {
  const sent = { finance: [], marketing: [] };
  const mk = (bucket) => async (m) => { sent[bucket].push(m); return { sent: true }; };
  const notifier = new HitlNotifier({
    routes: {
      finance: { send: mk('finance'), chatId: 'CFO' },
      marketing: { send: mk('marketing'), chatId: 'MKT' },
    },
    fallback: { send: mk('marketing'), chatId: 'MKT' },
  });
  return { notifier, sent };
}

test('enruta finanzas al bot del CFO y marketing al suyo (por prefijo del agentId)', async () => {
  const { notifier, sent } = build();
  await notifier.notify({ approvalId: 'a1', tenantId: 'acme', agentId: 'finance.ar-chaser', action: { category: 'payment' } });
  await notifier.notify({ approvalId: 'a2', tenantId: 'acme', agentId: 'marketing.social', action: { category: 'public_post' } });

  assert.equal(sent.finance.length, 1);
  assert.equal(sent.finance[0].to, 'CFO');
  assert.match(sent.finance[0].text, /finance/);
  assert.equal(sent.marketing.length, 1);
  assert.equal(sent.marketing[0].to, 'MKT');
});

test('departamento sin ruta usa el fallback', async () => {
  const { notifier, sent } = build();
  await notifier.notify({ approvalId: 'a3', tenantId: 'acme', agentId: 'sales.negotiator', action: { category: 'contract' } });
  assert.equal(sent.marketing.length, 1, 'cae al fallback (marketing)');
});

test('setChat actualiza el destino de un departamento', async () => {
  const { notifier, sent } = build();
  notifier.setChat('finance', 'CFO-2');
  await notifier.notify({ approvalId: 'a4', tenantId: 'acme', agentId: 'finance.x', action: {} });
  assert.equal(sent.finance[0].to, 'CFO-2');
});

test('sin destino configurado no envía', async () => {
  const notifier = new HitlNotifier({ routes: {}, fallback: null });
  const r = await notifier.notify({ approvalId: 'a', tenantId: 'x', agentId: 'finance.x' });
  assert.equal(r.sent, false);
});

test('fromEnv en modo simulado no rompe (sin tokens reales)', async () => {
  const notifier = HitlNotifier.fromEnv({ HITL_TELEGRAM_CHAT_ID: '123' }); // sin tokens → senders simulados
  const r = await notifier.notify({ approvalId: 'a', tenantId: 'x', agentId: 'finance.ar-chaser', action: { category: 'payment' } });
  assert.equal(r.sent, true);
  assert.equal(r.simulated, true);
});

test('integración: HITLGate.request enruta la notificación por departamento', async () => {
  const { notifier, sent } = build();
  const gate = new HITLGate({ bus: new EventBus('acme'), audit: { log() {} }, notify: (a) => notifier.notify(a) });

  const pending = gate.request({ tenantId: 'acme', agentId: 'finance.ar-chaser', action: { category: 'transfer' }, reason: 'mover dinero' });
  assert.equal(sent.finance.length, 1, 'avisó al bot financiero');

  const [appr] = gate.listPending('acme');
  gate.resolve(appr.approvalId, true);
  await pending;
});
