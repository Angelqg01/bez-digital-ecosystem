'use strict';

/**
 * Tests de la capa comercial: claves de API, rate limiting y alta self-service.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ApiKeyRegistry = require('../src/platform/ApiKeyRegistry');
const RateLimiter = require('../src/platform/RateLimiter');
const { signup } = require('../src/platform/onboarding');
const TenantManager = require('../src/core/TenantManager');
const ModelGateway = require('../src/cognition/ModelGateway');

const PLANS = require('../config/plans.json');

// ── ApiKeyRegistry ──────────────────────────────────────────────

test('ApiKeyRegistry: emite, resuelve y rota claves', () => {
  const reg = new ApiKeyRegistry();
  const key = reg.issue('acme');
  assert.match(key, /^sk_[0-9a-f]{48}$/);
  assert.equal(reg.resolve(key), 'acme');
  assert.equal(reg.resolve('sk_inventada'), null);

  const key2 = reg.issue('acme');           // rota
  assert.equal(reg.resolve(key2), 'acme');
  assert.equal(reg.resolve(key), null, 'la clave anterior queda revocada');

  reg.revoke('acme');
  assert.equal(reg.resolve(key2), null);
});

// ── RateLimiter ─────────────────────────────────────────────────

test('RateLimiter: corta al superar el límite y reabre en la siguiente ventana', () => {
  let now = 0;
  const rl = new RateLimiter({ limit: 2, windowMs: 1000, clock: () => now });

  assert.equal(rl.consume('acme').allowed, true);
  assert.equal(rl.consume('acme').allowed, true);
  const blocked = rl.consume('acme');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);

  assert.equal(rl.consume('globex').allowed, true, 'otro tenant tiene su propio cupo');

  now = 1000; // nueva ventana
  assert.equal(rl.consume('acme').allowed, true);
});

test('RateLimiter: límite por tenant (setLimit)', () => {
  let now = 0;
  const rl = new RateLimiter({ limit: 100, windowMs: 1000, clock: () => now });
  rl.setLimit('acme', 1);
  assert.equal(rl.consume('acme').allowed, true);
  assert.equal(rl.consume('acme').allowed, false);
});

// ── Onboarding self-service ─────────────────────────────────────

function deps() {
  return {
    tenants: new TenantManager({ modelGateway: new ModelGateway({ providers: {} }), plans: PLANS }),
    apiKeys: new ApiKeyRegistry(),
    rateLimiter: new RateLimiter(),
    plans: PLANS,
  };
}

test('signup: aprovisiona, limita departamentos al plan y emite clave', async () => {
  const d = deps();
  const r = await signup(d, { tenantId: 'acme', plan: 'starter', departments: ['sales', 'support', 'marketing'] });

  assert.deepEqual(r.departments, ['sales', 'support'], 'marketing no está en starter → filtrado');
  assert.equal(d.apiKeys.resolve(r.apiKey), 'acme', 'la clave resuelve al tenant');
  assert.ok(d.tenants.get('acme'), 'el tenant queda aprovisionado');
});

test('signup: rechaza plan inválido y tenantId inválido', async () => {
  const d = deps();
  await assert.rejects(() => signup(d, { tenantId: 'acme', plan: 'galáctico' }), /plan inválido/);
  await assert.rejects(() => signup(d, { tenantId: 'AC ME', plan: 'pro' }), /tenantId inválido/);
});

test('signup: sin departamentos usa los del plan', async () => {
  const d = deps();
  const r = await signup(d, { tenantId: 'globex', plan: 'pro' });
  assert.deepEqual(r.departments, PLANS.pro.departments);
});
