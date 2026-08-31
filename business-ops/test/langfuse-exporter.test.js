'use strict';

/**
 * LangfuseExporter: traduce eventos onUsage del ModelGateway a trace+generation
 * de Langfuse. Lo que más se puede romper en silencio es la autenticación
 * (Basic Auth mal construida) y que un Langfuse caído no debe poder tumbar el
 * servicio ni hacer crecer la cola sin límite.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const LangfuseExporter = require('../src/platform/LangfuseExporter');

function exporterCon(extra = {}) {
  const enviados = [];
  const exp = new LangfuseExporter({
    baseUrl: 'http://langfuse.local:3000',
    publicKey: 'pk-lf-test',
    secretKey: 'sk-lf-test',
    clock: () => 1_700_000_000_000,
    fetch: async (url, opts) => {
      enviados.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
      return { ok: true, status: 207 };
    },
    ...extra,
  });
  return { exp, enviados };
}

test('sin credenciales no hace nada ni intenta red', async () => {
  let llamadas = 0;
  const exp = new LangfuseExporter({
    baseUrl: '', publicKey: '', secretKey: '',
    fetch: async () => { llamadas++; return { ok: true }; },
  });

  assert.equal(exp.enabled, false);
  assert.equal(exp.start(), false, 'no debe arrancar el temporizador');
  exp.recordModel({ meta: { tenantId: 'acme' }, tier: 'fast', model: 'claude-haiku-4-5' });
  assert.equal(exp._queue.length, 0, 'recordModel no encola nada si está deshabilitado');

  const r = await exp.flush();
  assert.equal(r.sent, false);
  assert.equal(llamadas, 0);
});

test('recordModel encola una traza y una generación enlazadas por traceId', () => {
  const { exp } = exporterCon();
  exp.recordModel({
    meta: { tenantId: 'acme', agentId: 'sales.lead-hunter' },
    tier: 'mid',
    model: 'claude-sonnet-4-6',
    system: 'Eres un cazador de leads.',
    input: [{ role: 'user', content: 'Busca leads en Cádiz' }],
    output: 'He encontrado 3 leads.',
    usage: { inputTokens: 120, outputTokens: 40 },
    latencyMs: 850,
  });

  assert.equal(exp._queue.length, 2);
  const [trace, gen] = exp._queue;

  assert.equal(trace.type, 'trace-create');
  assert.equal(trace.body.name, 'sales.lead-hunter');
  assert.equal(trace.body.userId, 'acme');
  assert.deepEqual(trace.body.tags, ['acme', 'sales.lead-hunter', 'mid']);

  assert.equal(gen.type, 'generation-create');
  assert.equal(gen.body.traceId, trace.body.id, 'la generación debe apuntar a la traza recién creada');
  assert.equal(gen.body.model, 'claude-sonnet-4-6');
  assert.equal(gen.body.input.system, 'Eres un cazador de leads.');
  assert.deepEqual(gen.body.input.messages, [{ role: 'user', content: 'Busca leads en Cádiz' }]);
  assert.equal(gen.body.output, 'He encontrado 3 leads.');
  assert.equal(gen.body.usage.input, 120);
  assert.equal(gen.body.usage.output, 40);
  assert.equal(gen.body.usage.unit, 'TOKENS');
  assert.equal(gen.body.level, 'DEFAULT');
  // startTime = ahora - latencia; con clock fijo debe caer 850ms antes.
  assert.equal(new Date(gen.body.endTime).getTime() - new Date(gen.body.startTime).getTime(), 850);
});

test('un error de la llamada se refleja como nivel ERROR con statusMessage', () => {
  const { exp } = exporterCon();
  exp.recordModel({
    meta: { tenantId: 'acme', agentId: 'finance.invoice-bot' },
    tier: 'fast', model: 'claude-haiku-4-5',
    usage: { inputTokens: 10, outputTokens: 0 },
    fallback: true, error: 'ECONNREFUSED',
  });
  const gen = exp._queue[1];
  assert.equal(gen.body.level, 'ERROR');
  assert.equal(gen.body.statusMessage, 'ECONNREFUSED');
  assert.equal(gen.body.metadata.fallback, true);
});

test('flush manda el lote por Basic Auth con las claves del proyecto', async () => {
  const { exp, enviados } = exporterCon();
  exp.recordModel({ meta: { tenantId: 'acme' }, tier: 'fast', model: 'claude-haiku-4-5', usage: {} });

  const r = await exp.flush();
  assert.equal(r.sent, true);
  assert.equal(r.count, 2);
  assert.equal(exp._queue.length, 0, 'la cola se vacía tras un envío correcto');

  assert.match(enviados[0].url, /\/api\/public\/ingestion$/);
  const esperado = `Basic ${Buffer.from('pk-lf-test:sk-lf-test').toString('base64')}`;
  assert.equal(enviados[0].headers.Authorization, esperado);
  assert.equal(enviados[0].body.batch.length, 2);
});

test('sin eventos en cola no manda nada', async () => {
  const { exp, enviados } = exporterCon();
  const r = await exp.flush();
  assert.equal(r.sent, false);
  assert.match(r.reason, /cola vacía/);
  assert.equal(enviados.length, 0);
});

test('un Langfuse caído no rompe el servicio y conserva el lote para el siguiente intento', async () => {
  const { exp } = exporterCon({ fetch: async () => { throw new Error('ECONNREFUSED'); } });
  exp.recordModel({ meta: { tenantId: 'acme' }, tier: 'fast', model: 'claude-haiku-4-5', usage: {} });

  const r = await exp.flush();
  assert.equal(r.sent, false);
  assert.equal(exp.lastError, 'ECONNREFUSED');
  assert.equal(exp.status().enabled, true, 'sigue habilitado para reintentar en el próximo ciclo');
});

test('un HTTP no-2xx del servidor se registra como fallo', async () => {
  const { exp } = exporterCon({ fetch: async () => ({ ok: false, status: 401 }) });
  exp.recordModel({ meta: { tenantId: 'acme' }, tier: 'fast', model: 'claude-haiku-4-5', usage: {} });
  const r = await exp.flush();
  assert.equal(r.sent, false);
  assert.match(exp.lastError, /401/);
});

test('la cola tiene tope: una caída larga no crece la memoria sin límite', () => {
  const { exp } = exporterCon();
  for (let i = 0; i < 600; i++) {
    exp.recordModel({ meta: { tenantId: 'acme' }, tier: 'fast', model: 'claude-haiku-4-5', usage: {} });
  }
  // 600 llamadas × 2 eventos (trace+generation) = 1200, por encima del tope de 1000.
  assert.equal(exp._queue.length, 1000);
  assert.ok(exp.dropped > 0, 'debe contabilizar lo descartado');
});

test('flush solo manda hasta 100 eventos por lote', async () => {
  const { exp, enviados } = exporterCon();
  for (let i = 0; i < 60; i++) {
    exp.recordModel({ meta: { tenantId: 'acme' }, tier: 'fast', model: 'claude-haiku-4-5', usage: {} });
  }
  assert.equal(exp._queue.length, 120); // 60 × 2 eventos

  const r1 = await exp.flush();
  assert.equal(r1.count, 100);
  assert.equal(exp._queue.length, 20, 'el resto queda para el siguiente vaciado');

  const r2 = await exp.flush();
  assert.equal(r2.count, 20);
  assert.equal(exp._queue.length, 0);
});

test('status() resume el estado sin exponer las claves', () => {
  const { exp } = exporterCon();
  const s = exp.status();
  assert.equal(s.enabled, true);
  assert.equal(s.baseUrl, 'http://langfuse.local:3000');
  assert.equal(s.queued, 0);
  assert.equal(s.flushes, 0);
  assert.equal(s.dropped, 0);
  assert.equal(s.lastError, null);
  assert.ok(!('publicKey' in s) && !('secretKey' in s));
});
