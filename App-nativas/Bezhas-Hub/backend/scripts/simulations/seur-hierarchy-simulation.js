/**
 * seur-hierarchy-simulation.js
 * ============================================================================
 * Simulación de rentabilidad y comisiones de la jerarquía BeZhas aplicada a la
 * flota de SEUR (año 2025), usando la CONFIGURACIÓN REAL de planes del Hub
 * (config/plans.js → getHierarchyConfig) y la misma matemática de cascada que
 * services/commissionEngine.service.js (CASCADE_DECAY = 0.5).
 *
 * Ejecutar:  node scripts/simulations/seur-hierarchy-simulation.js
 *
 * ⚠️  IMPORTANTE SOBRE LAS CIFRAS DE SEUR:
 *   Son ESTIMACIONES PÚBLICAS APROXIMADAS de dominio general (SEUR no publica
 *   cuentas 2025 auditadas con este detalle). Están todas como parámetros
 *   editables abajo → sustituye por las cifras exactas cuando las tengas.
 *
 * ⚠️  IMPORTANTE SOBRE LA "COMISIÓN":
 *   BeZhas NO se queda el 20% del valor de los envíos. El % de la jerarquía se
 *   aplica sobre las COMISIONES / FEES DE RED que BeZhas genera al liquidar las
 *   transacciones de los subordinados ("20% de las comisiones de tus
 *   sub-empresas"). Por eso el `txAmount` que alimenta el ledger de comisiones
 *   es el FEE de liquidación, no el valor bruto del flete. El fee de red es un
 *   parámetro (settlementFeeBps) con análisis de sensibilidad incluido.
 * ============================================================================
 */

const { getHierarchyConfig, getPlan, calculateSubscription, ADMIN_SAVINGS_PCT } = require('../../config/plans');

// Debe coincidir con commissionEngine.service.js
const CASCADE_DECAY = 0.5;

// ─────────────────────────────────────────────────────────────────────────────
// PARÁMETROS EDITABLES — Flota SEUR 2025 (estimaciones públicas aproximadas)
// ─────────────────────────────────────────────────────────────────────────────
const SEUR = {
  grossRevenueEUR: 800_000_000,   // Facturación anual aprox. SEUR España (~€700–900M)
  parcelsPerYear:  110_000_000,   // Paquetes/año aprox.
  franchises:      85,            // Nº de franquicias (SEUR opera red de franquicias)
  vehicles:        5_000,         // Vehículos de flota aprox.
};

// Palancas del modelo económico (ajustables)
const MODEL = {
  // % del volumen de SEUR que se liquida a través de BeZhas (adopción)
  adoptionScenarios: [0.30, 0.60, 1.00],
  // Fee de red que BeZhas cobra sobre el volumen liquidado (base de la comisión)
  settlementFeeBpsScenarios: [50, 100, 250], // 0.5% / 1% / 2.5%
  // Escenario "principal" para el desglose detallado
  primaryAdoption: 1.00,
  primarySettlementFeeBps: 100, // 1%
};

// ─────────────────────────────────────────────────────────────────────────────
// AHORRO OPERATIVO — cada palanca mapea a una función REAL del ecosistema BeZhas.
// Todas las tasas son parámetros editables (modelo, no cuentas auditadas) y
// escalan con la adopción (solo aplican al volumen digitalizado vía BeZhas).
// ─────────────────────────────────────────────────────────────────────────────
const OPS = {
  // 1) Conciliación & auditoría automatizada (liquidación on-chain + trazabilidad
  //    inmutable). Tasa de ahorro = ADMIN_SAVINGS_PCT de config/plans.js (85%).
  reconciliation: { basePctRevenue: 0.010, savingRate: ADMIN_SAVINGS_PCT / 100 },
  // 2) Resolución de litigios/disputas (oráculo de disputas CargoLink + Smart
  //    Escrow → Smart Settlement automático, sin back-office ni chargebacks).
  disputes: { rateOfParcels: 0.004, costPerDispute: 18, savingRate: 0.70 },
  // 3) Liquidación en tiempo real → liberación de capital circulante (menos DSO,
  //    menos coste financiero del circulante). Solo cartera B2B.
  workingCapital: { b2bShare: 0.60, dsoDaysReduced: 30, financingRate: 0.05 },
  // 4) Tokenización de activos (RWA / ERC-3643): factoring de cuentas por cobrar
  //    on-chain → mejor spread de financiación sobre la parte financiada.
  tokenization: { receivableDays: 45, financedShare: 0.40, spreadReduction: 0.025 },
  // 5) Gas subvencionado 100% (Enterprise VIP, Paymaster ERC-4337): coste de gas
  //    de las transacciones liquidadas que SEUR ya no paga.
  gas: { costPerTx: 0.005 },
};

