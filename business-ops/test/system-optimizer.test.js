'use strict';

/**
 * SystemOptimizer — el agente que reconfigura OPERANT a partir de lo que ve.
 *
 * Lo que se fija aquí es sobre todo CUÁNDO actúa y CUÁNDO no. Un optimizador
 * automático que se dispara de más reconfigura producción con ruido de muestra;
 * uno que se dispara de menos deja una regla rota días en pie. Los umbrales son
 * el producto, no un detalle.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const SystemOptimizer = require('../src/cognition/SystemOptimizer');
const EventBus = require('../src/core/EventBus');

/** Memoria mínima con la API de facts que usa el optimizador. */
function memoriaFalsa() {
  const facts = new Map();
  return {
    facts,
    async setFact(k, v) { facts.set(k, v); },
    async getFact(k) { return facts.has(k) ? facts.get(k) : null; },
  };
}

/** Auditoría que solo apunta, para poder comprobar el rastro. */
function auditoriaFalsa() {
  const log = [];
  return { log: (r) => { log.push(r); return r; }, entries: log };
}

/** Orquestador mínimo: un par de departamentos con agentes que tienen tier. */
function orquestadorFalso(depts = { support: 'mid', sales: 'frontier' }) {
  const departments = new Map();
  for (const [id, tier] of Object.entries(depts)) {
    departments.set(id, {
      id: `${id}.manager`,
      modelTier: tier,
      specialists: new Map([[`${id}.a`, { id: `${id}.a`, modelTier: tier }]]),
    });
  }
  return {
    departments,
    agentIds: () => [...departments.keys()],
    learnedRoutes: [],
    async learnRoute(r) { this.learnedRoutes.push(r); return true; },
  };
}

function crear(extra = {}) {
  let ahora = 1_000_000_000_000;
  const opt = new SystemOptimizer({
    tenantId: 'acme',
    memory: memoriaFalsa(),
    audit: auditoriaFalsa(),
    orchestrator: orquestadorFalso(),
    now: () => ahora,
    ...extra,
  });
  return { opt, avanzar: (ms) => { ahora += ms; } };
}

/**
 * Encola n tareas de un departamento, cada una con texto distinto.
 *
 * El discriminante va pegado a una palabra (`asunto12`) y no suelto (`... 12`):
 * la firma descarta los términos de 3 letras o menos, así que un número suelto
 * no la cambia y las n tareas contarían como UN solo caso nuevo.
 */
function encolar(opt, n, { department = 'support', fallback = false, prefijo = 'caso' } = {}) {
  for (let i = 0; i < n; i++) {
    opt.observe('queued', {
      department, fallback,
      type: `${department}:request`,
      payload: { text: `${prefijo} asunto${i} con texto suficientemente largo para firmar` },
    });
  }
}

// ── Disparo ───────────────────────────────────────────────────────────────────

test('sin datos no corre: no hay nada que optimizar', async () => {
  const { opt } = crear();
  const r = opt.readiness();
  assert.equal(r.ready, false);
  assert.match(r.reason, /faltan tareas/);

  const c = await opt.cycle();
  assert.equal(c.ran, false);
});

test('volumen sin novedad NO dispara: 500 tareas iguales no enseñan nada', () => {
  const { opt } = crear();
  // Mismo texto siempre → una sola firma → sin novedad.
  for (let i = 0; i < 200; i++) {
    opt.observe('queued', { department: 'support', payload: { text: 'la misma incidencia de siempre repetida' } });
  }
  const r = opt.readiness();
  assert.equal(r.ready, false);
  assert.match(r.reason, /poca novedad/);
  assert.equal(r.signal.novel, 1);
});

test('volumen + casos nuevos sí dispara', () => {
  const { opt } = crear();
  encolar(opt, 60);
  const r = opt.readiness();
  assert.equal(r.ready, true);
  assert.equal(r.urgent, false);
  assert.ok(r.signal.novel >= 8);
});

test('una tasa de fallo disparada no espera a juntar volumen', () => {
  const { opt } = crear();
  encolar(opt, 20);
  for (let i = 0; i < 8; i++) opt.observe('failed', { department: 'support' });
  const r = opt.readiness();
  assert.equal(r.ready, true);
  assert.equal(r.urgent, true);
  assert.match(r.reason, /disparada/);
});

