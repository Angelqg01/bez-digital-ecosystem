'use strict';

/**
 * Auto-respondedor de correo: lo que NO debe hacer pesa más que lo que hace.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const MailInbound = require('../src/channels/MailInbound');
const EmailChannel = require('../src/channels/EmailChannel');
const BaseChannel = require('../src/channels/BaseChannel');
const { motivoParaNoResponder, limpiarCuerpo, aliasDe } = MailInbound;

const DESDE = new Date('2026-10-19T12:00:00Z');
const base = (o = {}) => ({
  uid: 1, internalDate: new Date('2026-10-19T13:00:00Z'), messageId: '<m1@cliente.com>', references: [],
  from: 'ana@cliente.com', fromName: 'Ana', recipients: ['support@bezhas.com'], subject: 'No puedo entrar', text: 'Hola, no puedo entrar a mi cuenta.',
  headers: {}, ...o,
});

function montar(mensajes, { entrega } = {}) {
  const marcados = []; const enviados = []; const tareas = [];
  const reader = {
    // Como el servidor real: lo marcado `OperantHandled` ya no vuelve.
    fetchUnhandled: async ({ skipUids }) => mensajes.filter((m) => !skipUids.has(m.uid) && !marcados.includes(m.uid)),
    markHandled: async ({ uid }) => { marcados.push(uid); },
  };
  const tenants = { handleAndWait: async (_t, input) => { tareas.push(input); return { department: 'support', result: { resolution: { reply: 'Te ayudamos.' } } }; } };
  const channel = new EmailChannel({ send: entrega || (async (m) => { enviados.push(m); return { sent: true }; }) });
  const inbound = new MailInbound({ reader, tenants, channel, since: DESDE, log: { info() {}, warn() {} } });
  return { inbound, marcados, enviados, tareas };
}

test('responde a un cliente real, desde el alias, con hilo y Auto-Submitted, y marca el correo', async () => {
  const { inbound, marcados, enviados } = montar([base()]);
  const r = await inbound.pollOnce();
  assert.equal(r.respondidos, 1);
  assert.deepEqual(marcados, [1]);
  assert.equal(enviados[0].to, 'ana@cliente.com');
  assert.equal(enviados[0].meta.from, 'support@bezhas.com');
  assert.equal(enviados[0].meta.headers['Auto-Submitted'], 'auto-replied');
  assert.equal(enviados[0].meta.headers['In-Reply-To'], '<m1@cliente.com>');
  assert.equal(enviados[0].text, 'Te ayudamos.');
});

test('lo que no va a un alias NO se toca: ni se contesta ni se marca', async () => {
  const { inbound, marcados, enviados } = montar([base({ recipients: ['yoelceo@bezhas.com'] })]);
  const r = await inbound.pollOnce();
  assert.equal(r.ajenos, 1);
  assert.deepEqual(marcados, []);
  assert.equal(enviados.length, 0);
});

test('el histórico anterior a la activación no recibe respuesta', async () => {
  const { inbound, marcados, enviados } = montar([base({ internalDate: new Date('2026-10-18T09:00:00Z') })]);
  await inbound.pollOnce();
  assert.equal(enviados.length, 0);
  assert.deepEqual(marcados, []);
});

test('máquinas: Auto-Submitted, listas, no-reply, rebotes, ausencias y remitentes internos se descartan marcados', async () => {
  const casos = [
    base({ uid: 10, headers: { autoSubmitted: 'auto-generated' } }),
    base({ uid: 11, headers: { precedence: 'bulk' } }),
    base({ uid: 12, headers: { listUnsubscribe: '<mailto:x@y.z>' } }),
    base({ uid: 13, from: 'no-reply@proveedor.com' }),
    base({ uid: 14, from: 'mailer-daemon@mx.cliente.com' }),
    base({ uid: 15, subject: 'Respuesta automática: fuera de la oficina' }),
    base({ uid: 16, from: 'yoelceo@bezhas.com' }),
    base({ uid: 17, headers: { returnPath: '<>' } }),
  ];
  const { inbound, marcados, enviados } = montar(casos);
  const r = await inbound.pollOnce();
  assert.equal(enviados.length, 0);
  assert.equal(r.descartados, casos.length);
  assert.deepEqual(marcados, casos.map((c) => c.uid));
});

test('tope por remitente: a la 4.ª en un día no se contesta (corta bucles)', async () => {
  const { inbound, enviados } = montar([1, 2, 3, 4, 5].map((uid) => base({ uid, messageId: `<m${uid}@c.com>` })));
  await inbound.pollOnce();
  assert.equal(enviados.length, 3);
});

test('un fallo al contestar no marca a la primera y, tras el reintento, no contesta dos veces', async () => {
  let intentos = 0;
  const { inbound, marcados } = montar([base()], { entrega: async () => { intentos += 1; throw new Error('smtp caído'); } });
  await inbound.pollOnce();
  assert.deepEqual(marcados, []);
  await inbound.pollOnce();
  assert.deepEqual(marcados, [1]);      // al agotar los reintentos se marca igualmente
  await inbound.pollOnce();
  assert.equal(intentos, 2);
});

test('sin `since` no arranca: nunca contestaría al histórico', () => {
  assert.throws(() => new MailInbound({ reader: {}, tenants: {}, channel: {} }), /since/);
});

test('un departamento que no es Soporte nunca deja salir su resumen interno al cliente', () => {
  const task = { department: 'sales', result: { summary: 'lead score 0.92, margen 40%, nota interna' } };
  assert.equal(BaseChannel.replyText(task), BaseChannel.ACUSE);
  assert.doesNotMatch(BaseChannel.replyText(task), /score|margen/);
  assert.equal(BaseChannel.replyText({ department: 'support', result: { resolution: { reply: 'Hola' } } }), 'Hola');
});

test('utilidades: cuerpo sin citas, alias por destinatario real', () => {
  assert.equal(limpiarCuerpo('Hola\n\n> cita antigua\nEl lun, 1 oct escribió:\n> más'), 'Hola');
  assert.equal(aliasDe(['otro@x.com', 'Ventas@bezhas.com']), 'ventas@bezhas.com');
  assert.equal(motivoParaNoResponder(base()), null);
});

test('lo que escribe un cliente por un canal va a Soporte, no a Tesorería ni a Ventas', async () => {
  const { enrutarCanalDeCliente } = require('../src/channels/routing');
  const Orchestrator = require('../src/core/Orchestrator');
  const clasificar = (input) => Orchestrator.prototype._classify.call({ _learnedRoutes: [] }, input);

  // Sin el enrutado, «bez-coin» caía en Tesorería y «comprar» en Ventas: acuse de recibo y nada más.
  assert.equal((await clasificar({ text: '¿Qué es BEZ-Coin?' })).department, 'treasury');
  for (const texto of ['¿Qué es BEZ-Coin?', 'Envía los pasos para comprar tokens', 'quiero invertir en una ronda']) {
    for (const canal of ['telegram', 'email', 'whatsapp', 'web']) {
      const input = enrutarCanalDeCliente(canal, { text: texto, channel: canal });
      assert.equal((await clasificar(input)).department, 'support', `${canal}: ${texto}`);
    }
  }
  // Los webhooks que ya traen tipo y departamento no se tocan.
  const stripe = enrutarCanalDeCliente('telegram', { text: 'x', type: 'finance:payment', department: 'finance' });
  assert.equal(stripe.department, 'finance');
  // Un canal que no es de cliente tampoco.
  assert.equal(enrutarCanalDeCliente('interno', { text: 'x' }).department, undefined);
});

test('el cliente no ve marcadores sin rellenar como [Nombre del Asesor]', () => {
  const SupportChatAgent = require('../src/agents/support/SupportChatAgent');
  assert.equal(SupportChatAgent.limpiarMarcadores('Saludos,\n[Nombre del Asesor]'), 'Saludos,\nEl equipo de BeZhas');
  assert.equal(SupportChatAgent.limpiarMarcadores('Atentamente, [Tu nombre]'), 'Atentamente, El equipo de BeZhas');
  assert.equal(SupportChatAgent.limpiarMarcadores('Sin marcadores [1] aquí'), 'Sin marcadores [1] aquí');
});
