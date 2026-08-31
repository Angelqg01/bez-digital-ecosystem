'use strict';

/**
 * Micro-benchmark del `KnowledgeBase.search` (ruta por términos, sin embedder).
 *
 * Pregunta que responde: ¿a partir de qué tamaño de KB deja de ser aceptable
 * el escaneo lineal y merece la pena montar un índice invertido?
 *
 * Umbral de decisión (arbitrario pero justificado): p95 < 5 ms por consulta.
 * Por debajo, el escaneo lineal no aporta latencia perceptible frente al modelo
 * (respuesta LLM ≈ 1-5 s). Por encima, empieza a competir con la latencia total
 * y merece optimización.
 *
 * Uso: `node bench/kb-search.bench.js` (sin dependencias, ~2 s en total).
 */
const KnowledgeBase = require('../src/platform/KnowledgeBase');

const VOCAB = [
  'factura', 'pago', 'reembolso', 'suscripcion', 'contrato', 'cancelacion',
  'usuario', 'cuenta', 'contraseña', 'acceso', 'permiso', 'plan', 'precio',
  'error', 'fallo', 'lento', 'caido', 'conexion', 'servidor', 'base', 'datos',
  'blockchain', 'token', 'wallet', 'tesoreria', 'inversor', 'ronda', 'gobierno',
  'kyc', 'aml', 'sancion', 'rgpd', 'privacidad', 'consentimiento', 'cookie',
  'email', 'telefono', 'chat', 'ticket', 'soporte', 'ventas', 'marketing',
  'campaña', 'lead', 'prospecto', 'cierre', 'demo', 'onboarding', 'formacion',
];

function articuloFalso(i) {
  const pick = () => VOCAB[(i * 7919 + Math.floor(Math.random() * VOCAB.length)) % VOCAB.length];
  const title = `${pick()} ${pick()}`;
  const body = Array.from({ length: 40 }, pick).join(' ');
  return { id: `a${i}`, title, body, tags: [pick(), pick()] };
}

function consultaFalsa() {
  const n = 2 + Math.floor(Math.random() * 3);
  return Array.from({ length: n }, () => VOCAB[Math.floor(Math.random() * VOCAB.length)]).join(' ');
}

function p95(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)];
}

async function medir(sizes, queriesPerSize = 200) {
  console.log(`\nKnowledgeBase.search — ruta por términos (${queriesPerSize} consultas por tamaño)\n`);
  console.log('  Artículos │  media (ms) │  p95 (ms) │  p99 (ms) │ Veredicto');
  console.log('  ──────────┼─────────────┼───────────┼───────────┼──────────');

  const filas = [];
  for (const n of sizes) {
    const kb = new KnowledgeBase({ tenantId: 'bench' });
    for (let i = 0; i < n; i++) await kb.ingest(articuloFalso(i));

    // Calentamiento (evita el sesgo del primer JIT).
    for (let i = 0; i < 20; i++) await kb.search(consultaFalsa(), { k: 3 });

    const lats = [];
    for (let i = 0; i < queriesPerSize; i++) {
      const t0 = process.hrtime.bigint();
      await kb.search(consultaFalsa(), { k: 3 });
      lats.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    const media = lats.reduce((a, b) => a + b, 0) / lats.length;
    const p95v = p95(lats);
    const p99v = p95(lats.filter((_, i, arr) => i >= arr.length * 0.99 - 1));

    const veredicto = p95v < 5 ? 'ok' : p95v < 20 ? 'atención' : 'índice invertido';
    filas.push({ n, media, p95v, p99v, veredicto });
    console.log(`  ${String(n).padStart(9)} │  ${media.toFixed(2).padStart(10)} │  ${p95v.toFixed(2).padStart(8)} │  ${p99v.toFixed(2).padStart(8)} │ ${veredicto}`);
  }
  return filas;
}

(async () => {
  const filas = await medir([100, 500, 1_000, 5_000, 10_000, 50_000]);

  const cruce = filas.find((f) => f.p95v >= 5);
  console.log('\nInterpretación');
  console.log('  Umbral de decisión: p95 < 5 ms (por debajo del ruido del LLM).');
  if (!cruce) {
    console.log('  ✅ Con ≤50k artículos el escaneo lineal no cruza el umbral.');
    console.log('  → El índice invertido NO se justifica todavía. Volver a medir si un tenant supera 50k.');
  } else {
    console.log(`  ⚠  Cruce en ~${cruce.n} artículos (p95 = ${cruce.p95v.toFixed(2)} ms).`);
    console.log('  → Índice invertido justificado a partir de ese tamaño.');
  }
})().catch((e) => { console.error(e); process.exit(1); });