const eur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const eur2 = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
const pct = (n) => `${(n * 100).toFixed(2)}%`;

// ─────────────────────────────────────────────────────────────────────────────
// Núcleo: dado un fee-pool de red, reparte la comisión según la topología
// jerárquica usando EXACTAMENTE la lógica del motor (rate del enlace directo,
// decaimiento ×0.5 por nivel, tope por cascadeDepth del plan de cada ancestro).
// ─────────────────────────────────────────────────────────────────────────────
function cascadeSplit({ feePool, directParentPlan, ancestors }) {
  // baseRateBps = rate capturado del plan del PADRE DIRECTO (como en linkSubordinate)
  const baseRateBps = getHierarchyConfig(directParentPlan).commissionRateBps;
  const out = [];
  ancestors.forEach((anc, idx) => {
    const level = idx + 1; // 1 = padre directo
    const cfg = getHierarchyConfig(anc.plan);
    if (!cfg || level > cfg.cascadeDepth) return; // su plan no alcanza este nivel → no cobra
    const rateBps = Math.round(baseRateBps * Math.pow(CASCADE_DECAY, level - 1));
    const amount = (feePool * rateBps) / 10_000;
    out.push({ name: anc.name, plan: anc.plan, level, rateBps, amount });
  });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ahorro operativo por función, escalado por adopción.
// ─────────────────────────────────────────────────────────────────────────────
function operationalSavings(adoption) {
  const rev = SEUR.grossRevenueEUR * adoption;
  const parcels = SEUR.parcelsPerYear * adoption;

  const reconciliation = rev * OPS.reconciliation.basePctRevenue * OPS.reconciliation.savingRate;
  const disputes = parcels * OPS.disputes.rateOfParcels * OPS.disputes.costPerDispute * OPS.disputes.savingRate;
  const workingCapital =
    rev * OPS.workingCapital.b2bShare * (OPS.workingCapital.dsoDaysReduced / 365) * OPS.workingCapital.financingRate;
  const tokenization =
    rev * (OPS.tokenization.receivableDays / 365) * OPS.tokenization.financedShare * OPS.tokenization.spreadReduction;
  const gas = parcels * OPS.gas.costPerTx;

  const items = [
    { key: 'reconciliation', label: 'Conciliación & auditoría automatizada', amount: reconciliation, fn: 'Liquidación on-chain + trazabilidad inmutable (85% ahorro)' },
    { key: 'disputes', label: 'Resolución de litigios / disputas', amount: disputes, fn: 'Oráculo de disputas + Smart Escrow → settlement automático' },
    { key: 'workingCapital', label: 'Liberación de capital circulante', amount: workingCapital, fn: 'Liquidación en tiempo real → menos DSO y coste financiero' },
    { key: 'tokenization', label: 'Tokenización de activos (RWA / ERC-3643)', amount: tokenization, fn: 'Factoring on-chain de cuentas por cobrar → mejor spread' },
    { key: 'gas', label: 'Gas subvencionado 100% (Enterprise)', amount: gas, fn: 'Paymaster ERC-4337: SEUR no paga el gas de sus transacciones' },
  ];
  const total = items.reduce((s, i) => s + i.amount, 0);
  return { items, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULACIÓN
// ─────────────────────────────────────────────────────────────────────────────
function run() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║   SIMULACIÓN — Jerarquía BeZhas aplicada a la flota de SEUR (2025)     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  console.log('▸ ENTRADAS (estimaciones públicas aprox. — editables en el script):');
  console.log(`   Facturación bruta anual .......... ${eur(SEUR.grossRevenueEUR)}`);
  console.log(`   Paquetes/año ..................... ${SEUR.parcelsPerYear.toLocaleString('es-ES')}`);
  console.log(`   Franquicias ...................... ${SEUR.franchises}`);
  console.log(`   Vehículos de flota ............... ${SEUR.vehicles.toLocaleString('es-ES')}`);
  console.log(`   Ingreso medio por envío .......... ${eur2(SEUR.grossRevenueEUR / SEUR.parcelsPerYear)}\n`);

  // Aviso de límite real del plan
  const entLimit = getHierarchyConfig('enterprise_vip').maxSubOrgs;
  if (SEUR.franchises > entLimit) {
    console.log(`   ⚠️  RESTRICCIÓN DE PLAN: Enterprise VIP soporta ${entLimit} sub-empresas,`);
    console.log(`       pero SEUR tiene ${SEUR.franchises} franquicias → requeriría un tier custom,`);
    console.log(`       agrupar franquicias por región, o subir el límite en config/plans.js.\n`);
  }

  const A = MODEL.primaryAdoption;
  const feeBps = MODEL.primarySettlementFeeBps;
  const settledVolume = SEUR.grossRevenueEUR * A;
  const feePool = (settledVolume * feeBps) / 10_000;

  console.log('─────────────────────────────────────────────────────────────────────────');
  console.log(`▸ ESCENARIO PRINCIPAL: adopción ${pct(A)} · fee de red ${feeBps / 100}%`);
  console.log('─────────────────────────────────────────────────────────────────────────');
  console.log(`   Volumen liquidado vía BeZhas ..... ${eur(settledVolume)}`);
  console.log(`   Fee-pool de red (base comisión) .. ${eur(feePool)}`);
  console.log(`   Fee de red por paquete ........... ${eur2(feePool / (SEUR.parcelsPerYear * A))}\n`);

  // ── TOPOLOGÍA A: SEUR holding → franquicias → repartidores (cascada 3 niveles)
  console.log('   ┌── TOPOLOGÍA A — Cascada de franquicia ───────────────────────────┐');
  console.log('   │   repartidores → Franquicia (Business) → SEUR (Enterprise VIP)     │');
  console.log('   └───────────────────────────────────────────────────────────────────┘');
  const topoA = cascadeSplit({
    feePool,
    directParentPlan: 'business', // la franquicia es el padre directo del repartidor
    ancestors: [
      { name: 'Franquicias (nivel 1, agregado)', plan: 'business' },
      { name: 'SEUR Holding (nivel 2)', plan: 'enterprise_vip' },
    ],
  });
  let retainedA = 0;
  topoA.forEach((r) => {
    retainedA += r.amount;
    const perFranchise = r.level === 1 ? `  (~${eur(r.amount / SEUR.franchises)}/franquicia)` : '';
    console.log(`     Nivel ${r.level} · ${r.name}`);
    console.log(`        tasa aplicada ${(r.rateBps / 100).toFixed(2)}%  →  ${eur(r.amount)}${perFranchise}`);
  });
  console.log(`     ── Retenido por la jerarquía SEUR: ${eur(retainedA)}  (${pct(retainedA / feePool)} del fee-pool)`);
  console.log(`        BeZhas retiene: ${eur(feePool - retainedA)}\n`);

  // ── TOPOLOGÍA B: SEUR Enterprise como padre directo (franquicias = sedes)
  console.log('   ┌── TOPOLOGÍA B — Holding directo ─────────────────────────────────┐');
  console.log('   │   repartidores → SEUR (Enterprise VIP)   [franquicias = sedes]     │');
  console.log('   └───────────────────────────────────────────────────────────────────┘');
  const topoB = cascadeSplit({
    feePool,
    directParentPlan: 'enterprise_vip',
    ancestors: [{ name: 'SEUR Holding (nivel 1)', plan: 'enterprise_vip' }],
  });
  let retainedB = 0;
  topoB.forEach((r) => {
    retainedB += r.amount;
    console.log(`     Nivel ${r.level} · ${r.name}`);
    console.log(`        tasa aplicada ${(r.rateBps / 100).toFixed(2)}%  →  ${eur(r.amount)}`);
  });
  console.log(`     ── SEUR captura: ${eur(retainedB)}  (${pct(retainedB / feePool)} del fee-pool)\n`);

  // ── Coste de suscripción y neto
  const subEnt = calculateSubscription({ planId: 'enterprise_vip', annual: true, payWithBez: true });
  const subBiz = calculateSubscription({ planId: 'business', annual: true, payWithBez: true });
  const seurAnnualSub = subEnt.total; // SEUR paga Enterprise (anual, en BEZ −20%)
  const franchisesSub = subBiz.total * SEUR.franchises; // cada franquicia paga Business

  console.log('   ┌── COSTE DE SUSCRIPCIÓN (anual, pagando en $BEZ −20%, IVA incl.) ──┐');
  console.log(`     SEUR Enterprise VIP .............. ${eur(seurAnnualSub)}/año`);
  console.log(`     ${SEUR.franchises} franquicias × Business ......... ${eur(franchisesSub)}/año (lo pagan las franquicias)\n`);

  console.log('   ┌── RESULTADO NETO PARA SEUR (holding) ────────────────────────────┐');
  console.log(`     Topología A → comisión ${eur(topoA.find(r=>r.level===2)?.amount||0)} − suscripción ${eur(seurAnnualSub)} = ${eur((topoA.find(r=>r.level===2)?.amount||0) - seurAnnualSub)} neto/año`);
  console.log(`     Topología B → comisión ${eur(retainedB)} − suscripción ${eur(seurAnnualSub)} = ${eur(retainedB - seurAnnualSub)} neto/año\n`);

  // ── SENSIBILIDAD (Topología B — SEUR captura 20% del fee-pool)
  console.log('─────────────────────────────────────────────────────────────────────────');
  console.log('▸ SENSIBILIDAD — Comisión anual que capta SEUR (Topología B, 20% del fee-pool)');
  console.log('─────────────────────────────────────────────────────────────────────────');
  const seurRate = getHierarchyConfig('enterprise_vip').commissionRateBps / 10_000;
  const header = ['Fee de red \\ Adopción', ...MODEL.adoptionScenarios.map((a) => `${(a * 100).toFixed(0)}%`)];
  console.log('   ' + header.map((h) => h.padStart(16)).join(''));
  MODEL.settlementFeeBpsScenarios.forEach((fb) => {
    const row = [`${(fb / 100).toFixed(2).padStart(5)}% fee`];
    MODEL.adoptionScenarios.forEach((a) => {
      const fp = (SEUR.grossRevenueEUR * a * fb) / 10_000;
      const seurCut = fp * seurRate;
      row.push(eur(seurCut));
    });
    console.log('   ' + row.map((c) => String(c).padStart(16)).join(''));
  });

  // ── AHORRO OPERATIVO (escenario principal de adopción)
  const savings = operationalSavings(A);
  console.log('─────────────────────────────────────────────────────────────────────────');
  console.log(`▸ AHORRO OPERATIVO ANUAL — funciones del ecosistema (adopción ${pct(A)})`);
  console.log('─────────────────────────────────────────────────────────────────────────');
  savings.items.forEach((it) => {
    console.log(`   ${it.label.padEnd(42)} ${eur(it.amount).padStart(14)}`);
    console.log(`      └ ${it.fn}`);
  });
  console.log(`   ${'─'.repeat(42)} ${'─'.repeat(14)}`);
  console.log(`   ${'TOTAL ahorro operativo'.padEnd(42)} ${eur(savings.total).padStart(14)}`);
  console.log(`   ${'(equivale al'.padEnd(42)} ${pct(savings.total / SEUR.grossRevenueEUR)} de la facturación)\n`);

  // ── VALOR TOTAL PARA SEUR = comisión (Topología B) + ahorro operativo
  const commissionB = retainedB;
  const grandTotal = commissionB + savings.total;
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  VALOR TOTAL ANUAL PARA SEUR (comisión de red + ahorro operativo)      ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║   Comisión de jerarquía (Topología B) ...... ${eur(commissionB).padStart(16)}         ║`);
  console.log(`║   Ahorro operativo total .................. ${eur(savings.total).padStart(16)}         ║`);
  console.log(`║   ─────────────────────────────────────────────────────               ║`);
  console.log(`║   VALOR TOTAL ............................. ${eur(grandTotal).padStart(16)}         ║`);
  console.log(`║   − Suscripción Enterprise VIP ............ ${eur(seurAnnualSub).padStart(16)}         ║`);
  console.log(`║   = NETO / AÑO ............................ ${eur(grandTotal - seurAnnualSub).padStart(16)}         ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  const roi = (grandTotal - seurAnnualSub) / seurAnnualSub;
  console.log(`   ROI sobre la suscripción: ${Math.round(roi * 100).toLocaleString('es-ES')}%  (por cada 1€ de plan, ${(grandTotal / seurAnnualSub).toFixed(0)}€ de valor)\n`);

  console.log('   Optatividad adicional NO cuantificada arriba (evita sobre-estimar):');
  console.log('   · Desbloqueo puntual de liquidez tokenizando flota/inmuebles (RWA).');
  console.log('   · Staking corporativo $BEZ hasta 31,25% APY sobre tesorería ociosa.');
  console.log('   · Due-diligence inmutable → menor coste en operaciones M&A.\n');

  // Export estructurado para el visual
  return {
    inputs: SEUR,
    primary: { adoption: A, settlementFeeBps: feeBps, settledVolume, feePool },
    topologyA: { splits: topoA, retained: retainedA, bezhasKeeps: feePool - retainedA },
    topologyB: { splits: topoB, retained: retainedB },
    subscription: { seur: seurAnnualSub, franchisesTotal: franchisesSub },
    savings,
    grandTotal, netAnnual: grandTotal - seurAnnualSub, roi,
    sensitivity: MODEL.settlementFeeBpsScenarios.map((fb) => ({
      feeBps: fb,
      byAdoption: MODEL.adoptionScenarios.map((a) => ({
        adoption: a,
        seurCommission: ((SEUR.grossRevenueEUR * a * fb) / 10_000) * seurRate,
      })),
    })),
  };
}

if (require.main === module) {
  const result = run();
  if (process.env.JSON_OUT) console.log('\n__JSON__' + JSON.stringify(result));
}

module.exports = { run, cascadeSplit };
