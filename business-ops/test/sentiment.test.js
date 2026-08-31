'use strict';

/**
 * SentimentAgent — detección de riesgo de cliente con el ticket aún abierto.
 *
 * Lo que se blinda aquí, por orden de daño si se rompe:
 *   1. **Falsos positivos con vocabulario de BeZhas.** "consumo de tokens",
 *      "demanda de BEZ-Coin" y "arbitraje de precios" son operativa diaria en
 *      una empresa blockchain. Si disparan "amenaza legal", los avisos se
 *      ignoran en una semana y dejan de proteger.
 *   2. **El suelo determinista.** Con el modelo degradado a simulado, una
 *      amenaza legal DEBE seguir detectándose: es cuando más caro sale no verla.
 *   3. **Asimetría modelo/léxico.** El modelo agrava, nunca rebaja.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const lexicon = require('../src/platform/sentimentLexicon');
const SentimentAgent = require('../src/agents/support/SentimentAgent');
const calib = require('../src/platform/sentimentCalibration');
const ModelGateway = require('../src/cognition/ModelGateway');
const EventBus = require('../src/core/EventBus');

const ctx = (extra = {}) => ({
  tenantId: 'bezhas', department: 'support',
  model: new ModelGateway({ providers: {} }),   // simulado
  bus: new EventBus('bezhas'),
  ...extra,
});

// ── Falsos positivos del dominio (el fallo que quema las alertas) ─────────

test('vocabulario blockchain normal NO se marca como amenaza legal', () => {
  const inocuos = [
    '¿Cuál es mi consumo de tokens este mes?',
    'Hay mucha demanda de BEZ-Coin ahora mismo',
    'Hago arbitraje de precios entre exchanges',
    '¿El consumo de gas se factura aparte?',
  ];
  for (const t of inocuos) {
    const r = lexicon.analyze(t);
    assert.ok(!r.signals.includes('legal_threat'), `falso positivo con: "${t}"`);
    assert.equal(r.minSeverity, 'none', `gravedad indebida con: "${t}"`);
  }
});

test('las amenazas legales de verdad sí se detectan', () => {
  const reales = [
    'Voy a hablar con mi abogado',
    'Voy a poner una demanda',
    'Presentaré una reclamación formal ante la AEPD',
    'Esto es un incumplimiento de contrato',
    'I will take legal action',
  ];
  for (const t of reales) {
    const r = lexicon.analyze(t);
    assert.ok(r.signals.includes('legal_threat'), `no detectó: "${t}"`);
    assert.equal(r.minSeverity, 'critical');
  }
});

// ── Señales separadas (cada una tiene consecuencia distinta) ──────────────

test('intención de baja se detecta aunque el mensaje sea educado', () => {
  const r = lexicon.analyze('Muchas gracias por todo, pero quiero darme de baja del servicio');
  assert.ok(r.signals.includes('churn_intent'));
  assert.equal(r.minSeverity, 'critical');
  assert.ok(r.polarity <= -0.5, 'un "gracias" de cortesía no puede dejarlo en positivo');
});

test('amenaza de reseña pública se separa de la legal', () => {
  const r = lexicon.analyze('Voy a dejar una reseña de una estrella en Trustpilot');
  assert.deepEqual(r.signals, ['reputational_threat']);
  assert.equal(r.minSeverity, 'high');
});

test('contacto reiterado se detecta aunque el tono sea neutro', () => {
  const r = lexicon.analyze('Es la tercera vez que escribo y sigo sin respuesta');
  assert.ok(r.signals.includes('repeat_contact'));
  assert.equal(r.minSeverity, 'elevated');
});

// ── Polaridad ────────────────────────────────────────────────────────────

test('un agradecimiento sale positivo, no negativo por los signos', () => {
  const r = lexicon.analyze('¡¡GRACIAS!! Excelente servicio, todo perfecto');
  assert.equal(r.label, 'positive');
  assert.ok(r.polarity > 0.5);
});

test('gritar agrava lo negativo pero no inventa negatividad', () => {
  const gritando = lexicon.analyze('ESTO NO FUNCIONA Y ESTOY MUY HARTO DEL SERVICIO');
  const tranquilo = lexicon.analyze('esto no funciona y estoy muy harto del servicio');
  assert.ok(gritando.polarity < tranquilo.polarity, 'las mayúsculas deben agravar');

  const neutroEnMayus = lexicon.analyze('BUENOS DIAS NECESITO LA FACTURA DE ENERO');
  assert.equal(neutroEnMayus.label, 'neutral', 'mayúsculas sin vocabulario negativo no son enfado');
});

test('la polaridad se gradúa por intensidad del término', () => {
  const leve = lexicon.analyze('tengo un problema con el acceso');
  const fuerte = lexicon.analyze('esto es una verguenza');
  assert.ok(fuerte.polarity < leve.polarity);
  assert.equal(fuerte.label, 'furious');
});

test('un mensaje neutro no genera señal ni gravedad', () => {
  const r = lexicon.analyze('Hola, ¿cómo activo la facturación mensual?');
  assert.deepEqual(r.signals, []);
  assert.equal(r.minSeverity, 'none');
  assert.equal(r.label, 'neutral');
});

test('texto vacío o nulo no rompe', () => {
  for (const v of [null, undefined, '', '   ']) {
    const r = lexicon.analyze(v);
    assert.equal(r.minSeverity, 'none');
    assert.equal(r.polarity, 0);
  }
});

// ── El agente ────────────────────────────────────────────────────────────

test('con el modelo caído, una amenaza legal se sigue detectando', async () => {
  const roto = { complete: async () => { throw new Error('proveedor caído'); } };
  const agent = new SentimentAgent(ctx({ model: roto }));

  const out = await agent.run({ payload: { text: 'Voy a hablar con mi abogado sobre esto' } });

  assert.equal(out.severity, 'critical', 'el suelo determinista debe aguantar solo');
  assert.equal(out.modelUsed, false);
  assert.equal(out.requiresHuman, true);
  assert.match(out.summary, /amenaza legal/i, 'debe explicarse sin el modelo');
});

test('el modelo puede AGRAVAR pero nunca rebajar el suelo del léxico', async () => {
  // El modelo dice "none" ante un mensaje con amenaza legal explícita.
  const blando = { complete: async () => ({ text: 'GRAVEDAD=none; RESUMEN=parece tranquilo' }) };
  const a1 = new SentimentAgent(ctx({ model: blando }));
  const r1 = await a1.run({ payload: { text: 'Voy a denunciaros' } });
  assert.equal(r1.severity, 'critical', 'el modelo no puede rebajar una amenaza explícita');

  // El modelo detecta ironía en un texto que el léxico ve inocuo.
  const fino = { complete: async () => ({ text: 'GRAVEDAD=high; RESUMEN=ironía y hartazgo' }) };
  const a2 = new SentimentAgent(ctx({ model: fino }));
  const r2 = await a2.run({ payload: { text: 'Enhorabuena por el servicio, de verdad, impecable como siempre' } });
  assert.equal(r2.severity, 'high', 'el modelo sí puede agravar');
  assert.equal(r2.modelUsed, true);
});

test('emite aviso solo a partir de gravedad alta (si suena siempre, se ignora)', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('support:sentiment_alert', (e) => avisos.push(e));
  const agent = new SentimentAgent(ctx({ bus }));

  await agent.run({ payload: { text: 'Hola, ¿cómo cambio mi contraseña?' } });
  assert.equal(avisos.length, 0, 'una consulta rutinaria no avisa');

  await agent.run({ payload: { text: 'tengo un problema con el acceso' } });
  assert.equal(avisos.length, 0, 'una molestia leve tampoco');

  await agent.run({ id: 't_9', payload: { text: 'Quiero darme de baja ahora mismo' } });
  assert.equal(avisos.length, 1, 'una baja sí');
  assert.equal(avisos[0].severity, 'critical');
  assert.equal(avisos[0].taskId, 't_9');
  assert.ok(avisos[0].excerpt, 'el aviso lleva el texto para que el humano decida');
});

test('sin texto devuelve neutro sin llamar al modelo', async () => {
  let llamadas = 0;
  const model = { complete: async () => { llamadas++; return { text: '' }; } };
  const out = await new SentimentAgent(ctx({ model })).run({ payload: {} });
  assert.equal(out.label, 'neutral');
  assert.equal(llamadas, 0);
});

test('parseModelOutput tolera formato imperfecto y descarta basura', () => {
  assert.deepEqual(
    SentimentAgent.parseModelOutput('GRAVEDAD=high; RESUMEN=cliente harto'),
    { severity: 'high', summary: 'cliente harto' },
  );
  assert.equal(SentimentAgent.parseModelOutput('gravedad = CRITICAL; resumen = x').severity, 'critical');
  assert.equal(SentimentAgent.parseModelOutput('bla bla sin formato').severity, null);
  assert.equal(SentimentAgent.parseModelOutput('GRAVEDAD=inventada').severity, null);
});

// ── Calibración contra el CSAT ───────────────────────────────────────────

test('calibración: precisión y exhaustividad sobre la decisión real', () => {
  const preds = [
    { taskId: 'a', severity: 'critical' },   // predijo riesgo
    { taskId: 'b', severity: 'high' },       // predijo riesgo
    { taskId: 'c', severity: 'none' },       // no predijo
    { taskId: 'd', severity: 'elevated' },   // no predijo (elevated < high)
  ];
  const csat = [
    { taskId: 'a', rating: 1 },   // detractor → acierto
    { taskId: 'b', rating: 5 },   // contento  → falsa alarma
    { taskId: 'c', rating: 5 },   // contento  → acierto negativo
    { taskId: 'd', rating: 2 },   // detractor → se escapó
  ];
  const r = calib.calibrate(preds, csat);

  assert.equal(r.truePositives, 1);
  assert.equal(r.falsePositives, 1);
  assert.equal(r.falseNegatives, 1);
  assert.equal(r.trueNegatives, 1);
  assert.equal(r.precision, 0.5);
  assert.equal(r.recall, 0.5);
  assert.equal(r.misses[0].taskId, 'd', 'debe señalar a quién se le escapó');
});

test('calibración sin muestras devuelve null, no 0 (y lo dice)', () => {
  const r = calib.calibrate([], []);
  assert.equal(r.precision, null);
  assert.equal(r.recall, null);
  assert.match(r.verdict, /insuficientes/);
});

test('los tickets sin CSAT no se cuentan (no hay verdad que comparar)', () => {
  const r = calib.calibrate(
    [{ taskId: 'a', severity: 'critical' }, { taskId: 'sin-csat', severity: 'critical' }],
    [{ taskId: 'a', rating: 1 }],
  );
  assert.equal(r.matched, 1);
});

test('el veredicto avisa del fallo caro (se escapan clientes) antes que del leve', () => {
  // 30 muestras: detecta 2 de 10 detractores → recall 0.2.
  const preds = [], csat = [];
  for (let i = 0; i < 30; i++) {
    const detractor = i < 10;
    const predice = i < 2;
    preds.push({ taskId: `t${i}`, severity: predice ? 'critical' : 'none' });
    csat.push({ taskId: `t${i}`, rating: detractor ? 1 : 5 });
  }
  const r = calib.calibrate(preds, csat);
  assert.ok(r.recall < 0.5);
  assert.match(r.verdict, /se escapan/);
});

test('recordPrediction no duplica el mismo ticket', async () => {
  const facts = new Map();
  const store = {
    getFact: async ({ tenantId, key }) => facts.get(`${tenantId}:${key}`),
    setFact: async ({ tenantId, key, value }) => { facts.set(`${tenantId}:${key}`, value); },
  };
  await calib.recordPrediction({ store, tenantId: 't', taskId: 'x', severity: 'high' });
  const second = await calib.recordPrediction({ store, tenantId: 't', taskId: 'x', severity: 'none' });
  assert.equal(second.duplicate, true);
  assert.equal(facts.get('t:support:sentiment_predictions').length, 1);
});
