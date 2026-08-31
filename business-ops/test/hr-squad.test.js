'use strict';

/**
 * Criba de candidatos: el fallo caro no es un candidato mal evaluado (eso lo
 * corrige un humano), es que la evaluación esté contaminada con proxies de
 * discriminación que nadie puede auditar después. La contratación es una
 * decisión automatizada de alto riesgo (RGPD art. 22, AI Act de la UE), así
 * que lo que el modelo NUNCA debe ver importa tanto como lo que sí ve.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const redaction = require('../src/platform/candidateRedaction');
const requisitionMatch = require('../src/platform/requisitionMatch');
const CVScreenerAgent = require('../src/agents/hr/CVScreenerAgent');
const RecruiterScreenAgent = require('../src/agents/hr/RecruiterScreenAgent');
const ModelGateway = require('../src/cognition/ModelGateway');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const HITLGate = require('../src/core/HITLGate');
const EventBus = require('../src/core/EventBus');

const ctx = (extra = {}) => ({
  tenantId: 'bezhas', department: 'hr',
  model: new ModelGateway({ providers: {} }),
  guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
  hitl: new HITLGate({}),
  bus: new EventBus('bezhas'),
  tools: {},
  ...extra,
});

// ══ Redacción: quita el proxy, no la señal ═══════════════════════════════

test('quita nombre, edad, nacionalidad y estado civil del objeto', () => {
  const out = redaction.redact({
    name: 'Fatima Al-Rashid', age: 52, nationality: 'Marroquí', maritalStatus: 'casada',
    resumeText: 'Ingeniera de software con Node.js.',
  });
  assert.ok(!('name' in out.safeCandidate));
  assert.ok(!('age' in out.safeCandidate));
  assert.ok(!('nationality' in out.safeCandidate));
  assert.deepEqual(out.removed.sort(), ['age', 'maritalStatus', 'name', 'nationality']);
});

test('detecta edad y fecha de nacimiento en texto libre, y las anota (nunca en silencio)', () => {
  const out = redaction.redact({ resumeText: 'Tiene 45 años, casada. Nacida el 03/04/1980.' });
  assert.ok(!/45/.test(out.redactedText));
  assert.ok(!/1980/.test(out.redactedText));
  assert.ok(out.removed.includes('text:age'));
  assert.ok(out.removed.includes('text:dob'));
  assert.ok(out.removed.includes('text:marital_status'));
});

test('NO confunde "años de experiencia" con la edad (bug real encontrado y corregido)', () => {
  // El regex de edad inicial se comía "10 años de experiencia" entero —
  // justo la señal que el cribador SÍ necesita ver.
  const casos = [
    'Tiene 10 años de experiencia en Node.js',
    '8 años trabajando como backend developer',
    'Más de 5 años en el sector fintech',
    '6 años de trayectoria en consultoría',
  ];
  for (const texto of casos) {
    const out = redaction.redact({ resumeText: texto });
    assert.equal(out.redactedText, texto, `no debía tocar: "${texto}"`);
    assert.ok(!out.removed.includes('text:age'), `falso positivo en: "${texto}"`);
  }
});

test('sigue redactando la edad real aunque la frase mencione experiencia en otra parte', () => {
  const out = redaction.redact({ resumeText: 'Tiene 45 años. Cuenta con 10 años de experiencia.' });
  assert.match(out.redactedText, /\[dato omitido\]\./);
  assert.match(out.redactedText, /10 años de experiencia/, 'la experiencia real debe sobrevivir');
});

test('candidato sin ningún dato protegido no marca nada como retirado', () => {
  const out = redaction.redact({ resumeText: 'Experiencia en Python y Docker.', role: 'Backend' });
  assert.deepEqual(out.removed, []);
  assert.equal(out.safeCandidate.role, 'Backend');
});

// ══ Emparejamiento objetivo contra el puesto ══════════════════════════════

test('puntúa por requisitos cumplidos, no por impresión general', () => {
  const req = { requiredSkills: ['node.js', 'python'], niceToHaveSkills: ['docker'], minYears: 5 };
  const fuerte = requisitionMatch.score(req, { resumeText: 'Node.js, Python y Docker.', years: 6 });
  const flojo = requisitionMatch.score(req, { resumeText: 'Solo conocimientos de Java.', years: 1 });

  assert.ok(fuerte.score > flojo.score);
  assert.deepEqual(fuerte.matchedRequired.sort(), ['node.js', 'python']);
  assert.deepEqual(flojo.missingRequired.sort(), ['node.js', 'python']);
  assert.equal(fuerte.meetsMinYears, true);
  assert.equal(flojo.meetsMinYears, false);
});

test('sin requisitos definidos, no se penaliza al candidato de más', () => {
  const r = requisitionMatch.score({}, { resumeText: 'cualquier cosa' });
  assert.ok(r.score > 0);
});

test('el mismo CV saca siempre el mismo score (determinista)', () => {
  const req = { requiredSkills: ['react'], minYears: 2 };
  const cand = { resumeText: 'React desde hace 3 años.', years: 3 };
  const a = requisitionMatch.score(req, cand);
  const b = requisitionMatch.score(req, cand);
  assert.deepEqual(a, b);
});

// ══ CVScreenerAgent ════════════════════════════════════════════════════════

test('el modelo nunca recibe el nombre, la edad ni la nacionalidad del candidato', async () => {
  const prompts = [];
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'Evaluación.' }; } };
  const agent = new CVScreenerAgent(ctx({ model }));

  await agent.run({
    payload: {
      candidate: { name: 'Fatima Al-Rashid', age: 52, nationality: 'Marroquí', resumeText: 'Node.js y Python, 6 años.' },
    },
  });

  assert.ok(!prompts[0].includes('Fatima'));
  assert.ok(!prompts[0].includes('52'));
  assert.ok(!prompts[0].includes('Marroquí'));
  assert.match(prompts[0], /Node\.js/);
});

test('con requisición, el modelo recibe el encaje YA CALCULADO, no lo inventa', async () => {
  const prompts = [];
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'x' }; } };
  const agent = new CVScreenerAgent(ctx({ model }));

  const out = await agent.run({
    payload: {
      candidate: { name: 'Ana', resumeText: 'Node.js, Python, Docker. 6 años de experiencia.', years: 6 },
      requisition: { requiredSkills: ['node.js', 'python'], niceToHaveSkills: ['docker'], minYears: 5 },
    },
  });

  assert.ok(out.match);
  assert.equal(out.match.meetsMinYears, true);
  assert.match(prompts[0], /ENCAJE OBJETIVO YA CALCULADO/);
  assert.match(prompts[0], /Requisitos cumplidos: node\.js, python/);
});

test('devuelve qué campos se redactaron, para poder auditar la decisión', async () => {
  const agent = new CVScreenerAgent(ctx());
  const out = await agent.run({ payload: { candidate: { name: 'X', age: 30, resumeText: 'Java.' } } });
  assert.ok(out.redactedFields.includes('name'));
  assert.ok(out.redactedFields.includes('age'));
});

test('una decisión de empleo sigue pasando por HITL (sin cambios de guardrail)', async () => {
  const hitl = { request: async (req) => ({ approved: false, note: 'rechazado en test' }) };
  const agent = new CVScreenerAgent(ctx({ hitl }));
  const out = await agent.run({ payload: { candidate: { name: 'Ana' }, decision: 'hire' } });
  assert.equal(out.decision.status, 'rejected');
});

// ══ RecruiterScreenAgent ═══════════════════════════════════════════════════

test('RecruiterScreenAgent tampoco manda el nombre al modelo (bug real corregido)', async () => {
  const prompts = [];
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'x' }; } };
  const agent = new RecruiterScreenAgent(ctx({ model }));

  await agent.run({
    payload: {
      candidate: { name: 'Fatima Al-Rashid', resumeText: 'Ingeniera de Software con 6 años de experiencia en Node.js.' },
      jobProfile: 'Senior Backend Developer',
    },
  });

  assert.ok(!prompts[0].includes('Fatima'), 'el nombre no debe llegar al modelo');
  assert.ok(!/Nombre:/.test(prompts[0]), 'ni siquiera el campo Nombre debe aparecer');
  assert.match(prompts[0], /Node\.js/);
});

test('la decisión de empleo de RecruiterScreenAgent conserva el nombre real (la ve el humano)', async () => {
  const hitl = { request: async (req) => { return { approved: false, note: 'x' }; } };
  const capturado = [];
  const hitlSpia = { request: async (req) => { capturado.push(req); return { approved: false, note: 'x' }; } };
  const agent = new RecruiterScreenAgent(ctx({ hitl: hitlSpia }));

  await agent.run({ payload: { candidate: { name: 'Ana López' }, jobProfile: 'X', decision: 'hire' } });

  assert.equal(capturado[0].action.args.candidateName, 'Ana López', 'el humano SÍ debe ver a quién decide');
});