test('el enfriado frena incluso lo urgente: un sistema que se reconfigura en bucle empeora', async () => {
  const { opt, avanzar } = crear();
  encolar(opt, 60);
  await opt.cycle();

  encolar(opt, 30);
  for (let i = 0; i < 20; i++) opt.observe('failed', { department: 'support' });
  const r = opt.readiness();
  assert.equal(r.ready, false);
  assert.match(r.reason, /enfriado/);

  avanzar(SystemOptimizer.DEFAULTS.cooldownMs + 1);
  assert.equal(opt.readiness().ready, true);
});

test('`force` se salta el umbral pero sigue devolviendo un ciclo honesto', async () => {
  const { opt } = crear();
  const c = await opt.cycle({ force: true });
  assert.equal(c.ran, true);
  assert.deepEqual(c.applied, []);
});

// ── Propuestas ────────────────────────────────────────────────────────────────

test('un departamento interno que resuelve solo baja de modelo, y se aplica', async () => {
  const { opt } = crear();
  encolar(opt, 60, { department: 'support' });      // 0 escalados, 0 fallos
  const c = await opt.cycle();

  const baja = c.applied.find((p) => p.id === 'tier:down:support');
  assert.ok(baja, 'debería haber bajado el tier de support');
  assert.equal(baja.from, 'mid');
  assert.equal(baja.to, 'fast');
  assert.equal(opt.orchestrator.departments.get('support').modelTier, 'fast');
});

test('bajar el modelo de un departamento de cara al cliente NO se aplica solo', async () => {
  const { opt } = crear();
  encolar(opt, 60, { department: 'sales' });
  const c = await opt.cycle();

  const baja = c.underReview.find((p) => p.id === 'tier:down:sales');
  assert.ok(baja, 'sales es cara al cliente: debe ir a revisión');
  assert.equal(baja.risk, 'review');
  assert.equal(opt.orchestrator.departments.get('sales').modelTier, 'frontier', 'no se tocó');
});

test('un departamento que escala demasiado propone subir de modelo, a revisión por el coste', async () => {
  const { opt } = crear();
  encolar(opt, 60, { department: 'support' });
  for (let i = 0; i < 35; i++) opt.observe('escalated', { department: 'support' });
  const c = await opt.cycle();

  const sube = c.underReview.find((p) => p.id === 'tier:up:support');
  assert.ok(sube);
  assert.equal(sube.risk, 'review');
  assert.match(sube.reason, /más coste por tarea/);
});

test('rechazos frecuentes bajan la autonomía sin preguntar; aprobarlo todo pide permiso para subirla', async () => {
  const dial = { level: 'assist', set(l) { this.level = l; } };
  const { opt } = crear({ autonomy: dial });
  encolar(opt, 60);
  for (let i = 0; i < 20; i++) opt.observe('hitl:resolved', { approved: false, department: 'support' });
  const c = await opt.cycle();

  const baja = c.applied.find((p) => p.id === 'autonomy:lower');
  assert.ok(baja, 'bajar el dial es seguro: se aplica');
  assert.equal(dial.level, 'manual');

  const { opt: opt2 } = crear({ autonomy: { level: 'assist', set() {} } });
  encolar(opt2, 60);
  for (let i = 0; i < 20; i++) opt2.observe('hitl:resolved', { approved: true, department: 'support' });
  const c2 = await opt2.cycle();
  const sube = c2.underReview.find((p) => p.id === 'autonomy:raise');
  assert.ok(sube, 'subir el dial es decisión de negocio: va a revisión');
});

// ── Aprendizaje: verificar y revertir ─────────────────────────────────────────

test('si un cambio empeora la métrica que prometía mejorar, el ciclo siguiente lo revierte', async () => {
  const { opt, avanzar } = crear();

  // Ciclo 1: support va fino → baja a 'fast'.
  encolar(opt, 60, { department: 'support' });
  const c1 = await opt.cycle();
  assert.ok(c1.applied.some((p) => p.id === 'tier:down:support'));
  assert.equal(opt.orchestrator.departments.get('support').modelTier, 'fast');

  // Ciclo 2: con el modelo más barato, support empieza a escalar.
  avanzar(SystemOptimizer.DEFAULTS.cooldownMs + 1);
  encolar(opt, 60, { department: 'support', prefijo: 'otro' });
  for (let i = 0; i < 25; i++) opt.observe('escalated', { department: 'support' });
  const c2 = await opt.cycle();

  const revert = c2.applied.find((p) => p.kind === 'revert');
  assert.ok(revert, 'debería deshacer la bajada que empeoró el escalado');
  assert.equal(opt.orchestrator.departments.get('support').modelTier, 'mid', 'devuelto a su tier');
});

