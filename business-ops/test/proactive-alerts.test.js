'use strict';

/**
 * Contratos de las automatizaciones proactivas:
 *  - los agentes de vigilancia tienen trabajo programado (antes: construidos
 *    pero nunca ejecutados por nadie);
 *  - sus alertas llegan a una persona por el bot del departamento correcto
 *    (antes: se emitían al bus y nadie escuchaba).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const EventBus = require('../src/core/EventBus');
const HitlNotifier = require('../src/platform/HitlNotifier');
const Scheduler = require('../src/platform/Scheduler');

/** Notificador con transportes falsos, uno por bot, para ver a cuál va cada cosa. */
function makeNotifier() {
  const enviados = [];
  const bot = (nombre) => ({
    send: async (msg) => { enviados.push({ bot: nombre, ...msg }); return { sent: true }; },
    chatId: '123',
    token: `tok-${nombre}`,
  });
  const notifier = new HitlNotifier({
    routes: {
      finance: bot('cfo'),
      operations: bot('devops'),
      blockchain: bot('devops'),
      treasury: bot('cfo'),
      legal: bot('legal'),
    },
    fallback: bot('ceo'),
  });
  return { notifier, enviados };
}

test('una anomalía on-chain llega al bot de DevOps sin que nadie la pida', async () => {
  const { notifier, enviados } = makeNotifier();
  const bus = new EventBus('acme');
  notifier.attach(bus, 'acme');

  bus.emit('blockchain:anomaly_detected', {
    tenantId: 'acme',
    alerts: ['El stack de BeZhas-Blockchain no respondió'],
  });
  await new Promise((r) => setImmediate(r));

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].bot, 'devops', 'la vigilancia on-chain avisa al bot DevOps');
  assert.match(enviados[0].text, /Anomalía on-chain/);
  assert.match(enviados[0].text, /no respondió/);
});

test('un runway crítico llega al bot del CFO con las cifras', async () => {
  const { notifier, enviados } = makeNotifier();
  const bus = new EventBus('acme');
  notifier.attach(bus, 'acme');

  bus.emit('treasury:runway_critical', { tenantId: 'acme', balanceUsd: 4200, runwayMonths: 1.4 });
  await new Promise((r) => setImmediate(r));

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].bot, 'cfo', 'la tesorería avisa al bot del CFO');
  assert.match(enviados[0].text, /1\.4 meses/);
  assert.match(enviados[0].text, /4200/);
});

test('las alertas no llevan botones de aprobar/rechazar (no hay nada que decidir)', async () => {
  const { notifier, enviados } = makeNotifier();
  await notifier.alert({ tenantId: 'acme', department: 'blockchain', title: 'Prueba', lines: ['x'] });
  assert.equal(enviados[0].replyMarkup, undefined);
});

test('sin ruta configurada la alerta no rompe nada (degrada en silencio)', async () => {
  const vacio = new HitlNotifier({ routes: {}, fallback: null });
  const r = await vacio.alert({ tenantId: 'acme', department: 'blockchain', title: 'x' });
  assert.equal(r.sent, false);
});

test('la agenda por defecto programa aprendizaje y vigilancia según departamento', async () => {
  const jobs = [];
  const scheduler = new Scheduler({
    tenants: { handle: async () => 't1' },
    actions: { digest: async () => {}, learn: async () => {} },
  });

  // Réplica de la política de registerDefaultJobs() del server.
  const DIA = 24 * 60 * 60 * 1000;
  const registrar = async (tenantId, departments) => {
    await scheduler.addJob(tenantId, { id: 'digest-diario', everyMs: DIA, action: 'digest' });
    await scheduler.addJob(tenantId, { id: 'aprendizaje-diario', everyMs: DIA, action: 'learn' });
    if (departments.includes('blockchain')) {
      await scheduler.addJob(tenantId, { id: 'onchain-monitor', everyMs: 30 * 60 * 1000, input: { text: 'Revisa el estado de la cadena, validadores y gas' } });
    }
    if (departments.includes('treasury')) {
      await scheduler.addJob(tenantId, { id: 'treasury-runway', everyMs: DIA, input: { text: 'Cuantos meses de autonomia le quedan a la tesoreria' } });
    }
  };

  await registrar('bezhas', ['sales', 'blockchain', 'treasury']);
  await registrar('taller', ['sales', 'support']);

  const bezhas = scheduler.listJobs('bezhas').map((j) => j.id);
  assert.ok(bezhas.includes('aprendizaje-diario'), 'el aprendizaje continuo debe estar programado');
  assert.ok(bezhas.includes('onchain-monitor'));
  assert.ok(bezhas.includes('treasury-runway'));

  const taller = scheduler.listJobs('taller').map((j) => j.id);
  assert.ok(taller.includes('aprendizaje-diario'));
  assert.ok(!taller.includes('onchain-monitor'), 'sin departamento blockchain no se vigila la cadena');
  assert.ok(!taller.includes('treasury-runway'), 'sin departamento treasury no se calcula runway');
  jobs.push(...bezhas);
});

test('re-registrar la agenda por defecto es idempotente y conserva lastRunAt', async () => {
  const scheduler = new Scheduler({
    tenants: { handle: async () => 't1' },
    actions: { learn: async () => {} },
    clock: () => 1_000_000,
  });
  await scheduler.addJob('acme', { id: 'aprendizaje-diario', everyMs: 86_400_000, action: 'learn' });
  await scheduler.tick();                       // marca lastRunAt
  const tras1 = scheduler.listJobs('acme')[0].lastRunAt;
  assert.ok(tras1, 'debe haber corrido una vez');

  await scheduler.addJob('acme', { id: 'aprendizaje-diario', everyMs: 86_400_000, action: 'learn' });
  const jobs = scheduler.listJobs('acme');
  assert.equal(jobs.length, 1, 'no se duplica el trabajo');
  assert.equal(jobs[0].lastRunAt, tras1, 'conserva lastRunAt: no re-dispara al rehidratar');
});
