'use strict';

/**
 * Scheduler de agentes proactivos: trabajos recurrentes por tenant que entran
 * por el mismo camino que una solicitud humana (cola, cuota, guardrails),
 * persisten como fact del tenant y sobreviven a reinicios.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const Scheduler = require('../src/platform/Scheduler');
const SqliteStore = require('../src/platform/SqliteStore');

function tempDb(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'operant-')), `${name}.db`);
}

/** TenantManager falso que registra los handle(). */
function fakeTenants() {
  return {
    handled: [],
    async handle(tenantId, input) {
      this.handled.push({ tenantId, input });
      return `t_${this.handled.length}`;
    },
  };
}

test('parseEvery: 30m/2h/1d y ms crudos; inválido lanza', () => {
  assert.equal(Scheduler.parseEvery('30m'), 30 * 60_000);
  assert.equal(Scheduler.parseEvery('2h'), 2 * 3_600_000);
  assert.equal(Scheduler.parseEvery('1d'), 86_400_000);
  assert.equal(Scheduler.parseEvery(90_000), 90_000);
  assert.throws(() => Scheduler.parseEvery('cada rato'), /intervalo inválido/);
});

test('addJob valida el mínimo y exige input.text', async () => {
  const sch = new Scheduler({ tenants: fakeTenants() });
  await assert.rejects(() => sch.addJob('acme', { everyMs: 5_000, input: { text: 'x' } }), /mínimo/);
  await assert.rejects(() => sch.addJob('acme', { everyMs: 60_000, input: {} }), /input\.text/);
  const job = await sch.addJob('acme', { everyMs: 60_000, input: { text: 'informe' } });
  assert.ok(job.id);
  assert.equal(job.input.channel, 'scheduler');
});

test('tick: ejecuta lo vencido, respeta el intervalo y reejecuta al vencer', async () => {
  let now = 1_000_000;
  const tenants = fakeTenants();
  const sch = new Scheduler({ tenants, clock: () => now });
  await sch.addJob('acme', { id: 'informe', everyMs: 60_000, input: { text: 'prepara el informe operativo' } });

  // Primer tick: nunca ha corrido → corre.
  let ran = await sch.tick();
  assert.equal(ran.length, 1);
  assert.equal(tenants.handled.length, 1);
  assert.equal(tenants.handled[0].input.channel, 'scheduler');

  // Antes de vencer: no corre.
  now += 30_000;
  ran = await sch.tick();
  assert.equal(ran.length, 0);
  assert.equal(tenants.handled.length, 1);

  // Vencido: vuelve a correr.
  now += 31_000;
  ran = await sch.tick();
  assert.equal(ran.length, 1);
  assert.equal(tenants.handled.length, 2);
});

test('tick: un tenant con cuota agotada no rompe los trabajos de otros', async () => {
  const tenants = {
    handled: [],
    async handle(tenantId, input) {
      if (tenantId === 'roto') { const e = new Error('cuota agotada'); e.code = 'quota_exceeded'; throw e; }
      this.handled.push({ tenantId, input });
      return 't_ok';
    },
  };
  const sch = new Scheduler({ tenants, clock: () => 1 });
  await sch.addJob('roto', { everyMs: 60_000, input: { text: 'x' } });
  await sch.addJob('sano', { everyMs: 60_000, input: { text: 'y' } });

  const ran = await sch.tick();
  assert.equal(ran.length, 2);
  assert.ok(ran.find((r) => r.tenantId === 'roto').error);
  assert.equal(tenants.handled.length, 1, 'el tenant sano ejecutó igual');
});

test('REINICIO: la agenda persiste y se rehidrata sin re-disparar en cascada', async () => {
  const file = tempDb('sched');
  let now = 500_000;

  const store1 = new SqliteStore({ filePath: file });
  await store1.connect();
  const sch1 = new Scheduler({ tenants: fakeTenants(), store: store1, clock: () => now });
  await sch1.addJob('acme', { id: 'diario', description: 'informe del CEO', everyMs: 3_600_000, input: { text: 'digest' } });
  await sch1.tick();               // corre y asienta lastRunAt
  await store1.disconnect();       // ← "apagón"

  const store2 = new SqliteStore({ filePath: file });
  await store2.connect();
  const tenants2 = fakeTenants();
  const sch2 = new Scheduler({ tenants: tenants2, store: store2, clock: () => now + 60_000 });
  const n = await sch2.hydrate(['acme']);
  assert.equal(n, 1);
  const [job] = sch2.listJobs('acme');
  assert.equal(job.id, 'diario');
  assert.ok(job.lastRunAt, 'conserva el último run');

  // Solo ha pasado 1 minuto de un trabajo horario: NO debe correr.
  const ran = await sch2.tick();
  assert.equal(ran.length, 0);
  assert.equal(tenants2.handled.length, 0);
  await store2.disconnect();
});

test('removeJob elimina y persiste', async () => {
  const store = new SqliteStore({ filePath: tempDb('sched-rm') });
  await store.connect();
  const sch = new Scheduler({ tenants: fakeTenants(), store });
  await sch.addJob('acme', { id: 'j1', everyMs: 60_000, input: { text: 'x' } });
  assert.equal(await sch.removeJob('acme', 'j1'), true);
  assert.equal(sch.listJobs('acme').length, 0);
  assert.deepEqual(await store.getFact({ tenantId: 'acme', key: 'scheduler:jobs' }), []);
  await store.disconnect();
});
