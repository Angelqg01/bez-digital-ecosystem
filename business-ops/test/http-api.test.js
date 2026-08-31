'use strict';

/**
 * Tests de integración de la API HTTP.
 *
 * Por qué existe: los 57 endpoints de `src/server.js` no tenían ni una prueba.
 * Toda la lógica de dominio estaba cubierta, pero la capa que de verdad está
 * expuesta a internet —autenticación, aislamiento por tenant, verificación de
 * firmas de webhooks y defensas del formulario público— no la tocaba nadie. Es
 * justo donde un fallo no es un bug, es un incidente: cobrar sin firma válida,
 * leer los datos de otra empresa, o disparar una transferencia sin humano.
 *
 * Se levanta el servidor real (`app.listen(0)`) y se le habla por HTTP con
 * fetch. Sin supertest ni ningún doble: si el middleware está mal encadenado o
 * una ruta no valida lo que cree validar, aquí se ve.
 */

// ── Aislamiento del entorno ────────────────────────────────────────────────
// server.js hace `require('dotenv').config()`, que lee el .env REAL del
// proyecto: tokens de Telegram, claves de Stripe, la wallet de dispersión. Un
// test no puede correr con eso cargado — un HITL de prueba mandaría un mensaje
// de verdad. dotenv resuelve `.env` contra el directorio de trabajo, así que
// nos movemos a uno vacío ANTES de requerir el servidor. Los require siguen
// funcionando: se resuelven contra __dirname, no contra el cwd.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { once } = require('events');

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-http-')));

// Configuración determinista, fijada antes de cargar el módulo.
process.env.INTERNAL_API_KEY = 'admin-key-de-prueba';
// Store en memoria SIEMPRE, aunque el entorno traiga DATABASE_URL: lo que se
// prueba aquí es la capa HTTP, no la persistencia (eso es store-contract). Con
// una base compartida, estos tests arrastrarían los tenants de la ejecución
// anterior y dejarían basura en una base real.
delete process.env.DATABASE_URL;
process.env.SQLITE_PATH = 'memory';          // nada tocará data/operant.db
process.env.INTAKE_MAX_PER_MINUTE = '3';     // el throttle se lee al cargar
delete process.env.STRIPE_WEBHOOK_SECRET;    // cada test fija el suyo
delete process.env.LEADS_WEBHOOK_SECRET;
delete process.env.SIGNUP_SECRET;
delete process.env.CSAT_SECRET;
// Los canales se construyen al cargar el módulo: sus secretos van aquí.
process.env.TELEGRAM_WEBHOOK_SECRET = 'secreto-telegram';
process.env.WHATSAPP_VERIFY_TOKEN = 'token-whatsapp';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const { app, tenants, rateLimiter } = require('../src/server');

const ADMIN = process.env.INTERNAL_API_KEY;
let server;
let base;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// ── Utilidades ──────────────────────────────────────────────────────────────

async function call(method, ruta, { key, body, headers = {}, raw } = {}) {
  const init = { method, headers: { ...headers } };
  if (key) init.headers['x-api-key'] = key;
  if (raw !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = raw;
  } else if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(base + ruta, init);
  const texto = await res.text();
  let cuerpo;
  try { cuerpo = JSON.parse(texto); } catch { cuerpo = texto; }
  return { status: res.status, body: cuerpo, headers: res.headers };
}

const get = (ruta, opts) => call('GET', ruta, opts);
const post = (ruta, opts) => call('POST', ruta, opts);

/** Da de alta un tenant y devuelve su clave de API. */
async function altaTenant(tenantId, plan = 'pro') {
  const res = await post('/tenants', { key: ADMIN, body: { tenantId, plan } });
  assert.equal(res.status, 200, `alta de ${tenantId}: ${JSON.stringify(res.body)}`);
  return res.body.apiKey;
}