// ── Casos externos y enrutado ────────────────────────────────────────────────

test('los casos que nadie reconoce se cuentan aparte y guardan muestra', () => {
  const { opt } = crear();
  encolar(opt, 20, { fallback: true, prefijo: 'basculas descalibradas en planta' });
  assert.equal(opt.evidence.fallbackRoutes, 20);
  assert.ok(opt.evidence.fallbackSamples.length > 0);
  assert.ok(opt.evidence.fallbackSamples.length <= 40, 'la muestra está acotada');
});

test('con muchos casos sin reconocer se propone aprender enrutado', async () => {
  const { opt } = crear();
  encolar(opt, 30, { fallback: true, prefijo: 'incidencia de bascula' });
  encolar(opt, 30, { prefijo: 'normal' });
  const c = await opt.cycle();
  const todas = [...c.applied, ...c.underReview];
  assert.ok(todas.some((p) => p.kind === 'routing'));
});

test('solo acepta reglas de departamentos que el tenant tiene contratados', async () => {
  const modelo = {
    complete: async () => ({
      text: JSON.stringify([
        { keyword: 'bascula', department: 'operations' },   // NO contratado
        { keyword: 'devolucion', department: 'support' },   // sí
        { keyword: 'ok', department: 'support' },           // demasiado corta
      ]),
    }),
  };
  const { opt } = crear({ model: modelo });
  const reglas = await opt._extraerReglas(['la bascula falla', 'quiero una devolucion']);
  assert.deepEqual(reglas, [{ keyword: 'devolucion', department: 'support' }]);
});

test('si el modelo no devuelve JSON, no se aprende nada (y no revienta)', async () => {
  const { opt } = crear({ model: { complete: async () => ({ text: 'pues mira, yo creo que…' }) } });
  assert.deepEqual(await opt._extraerReglas(['algo']), []);
});

// ── Rastro y durabilidad ─────────────────────────────────────────────────────

test('cada ciclo entra en la cadena de auditoría', async () => {
  const audit = auditoriaFalsa();
  const { opt } = crear({ audit });
  encolar(opt, 60);
  await opt.cycle();
  assert.ok(audit.entries.some((e) => e.event === 'optimizer:cycle'));
});

test('la evidencia se reinicia tras el ciclo: no se cuenta dos veces lo mismo', async () => {
  const { opt } = crear();
  encolar(opt, 60);
  await opt.cycle();
  assert.equal(opt.evidence.tasks, 0);
  assert.equal(opt.evidence.novelSignatures.length, 0);
});

test('el estado sobrevive a un reinicio', async () => {
  const memory = memoriaFalsa();
  const { opt } = crear({ memory });
  encolar(opt, 60);
  await opt.cycle();

  const otro = new SystemOptimizer({ tenantId: 'acme', memory, orchestrator: orquestadorFalso() });
  assert.equal(await otro.hydrate(), true);
  assert.ok(otro.lastCycleAt, 'recuerda cuándo corrió el último ciclo');
  assert.ok(otro._seen.size > 0, 'recuerda qué casos ya había visto');
});

test('las firmas conocidas no crecen sin límite', async () => {
  const memory = memoriaFalsa();
  const { opt } = crear({ memory });
  for (let i = 0; i < 6000; i++) opt._seen.add(`sig${i}`);
  await opt._persist();
  assert.equal(memory.facts.get('optimizer:state').seen.length, 5000);
});

test('un fallo al aplicar no tumba el resto del ciclo', async () => {
  const { opt } = crear({ autonomy: { level: 'assist', set() { throw new Error('dial roto'); } } });
  encolar(opt, 60, { department: 'support' });
  for (let i = 0; i < 20; i++) opt.observe('hitl:resolved', { approved: false, department: 'support' });
  const c = await opt.cycle();

  assert.equal(c.ran, true);
  assert.ok(c.underReview.some((p) => p.why === 'dial roto'), 'el fallo se reporta');
  assert.ok(c.applied.some((p) => p.id === 'tier:down:support'), 'lo demás se aplicó igual');
});

