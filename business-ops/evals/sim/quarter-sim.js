'use strict';

/**
 * Simulación de un trimestre (13 semanas / 91 días) de OPERANT con:
 *  - 4 navieras, 3 empresas de logística terrestre y 1 de cadena de frío,
 *  - un desk DeFi (BEZ, stablecoins, supply/yield, farm/LP con APY),
 *  - 4 bancos: Dubái (AED), Miami (USD), Róterdam (EUR), Algeciras (EUR).
 *
 * NO usa datos de clientes reales ni mueve dinero: genera un mundo sintético
 * (semilla fija → reproducible) con parámetros calibrados en cifras públicas
 * (ver docs/TEST-TRIMESTRE-LOGISTICA-DEFI.md) y lo pasa por los módulos REALES
 * de OPERANT: PolicyEngine (líneas rojas), screening (KYC/AML), runwayMath y
 * AuditLog (cadena de hash). Mide cuánta carga humana genera, qué se le escapa
 * y qué detecta a tiempo.
 *
 * Uso:  node evals/sim/quarter-sim.js [semilla]   → JSON en stdout
 */
const PolicyEngine = require('../../src/guardrails/PolicyEngine');
const AuditLog = require('../../src/guardrails/AuditLog');
const { screen } = require('../../src/compliance/screening');
const { calcRunway, isCritical } = require('../../src/agents/treasury/runwayMath');

const SEED = Number(process.argv[2]) || 2026;
const DAYS = 91;

// ── PRNG determinista (mulberry32) ────────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const between = (lo, hi) => lo + rand() * (hi - lo);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ── Parámetros (públicos o supuestos, marcados) ───────────────────────────────
const P = {
  // Públicos: tamaño relativo de los puertos (TEU/año) → peso de las rutas.
  portsTeu: { Rotterdam: 14.2e6, Algeciras: 4.74e6, Miami: 1.115e6, 'Jebel Ali': 15.55e6 },
  // Supuesto: contenedores reefer/semana de la empresa de frío y tasa de excursión por contenedor.
  reeferPerWeek: 60, excursionRate: 0.008, alarmToClaim: 0.30,
  // Público (rango observado en Aave v3 USDC/USDT 2026: ~2%–5%, con saltos fuertes).
  stableApy: { start: 0.045, floor: 0.02, ceil: 0.09 },
  // Supuesto: farm BEZ/USDC con APY alto que decae y riesgo de impermanent loss.
  farmApyStart: 0.60,
  // Supuesto operativo: un aprobador humano resuelve ~40 aprobaciones/día.
  humanCapacityPerDay: 40,
  bankBalanceUsd: { Dubai: 1.2e6, Miami: 1.8e6, Rotterdam: 2.2e6, Algeciras: 1.5e6 },
  monthlyBurnUsd: 420000,
};

const COUNTERPARTIES = [
  ...['Naviera Atlántico', 'Naviera Levante', 'Gulf Lines', 'Caribbean Lines'].map((n, i) => ({ name: n, type: 'naviera', country: ['España', 'Países Bajos', 'Emiratos Árabes Unidos', 'Estados Unidos'][i] })),
  ...['Trans Ibérica', 'EuroRuta', 'Dutch Haul'].map((n, i) => ({ name: n, type: 'terrestre', country: ['España', 'España', 'Países Bajos'][i] })),
  { name: 'FríoMar Logística', type: 'frio', country: 'España' },
  // Contrapartes de riesgo para el cribado (supuestas): comprobar qué detecta y qué no.
  { name: 'Trader A', type: 'trader', country: 'Irán' },
  { name: 'Trader B', type: 'trader', country: 'Rusia' },
  { name: 'Trader C', type: 'trader', country: 'Bielorrusia' },
  { name: 'Trader D', type: 'trader', country: 'Myanmar' },
  { name: 'Trader E', type: 'trader', country: 'Venezuela' },
];
const BANKS = [
  { id: 'Dubai', ccy: 'AED' }, { id: 'Miami', ccy: 'USD' },
  { id: 'Rotterdam', ccy: 'EUR' }, { id: 'Algeciras', ccy: 'EUR' },
];

