'use strict';

/**
 * Reintentos automáticos y dead-letter.
 *
 * La regla que manda sobre todas las demás: una tarea que YA tuvo efecto fuera
 * del sistema (envió un email, escribió en el CRM, disparó un workflow) no se
 * reintenta sola jamás — repetirla duplicaría ese efecto. Ante la duda, el
 * fallo cae del lado seguro y lo decide un humano.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const AuditLog = require('../src/guardrails/AuditLog');
const Orchestrator = require('../src/core/Orchestrator');
const { hasSideEffect } = require('../src/cognition/toolCatalog');
const { runInTask, markSideEffect } = require('../src/core/executionContext');

const tick = () => new Promise((r) => setImmediate(r));
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function makeOrchestrator({ run, retryBaseDelayMs = 5, retryMaxAttempts = 3, retryMaxDelayMs = 20 } = {}) {
  const bus = new EventBus('acme');
  const o = new Orchestrator({
    tenantId: 'acme',
    guardrails: { evaluate: () => ({ allowed: true }) },
    bus, audit: new AuditLog({ tenantId: 'acme' }),
    retryBaseDelayMs, retryMaxAttempts, retryMaxDelayMs,
  });
  o.registerDepartment({ department: 'sales', id: 'sales.manager', specialists: new Map(), run });
  o.start();
  return o;
}

const encolar = (o) => o.handle({ text: 'x', type: 'sales:inbound', department: 'sales' });

/** Espera a que la tarea llegue a un estado terminal (o se agote el tiempo). */
async function esperarFin(o, id, ms = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = o.getTask(id);
    if (t && ['completed', 'failed'].includes(t.status)) return t;
    await esperar(5);
  }
  return o.getTask(id);
}

// ── Clasificación de efectos ────────────────────────────────────────────────

test('hasSideEffect: leer no deja huella; escribir/enviar sí', () => {
  assert.equal(hasSideEffect('crm', 'listLeads'), false);
  assert.equal(hasSideEffect('bezhas-core', 'treasuryStats'), false);
  assert.equal(hasSideEffect('fs', 'read'), false);

  assert.equal(hasSideEffect('email', 'send'), true);
  assert.equal(hasSideEffect('crm', 'upsertLead'), true);
  assert.equal(hasSideEffect('automation', 'trigger'), true);
  assert.equal(hasSideEffect('blockchain', 'transfer'), true);
});

test('hasSideEffect: un conector o método desconocido se asume con efecto', () => {
  assert.equal(hasSideEffect('conector-nuevo', 'loQueSea'), true,
    'lo no clasificado debe caer del lado seguro: no reintentable');
  assert.equal(hasSideEffect('crm', 'metodoNuevoSinClasificar'), true);
});

// ── Reintento de fallos transitorios ────────────────────────────────────────

test('un fallo transitorio se reintenta solo y acaba completando', async () => {
  let intentos = 0;
  const o = makeOrchestrator({
    run: async () => {
      intentos++;
      if (intentos < 3) throw new Error('ECONNRESET del proveedor');
      return { ok: true, intentos };
    },
  });

  const id = await encolar(o);
  const t = await esperarFin(o, id);

  assert.equal(t.status, 'completed');
  assert.equal(t.attempts, 3, 'debe haber hecho 3 intentos');
  assert.equal(t.result.ok, true);
  o.stop();
});

test('agotados los reintentos, la tarea queda en dead-letter', async () => {
  const o = makeOrchestrator({ run: async () => { throw new Error('proveedor caído'); } });

  const id = await encolar(o);
  const t = await esperarFin(o, id);

  assert.equal(t.status, 'failed');
  assert.equal(t.attempts, 3, 'no debe reintentar más allá del tope');
  assert.equal(t.deadLetter, true, 'agotar reintentos marca dead-letter');
  assert.equal(t.notRetriedBecause, 'reintentos agotados');
  o.stop();
});

