'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const ChiefOfStaffAgent = require('../src/agents/executive/ChiefOfStaffAgent');
const SalesManager = require('../src/agents/sales/SalesManager');
const ModelGateway = require('../src/cognition/ModelGateway');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const HITLGate = require('../src/core/HITLGate');
const EventBus = require('../src/core/EventBus');

const ctx = () => ({
  tenantId: 'bezhas',
  model: new ModelGateway({ providers: {} }),
  guardrails: new PolicyEngine({ tenantId: 'bezhas' }),
  hitl: new HITLGate({}),
  bus: new EventBus('bezhas'),
  tools: {},
});

const reports = [
  { department: 'sales', done: '2 hilos', blocked: 'reparto de ingresos', decision: 'Aceptar reparto por proyecto',
    risk: 'compromiso sin contrato', stance: { subject: 'reparto-nauticops', position: 'aceptar' } },
  { department: 'legal', done: 'revisión', blocked: '—', decision: 'Ninguna',
    risk: 'sin contrato', stance: { subject: 'reparto-nauticops', position: 'vetar' } },
  { department: 'finance', done: 'cobros al día', blocked: '—', decision: 'ninguna', risk: '—' },
];

test('la cola solo incluye decisiones realmente pedidas', () => {
  const q = ChiefOfStaffAgent.decisionQueue(reports);
  assert.equal(q.length, 1);
  assert.equal(q[0].department, 'sales');
  assert.equal(q[0].voice, 'Ventas');
});

test('detecta el desacuerdo entre Ventas y Legal y no inventa otros', () => {
  const d = ChiefOfStaffAgent.disagreements(reports);
  assert.equal(d.length, 1);
  assert.equal(d[0].subject, 'reparto-nauticops');
  assert.equal(ChiefOfStaffAgent.disagreements([reports[2]]).length, 0);
});

test('run devuelve parte, decisiones y desacuerdos (modo simulado)', async () => {
  const out = await new ChiefOfStaffAgent(ctx()).run({ type: 'digest', payload: { reports } });
  assert.equal(out.status, 'ok');
  assert.equal(out.decisions.length, 1);
  assert.equal(out.disagreements.length, 1);
  assert.ok(out.digest);
});

test('los managers de departamento heredan su voz', () => {
  const sales = new SalesManager(ctx());
  assert.match(sales.systemPrompt, /voz de Ventas/);
  assert.match(sales.systemPrompt, /Hecho · Bloqueado/);
});
