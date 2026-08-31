'use strict';

/**
 * Ventana caliente de tareas: el Map en RAM no puede crecer sin límite (guarda
 * el resultado completo de cada tarea, borradores de email incluidos), pero
 * podarlo no puede hacer desaparecer una tarea de la API — la verdad vive en
 * el Store y `findTask` debe encontrarla igual.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const AuditLog = require('../src/guardrails/AuditLog');
const InMemoryStore = require('../src/platform/InMemoryStore');
const Orchestrator = require('../src/core/Orchestrator');

const tick = () => new Promise((r) => setImmediate(r));

function makeOrchestrator({ maxHotTasks = 5, store = null } = {}) {
  const bus = new EventBus('acme');
  const audit = new AuditLog({ tenantId: 'acme', store });
  const orchestrator = new Orchestrator({
    tenantId: 'acme',
    guardrails: { evaluate: () => ({ allowed: true }) },
    bus, audit, store, maxHotTasks,
  });
  orchestrator.registerDepartment({
    department: 'sales', id: 'sales.manager', specialists: new Map(),
    async run() { return { ok: true }; },
  });
  orchestrator.start();
  return orchestrator;
}

async function correr(orchestrator, n) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    ids.push(await orchestrator.handle({ text: `t${i}`, type: 'sales:inbound', department: 'sales' }));
    await tick(); await tick();
  }
  return ids;
}

test('la ventana caliente no crece sin límite', async () => {
  const o = makeOrchestrator({ maxHotTasks: 5 });
  await correr(o, 20);
  assert.ok(o._tasks.size <= 5, `la ventana debe respetar el tope (size=${o._tasks.size})`);
});

test('la poda descarta las terminadas más antiguas, no las vivas', async () => {
  const o = makeOrchestrator({ maxHotTasks: 3 });

  // Una tarea que se queda "viva" (no termina nunca durante el test).
  let liberar;
  o.registerDepartment({
    department: 'slow', id: 'slow.manager', specialists: new Map(),
    run: () => new Promise((r) => { liberar = r; }),
  });
  const vivaId = await o.handle({ text: 'lenta', type: 'slow:x', department: 'slow' });
  await tick(); await tick();
  assert.equal(o.getTask(vivaId).status, 'running');

  await correr(o, 10);   // fuerza mucha poda

  assert.ok(o.getTask(vivaId), 'una tarea en vuelo NUNCA se poda');
  assert.equal(o.getTask(vivaId).status, 'running');
  liberar({ ok: true });
});

test('findTask recupera del Store una tarea ya podada de la RAM', async () => {
  const store = new InMemoryStore();
  const o = makeOrchestrator({ maxHotTasks: 3, store });

  const ids = await correr(o, 12);
  const antigua = ids[0];

  assert.equal(o.getTask(antigua), null, 'la más antigua ya no está en RAM');

  const recuperada = await o.findTask(antigua);
  assert.ok(recuperada, 'findTask debe encontrarla en el Store');
  assert.equal(recuperada.id, antigua);
  assert.equal(recuperada.status, 'completed');
});

test('findTask no cruza tenants', async () => {
  const store = new InMemoryStore();
  const o = makeOrchestrator({ maxHotTasks: 3, store });
  const ids = await correr(o, 8);

  const otro = new Orchestrator({
    tenantId: 'beta',
    guardrails: { evaluate: () => ({ allowed: true }) },
    bus: new EventBus('beta'), audit: new AuditLog({ tenantId: 'beta' }), store,
  });
  assert.equal(await otro.findTask(ids[0]), null, 'un tenant no puede leer la tarea de otro');
});