test('el backoff crece entre intentos y respeta el tope (no martillea al proveedor)', () => {
  const o = new Orchestrator({
    tenantId: 'acme', guardrails: { evaluate: () => ({ allowed: true }) },
    bus: new EventBus('acme'), audit: new AuditLog({ tenantId: 'acme' }),
    retryBaseDelayMs: 1000, retryMaxDelayMs: 30_000,
  });

  // Con jitter (50-100% del exponencial) los rangos por intento son
  // [500,1000], [1000,2000], [2000,4000]…: se tocan pero no se solapan, así
  // que la espera nunca decrece por mucho que se repita el sorteo.
  for (let i = 0; i < 200; i++) {
    const d1 = o._retryDelay(1);
    const d2 = o._retryDelay(2);
    const d3 = o._retryDelay(3);
    assert.ok(d1 >= 500 && d1 <= 1000, `intento 1 fuera de rango: ${d1}`);
    assert.ok(d2 >= 1000 && d2 <= 2000, `intento 2 fuera de rango: ${d2}`);
    assert.ok(d3 >= 2000 && d3 <= 4000, `intento 3 fuera de rango: ${d3}`);
    assert.ok(d2 >= d1 && d3 >= d2, 'la espera nunca decrece');
  }

  // El tope corta el crecimiento exponencial.
  for (let i = 0; i < 50; i++) {
    assert.ok(o._retryDelay(20) <= 30_000, 'el backoff no puede superar maxDelayMs');
  }
  o.stop();
});

test('hay una espera real entre un fallo y su reintento', async () => {
  const marcas = [];
  const o = makeOrchestrator({
    // Sin tope que recorte: la espera del primer reintento cae en [30, 60] ms.
    retryBaseDelayMs: 60, retryMaxDelayMs: 1000, retryMaxAttempts: 2,
    run: async () => { marcas.push(Date.now()); throw new Error('caído'); },
  });

  const id = await encolar(o);
  await esperarFin(o, id);

  assert.equal(marcas.length, 2);
  assert.ok(marcas[1] - marcas[0] >= 25, `no esperó lo suficiente (${marcas[1] - marcas[0]}ms)`);
  o.stop();
});

// ── La regla dura: efectos externos ─────────────────────────────────────────

test('NO se reintenta una tarea que ya envió algo, aunque el error sea transitorio', async () => {
  let intentos = 0;
  const o = makeOrchestrator({
    run: async () => {
      intentos++;
      markSideEffect({ tool: 'email', method: 'send' });   // el agente ya envió
      throw new Error('ECONNRESET al guardar el resultado');
    },
  });

  const id = await encolar(o);
  const t = await esperarFin(o, id);

  assert.equal(intentos, 1, 'un email ya enviado no se puede reenviar por reintento');
  assert.equal(t.status, 'failed');
  assert.equal(t.sideEffectPerformed, true);
  assert.equal(t.deadLetter, false, 'no es dead-letter: no agotó reintentos, es que no debía reintentarse');
  assert.equal(t.notRetriedBecause, 'la tarea ya tuvo efectos externos');
  assert.deepEqual(t.firstSideEffect, { tool: 'email', method: 'send' });
  o.stop();
});

test('una tarea que solo LEYÓ sí se reintenta', async () => {
  let intentos = 0;
  const o = makeOrchestrator({
    run: async () => {
      intentos++;
      // Leer no marca efecto (lo haría BaseAgent._execute solo si hasSideEffect).
      if (intentos < 2) throw new Error('timeout leyendo');
      return { ok: true };
    },
  });

  const id = await encolar(o);
  const t = await esperarFin(o, id);
  assert.equal(t.status, 'completed');
  assert.equal(intentos, 2);
  o.stop();
});

// ── Errores permanentes ─────────────────────────────────────────────────────

