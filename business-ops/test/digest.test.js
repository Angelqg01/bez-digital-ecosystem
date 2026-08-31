'use strict';

/**
 * Digest del CEO: resumen ejecutivo cross-departamento generado bajo demanda
 * o proactivamente (acción 'digest' del Scheduler), persistido como fact.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const TenantManager = require('../src/core/TenantManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const InMemoryStore = require('../src/platform/InMemoryStore');
const UsageMeter = require('../src/platform/UsageMeter');
const CostTracker = require('../src/platform/CostTracker');
const SupportMetrics = require('../src/platform/SupportMetrics');
const Billing = require('../src/platform/Billing');
const Scheduler = require('../src/platform/Scheduler');
const { buildDigest, lastDigest } = require('../src/platform/digest');
const plans = require('../config/plans.json');

/**
 * Proveedor de mentira con la forma del SDK de Anthropic. Sirve para probar el
 * camino NO simulado: `digest.js` solo persiste cuando la respuesta viene de un
 * modelo real, así que sin esto la mitad del comportamiento queda sin cubrir.
 */
function fakeProvider(text = 'Resumen del día: todo en orden.') {
  return {
    messages: {
      create: async () => ({
        content: [{ type: 'text', text }],
        usage: { input_tokens: 120, output_tokens: 40 },
      }),
    },
  };
}

async function makeWorld({ providers = {} } = {}) {
  const store = new InMemoryStore();
  const usageMeter = new UsageMeter({ store });
  const costTracker = new CostTracker({ store });
  const supportMetrics = new SupportMetrics();
  const billing = new Billing({ plans });
  const modelGateway = new ModelGateway({
    providers,
    onUsage: (u) => { costTracker.record(u); if (u.meta?.tenantId) usageMeter.record(u.meta.tenantId); },
  });
  const tenants = new TenantManager({ modelGateway, store, usageMeter, metrics: supportMetrics, plans });
  await tenants.provision({ tenantId: 'acme', plan: 'pro', departments: ['sales', 'support'] });
  usageMeter.setLimit('acme', 5000);
  await billing.subscribe('acme', 'pro');
  return { tenants, usageMeter, costTracker, supportMetrics, billing, plans, modelGateway, store };
}

test('buildDigest: junta KPIs reales y los redacta con el modelo', async () => {
  const deps = await makeWorld();

  // Algo de actividad para que el digest tenga contenido.
  await deps.tenants.handle('acme', { text: 'Quiero una demo y precio', channel: 'web', customerId: 'c1' });
  await new Promise((r) => setTimeout(r, 200));

  const digest = await buildDigest(deps, 'acme');
  assert.ok(digest.at);
  assert.match(digest.text, /SIMULADO/, 'en simulado el texto viene del gateway simulado');
  assert.equal(digest.kpis.plan, 'pro');
  assert.ok(digest.kpis.tareasRecientes >= 1);
  assert.ok(digest.kpis.tareasPorDepartamento.sales >= 1);
  assert.equal(typeof digest.kpis.facturaEstimadaEur, 'number');
  assert.equal(digest.kpis.excedenteFacturadoPor, 'bezhas-gateway',
    'el excedente lo tarifica el Gateway de BeZhas, no OPERANT');
});

test('buildDigest: un digest simulado NO se persiste (no puede quedarse de titular fijo)', async () => {
  const deps = await makeWorld(); // sin proveedor → simulado

  const digest = await buildDigest(deps, 'acme');
  assert.equal(digest.simulado, true);
  assert.equal(await lastDigest(deps.store, 'acme'), null,
    'la caché serviría ese texto a todo el que no pida ?fresh=1');
});

test('buildDigest: con modelo real, el digest sí se persiste y es recuperable', async () => {
  const deps = await makeWorld({ providers: { anthropic: fakeProvider() } });

  const digest = await buildDigest(deps, 'acme');
  assert.equal(digest.simulado, false);
  const saved = await lastDigest(deps.store, 'acme');
  assert.equal(saved.at, digest.at);
});

test('buildDigest: tenant inexistente devuelve null', async () => {
  const deps = await makeWorld();
  assert.equal(await buildDigest(deps, 'nadie'), null);
});

test('Scheduler acción digest: se genera proactivamente sin solicitud humana', async () => {
  // Con proveedor real: el objetivo es comprobar que el Scheduler dispara la
  // acción y el resultado queda guardado, no la regla del simulado.
  const deps = await makeWorld({ providers: { anthropic: fakeProvider() } });
  let now = 1_000_000;
  const sch = new Scheduler({
    tenants: deps.tenants,
    store: deps.store,
    clock: () => now,
    actions: { digest: (tenantId) => buildDigest(deps, tenantId) },
  });
  await sch.addJob('acme', { id: 'digest-diario', everyMs: 86_400_000, action: 'digest' });

  const ran = await sch.tick();
  assert.deepEqual(ran, [{ tenantId: 'acme', jobId: 'digest-diario', action: 'digest' }]);

  const saved = await lastDigest(deps.store, 'acme');
  assert.ok(saved, 'el digest quedó persistido sin que nadie lo pidiera');

  // No vuelve a correr hasta el día siguiente.
  now += 3_600_000;
  assert.equal((await sch.tick()).length, 0);
});

test('Scheduler: acción desconocida se rechaza al crear el trabajo', async () => {
  const sch = new Scheduler({ tenants: {}, actions: {} });
  await assert.rejects(() => sch.addJob('acme', { everyMs: 60_000, action: 'nada' }), /acción desconocida/);
});
