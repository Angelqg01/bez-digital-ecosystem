'use strict';

/**
 * Los 7 especialistas que faltaban en el vertical BeZhas (Blockchain, Legal,
 * Tesorería, Fundraising). Mismo patrón que en el resto de departamentos:
 * cada número con consecuencia económica o legal real lo calcula un módulo
 * puro, el modelo solo redacta alrededor.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const slashing = require('../src/platform/slashingWatch');
const gasOptimizer = require('../src/platform/gasOptimizer');
const dpia = require('../src/platform/dpiaChecklist');
const vesting = require('../src/platform/vestingMath');
const liquidity = require('../src/platform/liquidityMath');
const capTable = require('../src/platform/capTableMath');

const SlashingWatcherAgent = require('../src/agents/blockchain/SlashingWatcherAgent');
const GasOptimizerAgent = require('../src/agents/blockchain/GasOptimizerAgent');
const DPIAAgent = require('../src/agents/legal/DPIAAgent');
const VestingMonitorAgent = require('../src/agents/treasury/VestingMonitorAgent');
const LiquidityWatcherAgent = require('../src/agents/treasury/LiquidityWatcherAgent');
const DataRoomAgent = require('../src/agents/fundraising/DataRoomAgent');
const CapTableAgent = require('../src/agents/fundraising/CapTableAgent');

const ModelGateway = require('../src/cognition/ModelGateway');
const EventBus = require('../src/core/EventBus');

const ctx = (extra = {}) => ({
  tenantId: 'bezhas', department: 'x',
  model: new ModelGateway({ providers: {} }),
  bus: new EventBus('bezhas'),
  tools: {},
  ...extra,
});

// ══ 1. Slashing: gravedad por % real, no por "hubo evento" ═══════════════

test('un validador con 0.005% de slashing es ruido menor, no crítico', () => {
  const r = slashing.evaluate({ id: 'v1', stakedAmount: 1_000_000, slashedAmount: 50 });
  assert.equal(r.level, 'menor');
});

test('un 5%+ de slashing es crítico (typico de double-signing)', () => {
  const r = slashing.evaluate({ id: 'v2', stakedAmount: 1_000_000, slashedAmount: 60_000 });
  assert.equal(r.level, 'critico');
});

test('sin dato de slashedAmount, no se opina', () => {
  const r = slashing.evaluate({ id: 'v3', stakedAmount: 1_000_000 });
  assert.equal(r.level, null);
  assert.match(r.reason, /no se opina/);
});

test('SlashingWatcherAgent sin validadores lo dice explícitamente', async () => {
  const out = await new SlashingWatcherAgent(ctx()).run({ payload: {} });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /no expone slashing por validador/);
});

test('SlashingWatcherAgent avisa solo de lo crítico', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('blockchain:slashing_critical', (e) => avisos.push(e));
  const out = await new SlashingWatcherAgent(ctx({ bus })).run({
    payload: { validators: [
      { id: 'sano', stakedAmount: 1_000_000, slashedAmount: 0 },
      { id: 'grave', stakedAmount: 1_000_000, slashedAmount: 80_000, jailed: true },
    ] },
  });
  assert.equal(out.critical, 1);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].validatorId, 'grave');
});

// ══ 2. Gas: umbral del tenant, nunca inventado ════════════════════════════

test('sin thresholdGwei, no se recomienda nada', () => {
  const r = gasOptimizer.evaluate(50, null);
  assert.equal(r.recommendation, null);
  assert.match(r.reason, /no se recomienda/);
});

test('gas por debajo del umbral → ejecutar ahora; por encima → esperar', () => {
  assert.equal(gasOptimizer.evaluate(30, 50).recommendation, 'execute_now');
  assert.equal(gasOptimizer.evaluate(80, 50).recommendation, 'wait');
});

test('GasOptimizerAgent sin threshold configurado se niega (decisión de negocio)', async () => {
  const out = await new GasOptimizerAgent(ctx()).run({ payload: { currentGwei: 40 } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /decisión de negocio/);
});

test('GasOptimizerAgent con bezhas-core simulado no recomienda sobre datos falsos', async () => {
  const core = { name: 'bezhas-core', execute: async () => ({ gasPriceGwei: 0, simulated: true }) };
  const out = await new GasOptimizerAgent(ctx({ tools: { 'bezhas-core': core } })).run({ payload: { thresholdGwei: 50 } });
  assert.equal(out.status, 'blocked');
  assert.match(out.reason, /simulado/);
});

// ══ 3. DPIA: 2+ criterios = obligatoria, y SIEMPRE requiere DPO ═══════════

test('ningún criterio → no obligatoria, pero sigue requiriendo revisión del DPO', () => {
  const r = dpia.evaluate({});
  assert.equal(r.verdict, 'not_required');
  assert.equal(r.requiresDPOReview, true);
});

test('un solo criterio → recomendable, no obligatoria', () => {
  const r = dpia.evaluate({ largeScale: true });
  assert.equal(r.verdict, 'recommended');
});

test('dos o más criterios → obligatoria', () => {
  const r = dpia.evaluate({ largeScale: true, sensitiveData: true });
  assert.equal(r.verdict, 'mandatory');
  assert.deepEqual(r.matched.sort(), ['largeScale', 'sensitiveData']);
});

test('DPIAAgent sin criterios evaluados no opina', async () => {
  const out = await new DPIAAgent(ctx()).run({ payload: { subapp: 'PureScan' } });
  assert.equal(out.status, 'blocked');
});

test('DPIAAgent con veredicto obligatorio nunca dice que el documento está aprobado', async () => {
  const model = { complete: async () => ({ text: 'Borrador de secciones descriptivas.' }) };
  const out = await new DPIAAgent(ctx({ model })).run({
    payload: { subapp: 'CargoLink', flags: { largeScale: true, innovativeTech: true } },
  });
  assert.equal(out.verdict, 'mandatory');
  assert.equal(out.requiresDPOReview, true);
  assert.ok(out.draft);
});

// ══ 4. Vesting: fórmula real de cliff + lineal ════════════════════════════

test('antes del cliff, nada está liberado', () => {
  const r = vesting.evaluate({ totalTokens: 120_000, startDate: '2025-01-01', cliffMonths: 12, vestingMonths: 48 }, '2025-06-01');
  assert.equal(r.vested, 0);
  assert.equal(r.cliffPassed, false);
});

test('al terminar el vesting, el 100% está liberado', () => {
  const r = vesting.evaluate({ totalTokens: 120_000, startDate: '2025-01-01', cliffMonths: 12, vestingMonths: 48 }, '2030-01-01');
  assert.equal(r.vested, 120_000);
  assert.equal(r.nextUnlockDate, null);
});

test('sin datos de vesting suficientes, no calcula nada', () => {
  const r = vesting.evaluate({ totalTokens: 100 });
  assert.equal(r.vested, null);
});

test('VestingMonitorAgent avisa de desbloqueos dentro del horizonte configurado', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('treasury:vesting_unlock_upcoming', (e) => avisos.push(e));
  const now = new Date('2026-01-15').getTime();
  const out = await new VestingMonitorAgent(ctx({ bus })).run({
    payload: {
      now, horizonDays: 30,
      grants: [{ holder: 'Founder A', totalTokens: 120_000, startDate: '2025-01-01', cliffMonths: 12, vestingMonths: 48 }],
    },
  });
  assert.equal(out.status, 'ok');
  assert.equal(avisos.length, 1, 'el cliff cae dentro de los 30 días desde el 15 de enero de 2026');
});

// ══ 5. Liquidez: x·y=k real, umbrales del tenant ══════════════════════════

test('priceImpact respeta la fórmula constant-product', () => {
  const r = liquidity.priceImpact(500_000, 250_000, 10_000);
  assert.equal(r.amountOut, 4901.960784);
  assert.ok(Math.abs(r.priceImpactPct - 0.019608) < 1e-5);
});

test('sin políticas configuradas, no se opina si el pool está sano', () => {
  const r = liquidity.evaluatePool({ reserveBez: 500_000, reserveUsdc: 250_000 }, {});
  assert.equal(r.healthy, null);
});

test('por debajo de la liquidez mínima, no está sano y explica por qué', () => {
  const r = liquidity.evaluatePool({ reserveBez: 500_000, reserveUsdc: 250_000 }, { minLiquidityUsd: 2_000_000 });
  assert.equal(r.healthy, false);
  assert.match(r.reasons[0], /por debajo del mínimo/);
});

test('LiquidityWatcherAgent sin reservas del pool lo bloquea', async () => {
  const out = await new LiquidityWatcherAgent(ctx()).run({ payload: {} });
  assert.equal(out.status, 'blocked');
});

test('LiquidityWatcherAgent avisa cuando el pool no cumple la política', async () => {
  const avisos = [];
  const bus = new EventBus('bezhas');
  bus.on('treasury:liquidity_unhealthy', (e) => avisos.push(e));
  const out = await new LiquidityWatcherAgent(ctx({ bus })).run({
    payload: { pool: { reserveBez: 500_000, reserveUsdc: 250_000 }, minLiquidityUsd: 2_000_000 },
  });
  assert.equal(out.status, 'ok');
  assert.equal(avisos.length, 1);
});

// ══ 6. Data room: checklist fijo, no inventado ════════════════════════════

test('sin ningún documento presente, faltan todas las categorías', async () => {
  const out = await new DataRoomAgent(ctx()).run({ payload: { present: [] } });
  assert.equal(out.complete, false);
  assert.ok(Object.keys(out.missing).length === Object.keys(DataRoomAgent.CHECKLIST).length);
});

test('con todo presente, el data room está completo', async () => {
  const todos = Object.values(DataRoomAgent.CHECKLIST).flat();
  const out = await new DataRoomAgent(ctx()).run({ payload: { present: todos } });
  assert.equal(out.complete, true);
  assert.equal(out.draft, null, 'nada que redactar si no falta nada');
});

test('data room parcial redacta la petición solo de lo que falta', async () => {
  const prompts = [];
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'Correo.' }; } };
  const presentes = DataRoomAgent.CHECKLIST.corporate;   // solo esta categoría completa
  const out = await new DataRoomAgent(ctx({ model })).run({ payload: { present: presentes } });
  assert.equal(out.complete, false);
  assert.ok(!('corporate' in out.missing));
  assert.ok('captable' in out.missing);
  assert.match(prompts[0], /captable/);
});

// ══ 7. Cap table: dilución exacta, no estimada ════════════════════════════

test('simulateRound reparte el post-money exacto entre existentes y nuevo inversor', () => {
  const out = capTable.simulateRound(
    [{ holder: 'A', shares: 6_000_000 }, { holder: 'B', shares: 4_000_000 }],
    { preMoneyValuation: 10_000_000, raiseAmount: 2_500_000, newInvestorName: 'VC' },
  );
  assert.equal(out.newInvestorPct, 0.2);
  const suma = out.holders.reduce((a, h) => a + h.pctAfter, 0);
  assert.ok(Math.abs(suma - 1) < 1e-9);
});

test('simulateRound rechaza una cap table vacía o valores inválidos', () => {
  assert.throws(() => capTable.simulateRound([], { preMoneyValuation: 1, raiseAmount: 1 }));
  assert.throws(() => capTable.simulateRound([{ holder: 'A', shares: 100 }], { preMoneyValuation: 0, raiseAmount: 1 }));
});

test('CapTableAgent copia los porcentajes calculados al prompt sin recalcularlos', async () => {
  const prompts = [];
  const model = { complete: async ({ messages }) => { prompts.push(messages[0].content); return { text: 'Resumen.' }; } };
  const out = await new CapTableAgent(ctx({ model })).run({
    payload: {
      capTable: [{ holder: 'Founder', shares: 10_000_000 }],
      preMoneyValuation: 20_000_000, raiseAmount: 5_000_000, newInvestorName: 'Fund X',
    },
  });
  assert.equal(out.status, 'ok');
  assert.equal(out.simulation.newInvestorPct, 0.2);
  assert.match(prompts[0], /20\.00%/);
});

test('CapTableAgent bloquea con datos inválidos en vez de dejar que el error suba sin control', async () => {
  const out = await new CapTableAgent(ctx()).run({ payload: { capTable: [], preMoneyValuation: 1, raiseAmount: 1 } });
  assert.equal(out.status, 'blocked');
});