test('un error permanente no se reintenta ni se marca dead-letter', async () => {
  let intentos = 0;
  const o = makeOrchestrator({
    run: async () => { intentos++; throw new Error('herramienta no disponible: email'); },
  });

  const id = await encolar(o);
  const t = await esperarFin(o, id);

  assert.equal(intentos, 1, 'reintentar un error de configuración da el mismo resultado');
  assert.equal(t.status, 'failed');
  assert.equal(t.deadLetter, false);
  assert.equal(t.notRetriedBecause, 'error permanente');
  o.stop();
});

test('isPermanentError distingue configuración de mala suerte', () => {
  assert.equal(Orchestrator.isPermanentError('sin departamento: ventas'), true);
  assert.equal(Orchestrator.isPermanentError('herramienta no disponible: crm'), true);
  assert.equal(Orchestrator.isPermanentError('Cuota mensual agotada (10/10 llamadas).'), true);
  assert.equal(Orchestrator.isPermanentError('ECONNRESET'), false);
  assert.equal(Orchestrator.isPermanentError('HTTP 503'), false);
});

// ── Integración con el resto del ciclo de vida ──────────────────────────────

test('mientras espera el reintento no retiene hueco de cola', async () => {
  const o = makeOrchestrator({
    retryBaseDelayMs: 60,
    run: async (task) => {
      if (task.payload.falla) throw new Error('caído');
      return { ok: true };
    },
  });
  o.queue.maxConcurrent = 1;

  const idFalla = await o.handle({ text: 'x', falla: true, type: 'sales:inbound', department: 'sales' });
  await tick(); await tick();
  assert.equal(o.getTask(idFalla).status, 'retrying', 'debe estar esperando su reintento');

  const idOk = await encolar(o);
  const t = await esperarFin(o, idOk, 500);
  assert.equal(t.status, 'completed', 'otra tarea puede correr mientras la otra espera su reintento');
  o.stop();
});

test('un reinicio NO reencola a ciegas: lo que estaba reintentando queda interrumpido', async () => {
  const guardadas = [
    { id: 't1', tenantId: 'acme', status: 'retrying', payload: {}, attempts: 2 },
    { id: 't2', tenantId: 'acme', status: 'completed', payload: {} },
  ];
  const store = {
    listTasks: async () => guardadas.map((t) => ({ ...t })),
    upsertTask: async () => true,
  };
  const o = new Orchestrator({
    tenantId: 'acme', guardrails: { evaluate: () => ({ allowed: true }) },
    bus: new EventBus('acme'), audit: new AuditLog({ tenantId: 'acme' }), store,
  });

  const { interrupted } = await o.hydrate();
  assert.equal(interrupted, 1);
  assert.equal(o.getTask('t1').status, 'interrupted');
  assert.equal(o.getTask('t2').status, 'completed');
  o.stop();
});

test('stop() cancela los reintentos pendientes', async () => {
  let intentos = 0;
  const o = makeOrchestrator({
    retryBaseDelayMs: 50,
    run: async () => { intentos++; throw new Error('caído'); },
  });

  const id = await encolar(o);
  await tick(); await tick();
  assert.equal(o.getTask(id).status, 'retrying');

  o.stop();
  await esperar(150);
  assert.equal(intentos, 1, 'tras stop() no debe dispararse ningún reintento');
});

test('markSideEffect fuera de una tarea no rompe nada', () => {
  assert.doesNotThrow(() => markSideEffect({ tool: 'email', method: 'send' }));
});

test('markSideEffect es idempotente: solo registra el primer efecto', async () => {
  const efectos = [];
  const task = {};
  const exec = {
    taskId: 't1',
    markSideEffect: (d) => { if (!task.done) { task.done = true; efectos.push(d); } },
  };
  await runInTask(exec, async () => {
    markSideEffect({ tool: 'email', method: 'send' });
    markSideEffect({ tool: 'crm', method: 'upsertLead' });
  });
  assert.equal(efectos.length, 1);
  assert.equal(efectos[0].tool, 'email');
});