async function main() {
  console.log = () => {}; // AuditLog imprime cada registro; el informe va por stdout al final
  const audit = new AuditLog({ tenantId: 'sim-q1' });
  const policy = new PolicyEngine({ tenantId: 'sim-q1', audit });

  const m = {
    actions: 0, byVerdict: { allowed: 0, requires_approval: 0, blocked: 0 },
    byCategory: {}, approvalsPerDay: new Array(DAYS).fill(0),
    aml: { screened: 0, low: 0, medium: 0, high: 0, byCountry: {} },
    treasury: { weekly: [], criticalWeeks: 0 },
    defi: { depegDetectedDay: null, depegStartDay: null, alerts: [], apyPath: [] },
    cold: { containers: 0, excursions: 0, claimsOpened: 0 },
    payments: { count: 0, volumeUsd: 0, byRail: { SEPA: 0, SWIFT: 0, BEZ: 0 } },
  };

  const act = (day, category, action, label) => {
    const v = policy.evaluate({ agentId: label, action: { category, ...action } });
    m.actions++;
    m.byCategory[category] = (m.byCategory[category] || 0) + 1;
    if (v.requiresApproval) { m.byVerdict.requires_approval++; m.approvalsPerDay[day]++; }
    else if (v.allowed) m.byVerdict.allowed++;
    else m.byVerdict.blocked++;
    return v;
  };

  let balance = Object.values(P.bankBalanceUsd).reduce((a, b) => a + b, 0);
  let stableApy = P.stableApy.start;
  let farmApy = P.farmApyStart;
  let usdcPeg = 1.0;
  const depegDay = 62, depegRecoverDay = 66, apyCrashDay = 41;
  let weekIn = 0, weekOut = 0;

  for (let day = 0; day < DAYS; day++) {
    const weekday = day % 7 < 5;

    // ── Escenarios de estrés programados ──
    if (day === apyCrashDay) stableApy = Math.max(P.stableApy.floor, stableApy * 0.4); // caída brusca del APY
    if (day === depegDay) { usdcPeg = 0.96; m.defi.depegStartDay = day; }
    if (day === depegRecoverDay) usdcPeg = 0.999;
    stableApy = Math.min(P.stableApy.ceil, Math.max(P.stableApy.floor, stableApy + between(-0.002, 0.0025)));
    farmApy = Math.max(0.08, farmApy * (1 - between(0.001, 0.012)));
    m.defi.apyPath.push({ day, stable: +stableApy.toFixed(4), farm: +farmApy.toFixed(4) });

    // ── Vigilancia DeFi diaria (equivalente al LiquidityWatcher): depeg > 1% ──
    if (Math.abs(1 - usdcPeg) > 0.01 && m.defi.depegDetectedDay === null) {
      m.defi.depegDetectedDay = day;
      m.defi.alerts.push({ day, type: 'depeg', peg: usdcPeg });
      // El agente propone retirar la posición: mover tesorería exige humano.
      act(day, 'treasury_movement', { method: 'withdraw', tool: 'blockchain' }, 'treasury.liquidity');
    }
    if (day === apyCrashDay) m.defi.alerts.push({ day, type: 'apy_crash', apy: +stableApy.toFixed(4) });

    if (weekday) {
      // ── Facturas y pagos de navieras/terrestres/frío ──
      const nInv = 6 + Math.floor(rand() * 6);
      for (let i = 0; i < nInv; i++) {
        const cp = pick(COUNTERPARTIES.slice(0, 8));
        const amount = cp.type === 'naviera' ? between(40e3, 260e3) : cp.type === 'frio' ? between(15e3, 70e3) : between(4e3, 38e3);
        const bank = pick(BANKS);
        const eurZone = bank.ccy === 'EUR' && ['España', 'Países Bajos'].includes(cp.country);
        const viaBez = rand() < 0.22;
        const rail = viaBez ? 'BEZ' : (eurZone ? 'SEPA' : 'SWIFT');
        m.payments.count++; m.payments.volumeUsd += amount; m.payments.byRail[rail]++;
        const incoming = rand() < 0.55;
        if (incoming) weekIn += amount; else weekOut += amount;

        // KYC/AML de la contraparte en cada pago
        const s = screen({ amountUsd: amount, country: cp.country, walletAddress: viaBez ? '0xabc' : 'iban', customerEmail: 'ops@x.com', segment: 'b2b' });
        m.aml.screened++; m.aml[{ bajo: 'low', medio: 'medium', alto: 'high' }[s.riskLevel]]++;

        // Mover dinero: siempre humano. Cripto: línea roja propia.
        act(day, viaBez ? 'crypto_transfer' : 'payment', viaBez ? { tool: 'blockchain', method: 'transfer' } : { amount }, 'finance.payments');
      }

      // ── Cribado de traders de riesgo (una vez por semana cada uno) ──
      if (day % 7 === 0) {
        for (const t of COUNTERPARTIES.filter((c) => c.type === 'trader')) {
          const s = screen({ amountUsd: between(20e3, 90e3), country: t.country, walletAddress: '0xabc', customerEmail: 'ops@x.com', segment: 'b2b' });
          m.aml.byCountry[t.country] = s.riskLevel;
        }
      }

      // ── Cadena de frío ──
      if (day % 7 === 0) {
        for (let c = 0; c < P.reeferPerWeek; c++) {
          m.cold.containers++;
          if (rand() < P.excursionRate) {
            m.cold.excursions++;
            if (rand() < P.alarmToClaim) m.cold.claimsOpened++;
            act(day, 'crm', { method: 'upsertLead' }, 'ops.coldchain'); // aviso al cliente: acción normal
          }
        }
      }

      // ── Trabajo rutinario de los demás departamentos ──
      const routine = 14 + Math.floor(rand() * 10);
      for (let i = 0; i < routine; i++) {
        const r = rand();
        if (r < 0.50) act(day, 'crm', { method: 'listLeads' }, 'sales.crm');
        else if (r < 0.75) act(day, 'outbound', { cold: false, recipientCount: 1, tool: 'email', method: 'send' }, 'support.reply');
        else if (r < 0.90) act(day, 'outbound', { cold: true, recipientCount: 1, tool: 'email', method: 'send' }, 'sales.outreach');
        else act(day, 'signature', { tool: 'esign', method: 'sign' }, 'legal.contracts');
      }
      // ── Staking / farm: reequilibrios semanales ──
      if (day % 7 === 2) act(day, 'crypto_transfer', { tool: 'blockchain', method: 'stake' }, 'treasury.staking');
      if (day % 14 === 4) act(day, 'treasury_movement', { method: 'rebalance_farm' }, 'treasury.farm');
    }

    // ── Cierre semanal de tesorería ──
    if (day % 7 === 6) {
      const defiYield = (balance * 0.25) * (stableApy / 52);
      balance = balance + weekIn - weekOut - P.monthlyBurnUsd / 4.345 + defiYield;
      weekIn = 0; weekOut = 0;
      const runway = calcRunway(balance, P.monthlyBurnUsd);
      const crit = isCritical(runway, false);
      if (crit) m.treasury.criticalWeeks++;
      m.treasury.weekly.push({ week: Math.floor(day / 7) + 1, balanceUsd: Math.round(balance), runwayMonths: runway, critical: crit });
    }
  }

  // ── Integridad de la auditoría y prueba de manipulación ──
  const records = audit.query({});
  const intact = await audit.verifyChain(records);
  const tampered = records.map((r) => ({ ...r }));
  const mid = Math.floor(tampered.length / 2);
  tampered[mid] = { ...tampered[mid], decision: 'allowed', reason: 'ok' };
  const tamperCheck = await audit.verifyChain(tampered);

  const approvalsMax = Math.max(...m.approvalsPerDay);
  const overCapacityDays = m.approvalsPerDay.filter((n) => n > P.humanCapacityPerDay).length;

  const out = {
    seed: SEED, days: DAYS,
    actions: m.actions, verdicts: m.byVerdict,
    humanLoad: {
      approvalsTotal: m.byVerdict.requires_approval,
      pctOfActions: +(100 * m.byVerdict.requires_approval / m.actions).toFixed(1),
      peakPerDay: approvalsMax, avgPerWorkday: +(m.byVerdict.requires_approval / 65).toFixed(1),
      capacityPerDay: P.humanCapacityPerDay, daysOverCapacity: overCapacityDays,
    },
    byCategory: m.byCategory,
    payments: { ...m.payments, volumeUsd: Math.round(m.payments.volumeUsd) },
    aml: m.aml,
    treasury: { start: Object.values(P.bankBalanceUsd).reduce((a, b) => a + b, 0), end: Math.round(balance), criticalWeeks: m.treasury.criticalWeeks, weekly: m.treasury.weekly },
    defi: { alerts: m.defi.alerts, depegStartDay: m.defi.depegStartDay, depegDetectedDay: m.defi.depegDetectedDay, apyFirst: m.defi.apyPath[0], apyLast: m.defi.apyPath[DAYS - 1] },
    cold: m.cold,
    audit: { records: records.length, intact: intact.ok, tamperDetected: !tamperCheck.ok, tamperAt: tamperCheck.brokenAt?.index ?? null },
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