test('snapshot describe el estado sin necesidad de correr un ciclo', () => {
  const { opt } = crear();
  encolar(opt, 10);
  const s = opt.snapshot();
  assert.equal(s.tenantId, 'acme');
  assert.equal(s.readiness.ready, false);
  assert.equal(s.readiness.signal.tasks, 10);
  assert.ok(s.thresholds.minTasks);
});


// ── Regresión: la contradicción entre señal global y por departamento ────────

test('no baja el modelo si el sistema entero está escalando, aunque el contador del departamento diga que va fino', async () => {
  // Caso real detectado probando contra el servicio: `support:escalated` no
  // llevaba departamento, así que el escalado subía el contador global y no el
  // de soporte. El optimizador leyó "soporte lo resuelve todo solo" y le bajó
  // el modelo mientras soporte escalaba el 89% de los casos.
  const { opt } = crear();
  encolar(opt, 60, { department: 'support' });
  // Escalados SIN departamento: solo suben el global.
  for (let i = 0; i < 40; i++) opt.observe('escalated', {});

  const c = await opt.cycle();
  assert.ok(!c.applied.some((p) => p.id === 'tier:down:support'),
    'la señal global contradice al contador del departamento: no se toca');
  assert.equal(opt.orchestrator.departments.get('support').modelTier, 'mid');
});

test('el escalado de soporte se atribuye a soporte aunque el evento no lo diga', () => {
  const { opt } = crear();
  const bus = new EventBus('acme');
  opt.attach(bus);
  bus.emit('support:escalated', { tenantId: 'acme', customerId: 'c1' });
  assert.equal(opt.evidence.byDepartment.support?.escalations, 1);
});


// ── El reloj como suelo, no como motor ───────────────────────────────────────

test('un tenant tranquilo acaba optimizándose igual: el latido de fondo lo cubre', async () => {
  const { opt, avanzar } = crear();
  encolar(opt, 5);   // muy por debajo del umbral de evidencia
  assert.equal(opt.readiness().ready, false, 'con 5 tareas no hay nada que mirar todavía');

  avanzar(SystemOptimizer.DEFAULTS.maxIntervalMs + 1);
  const r = opt.readiness();
  assert.equal(r.ready, true);
  assert.equal(r.heartbeat, 'max');
  assert.match(r.reason, /latido de fondo/);

  const c = await opt.cycle();
  assert.equal(c.trigger, 'reloj:max');
});

test('un cambio sin verificar se comprueba antes que el latido largo', async () => {
  const { opt, avanzar } = crear();
  encolar(opt, 60, { department: 'support' });
  const c1 = await opt.cycle();
  assert.ok(c1.applied.some((p) => p.id === 'tier:down:support'));

  // A las 48 h, con el cambio aún sin veredicto, se vuelve a mirar — sin
  // esperar los 7 días del latido largo ni los 50 casos del umbral.
  avanzar(SystemOptimizer.DEFAULTS.verifyIntervalMs + 1);
  const r = opt.readiness();
  assert.equal(r.ready, true);
  assert.equal(r.heartbeat, 'verify');
  assert.match(r.reason, /sin verificar/);
});

test('el enfriado sigue mandando sobre los suelos de reloj', () => {
  const { opt, avanzar } = crear({
    thresholds: { cooldownMs: 10 * 24 * 60 * 60 * 1000 },   // enfriado mayor que el latido
  });
  opt.lastCycleAt = new Date(opt.now()).toISOString();
  avanzar(SystemOptimizer.DEFAULTS.maxIntervalMs + 1);
  const r = opt.readiness();
  assert.equal(r.ready, false);
  assert.match(r.reason, /enfriado/);
});

test('un latido sin datos no paga la narración del modelo', async () => {
  let llamadas = 0;
  const { opt, avanzar } = crear({
    model: { complete: async () => { llamadas++; return { text: 'algo' }; } },
  });
  avanzar(SystemOptimizer.DEFAULTS.maxIntervalMs + 1);
  const c = await opt.cycle();
  assert.equal(c.trigger, 'reloj:max');
  assert.equal(llamadas, 0, 'sin evidencia ni propuestas, no se llama al modelo');
  assert.equal(c.reading, null);
});

test('un ciclo con datos sí paga la narración', async () => {
  let llamadas = 0;
  const { opt } = crear({
    model: { complete: async () => { llamadas++; return { text: 'resumen' }; } },
  });
  encolar(opt, 60);
  const c = await opt.cycle();
  assert.ok(llamadas >= 1);
  assert.equal(c.reading, 'resumen');
});
