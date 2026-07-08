// Simulador de tráfico de red para el Brain Console (demo/dev).
// Empuja eventos realistas a /telemetry/usage igual que lo harían la API :3001,
// el gateway y los agentes en producción.
// Uso: node scripts/simulateUsage.mjs [rondas=12] [--base http://localhost:4007]
const baseArg = process.argv.indexOf('--base');
const BASE = baseArg > -1 ? process.argv[baseArg + 1] : 'http://localhost:4007';
const ROUNDS = Number(process.argv[2]) || 12;

// [source, target, fn, peso, tokensMedio, bezMedio]
const PATTERNS = [
  ['trading-agent',   'Obsidian-Brain',  'obsidian:search_vault',        9, 420, 0],
  ['trading-agent',   'API-Backend',     'GET /market/price',            8, 0,   0],
  ['director-agent',  'Obsidian-Brain',  'obsidian:get_recent_notes',    6, 380, 0],
  ['director-agent',  'Obsidian-Brain',  'obsidian:record_episode',      3, 510, 0],
  ['finance-agent',   'API-Backend',     'POST /payments/buy',           7, 0,   1.2],
  ['Bezhas-Hub',      'API-Backend',     'POST /gateway/subscription',   5, 0,   4.0],
  ['BeZhas-Pay',      'Smart-Contracts', 'BEZ.transfer (Polygon V1)',    6, 0,   9.5],
  ['BEZ-Wallet',      'BEZCoinV2-L2',    'paymaster.sponsorGas',         5, 0,   0.03],
  ['API-Backend',     'BEZCoinV2-L2',    'l2.sendRawTransaction',        7, 0,   0.05],
  ['BZ-Energy',       'Smart-Contracts', 'EnergyOracle.pushReading',     4, 0,   0.4],
  ['BZ-CargoLink',    'Bezhas-Hub',      'bezhas_id.resolve',            5, 0,   0],
  ['legal-agent',     'Obsidian-Brain',  'obsidian:semantic_search',     3, 640, 0],
  ['cliente-erp-01',  'Edge-Node',       'POST /webhook/erp',            4, 0,   0.8],
  ['Edge-Node',       'BEZCoinV2-L2',    'l2.signAndRelay',              4, 0,   0.02],
];

function pick() {
  const total = PATTERNS.reduce((acc, p) => acc + p[3], 0);
  let roll = Math.random() * total;
  for (const p of PATTERNS) { roll -= p[3]; if (roll <= 0) return p; }
  return PATTERNS[0];
}

let sent = 0;
for (let round = 0; round < ROUNDS; round += 1) {
  const events = Array.from({ length: 5 + Math.floor(Math.random() * 10) }, () => {
    const [source, target, fn, , tokens, bez] = pick();
    return {
      source, target, fn,
      tokens: tokens ? Math.round(tokens * (0.6 + Math.random() * 0.8)) : 0,
      bez: bez ? Number((bez * (0.5 + Math.random())).toFixed(4)) : 0,
    };
  });
  const res = await fetch(`${BASE}/telemetry/usage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events }),
  }).then((r) => r.json());
  sent += res.recorded || 0;
  process.stdout.write(`\r[SimUsage] ronda ${round + 1}/${ROUNDS} — ${sent} eventos`);
  await new Promise((r) => setTimeout(r, 400));
}
const summary = await fetch(`${BASE}/telemetry/summary`).then((r) => r.json());
console.log(`\n[SimUsage] totales: ${summary.totals.calls} llamadas · ${summary.totals.tokens} tokens · ${summary.totals.bez.toFixed(2)} BEZ`);
console.log(`[SimUsage] top función: ${summary.topFunctions[0]?.fn} (${summary.topFunctions[0]?.calls})`);
