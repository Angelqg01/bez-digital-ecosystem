'use strict';

/**
 * Captación pública: validación, defensas anti-bot, RGPD y webhook de resultados.
 *
 * Este es el único endpoint que escribe sin API key, así que lo que se prueba
 * aquí no es "funciona el happy path" sino "aguanta lo que le van a tirar":
 * payloads gigantes, inyección de cabeceras, inundación, y envenenamiento del
 * aprendizaje vía webhook sin firmar.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const intake = require('../src/platform/leadIntake');
const { validate, enqueue, verifySignature, IpThrottle, IntakeError, LIMITS } = intake;

const base = { email: 'ana@acmelog.com', company: 'AcmeLog', consent: true };

function memoryStore() {
  const facts = new Map();
  const k = (t, key) => `${t}:${key}`;
  return {
    getFact: async ({ tenantId, key }) => facts.get(k(tenantId, key)),
    setFact: async ({ tenantId, key, value }) => { facts.set(k(tenantId, key), value); },
  };
}

// ── RGPD ─────────────────────────────────────────────────────────────────

test('sin consentimiento explícito se rechaza (RGPD art. 6.1.a)', () => {
  assert.throws(() => validate({ ...base, consent: undefined }), /consentimiento/);
  assert.throws(() => validate({ ...base, consent: false }), /consentimiento/);
});

test('acepta las formas en que un form HTML manda el checkbox', () => {
  for (const v of [true, 'true', 'on']) {
    assert.equal(validate({ ...base, consent: v }).consent, true, `falló con ${JSON.stringify(v)}`);
  }
});

test('registra CUÁNDO se consintió (art. 7.1: hay que poder demostrarlo)', () => {
  const r = validate(base, { now: 1_700_000_000_000 });
  assert.equal(r.consentAt, '2023-11-14T22:13:20.000Z');
});

// ── Validación ───────────────────────────────────────────────────────────

test('email es obligatorio y se normaliza a minúsculas', () => {
  assert.throws(() => validate({ company: 'X', consent: true }), /email requerido/);
  assert.equal(validate({ ...base, email: '  ANA@AcmeLog.COM ' }).email, 'ana@acmelog.com');
});

test('rechaza emails malformados antes de encolarlos', () => {
  for (const bad of ['sin-arroba', 'a@b', 'a@@b.com', 'a b@c.com', '@nada.com']) {
    assert.throws(() => validate({ ...base, email: bad }), /email inválido/, `aceptó ${bad}`);
  }
});

test('exige identificar a alguien: company o contact', () => {
  assert.throws(() => validate({ email: 'a@b.com', consent: true }), /company o contact/);
  assert.ok(validate({ email: 'a@b.com', consent: true, contact: 'Ana' }).contact);
});

test('trunca campos largos en vez de reventar el store', () => {
  const r = validate({ ...base, company: 'x'.repeat(5000), message: 'y'.repeat(99_000) });
  assert.equal(r.company.length, LIMITS.company);
  assert.equal(r.notes.length, LIMITS.message);
});

test('neutraliza CRLF (inyección de cabeceras si el campo acaba en un correo)', () => {
  const r = validate({ ...base, message: 'hola\r\nBcc: atacante@evil.com' });
  assert.ok(!/[\r\n]/.test(r.notes), 'no debe quedar ningún salto de línea');
  assert.equal(r.notes, 'hola Bcc: atacante@evil.com');
});

test('preserva guiones y puntos legítimos del nombre de empresa', () => {
  assert.equal(validate({ ...base, company: 'Acme-Log S.A.' }).company, 'Acme-Log S.A.');
});

// ── Anti-bot ─────────────────────────────────────────────────────────────

test('honeypot relleno → se descarta con 200 (no se le enseña al bot que le pillamos)', () => {
  try {
    validate({ ...base, website: 'http://spam.example' });
    assert.fail('debía descartarse');
  } catch (err) {
    assert.ok(err instanceof IntakeError);
    assert.equal(err.status, 200);
    assert.equal(err.code, 'honeypot');
  }
});

test('envío en menos de 2 s desde que cargó el form → bot', () => {
  const now = 1_000_000;
  assert.throws(() => validate({ ...base, renderedAt: now - 500 }, { now }), /descartado/);
  // Un humano tardando lo normal pasa sin problema.
  assert.ok(validate({ ...base, renderedAt: now - 30_000 }, { now }).email);
});

test('renderedAt ausente o absurdo no bloquea a un humano legítimo', () => {
  const now = 1_000_000;
  assert.ok(validate({ ...base }, { now }).email, 'sin renderedAt debe pasar');
  assert.ok(validate({ ...base, renderedAt: 'basura' }, { now }).email, 'valor no numérico no debe bloquear');
  assert.ok(validate({ ...base, renderedAt: now + 60_000 }, { now }).email, 'reloj del cliente adelantado tampoco');
});

// ── Throttle por IP ──────────────────────────────────────────────────────

test('throttle: corta al superar el máximo y se recupera al pasar la ventana', () => {
  let t = 0;
  const th = new IpThrottle({ max: 3, windowMs: 60_000, clock: () => t });

  for (let i = 0; i < 3; i++) assert.equal(th.consume('1.2.3.4').allowed, true, `intento ${i + 1}`);
  const blocked = th.consume('1.2.3.4');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);

  // Otra IP no se ve afectada por el vecino ruidoso.
  assert.equal(th.consume('9.9.9.9').allowed, true);

  t += 60_001;
  assert.equal(th.consume('1.2.3.4').allowed, true, 'pasada la ventana vuelve a admitir');
});

// ── Cola ─────────────────────────────────────────────────────────────────

test('encola y deduplica por email (tres envíos ≠ tres contactos comerciales)', async () => {
  const store = memoryStore();
  const lead = validate(base);

  const first = await enqueue({ store, tenantId: 't', lead });
  assert.deepEqual({ queued: first.queued, duplicate: first.duplicate }, { queued: true, duplicate: false });

  const second = await enqueue({ store, tenantId: 't', lead });
  assert.equal(second.duplicate, true);
  assert.equal(second.queued, false);

  const q = await store.getFact({ tenantId: 't', key: 'intake:queue' });
  assert.equal(q.length, 1);
});

test('cola llena → 429 en vez de crecer sin techo', async () => {
  const store = memoryStore();
  await store.setFact({
    tenantId: 't', key: 'intake:queue',
    value: Array.from({ length: 5 }, (_, i) => ({ email: `x${i}@y.com` })),
  });
  await assert.rejects(
    () => enqueue({ store, tenantId: 't', lead: validate(base), maxQueue: 5 }),
    (err) => err.status === 429 && err.code === 'queue_full',
  );
});

test('sin store disponible falla con 503, no con un 500 opaco', async () => {
  await assert.rejects(
    () => enqueue({ store: null, tenantId: 't', lead: validate(base) }),
    (err) => err.status === 503,
  );
});

test('los leads de distintos tenants no se mezclan', async () => {
  const store = memoryStore();
  await enqueue({ store, tenantId: 'a', lead: validate({ ...base, email: 'uno@a.com' }) });
  await enqueue({ store, tenantId: 'b', lead: validate({ ...base, email: 'dos@b.com' }) });

  const qa = await store.getFact({ tenantId: 'a', key: 'intake:queue' });
  const qb = await store.getFact({ tenantId: 'b', key: 'intake:queue' });
  assert.equal(qa.length, 1);
  assert.equal(qb.length, 1);
  assert.equal(qa[0].email, 'uno@a.com');
});

// ── Firma del webhook ────────────────────────────────────────────────────

const sign = (body, secret) => 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

test('firma válida se acepta; cualquier alteración del cuerpo la invalida', () => {
  const body = JSON.stringify({ outcome: 'closed_won' });
  assert.equal(verifySignature(body, sign(body, 's3cr3t'), 's3cr3t'), true);
  assert.equal(verifySignature(body + ' ', sign(body, 's3cr3t'), 's3cr3t'), false);
  assert.equal(verifySignature(body, sign(body, 'otro'), 's3cr3t'), false);
});

test('firma ausente, basura o de longitud distinta no revienta: devuelve false', () => {
  const body = '{}';
  for (const h of [undefined, '', 'sha256=zz', 'sha256=abcd', 'no-es-una-firma']) {
    assert.equal(verifySignature(body, h, 's'), false, `aceptó ${JSON.stringify(h)}`);
  }
  assert.equal(verifySignature(body, sign(body, 's'), undefined), false, 'sin secreto configurado, nunca válida');
});
