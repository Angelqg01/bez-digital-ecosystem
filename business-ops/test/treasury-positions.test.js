'use strict';

/**
 * Runway multi-divisa: TreasuryPositionsConnector (posiciones + mercado) y su
 * uso por TreasuryRunwayAgent. Sin red ni RPC: todo se inyecta.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TreasuryPositionsConnector = require('../src/connectors/TreasuryPositionsConnector');
const EventBus = require('../src/core/EventBus');
const HITLGate = require('../src/core/HITLGate');
const AuditLog = require('../src/guardrails/AuditLog');
const PolicyEngine = require('../src/guardrails/PolicyEngine');
const { buildDepartments } = require('../src/agents');

const NOW = Date.parse('2026-11-04T12:00:00Z');

function writePositions(positions) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tp-')), 'positions.json');
  fs.writeFileSync(file, JSON.stringify({ positions }));
  return file;
}

const marketFetch = (usdcPrice = 1) => async (url) => ({
  ok: true,
  json: async () => (String(url).includes('open.er-api')
    ? { rates: { EUR: 0.92, AED: 3.6725 } }
    : { 'usd-coin': { usd: usdcPrice }, tether: { usd: 1 }, dai: { usd: 1 }, 'euro-coin': { usd: 1.08 } }),
});

test('positions: lee el fichero, marca como obsoleta una posición vieja y avisa', async () => {
  const file = writePositions([
    { bank: 'Rotterdam', asset: 'EUR', kind: 'fiat', amount: 1000, asOf: '2026-11-04' },
    { bank: 'Dubai', asset: 'AED', kind: 'fiat', amount: 5000, asOf: '2026-10-01' }, // > 72 h
    { asset: 'XXX', kind: 'raro', amount: 1 }, // formato inválido
  ]);
  const c = new TreasuryPositionsConnector({ config: { file, now: () => NOW } });
  const r = await c.execute('positions');
  assert.equal(r.holdings.length, 2);
  assert.equal(r.stale.length, 1);
  assert.equal(r.stale[0].bank, 'Dubai');
  assert.ok(r.warnings.some((w) => w.includes('Dubai')), 'avisa de la obsoleta');
  assert.ok(r.warnings.some((w) => w.includes('inválido')), 'avisa de la ignorada');
});

test('positions: sin fichero → simulado, sin posiciones (no inventa saldos)', async () => {
  const c = new TreasuryPositionsConnector({ config: { file: '/no/existe.json', now: () => NOW } });
  const r = await c.execute('positions');
  assert.deepEqual(r.holdings, []);
  assert.equal(r.simulated, true);
});

test('positions: stablecoin on-chain se lee por el lector inyectado; si falla, se avisa y se omite', async () => {
  const file = writePositions([
    { asset: 'USDC', kind: 'stable', source: 'onchain', token: '0xt', address: '0xa' },
    { asset: 'USDT', kind: 'stable', source: 'onchain', token: '0xu', address: '0xb' },
  ]);
  const readErc20 = async (e) => { if (e.asset === 'USDT') throw new Error('RPC caído'); return '250000.5'; };
  const c = new TreasuryPositionsConnector({ config: { file, readErc20, now: () => NOW } });
  const r = await c.execute('positions');
  assert.equal(r.holdings.length, 1);
  assert.equal(r.holdings[0].amount, 250000.5);
  assert.ok(r.warnings.some((w) => w.includes('USDT') && w.includes('RPC caído')));
});

test('market: tipos de cambio USD→divisa y peg de stablecoins; si el proveedor cae → simulado', async () => {
  const ok = await new TreasuryPositionsConnector({ config: { fetch: marketFetch(0.97), now: () => NOW } }).execute('market');
  assert.equal(ok.simulated, false);
  assert.ok(Math.abs(ok.fx.AED - 1 / 3.6725) < 1e-9);
  assert.equal(ok.pegs.USDC, 0.97);

  const caido = await new TreasuryPositionsConnector({ config: { fetch: async () => { throw new Error('sin red'); }, now: () => NOW } }).execute('market');
  assert.equal(caido.simulated, true);
});

// ── Agente ────────────────────────────────────────────────────────────────────
function fakeModel() { return { complete: async () => ({ text: 'ok' }), completeWithTools: async () => ({ text: 'ok', toolCalls: [] }) }; }
const fakeCore = (balanceUsd) => ({ name: 'bezhas-core', async execute() { return { simulated: false, balanceUsd }; } });

function agent({ file, fetch, bus = new EventBus('acme'), core = fakeCore(0) }) {
  const audit = new AuditLog({ tenantId: 'acme' });
  const ctx = {
    tenantId: 'acme', model: fakeModel(), bus, memory: null,
    guardrails: new PolicyEngine({ tenantId: 'acme' }),
    hitl: new HITLGate({ bus, audit, tenantId: 'acme' }),
    tools: { 'bezhas-core': core, 'treasury-positions': new TreasuryPositionsConnector({ config: { file, fetch, now: () => NOW } }) },
  };
  const [dept] = buildDepartments({ ...ctx, enabled: ['treasury'] });
  return dept.specialists.get('treasury.runway');
}

test('agente: suma bancos en AED/EUR/USD con su tipo de cambio y devuelve el runway de estrés', async () => {
  const file = writePositions([
    { bank: 'Miami', asset: 'USD', kind: 'fiat', amount: 100000, asOf: '2026-11-04' },
    { bank: 'Rotterdam', asset: 'EUR', kind: 'fiat', amount: 100000, asOf: '2026-11-04' },
    { bank: 'Dubai', asset: 'AED', kind: 'fiat', amount: 367250, asOf: '2026-11-04' },
    { asset: 'USDC', kind: 'stable', amount: 100000, asOf: '2026-11-04' },
  ]);
  const r = await agent({ file, fetch: marketFetch(1) }).run({ payload: { monthlyBurnUsd: 50000 } });
  // 100000 USD + 100000/0.92 EUR→USD + 367250/3.6725 AED→USD (=100000) + 100000 USDC
  const esperado = Math.round(100000 + 100000 / 0.92 + 100000 + 100000);
  assert.equal(r.multiCurrency.totalUsd, esperado);
  assert.ok(r.multiCurrency.stressedRunwayMonths < r.multiCurrency.runwayMonths, 'el estrés baja el runway');
  assert.equal(r.runwayMonths, r.multiCurrency.runwayMonths);
});

test('agente: depeg real del USDC baja el runway frente a peg 1', async () => {
  const file = writePositions([{ asset: 'USDC', kind: 'stable', amount: 1000000, asOf: '2026-11-04' }]);
  const peg1 = await agent({ file, fetch: marketFetch(1) }).run({ payload: { monthlyBurnUsd: 100000 } });
  const depeg = await agent({ file, fetch: marketFetch(0.96) }).run({ payload: { monthlyBurnUsd: 100000 } });
  assert.equal(peg1.runwayMonths, 10);
  assert.equal(depeg.runwayMonths, 9.6);
});

test('agente: saldos de banco obsoletos → no alarma aunque el runway sea bajo (dato no fiable)', async () => {
  const bus = new EventBus('acme');
  const eventos = [];
  bus.on('treasury:runway_critical', (e) => eventos.push(e));
  const file = writePositions([{ bank: 'Dubai', asset: 'USD', kind: 'fiat', amount: 1000, asOf: '2026-01-01' }]);
  const r = await agent({ file, fetch: marketFetch(1), bus }).run({ payload: { monthlyBurnUsd: 5000 } });
  assert.equal(r.critical, false);
  assert.equal(eventos.length, 0);
  assert.equal(r.multiCurrency.staleCount, 1);
});

test('agente: runway bajo con datos frescos y mercado real → alerta crítica', async () => {
  const bus = new EventBus('acme');
  const eventos = [];
  bus.on('treasury:runway_critical', (e) => eventos.push(e));
  const file = writePositions([{ bank: 'Miami', asset: 'USD', kind: 'fiat', amount: 4000, asOf: '2026-11-04' }]);
  const r = await agent({ file, fetch: marketFetch(1), bus }).run({ payload: { monthlyBurnUsd: 5000 } });
  assert.equal(r.critical, true);
  assert.equal(eventos.length, 1);
});

test('agente: mercado caído → asume peg 1, marca el dato como no fiable y no alarma', async () => {
  const bus = new EventBus('acme');
  const eventos = [];
  bus.on('treasury:runway_critical', (e) => eventos.push(e));
  const file = writePositions([{ bank: 'Miami', asset: 'USD', kind: 'fiat', amount: 4000, asOf: '2026-11-04' }]);
  const r = await agent({ file, fetch: async () => { throw new Error('sin red'); }, bus }).run({ payload: { monthlyBurnUsd: 5000 } });
  assert.equal(r.multiCurrency.marketSimulated, true);
  assert.equal(r.critical, false);
  assert.equal(eventos.length, 0);
});

test('agente: sin fichero de posiciones conserva el comportamiento anterior (solo Treasury DAO)', async () => {
  const r = await agent({ file: '/no/existe.json', fetch: marketFetch(1), core: fakeCore(100000) }).run({ payload: { monthlyBurnUsd: 5000 } });
  assert.equal(r.runwayMonths, 20);
  assert.equal(r.multiCurrency.positions, 0);
  assert.ok(r.multiCurrency.warnings.length > 0, 'avisa de que faltan las posiciones');
});