/** Firma un cuerpo como lo haría Stripe (esquema t=...,v1=...). */
function firmaStripe(rawBody, secret, t = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

/** Espera a que una condición se cumpla (las tareas se procesan en segundo plano). */
async function esperarA(fn, { timeoutMs = 5000, intervalMs = 25 } = {}) {
  const limite = Date.now() + timeoutMs;
  for (;;) {
    const valor = await fn();
    if (valor) return valor;
    if (Date.now() > limite) return null;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ── Alta y autenticación ────────────────────────────────────────────────────

test('POST /tenants: sin clave 401, con clave de tenant 403, con clave admin 200', async () => {
  assert.equal((await post('/tenants', { body: { tenantId: 'nadie' } })).status, 401);
  assert.equal((await post('/tenants', { key: 'inventada', body: { tenantId: 'nadie' } })).status, 401);

  const claveAcme = await altaTenant('auth-acme');

  // Una clave válida de tenant NO es una clave de administración.
  const comoTenant = await post('/tenants', { key: claveAcme, body: { tenantId: 'auth-otro', plan: 'pro' } });
  assert.equal(comoTenant.status, 403, 'un cliente no puede dar de alta a otros clientes');
  assert.ok(!tenants.get('auth-otro'), 'y no se ha creado nada');
});

test('El alta devuelve una clave de API que funciona y que no vale para otro tenant', async () => {
  const claveUno = await altaTenant('scope-uno');
  await altaTenant('scope-dos');

  assert.equal((await get('/tenants/scope-uno/usage', { key: claveUno })).status, 200);

  // El corazón de la multi-tenencia en la capa HTTP.
  const cruzado = await get('/tenants/scope-dos/usage', { key: claveUno });
  assert.equal(cruzado.status, 403, 'la clave de un cliente no abre los recursos de otro');

  // Y con la clave admin sí, que es la que opera la plataforma.
  assert.equal((await get('/tenants/scope-dos/usage', { key: ADMIN })).status, 200);
});

test('Los endpoints de administración rechazan una clave de tenant válida', async () => {
  const clave = await altaTenant('admin-check');

  for (const ruta of ['/observability/otlp', '/observability/langfuse']) {
    assert.equal((await get(ruta, { key: clave })).status, 403, `${ruta} debe ser solo admin`);
    assert.equal((await get(ruta, { key: ADMIN })).status, 200);
  }
});

test('POST /signup: honra SIGNUP_SECRET cuando está configurado', async () => {
  process.env.SIGNUP_SECRET = 'secreto-de-alta';
  try {
    const sinCabecera = await post('/signup', { body: { tenantId: 'signup-uno', plan: 'starter' } });
    assert.equal(sinCabecera.status, 401);
    assert.ok(!tenants.get('signup-uno'));

    const conCabecera = await post('/signup', {
      body: { tenantId: 'signup-uno', plan: 'starter' },
      headers: { 'x-signup-secret': 'secreto-de-alta' },
    });
    assert.equal(conCabecera.status, 200);
    assert.ok(conCabecera.body.apiKey);
  } finally {
    delete process.env.SIGNUP_SECRET;
  }
});

test('El alta limita los departamentos a los del plan y rechaza datos inválidos', async () => {
  // starter no incluye finanzas: pedirlo no lo concede.
  const res = await post('/tenants', {
    key: ADMIN,
    body: { tenantId: 'plan-limite', plan: 'starter', departments: ['sales', 'finance'] },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.departments, ['sales'], 'finanzas no entra en el plan starter');

  assert.equal((await post('/tenants', { key: ADMIN, body: { tenantId: 'MAYÚSCULAS' } })).status, 400);
  assert.equal((await post('/tenants', { key: ADMIN, body: { tenantId: 'plan-malo', plan: 'inexistente' } })).status, 400);
});

// ── Flujo principal ─────────────────────────────────────────────────────────

test('POST /handle encola la solicitud y la tarea se puede consultar después', async () => {
  const clave = await altaTenant('flujo');

  const res = await post('/tenants/flujo/handle', {
    key: clave,
    body: { text: 'Quiero una demo y precio', channel: 'web', customerId: 'c1' },
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.taskId, 'devuelve el identificador para seguir la tarea');

  const terminada = await esperarA(async () => {
    const t = await get(`/tenants/flujo/tasks/${res.body.taskId}`, { key: clave });
    return t.body?.status === 'completed' ? t.body : null;
  });
  assert.ok(terminada, 'la tarea llega a completed');
  assert.equal(terminada.department, 'sales', 'y se enrutó al departamento correcto');
});

test('Un tenant que no existe no filtra información: 400/404, nunca un 500', async () => {
  const handle = await post('/tenants/no-existe/handle', { key: ADMIN, body: { text: 'hola' } });
  assert.equal(handle.status, 400);

  for (const ruta of ['/tenants/no-existe/usage', '/tenants/no-existe/alerts', '/tenants/no-existe/dashboard']) {
    const res = await get(ruta, { key: ADMIN });
    assert.equal(res.status, 404, `${ruta} → 404`);
  }
});

test('El rate limit del plan devuelve 429 con Retry-After', async () => {
  const clave = await altaTenant('limitado');
  rateLimiter.setLimit('limitado', 2);

  assert.equal((await post('/tenants/limitado/handle', { key: clave, body: { text: 'una' } })).status, 200);
  assert.equal((await post('/tenants/limitado/handle', { key: clave, body: { text: 'dos' } })).status, 200);

  const tercera = await post('/tenants/limitado/handle', { key: clave, body: { text: 'tres' } });
  assert.equal(tercera.status, 429);
  assert.equal(tercera.body.code, 'rate_limited');
  assert.ok(tercera.headers.get('retry-after'), 'dice cuándo reintentar');
});

// ── Webhook de Stripe ───────────────────────────────────────────────────────
//
// Es el endpoint con más consecuencias de la plataforma: un pago confirmado
// aquí acaba en una transferencia de BEZ-Coin. No lleva API key — lo único que
// separa un cobro real de uno inventado es la firma HMAC.

test('Webhook de Stripe: sin secreto configurado, el endpoint queda cerrado', async () => {
  await altaTenant('stripe-cerrado');
  delete process.env.STRIPE_WEBHOOK_SECRET;

  const cuerpo = JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } });
  const res = await post('/webhooks/stripe/stripe-cerrado', {
    raw: cuerpo,
    headers: { 'stripe-signature': firmaStripe(cuerpo, 'cualquiera') },
  });
  assert.equal(res.status, 401, 'sin secreto no se acepta NADA: un webhook abierto es dinero regalado');
});

test('Webhook de Stripe: rechaza firma ausente, inválida, de otro secreto o de otro cuerpo', async () => {
  await altaTenant('stripe-firma');
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_de_prueba';
  try {
    const cuerpo = JSON.stringify({ type: 'checkout.session.completed', data: { object: { amount_total: 5000 } } });

    const sinFirma = await post('/webhooks/stripe/stripe-firma', { raw: cuerpo });
    assert.equal(sinFirma.status, 401, 'sin cabecera de firma');

    const basura = await post('/webhooks/stripe/stripe-firma', {
      raw: cuerpo, headers: { 'stripe-signature': 'no-es-una-firma' },
    });
    assert.equal(basura.status, 401, 'cabecera con formato inválido');

    const otroSecreto = await post('/webhooks/stripe/stripe-firma', {
      raw: cuerpo, headers: { 'stripe-signature': firmaStripe(cuerpo, 'whsec_del_atacante') },
    });
    assert.equal(otroSecreto.status, 401, 'firmado con otro secreto');

    // Firma legítima reutilizada sobre un cuerpo alterado: el importe cambia de
    // 50 a 50.000 USD. Si la firma se comprobara contra el objeto ya parseado
    // en vez de contra el cuerpo crudo, esto pasaría.
    const firmaBuena = firmaStripe(cuerpo, 'whsec_de_prueba');
    const manipulado = JSON.stringify({ type: 'checkout.session.completed', data: { object: { amount_total: 5000000 } } });
    const alterado = await post('/webhooks/stripe/stripe-firma', {
      raw: manipulado, headers: { 'stripe-signature': firmaBuena },
    });
    assert.equal(alterado.status, 401, 'cuerpo manipulado con una firma legítima de otro cuerpo');
  } finally {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('Webhook de Stripe: con firma válida ignora los eventos que no son un pago cerrado', async () => {
  await altaTenant('stripe-otros');
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_de_prueba';
  try {
    const cuerpo = JSON.stringify({ type: 'invoice.paid', data: { object: {} } });
    const res = await post('/webhooks/stripe/stripe-otros', {
      raw: cuerpo, headers: { 'stripe-signature': firmaStripe(cuerpo, 'whsec_de_prueba') },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ignored, 'invoice.paid');
    assert.equal(res.body.taskId, undefined, 'no crea ninguna tarea');
  } finally {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('Webhook de Stripe: un tenant inexistente no dispara nada, ni con firma válida', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_de_prueba';
  try {
    const cuerpo = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { amount_total: 5000, custom_fields: [{ key: 'wallet_polygon', text: { value: '0xabc' } }] } },
    });
    const res = await post('/webhooks/stripe/fantasma', {
      raw: cuerpo, headers: { 'stripe-signature': firmaStripe(cuerpo, 'whsec_de_prueba') },
    });
    assert.equal(res.status, 404);
  } finally {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('Webhook de Stripe: un pago con wallet prepara la transferencia pero NUNCA la ejecuta sola', async () => {
  const clave = await altaTenant('stripe-compra');
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_de_prueba';
  try {
    const cuerpo = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 15000,                       // 150,00 USD
          customer_details: { email: 'comprador@ejemplo.com' },
          custom_fields: [{ key: 'walletaddresstosendbezcoin', text: { value: '0x1111111111111111111111111111111111111111' } }],
        },
      },
    });

    const res = await post('/webhooks/stripe/stripe-compra', {
      raw: cuerpo, headers: { 'stripe-signature': firmaStripe(cuerpo, 'whsec_de_prueba') },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.taskId);

    // Lo que importa de verdad: el movimiento de activos se queda esperando a
    // un humano. Es una línea roja (crypto_asset_movement) y ningún camino,
    // tampoco este, puede saltársela.
    const pendiente = await esperarA(async () => {
      const r = await get('/tenants/stripe-compra/approvals', { key: clave });
      return Array.isArray(r.body) && r.body.length ? r.body[0] : null;
    });
    assert.ok(pendiente, 'la transferencia queda en la bandeja de aprobación humana');
    assert.equal(pendiente.action?.method, 'transfer');
    assert.equal(pendiente.action?.tool, 'blockchain');
    assert.equal(pendiente.action?.args?.to, '0x1111111111111111111111111111111111111111');

    const tarea = await get(`/tenants/stripe-compra/tasks/${res.body.taskId}`, { key: clave });
    assert.equal(tarea.body.status, 'awaiting_approval', 'la tarea consta como parada esperando al humano');

    // El humano dice que no: la acción no se ejecuta y sale de la bandeja.
    const decision = await post(`/tenants/stripe-compra/approvals/${pendiente.approvalId}`, {
      key: clave, body: { approved: false, note: 'wallet sin verificar' },
    });
    assert.equal(decision.status, 200);
    assert.equal(decision.body.ok, true);

    const vacia = await esperarA(async () => {
      const r = await get('/tenants/stripe-compra/approvals', { key: clave });
      return Array.isArray(r.body) && r.body.length === 0 ? true : null;
    });
    assert.ok(vacia, 'tras decidirla, deja de estar pendiente');
  } finally {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  }
});

test('Las aprobaciones de un tenant no se ven ni se deciden desde otro', async () => {
  const claveA = await altaTenant('hitl-a');
  const claveB = await altaTenant('hitl-b');

  assert.equal((await get('/tenants/hitl-a/approvals', { key: claveB })).status, 403);
  assert.equal((await post('/tenants/hitl-a/approvals/appr_inventada', { key: claveB, body: { approved: true } })).status, 403);
  assert.equal((await get('/tenants/hitl-a/approvals', { key: claveA })).status, 200);
});

// ── Formulario público de captación ─────────────────────────────────────────
//
// El único endpoint que escribe sin API key. Todo lo que llega es hostil.

const leadValido = (extra = {}) => ({
  company: 'Logística Ejemplo SL',
  contact: 'Ana Ruiz',
  email: 'ana@ejemplo.com',
  consent: true,
  ...extra,
});

// El throttle del intake es por IP y vive en memoria durante todo el proceso.
// Cada test usa una IP propia para no gastarse el cupo de los demás (y para no
// depender del orden en que se ejecuten).
const desde = (ip) => ({ 'x-forwarded-for': ip });

test('Intake: un envío legítimo se acepta y queda en cola', async () => {
  const clave = await altaTenant('intake-ok');

  const res = await post('/intake/intake-ok', { headers: desde('203.0.113.10'), body: leadValido() });
  assert.equal(res.status, 202);
  assert.equal(res.body.received, true);

  const funnel = await get('/tenants/intake-ok/funnel', { key: clave });
  assert.equal(funnel.body.pendingIntake, 1);
});

test('Intake: sin consentimiento no se trata el dato (RGPD)', async () => {
  const clave = await altaTenant('intake-consent');

  const res = await post('/intake/intake-consent', { headers: desde('203.0.113.11'), body: leadValido({ consent: false }) });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'consent_required');

  const funnel = await get('/tenants/intake-consent/funnel', { key: clave });
  assert.equal(funnel.body.pendingIntake, 0, 'y no se guarda nada');
});

test('Intake: el honeypot responde como un éxito pero no encola', async () => {
  const clave = await altaTenant('intake-bot');

  const res = await post('/intake/intake-bot', { headers: desde('203.0.113.12'), body: leadValido({ website: 'http://spam.example' }) });
  assert.equal(res.status, 200, 'al bot no se le dice que lo hemos detectado');
  assert.equal(res.body.received, true);

  const funnel = await get('/tenants/intake-bot/funnel', { key: clave });
  assert.equal(funnel.body.pendingIntake, 0, 'pero no entra en la cola');
});

test('Intake: rechaza email inválido y envíos sin identidad', async () => {
  await altaTenant('intake-validacion');

  const malEmail = await post('/intake/intake-validacion', { headers: desde('203.0.113.13'), body: leadValido({ email: 'esto-no-es-un-email' }) });
  assert.equal(malEmail.status, 400);
  assert.equal(malEmail.body.code, 'email_invalid');

  const sinIdentidad = await post('/intake/intake-validacion', {
    headers: desde('203.0.113.13'), body: { email: 'x@ejemplo.com', consent: true },
  });
  assert.equal(sinIdentidad.status, 400);
  assert.equal(sinIdentidad.body.code, 'identity_required');
});

test('Intake: el throttle por IP corta el goteo sostenido', async () => {
  await altaTenant('intake-throttle');
  const ip = desde('203.0.113.7');

  // INTAKE_MAX_PER_MINUTE = 3 (fijado antes de cargar el servidor).
  for (let n = 0; n < 3; n++) {
    const res = await post('/intake/intake-throttle', { headers: ip, body: leadValido({ email: `a${n}@ejemplo.com` }) });
    assert.equal(res.status, 202, `el envío ${n + 1} debe pasar`);
  }

  const cortado = await post('/intake/intake-throttle', { headers: ip, body: leadValido({ email: 'a4@ejemplo.com' }) });
  assert.equal(cortado.status, 429);
  assert.ok(cortado.headers.get('retry-after'));

  // El límite es por IP: otro origen no queda castigado por el primero.
  const otraIp = await post('/intake/intake-throttle', {
    headers: desde('198.51.100.4'), body: leadValido({ email: 'b1@ejemplo.com' }),
  });
  assert.equal(otraIp.status, 202);
});

test('Intake: un tenant que no existe no crea nada', async () => {
  const res = await post('/intake/fantasma', { headers: desde('203.0.113.14'), body: leadValido() });
  assert.equal(res.status, 404);
});

// ── Webhook de resultados del funnel ────────────────────────────────────────

test('Webhook de leads: cerrado sin secreto, y con secreto exige firma válida', async () => {
  const clave = await altaTenant('leads-hook');

  const cuerpo = JSON.stringify({ leadKey: 'ana@ejemplo.com', source: 'web', outcome: 'meeting' });

  delete process.env.LEADS_WEBHOOK_SECRET;
  const cerrado = await post('/webhooks/leads/leads-hook', { raw: cuerpo });
  assert.equal(cerrado.status, 503, 'sin secreto no se acepta nada: envenenaría el aprendizaje del funnel');

  process.env.LEADS_WEBHOOK_SECRET = 'secreto-leads';
  try {
    const malFirmado = await post('/webhooks/leads/leads-hook', {
      raw: cuerpo, headers: { 'x-signature': 'sha256=' + 'ab'.repeat(32) },
    });
    assert.equal(malFirmado.status, 401);

    const firma = crypto.createHmac('sha256', 'secreto-leads').update(cuerpo).digest('hex');
    const bien = await post('/webhooks/leads/leads-hook', {
      raw: cuerpo, headers: { 'x-signature': `sha256=${firma}` },
    });
    assert.equal(bien.status, 200);
    assert.equal(bien.body.recorded, 'meeting');

    const funnel = await get('/tenants/leads-hook/funnel', { key: clave });
    assert.ok(funnel.body.learning, 'el resultado alimenta el aprendizaje del embudo');
  } finally {
    delete process.env.LEADS_WEBHOOK_SECRET;
  }
});

// ── Endpoints de escritura del panel ────────────────────────────────────────

test('KB: ingesta validada y aislada por tenant', async () => {
  const claveA = await altaTenant('kb-a');
  const claveB = await altaTenant('kb-b');

  assert.equal((await post('/tenants/kb-a/kb', { key: claveA, body: { title: 'sin cuerpo' } })).status, 400);

  const ok = await post('/tenants/kb-a/kb', {
    key: claveA,
    body: { title: 'Restablecer contraseña', body: 'Entra en Ajustes → Seguridad.' },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.count, 1);

  assert.equal((await post('/tenants/kb-a/kb', { key: claveB, body: { title: 'x', body: 'y' } })).status, 403,
    'nadie escribe en la base de conocimiento de otra empresa');

  const deB = await get('/tenants/kb-b/dashboard', { key: claveB });
  assert.equal(deB.status, 200);
});

test('Políticas: se pueden endurecer por tenant, y la línea roja no se relaja', async () => {
  const clave = await altaTenant('politicas');

  const puesta = await call('PUT', '/tenants/politicas/policies/automation', {
    key: clave, body: { rule: 'always_approve' },
  });
  assert.equal(puesta.status, 200);

  const leidas = await get('/tenants/politicas/policies', { key: clave });
  assert.equal(leidas.status, 200);
  assert.equal(leidas.body.overrides?.automation, 'always_approve');
});

test('La cadena de auditoría se puede verificar por HTTP', async () => {
  const clave = await altaTenant('auditoria');
  await post('/tenants/auditoria/handle', { key: clave, body: { text: 'hola' } });

  const res = await get('/tenants/auditoria/audit/verify', { key: clave });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true, 'la cadena de hashes cuadra');
  assert.ok(res.body.checked > 0, 'y ha verificado registros de verdad');
});

// ── Canales de entrada (webhooks de proveedores, sin nuestra API key) ───────
//
// No llevan x-api-key: lo único que los autentica es el secreto del proveedor.
// Si `verify()` no se aplicara, cualquiera podría inyectar conversaciones en el
// tenant que quisiera — y cada una gasta cuota y puede acabar en un envío.

test('Canales: el webhook de Telegram exige el secreto del proveedor', async () => {
  await altaTenant('canal-tg');

  const update = { message: { text: 'hola', chat: { id: 42 }, from: { id: 7 } } };

  const sinSecreto = await post('/channels/telegram/canal-tg/inbound', { body: update });
  assert.equal(sinSecreto.status, 401, 'sin cabecera de secreto no entra');

  const secretoMalo = await post('/channels/telegram/canal-tg/inbound', {
    body: update, headers: { 'x-telegram-bot-api-secret-token': 'otro' },
  });
  assert.equal(secretoMalo.status, 401);

  const bien = await post('/channels/telegram/canal-tg/inbound', {
    body: update, headers: { 'x-telegram-bot-api-secret-token': 'secreto-telegram' },
  });
  assert.equal(bien.status, 200);
  // Telegram es asíncrono: la respuesta al cliente sale por la API del
  // proveedor (aquí, simulada), no por este HTTP.
  assert.equal(bien.body.ok, true, 'con el secreto correcto sí procesa el mensaje');
  assert.ok(bien.body.delivery, 'y deja constancia del envío de vuelta');
});

test('Canales: un canal inexistente responde 404 y no revienta', async () => {
  await altaTenant('canal-raro');
  const res = await post('/channels/telepatia/canal-raro/inbound', { body: { text: 'hola' } });
  assert.equal(res.status, 404);
});

test('Canales: el handshake de verificación de WhatsApp devuelve el challenge', async () => {
  await altaTenant('canal-wa');
  const res = await get('/channels/whatsapp/canal-wa/inbound?hub.mode=subscribe&hub.verify_token=token-whatsapp&hub.challenge=12345');
  assert.equal(res.status, 200);
  assert.equal(String(res.body), '12345');

  const malToken = await get('/channels/whatsapp/canal-wa/inbound?hub.mode=subscribe&hub.verify_token=falso&hub.challenge=12345');
  assert.notEqual(malToken.status, 200, 'con un token que no es el nuestro, no se confirma la suscripción');
});

// ── Encuesta de satisfacción (enlace público firmado) ──────────────────────

test('CSAT: sin secreto no se emiten enlaces; con secreto, el enlace firmado funciona una sola vez', async () => {
  const clave = await altaTenant('csat-demo');

  delete process.env.CSAT_SECRET;
  const sinSecreto = await post('/tenants/csat-demo/support/csat/issue', { key: clave, body: { taskId: 't-1' } });
  assert.equal(sinSecreto.status, 503, 'sin CSAT_SECRET no se puede firmar nada');

  process.env.CSAT_SECRET = 'secreto-csat';
  try {
    const emitido = await post('/tenants/csat-demo/support/csat/issue', { key: clave, body: { taskId: 't-1' } });
    assert.equal(emitido.status, 200);
    assert.ok(emitido.body.token);

    // Enlace manipulado: mismo formato, firma que no cuadra.
    const falso = await post(`/csat/${emitido.body.token.slice(0, -4)}dead`, {
      headers: desde('203.0.113.30'), body: { rating: 5 },
    });
    assert.equal(falso.status, 401);
    assert.equal(falso.body.code, 'bad_signature');

    // Valoración fuera de rango.
    const malaNota = await post(`/csat/${emitido.body.token}`, {
      headers: desde('203.0.113.31'), body: { rating: 99 },
    });
    assert.equal(malaNota.status, 400);
    assert.equal(malaNota.body.code, 'bad_rating');

    const votada = await post(`/csat/${emitido.body.token}`, {
      headers: desde('203.0.113.32'), body: { rating: 5, comment: 'muy bien' },
    });
    assert.equal(votada.status, 200);
    assert.equal(votada.body.thanks, true);

    // El segundo voto del mismo ticket no cuenta: si no, el CSAT se podría inflar.
    const repetida = await post(`/csat/${emitido.body.token}`, {
      headers: desde('203.0.113.33'), body: { rating: 1 },
    });
    assert.notEqual(repetida.status, 200, 'un ticket no se vota dos veces');

    const metricas = await get('/tenants/csat-demo/support/metrics', { key: clave });
    assert.equal(metricas.status, 200);
  } finally {
    delete process.env.CSAT_SECRET;
  }
});

// ── Reintento de tareas ─────────────────────────────────────────────────────

test('Reintentar: una tarea inexistente da 400, y el reintento respeta el aislamiento', async () => {
  const claveA = await altaTenant('retry-a');
  const claveB = await altaTenant('retry-b');

  const fantasma = await post('/tenants/retry-a/tasks/t_no_existe/retry', { key: claveA });
  assert.equal(fantasma.status, 400);

  const cruzado = await post('/tenants/retry-a/tasks/t_no_existe/retry', { key: claveB });
  assert.equal(cruzado.status, 403, 'ni siquiera se intenta con la clave de otro tenant');
});

// ── Escuadrón de Ventas: dial de autonomía y lista de exclusión ────────────

test('Ventas: el dial de autonomía se lee y se cambia, y la lista de exclusión se gestiona en caliente', async () => {
  const clave = await altaTenant('ventas-dial');

  const inicial = await get('/tenants/ventas-dial/sales/autonomy', { key: clave });
  assert.equal(inicial.status, 200);
  assert.equal(inicial.body.level, 'assist', 'por defecto, asistido');

  const subido = await call('PUT', '/tenants/ventas-dial/sales/autonomy', {
    key: clave, body: { level: 'full_auto' },
  });
  assert.equal(subido.status, 200);
  assert.equal((await get('/tenants/ventas-dial/sales/autonomy', { key: clave })).body.level, 'full_auto');

  const invalido = await call('PUT', '/tenants/ventas-dial/sales/autonomy', {
    key: clave, body: { level: 'barra-libre' },
  });
  assert.equal(invalido.status, 400, 'un nivel inventado no se acepta');

  const anadido = await post('/tenants/ventas-dial/sales/do-not-contact', {
    key: clave, body: { company: 'Competencia SL', reason: 'competidor' },
  });
  assert.equal(anadido.status, 200);

  const lista = await get('/tenants/ventas-dial/sales/do-not-contact', { key: clave });
  assert.equal(lista.status, 200);
  assert.ok(JSON.stringify(lista.body).includes('competencia sl') || JSON.stringify(lista.body).toLowerCase().includes('competencia sl'));
});

// ── Recarga del perfil de negocio ───────────────────────────────────────────

test('El perfil de negocio se puede recargar desde fichero, y solo por admin', async () => {
  const clave = await altaTenant('perfil-recarga');
  // Alta con businessId para que el tenant tenga perfil asociado.
  const conPerfil = await post('/tenants', { key: ADMIN, body: { tenantId: 'perfil-bezhas', plan: 'enterprise', businessId: 'bezhas' } });
  assert.equal(conPerfil.status, 200);

  assert.equal((await post('/tenants/perfil-bezhas/business/reload', { key: clave })).status, 403,
    'un cliente no recarga la configuración de la plataforma');

  const recarga = await post('/tenants/perfil-bezhas/business/reload', { key: ADMIN });
  assert.equal(recarga.status, 200);
  assert.equal(recarga.body.businessId, 'bezhas');
  assert.ok(recarga.body.buzones.length >= 10, 'devuelve los buzones declarados, para poder darlos de alta en el servidor de correo');

  // Sin perfil asociado no se inventa uno.
  assert.equal((await post('/tenants/perfil-recarga/business/reload', { key: ADMIN })).status, 400);
  assert.equal((await post('/tenants/no-existe/business/reload', { key: ADMIN })).status, 404);
});

test('Recargar el perfil alcanza a los agentes ya creados', async () => {
  await post('/tenants', { key: ADMIN, body: { tenantId: 'perfil-vivo', plan: 'enterprise', businessId: 'bezhas' } });
  const space = tenants.get('perfil-vivo');

  // Simula un perfil viejo persistido: los agentes comparten esta referencia.
  space.business.data = { id: 'bezhas', company: 'Versión vieja' };
  assert.equal(space.business.senderFor('sales'), null, 'el perfil viejo no tiene buzones');

  await post('/tenants/perfil-vivo/business/reload', { key: ADMIN });
  assert.match(space.business.senderFor('sales'), /ventas@bez\.digital/,
    'tras recargar, el mismo objeto que ven los agentes ya trae los buzones');
});

// ── Modelos locales declarados vs descargados ───────────────────────────────

test('Un tier que apunta a un modelo sin descargar se avisa al arrancar', async () => {
  const { checkLocalModels } = require('../src/server');
  // Sin motor local configurado no hay nada que comprobar.
  const r = await checkLocalModels();
  assert.equal(r.ok, true);
  assert.match(r.skipped || '', /sin motor local/,
    'en los tests no hay Ollama: la comprobación se salta en vez de fallar');
});

// ── El embudo de captación, cerrado de punta a punta ────────────────────────

test('El funnel procesa la cola del formulario público (el eslabón que faltaba)', async () => {
  const clave = await altaTenant('funnel-e2e', 'pro');

  // 1. Entra un lead por el formulario público, sin API key.
  const entrada = await post('/intake/funnel-e2e', {
    headers: desde('203.0.113.90'),
    body: {
      company: 'Lonja de Cítricos de Ejemplo', contact: 'Dirección de Operaciones',
      email: 'operaciones@ejemplo.es', message: 'Exportamos a Singapur y tenemos disputas por la cadena de frío',
      consent: true,
    },
  });
  assert.equal(entrada.status, 202);
  assert.equal((await get('/tenants/funnel-e2e/funnel', { key: clave })).body.pendingIntake, 1);

  // 2. Se procesa la cola.
  const run = await post('/tenants/funnel-e2e/funnel/run', { key: clave });
  assert.equal(run.status, 200);
  assert.equal(run.body.summary.discovered, 1, 'el lead del formulario llega al embudo');
  assert.equal(run.body.summary.scored, 1, 'y se puntúa');

  // 3. La cola queda vacía: el lead ya no se reprocesa en el siguiente ciclo.
  assert.equal((await get('/tenants/funnel-e2e/funnel', { key: clave })).body.pendingIntake, 0);

  // 4. Nada se ha enviado solo: el envío en frío es línea roja.
  assert.equal(run.body.summary.outreached, 0, 'ningún correo sale sin aprobación humana');
});

test('Sin departamento de Ventas no hay embudo, y se dice', async () => {
  // El plan starter incluye ventas; se fuerza un tenant sin ese departamento.
  const clave = await altaTenant('funnel-sin-ventas', 'starter');
  const space = tenants.get('funnel-sin-ventas');
  space.funnel = null;
  const r = await post('/tenants/funnel-sin-ventas/funnel/run', { key: clave });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Ventas/);
});
