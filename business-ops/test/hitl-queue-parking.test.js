'use strict';

/**
 * Contrato del aparcado HITL: una tarea que espera a un humano NO puede
 * retener un hueco de concurrencia del tenant.
 *
 * Bug original (visto en producción): con `maxConcurrent: 1`, un solo contacto
 * en frío pendiente de aprobación dejaba la cola muerta — ninguna tarea nueva
 * volvía a ejecutarse hasta que un humano decidía, y la latencia reportada
 * incluía el tiempo de espera humana (43 min en el caso real).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const AuditLog = require('../src/guardrails/AuditLog');
const HITLGate = require('../src/core/HITLGate');
const Orchestrator = require('../src/core/Orchestrator');
const TaskQueue = require('../src/core/TaskQueue');

const tick = () => new Promise((r) => setImmediate(r));

/** Departamento de prueba: pide aprobación humana y devuelve lo que se decida. */
function makeDept({ hitl, department = 'sales', onRun = null }) {
  return {
    department,
    id: `${department}.manager`,
    specialists: new Map(),
    async run(task) {
      if (onRun) onRun(task);
      if (task.payload?.needsApproval) {
        const decision = await hitl.request({
          tenantId: task.tenantId,
          agentId: `${department}.agent`,
          action: { category: 'outbound', cold: true, tool: 'email', method: 'send' },
          reason: 'contacto en frío',
        });
        return { approved: decision.approved };
      }
      return { ok: true };
    },
  };
}

function makeOrchestrator({ maxConcurrent = 1 } = {}) {
  const bus = new EventBus('acme');
  const audit = new AuditLog({ tenantId: 'acme' });
  const hitl = new HITLGate({ bus, audit, tenantId: 'acme' });
  const orchestrator = new Orchestrator({
    tenantId: 'acme',
    model: null,
    memory: null,
    guardrails: { evaluate: () => ({ allowed: true }) },
    bus, audit,
    maxConcurrent,
  });
  return { bus, audit, hitl, orchestrator };
}

test('una aprobación pendiente NO bloquea la cola del tenant', async () => {
  const { hitl, orchestrator } = makeOrchestrator({ maxConcurrent: 1 });
  const ejecutadas = [];
  orchestrator.registerDepartment(makeDept({ hitl, onRun: (t) => ejecutadas.push(t.id) }));
  orchestrator.start();

  // 1) Tarea que se queda esperando a un humano (ocupa el único hueco).
  const idBloqueante = await orchestrator.handle({ text: 'demo', needsApproval: true });
  await tick(); await tick();

  const pendientes = hitl.listPending('acme');
  assert.equal(pendientes.length, 1, 'la primera tarea debe estar esperando aprobación');
  assert.equal(orchestrator.getTask(idBloqueante).status, 'awaiting_approval',
    'la tarea aparcada se marca como awaiting_approval, no como running');

  // 2) Con la cola "llena" por la que espera, una tarea nueva DEBE poder correr.
  const idNueva = await orchestrator.handle({ text: 'otra demo' });
  await tick(); await tick(); await tick();

  assert.ok(ejecutadas.includes(idNueva), 'la tarea nueva debe ejecutarse aunque haya una esperando al humano');
  assert.equal(orchestrator.getTask(idNueva).status, 'completed');

  // 3) Al aprobar, la tarea aparcada se reanuda y termina.
  hitl.resolve(pendientes[0].approvalId, true, 'ok');
  await tick(); await tick(); await tick();

  const final = orchestrator.getTask(idBloqueante);
  assert.equal(final.status, 'completed');
  assert.equal(final.result.approved, true);
});

test('la latencia reportada descuenta el tiempo de espera humana', async () => {
  const { hitl, orchestrator } = makeOrchestrator({ maxConcurrent: 2 });
  orchestrator.registerDepartment(makeDept({ hitl }));
  orchestrator.start();

  const id = await orchestrator.handle({ text: 'demo', needsApproval: true });
  await tick(); await tick();

  const pend = hitl.listPending('acme');
  await new Promise((r) => setTimeout(r, 60));   // "el humano tarda"
  hitl.resolve(pend[0].approvalId, true);
  await tick(); await tick(); await tick();

  const t = orchestrator.getTask(id);
  assert.equal(t.status, 'completed');
  assert.ok(t.waitedMs >= 50, `debe registrar la espera humana (waitedMs=${t.waitedMs})`);
  assert.ok(t.ms < t.waitedMs, `la latencia del agente (${t.ms}ms) no debe incluir la espera humana (${t.waitedMs}ms)`);
});

test('varias tareas aparcadas: ninguna retiene hueco, todas terminan al aprobar', async () => {
  const { hitl, orchestrator } = makeOrchestrator({ maxConcurrent: 2 });
  orchestrator.registerDepartment(makeDept({ hitl }));
  orchestrator.start();

  const ids = [];
  for (let i = 0; i < 4; i++) {
    // type/department explícitos: el enrutado por palabras clave no es lo que
    // se prueba aquí (y 'd0'..'d3' caerían al departamento por defecto).
    ids.push(await orchestrator.handle({
      text: `d${i}`, needsApproval: true, type: 'sales:inbound', department: 'sales',
    }));
  }
  await tick(); await tick(); await tick(); await tick();

  const pend = hitl.listPending('acme');
  assert.equal(pend.length, 4, 'las 4 deben llegar a pedir aprobación pese a maxConcurrent=2');

  for (const p of pend) hitl.resolve(p.approvalId, true);
  await tick(); await tick(); await tick(); await tick();

  for (const id of ids) {
    assert.equal(orchestrator.getTask(id).status, 'completed', `${id} debe completarse`);
  }
});

test('TaskQueue: park libera hueco y unpark tiene prioridad sobre trabajo nuevo', async () => {
  const orden = [];
  const q = new TaskQueue({ maxConcurrent: 1 });
  q.start(async (task) => { orden.push(task.id); await new Promise((r) => setImmediate(r)); });

  await q.enqueue({ id: 'a' });
  await tick();
  q.park();                       // 'a' se aparca → hueco libre
  await q.enqueue({ id: 'b' });
  await tick();
  assert.deepEqual(orden, ['a', 'b'], 'b debe entrar con a aparcada');

  // Con la cola ocupada por 'b', 'a' pide volver: espera turno.
  let reanudada = false;
  const back = q.unpark().then(() => { reanudada = true; });
  assert.equal(reanudada, false, 'no puede reanudar mientras la cola está llena');
  await tick(); await tick();
  await back;
  assert.equal(reanudada, true, 'al liberarse el hueco, la aparcada se reanuda');
});
