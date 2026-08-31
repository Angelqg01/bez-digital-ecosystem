'use strict';

/**
 * Exportador OTLP: empuja las métricas a un colector OpenTelemetry.
 *
 * Lo que más se puede romper aquí en silencio es la conversión de histogramas:
 * Telemetry los guarda acumulados (estilo Prometheus) y OTLP los quiere por
 * bucket. Si se manda mal, el backend pinta totales inflados y nadie lo nota
 * hasta que alguien toma una decisión con esos números.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const Telemetry = require('../src/platform/Telemetry');
const OtlpExporter = require('../src/platform/OtlpExporter');

function exporterCon(telemetry, extra = {}) {
  const enviados = [];
  const exp = new OtlpExporter({
    telemetry,
    endpoint: 'http://colector:4318',
    clock: () => 1_700_000_000_000,
    fetch: async (url, opts) => {
      enviados.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
      return { ok: true, status: 200 };
    },
    ...extra,
  });
  return { exp, enviados };
}

test('sin endpoint configurado no exporta ni intenta red', async () => {
  let llamadas = 0;
  const exp = new OtlpExporter({
    telemetry: new Telemetry(), endpoint: '',
    fetch: async () => { llamadas++; return { ok: true }; },
  });

  assert.equal(exp.enabled, false);
  assert.equal(exp.start(), false, 'no debe arrancar el temporizador');
  const r = await exp.export();
  assert.equal(r.sent, false);
  assert.equal(llamadas, 0);
});

test('exporta contadores como Sum acumulado con sus etiquetas', async () => {
  const t = new Telemetry();
  t.inc('operant_tasks_total', { tenant: 'acme', status: 'completed' }, 3);
  t.inc('operant_tasks_total', { tenant: 'acme', status: 'failed' });

  const { exp, enviados } = exporterCon(t);
  const r = await exp.export();

  assert.equal(r.sent, true);
  assert.match(enviados[0].url, /\/v1\/metrics$/);

  const metricas = enviados[0].body.resourceMetrics[0].scopeMetrics[0].metrics;
  const tareas = metricas.find((m) => m.name === 'operant_tasks_total');
  assert.ok(tareas.sum, 'un contador va como sum');
  assert.equal(tareas.sum.isMonotonic, true);
  assert.equal(tareas.sum.aggregationTemporality, 2, 'CUMULATIVE');
  assert.equal(tareas.sum.dataPoints.length, 2);

  const completadas = tareas.sum.dataPoints.find((d) =>
    d.attributes.some((a) => a.key === 'status' && a.value.stringValue === 'completed'));
  assert.equal(completadas.asInt, '3');
  assert.ok(completadas.attributes.some((a) => a.key === 'tenant' && a.value.stringValue === 'acme'));
});

test('el histograma se manda por bucket, NO acumulado (o el backend infla las cuentas)', async () => {
  const t = new Telemetry();
  // 4 valores: uno en <=50, dos en <=250, uno por encima de todos los buckets.
  t.observe('operant_task_duration_ms', 10);
  t.observe('operant_task_duration_ms', 200);
  t.observe('operant_task_duration_ms', 240);
  t.observe('operant_task_duration_ms', 90_000);

  const { exp, enviados } = exporterCon(t);
  await exp.export();

  const h = enviados[0].body.resourceMetrics[0].scopeMetrics[0].metrics
    .find((m) => m.name === 'operant_task_duration_ms').histogram.dataPoints[0];

  assert.equal(h.count, '4');
  assert.equal(h.sum, 90_450);
  assert.equal(h.min, 10);
  assert.equal(h.max, 90_000);

  // OTLP exige exactamente un bucket más que límites (el +Inf final).
  assert.equal(h.bucketCounts.length, h.explicitBounds.length + 1);

  // La suma de los buckets tiene que dar el total: si se mandara acumulado, daría más.
  const suma = h.bucketCounts.reduce((a, b) => a + Number(b), 0);
  assert.equal(suma, 4, `los buckets deben sumar el count, sumaron ${suma}`);

  // Reparto concreto: 1 en <=50, 2 en <=250, 1 en +Inf.
  const porLimite = Object.fromEntries(h.explicitBounds.map((le, i) => [le, Number(h.bucketCounts[i])]));
  assert.equal(porLimite[50], 1);
  assert.equal(porLimite[250], 2);
  assert.equal(Number(h.bucketCounts.at(-1)), 1, 'el valor de 90s cae en +Inf');
});

test('un histograma vacío no se envía', async () => {
  const t = new Telemetry();
  t.inc('operant_tasks_total', { tenant: 'acme' });
  const { exp, enviados } = exporterCon(t);
  await exp.export();

  const nombres = enviados[0].body.resourceMetrics[0].scopeMetrics[0].metrics.map((m) => m.name);
  assert.ok(!nombres.includes('operant_task_duration_ms'));
});

test('sin métricas todavía, no manda un cuerpo vacío', async () => {
  const { exp, enviados } = exporterCon(new Telemetry());
  const r = await exp.export();
  assert.equal(r.sent, false);
  assert.match(r.reason, /sin métricas/);
  assert.equal(enviados.length, 0);
});

test('un colector caído no rompe el servicio', async () => {
  const t = new Telemetry();
  t.inc('operant_tasks_total', { tenant: 'acme' });
  const exp = new OtlpExporter({
    telemetry: t, endpoint: 'http://colector:4318',
    fetch: async () => { throw new Error('ECONNREFUSED'); },
  });

  const r = await exp.export();
  assert.equal(r.sent, false);
  assert.equal(exp.lastError, 'ECONNREFUSED');
  assert.equal(exp.status().enabled, true, 'sigue habilitado para reintentar en el próximo ciclo');
});

test('un HTTP no-2xx del colector se registra como fallo', async () => {
  const t = new Telemetry();
  t.inc('x', { tenant: 'acme' });
  const exp = new OtlpExporter({
    telemetry: t, endpoint: 'http://c:4318',
    fetch: async () => ({ ok: false, status: 503 }),
  });
  const r = await exp.export();
  assert.equal(r.sent, false);
  assert.match(exp.lastError, /503/);
});

test('las cabeceras del entorno viajan (API key del backend)', async () => {
  const t = new Telemetry();
  t.inc('x', { tenant: 'acme' });
  const { exp, enviados } = exporterCon(t, { headers: { 'signoz-access-token': 'abc123' } });
  await exp.export();
  assert.equal(enviados[0].headers['signoz-access-token'], 'abc123');
  assert.equal(enviados[0].headers['Content-Type'], 'application/json');
});

test('OTEL_EXPORTER_OTLP_HEADERS se parsea al formato de OTel', () => {
  const h = OtlpExporter._headersFromEnv({ OTEL_EXPORTER_OTLP_HEADERS: 'api-key=xyz, tenant=acme' });
  assert.deepEqual(h, { 'api-key': 'xyz', tenant: 'acme' });
  assert.deepEqual(OtlpExporter._headersFromEnv({}), {});
});

test('parseKey reconstruye nombre y etiquetas de una serie', () => {
  assert.deepEqual(OtlpExporter.parseKey('simple'), { name: 'simple', attributes: [] });
  const p = OtlpExporter.parseKey('m{tenant="acme",tier="fast"}');
  assert.equal(p.name, 'm');
  assert.deepEqual(p.attributes, [
    { key: 'tenant', value: { stringValue: 'acme' } },
    { key: 'tier', value: { stringValue: 'fast' } },
  ]);
});

test('el recurso identifica el servicio', async () => {
  const t = new Telemetry();
  t.inc('x', { tenant: 'acme' });
  const { exp, enviados } = exporterCon(t, { serviceName: 'operant-prod' });
  await exp.export();
  const attrs = enviados[0].body.resourceMetrics[0].resource.attributes;
  assert.ok(attrs.some((a) => a.key === 'service.name' && a.value.stringValue === 'operant-prod'));
});
