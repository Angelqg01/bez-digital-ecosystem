'use strict';

/**
 * Durabilidad de tareas y aprobaciones HITL — el último estado que moría al
 * reiniciar. Contratos:
 *  - toda transición de tarea queda persistida;
 *  - tras un "apagón", lo que estaba en vuelo aparece como `interrupted`
 *    (nunca se re-ejecuta a ciegas) y puede reintentarse (retryTask);
 *  - las aprobaciones pendientes se rehidratan como huérfanas: visibles,
 *    decidibles, y si el humano aprueba, la acción se ejecuta vía el conector.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SqliteStore = require('../src/platform/SqliteStore');
const TenantManager = require('../src/core/TenantManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const HITLGate = require('../src/core/HITLGate');
const AuditLog = require('../src/guardrails/AuditLog');

function tempDb(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-')), `${name}.db`);
}

async function makeTenants(store, tools = {}) {
  // El escuadrón de ventas necesita un email; stub inofensivo por defecto.
  const defaults = { email: { name: 'email', async execute() { return { sent: true, simulated: true }; } } };
  const tenants = new TenantManager({ modelGateway: new ModelGateway({ providers: {} }), store });
  await tenants.provision({ tenantId: 'acme', plan: 'pro', departments: ['sales', 'support'], tools: { ...defaults, ...tools } });
  return tenants;
}

test('toda transición de tarea queda persistida (queued → completed)', async () => {
  const store = new SqliteStore({ filePath: tempDb('t1') });
  await store.connect();
  const tenants = await makeTenants(store);

  const id = await tenants.handle('acme', { text: 'Quiero una demo y precio', channel: 'web', customerId: 'c1' });
  await tenants.get('acme').orchestrator.waitForTask(id, { timeoutMs: 5000 });
  await new Promise((r) => setImmediate(r)); // asienta la persistencia best-effort

  const rows = await store.listTasks({ tenantId: 'acme' });
  const row = rows.find((t) => t.id === id);
  assert.ok(row, 'la tarea debe estar en la base de datos');
  assert.equal(row.status, 'completed');
  assert.equal(row.department, 'sales');
  await store.disconnect();
});

test('APAGÓN: la tarea en vuelo aparece como interrupted y se puede reintentar', async () => {
  const file = tempDb('t2');
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();
  // Simula el estado que deja un crash: una tarea quedó "running" en la DB.
  await store1.upsertTask({
    id: 't_crash_1', tenantId: 'acme', type: 'sales:inbound', department: 'sales',
    payload: { text: 'Quiero una demo y precio', channel: 'web', customerId: 'c9' },
    status: 'running', createdAt: new Date().toISOString(),
  });
  await store1.disconnect();

  // "Reinicio": mundo nuevo sobre el mismo fichero.
  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const tenants = await makeTenants(store2);
  const orch = tenants.get('acme').orchestrator;

  const t = orch.getTask('t_crash_1');
  assert.ok(t, 'la tarea interrumpida debe rehidratarse en el historial');
  assert.equal(t.status, 'interrupted', 'en vuelo + reinicio = interrupted, no re-ejecución silenciosa');

  // Reintento explícito: tarea NUEVA con el mismo payload, enlazada.
  const newId = await orch.retryTask('t_crash_1');
  const done = await orch.waitForTask(newId, { timeoutMs: 5000 });
  assert.equal(done.status, 'completed');
  assert.equal(done.payload.retryOf, 't_crash_1');

  // Reintentar una completada debe rechazarse.
  await assert.rejects(() => orch.retryTask(newId), /interrumpidas o fallidas/);
  await store2.disconnect();
});

test('HITL: solicitud y decisión quedan persistidas (aprobación en vivo)', async () => {
  const store = new SqliteStore({ filePath: tempDb('t3') });
  await store.connect();
  const gate = new HITLGate({ store, tenantId: 'acme', audit: new AuditLog({ tenantId: 'acme' }) });

  const promise = gate.request({ tenantId: 'acme', agentId: 'sales.outreach', action: { tool: 'email', method: 'send', args: {} }, reason: 'frío' });
  await new Promise((r) => setImmediate(r));

  let rows = await store.listApprovals({ tenantId: 'acme', status: 'pending' });
  assert.equal(rows.length, 1, 'la solicitud debe persistirse al crearse');

  gate.resolve(rows[0].approvalId, true, 'adelante');
  await promise;
  await new Promise((r) => setImmediate(r));

  rows = await store.listApprovals({ tenantId: 'acme' });
  assert.equal(rows[0].status, 'approved');
  assert.equal(rows[0].note, 'adelante');
  await store.disconnect();
});

test('APAGÓN: la aprobación pendiente se rehidrata como huérfana y el sí humano ejecuta la acción', async () => {
  const file = tempDb('t4');
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();
  // Estado post-crash: una aprobación quedó pendiente en la DB.
  await store1.upsertApproval({
    approvalId: 'appr_crash_1', tenantId: 'acme', agentId: 'sales.outreach',
    action: { tool: 'email', method: 'send', args: { to: 'dir@puerto.es', subject: 'Propuesta' }, category: 'outbound', cold: true },
    reason: 'Línea roja: primer contacto en frío.', status: 'pending',
  });
  await store1.disconnect();

  // "Reinicio" con el conector del tenant disponible.
  const email = { name: 'email', sent: [], async execute(method, args) { this.sent.push({ method, args }); return { sent: true }; } };
  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const tenants = await makeTenants(store2, { email });
  const hitl = tenants.get('acme').hitl;

  const pendientes = hitl.listPending('acme');
  assert.equal(pendientes.length, 1, 'la huérfana debe estar en la bandeja');
  assert.equal(pendientes[0].orphan, true);
  assert.equal(pendientes[0].approvalId, 'appr_crash_1');

  // El humano aprueba tras el reinicio → la acción se ejecuta igualmente.
  assert.equal(hitl.resolve('appr_crash_1', true, 'ok, envíalo'), true);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(email.sent.length, 1, 'la acción aprobada debe ejecutarse vía el conector');
  assert.equal(email.sent[0].args.to, 'dir@puerto.es');

  const rows = await store2.listApprovals({ tenantId: 'acme' });
  assert.equal(rows[0].status, 'approved');
  await store2.disconnect();
});

test('APAGÓN: el rechazo de una huérfana NO ejecuta nada y queda registrado', async () => {
  const file = tempDb('t5');
  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();
  await store1.upsertApproval({
    approvalId: 'appr_crash_2', tenantId: 'acme', agentId: 'sales.outreach',
    action: { tool: 'email', method: 'send', args: { to: 'x@y.z' } }, reason: 'frío', status: 'pending',
  });
  await store1.disconnect();

  const email = { name: 'email', sent: [], async execute(m, a) { this.sent.push(a); } };
  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const tenants = await makeTenants(store2, { email });
  const hitl = tenants.get('acme').hitl;

  hitl.resolve('appr_crash_2', false, 'no procede');
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(email.sent.length, 0, 'JAMÁS se ejecuta un rechazo');

  const rows = await store2.listApprovals({ tenantId: 'acme' });
  assert.equal(rows[0].status, 'rejected');
  assert.equal(rows[0].note, 'no procede');
  assert.equal(hitl.listPending('acme').length, 0, 'la bandeja queda limpia');
  await store2.disconnect();
});
