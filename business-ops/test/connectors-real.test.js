'use strict';

/**
 * Conectores en modo real: se prueba el CABLEADO de la vía real con un `fetch`
 * inyectado (doble). No se usan credenciales reales ni se contacta a ningún
 * servicio externo: se verifica que, configurados, hacen la llamada correcta.
 * El envío simulado (sin credenciales) sigue funcionando para desarrollo.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const StripeConnector = require('../src/connectors/StripeConnector');
const CalendarConnector = require('../src/connectors/CalendarConnector');
const EmailConnector = require('../src/connectors/EmailConnector');
const TwentyCRM = require('../src/connectors/TwentyCRM');

function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: opts.body, headers: opts.headers });
    for (const [match, resp] of routes) {
      if (url.includes(match)) return { ok: true, status: 200, json: async () => resp };
    }
    return { ok: false, status: 404, json: async () => ({ error: { message: 'no route' } }) };
  };
  fn.calls = calls;
  return fn;
}

// ── Stripe ──────────────────────────────────────────────────────
test('Stripe real: createPaymentLink crea precio + link vía API (form-urlencoded)', async () => {
  const fetchFn = fakeFetch([
    ['/prices', { id: 'price_123' }],
    ['/payment_links', { id: 'plink_123', url: 'https://buy.stripe.com/abc', active: true }],
  ]);
  const s = new StripeConnector({ tenantId: 't', config: { apiKey: 'sk_test_x', fetch: fetchFn } });
  assert.equal(s.simulated, false);
  const r = await s.createPaymentLink({ amount: 199.5, description: 'Plan pro' });
  assert.equal(r.url, 'https://buy.stripe.com/abc');
  assert.equal(r.paymentLinkId, 'plink_123');
  // El precio se envió en la unidad mínima (céntimos) y como form-urlencoded.
  const priceCall = fetchFn.calls.find((c) => c.url.includes('/prices'));
  assert.match(priceCall.body, /unit_amount=19950/);
  assert.match(priceCall.headers['Content-Type'], /x-www-form-urlencoded/);
  assert.match(priceCall.headers.Authorization, /Bearer sk_test_x/);
});

test('Stripe simulado sin clave (desarrollo)', async () => {
  const s = new StripeConnector({ tenantId: 't' });
  assert.equal(s.simulated, true);
  const r = await s.createPaymentLink({ amount: 10 });
  assert.equal(r.simulated, true);
});

// ── Calendar (Cal.com) ──────────────────────────────────────────
test('Calendar real: scheduleMeeting hace booking vía Cal.com v2', async () => {
  const fetchFn = fakeFetch([['/bookings', { data: { id: 'bk_1', status: 'accepted', meetingUrl: 'https://cal.com/x' } }]]);
  const c = new CalendarConnector({ tenantId: 't', config: { apiKey: 'cal_x', eventTypeId: 42, fetch: fetchFn } });
  const r = await c.scheduleMeeting({ date: '2026-07-20', slot: '10:00', name: 'Ana', email: 'ana@x.es' });
  assert.equal(r.id, 'bk_1');
  assert.equal(r.status, 'accepted');
  const call = fetchFn.calls[0];
  assert.match(call.url, /\/bookings/);
  assert.match(call.body, /"eventTypeId":42/);
});

// ── Email ───────────────────────────────────────────────────────
test('Email real vía Resend: POST a la API con el remitente configurado', async () => {
  const fetchFn = fakeFetch([['api.resend.com', { id: 'email_1' }]]);
  const e = new EmailConnector({ tenantId: 't', config: { resendKey: 're_x', from: 'ventas@bez.digital', fetch: fetchFn } });
  assert.equal(e.mode, 'resend');
  const r = await e.send({ to: 'lead@puerto.es', subject: 'Propuesta', body: 'Hola' });
  assert.equal(r.sent, true);
  assert.equal(r.provider, 'resend');

  // Antes del envío se comprueba el canal (GET /domains, sin enviar nada); el
  // POST del correo es la llamada siguiente.
  const comprobacion = fetchFn.calls.find((c) => c.url.includes('/domains'));
  assert.ok(comprobacion, 'se verifica el canal antes de enviar');
  const envio = fetchFn.calls.find((c) => c.url.includes('/emails'));
  assert.match(envio.body, /"from":"ventas@bez.digital"/);
});

test('Email exige destinatario y cae a simulado sin credenciales', async () => {
  const e = new EmailConnector({ tenantId: 't' });
  assert.equal(e.mode, 'simulado');
  await assert.rejects(() => e.send({ subject: 'x' }), /destinatario/);
  const r = await e.send({ to: 'a@b.c', subject: 'x', body: 'y' });
  assert.equal(r.simulated, true);
});

// ── Twenty CRM ──────────────────────────────────────────────────
test('Twenty CRM real: upsertLead crea empresa + persona vía REST', async () => {
  const fetchFn = fakeFetch([
    ['/rest/companies', { data: { id: 'co_1' } }],
    ['/rest/people', { data: { id: 'pe_1' } }],
  ]);
  const crm = new TwentyCRM({ tenantId: 't', config: { apiUrl: 'https://crm.local', apiKey: 'k', fetch: fetchFn } });
  assert.equal(crm.simulated, false);
  const r = await crm.upsertLead({ companyName: 'Puerto X', contactName: 'Ana', role: 'COO', fitScore: 90 });
  assert.equal(r.id, 'co_1');
  assert.equal(r.personId, 'pe_1');
});

// ── Correo: configurado no es lo mismo que operativo ────────────────────────

test('Email: un canal configurado que no responde NO se anuncia como operativo', async () => {
  // SMTP apuntando a un puerto donde no hay nadie: es exactamente el caso real
  // de tener SMTP_HOST=localhost con el servidor de correo sin levantar.
  const e = new EmailConnector({
    tenantId: 't',
    config: { host: '127.0.0.1', port: 1, from: 'no-reply@bezhas.com' },
  });
  assert.equal(e.mode, 'smtp', 'con SMTP_HOST se declara en modo smtp');

  const estado = await e.verify();
  assert.equal(estado.ok, false, 'la comprobación detecta que no hay servidor');
  assert.match(estado.detail, /no responde/);
  assert.equal(e.degraded, true);

  // Y lo que importa: un envío aprobado no se da por hecho.
  const r = await e.send({ to: 'lead@puerto.es', subject: 'Propuesta', body: 'Hola' });
  assert.equal(r.sent, false, 'no se puede dar por enviado lo que no ha salido');
  assert.equal(r.degraded, true);
  assert.match(r.reason, /no responde/);
});

test('Email: un envío simulado se reporta como NO enviado', async () => {
  const e = new EmailConnector({ tenantId: 't' });
  assert.equal(e.mode, 'simulado');

  const r = await e.send({ to: 'a@b.c', subject: 'x', body: 'y' });
  assert.equal(r.simulated, true);
  // Antes devolvía sent:true y LeadFunnel lo registraba como 'delivered':
  // el embudo reentrenaba sus pesos con correos que nunca salieron.
  assert.equal(r.sent, false, 'un simulado no ha enviado nada, y debe decirlo');
  assert.ok(r.reason);
});

test('Email: la comprobación se cachea y el canal se recupera solo', async () => {
  let intentos = 0;
  const fetchFn = async () => { intentos++; return { ok: intentos > 1, status: intentos > 1 ? 200 : 401, json: async () => ({}) }; };
  const e = new EmailConnector({
    tenantId: 't',
    config: { resendKey: 're_x', from: 'ventas@bez.digital', fetch: fetchFn, verifyTtlMs: 0 },
  });

  const primera = await e.verify();
  assert.equal(primera.ok, false, 'clave rechazada → canal degradado');
  assert.match(primera.detail, /401|inválida/);

  // Con TTL 0 la siguiente comprobación vuelve a preguntar: si el problema se
  // arregló (clave corregida, servidor levantado), el canal se recupera sin
  // reiniciar la plataforma.
  const segunda = await e.verify();
  assert.equal(segunda.ok, true);
  assert.equal(e.degraded, false);
});

test('Email: describe() no filtra credenciales', async () => {
  const e = new EmailConnector({
    tenantId: 't',
    config: { host: 'mail.bezhas.com', port: 465, user: 'buzon', pass: 'secreto-que-no-debe-salir', from: 'no-reply@bezhas.com' },
  });
  const d = JSON.stringify(e.describe());
  assert.match(d, /mail\.bezhas\.com:465/);
  assert.ok(!d.includes('secreto-que-no-debe-salir'), 'la contraseña nunca sale en el estado del canal');
});
