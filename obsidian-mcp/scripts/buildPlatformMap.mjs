// Genera la capa de conocimiento de plataforma en el vault:
//   Capa 0: 03-Maps/BeZhas-Platform-Master.md (hub central)
//   Capa 1: 05-Platform/Cluster-*.md (clusters por tipo de información)
//   Capa 2: 05-Platform/*.md (servicios core) + 06-SubApps/*.md (13+ SubApps)
// Idempotente: solo reescribe notas cuyo contenido cambió. Re-ejecutable por /brain-daily.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vaultRoot = path.resolve(process.env.OBSIDIAN_VAULT_PATH || path.join(here, '..', '..', 'docs', 'obsidian-vault'));

// ── Capa 1: clusters por tipo de información ────────────────────────────────
const CLUSTERS = {
  'nucleo-blockchain': {
    title: 'Cluster Núcleo Blockchain',
    desc: 'Contratos, L2 soberana (OP Stack, chainId 2708), SDK y relays on-chain. Fuente de verdad: smart-contracts/ (Foundry, 78+ contratos, 1206 tests verdes).',
  },
  'ia-conocimiento': {
    title: 'Cluster IA y Conocimiento',
    desc: 'Cerebro y orquestación: Aegis (ML), OpenClaw (multi-LLM), agent-runtime (8 agentes), Brain Obsidian y base de conocimiento SKILL/.',
  },
  'finanzas-pagos': {
    title: 'Cluster Finanzas y Pagos',
    desc: 'Todo el flujo de dinero: gateway BEZ-Pay, wallet AA, on-ramps fiat (MoonPay/Transak), KYC MiCA por volumen, gas tank y capital DeFi. Moneda de liquidación: BEZ V1 Polygon 0xEcBa…11A8.',
  },
  'logistica-rwa': {
    title: 'Cluster Logística y RWA',
    desc: 'Trazabilidad física→on-chain: CargoLink (POS↔BeZhas_ID), simulador logístico 360°, PureScan, Vision Scan y gemelos digitales RWA.',
  },
  'energia-iot': {
    title: 'Cluster Energía e IoT',
    desc: 'VPP: ingesta MQTT de telemetría, EnergyOracle + CAE tokens + BeZhasVPP on-chain, feed OMIE y agente de arbitraje.',
  },
  'identidad-comunidad': {
    title: 'Cluster Identidad y Comunidad',
    desc: 'BeZhas_ID (B-UID único multi-tenant), reputación Prestige, onboarding Genesis y red social Sphere.',
  },
  'infra-devops': {
    title: 'Cluster Infraestructura y DevOps',
    desc: 'Docker (11 servicios), nginx WAF, Prometheus/Grafana/Loki, CI/CD GitHub Actions, Cloud Run (13 SubApps live) y control-center.',
  },
};

// ── Capa 2: servicios de plataforma y SubApps ───────────────────────────────
const ENTRIES = [
  // Plataforma (05-Platform)
  { folder: '05-Platform', title: 'Smart-Contracts', cluster: 'nucleo-blockchain', priority: 'P0', path: 'smart-contracts/', port: null,
    desc: 'Proyecto Foundry: BEZCoinV2, QualityEscrow, Bridge, Governance, Staking, wallet AA (SmartWallet/Paymaster/MultiSig), 16 sectores × 4 contratos, contratos Energy VPP. Build: forge build --sizes · Test: forge test (1206 verdes). Tras compilar SIEMPRE sync-daemon a los ABIs del frontend.',
    links: ['SDK-BeZhas', 'Edge-Node', 'BZ-Energy', 'API-Backend'] },
  { folder: '05-Platform', title: 'BEZCoinV2-L2', cluster: 'nucleo-blockchain', priority: 'P0', path: 'smart-contracts/src/core/ (BEZCoinV2) + L2 soberana OP Stack', port: 8545,
    desc: 'Token nativo de la L2 propia (chainId 2708, OP Stack: geth :8545 + consensus :5052 + batcher). ERC-20 con ERC20Permit para meta-transacciones gasless. ES EL TOKEN QUE ACTIVA LA CONEXIÓN BLOCKCHAIN PROPIA: gas fees, paymaster, validadores y recompensas edge corren sobre él. No confundir con BEZ V1 Polygon (0xEcBa…11A8), que es la moneda de cambio/liquidación externa.',
    links: ['Smart-Contracts', 'Edge-Node', 'BZ-Gas-Tank', 'BEZ-Wallet'] },
  { folder: '05-Platform', title: 'API-Backend', cluster: 'finanzas-pagos', priority: 'P0', path: 'api/', port: 3001,
    desc: 'Express :3001 — 35 rutas (auth, wallet, blockchain, energy, gateway), 19 servicios, PostgreSQL + Redis. Tests de integración con Anvil :8546 (ANVIL_BIN=anvil.exe). Gateway BEZ-Pay: /payments/buy con gates KYC MiCA, refunds, hosted checkout pay.bez.digital.',
    links: ['Smart-Contracts', 'Bezhas-Hub', 'BeZhas-Pay', 'Agent-Runtime'] },
  { folder: '05-Platform', title: 'Agent-Runtime', cluster: 'ia-conocimiento', priority: 'P0', path: 'agent-runtime/ + core/AgentToolRegistry.js', port: null,
    desc: '8 agentes departamentales (trading, marketing, investor, legal, finance, blockchain-dev, devops, director) con permisos por tool, human-in-loop y circuit breaker. Todos consumen el Brain vía obsidian:* — búsqueda, episodios, grafo, fingerprint.',
    links: ['Obsidian-Brain', 'OpenClaw-Orchestrator', 'Aegis-AI', 'API-Backend'] },
  { folder: '05-Platform', title: 'Aegis-AI', cluster: 'ia-conocimiento', priority: 'P0', path: 'aegis/', port: 8001,
    desc: 'FastAPI :8001 — DecisionEngine, AutoHealer, Monitor, 5 modelos ML. Capa 1 de seguridad: rate limiting Redis, roles ADMIN/OPERATOR/VIEWER/BOT, audit log. Privado en Cloud Run (OIDC via gcpServiceAuth.js).',
    links: ['Agent-Runtime', 'OpenClaw-Orchestrator', 'Infraestructura-Docker'] },
  { folder: '05-Platform', title: 'OpenClaw-Orchestrator', cluster: 'ia-conocimiento', priority: 'P0', path: 'core/OpenClawOrchestrator.js + openclaw/', port: null,
    desc: 'Orquestador multi-LLM: clasificación de intención, routing por orchestration-manifest.json, fallback Claude → Gemini 2.0 Flash → GPT-4o → DeepSeek → LLaMA local (Ollama). Gate + router + cache listos para BeZhasAgentManager (30/30 tests).',
    links: ['Agent-Runtime', 'Aegis-AI', 'Obsidian-Brain'] },
  { folder: '05-Platform', title: 'Obsidian-Brain', cluster: 'ia-conocimiento', priority: 'P0', path: 'obsidian-mcp/ + docs/obsidian-vault/', port: 4007,
    desc: 'Este vault. MCP :4007 con índice en memoria, búsqueda léxica ponderada + semántica (Ollama), consolidación de episodios, fingerprint merkle para anclaje on-chain y Brain Console en /ui. ADRs 0001-0003.',
    links: ['Agent-Runtime', 'SKILL-Knowledge-Base', 'Smart-Contracts'] },
  { folder: '05-Platform', title: 'SKILL-Knowledge-Base', cluster: 'ia-conocimiento', priority: 'P1', path: 'SKILL/', port: null,
    desc: 'Base de conocimiento operativa para IA: config (blockchain/infra/seguridad), runbooks (deploy, incidentes, wallet ops), solutions (fixes por categoría), patterns (Solidity/API/testing) y feedback de sesiones.',
    links: ['Obsidian-Brain', 'Agent-Runtime'] },
  { folder: '05-Platform', title: 'SDK-BeZhas', cluster: 'nucleo-blockchain', priority: 'P1', path: 'sdk/ + App\'s secundarias/packages/connect', port: null,
    desc: '@bezhas/sdk v3 (registry multi-chain, módulos por sector, cubre las 13 SubApps) y @bezhas/connect (embed B2B: Pay + CargoLink + Capability Registry + widget <script>, 30 tests).',
    links: ['Smart-Contracts', 'Bezhas-Hub', 'BeZhas-Pay'] },
  { folder: '05-Platform', title: 'Edge-Node', cluster: 'nucleo-blockchain', priority: 'P1', path: 'bezhas-edge-node/ + edge-gateway/', port: 4000,
    desc: 'Relay B2B :4000 — webhook ERP → compliance MCP → firma → contrato L2. Flujo: evento → EventListener → DB → WebSocket al frontend → audit Redis.',
    links: ['Smart-Contracts', 'API-Backend', 'BZ-Edge-Manager'] },
  { folder: '05-Platform', title: 'Control-Center', cluster: 'infra-devops', priority: 'P1', path: 'control-center/frontend/', port: 3000,
    desc: 'Dashboard corporativo Next.js 14 (Web2.5, oculta la complejidad blockchain). Incluye TabObsidian (mapa del Brain vía filesystem) y TabIntelligence. Landing con las 13 tarjetas *.bez.digital.',
    links: ['Obsidian-Brain', 'API-Backend', 'Infraestructura-Docker'] },
  { folder: '05-Platform', title: 'Infraestructura-Docker', cluster: 'infra-devops', priority: 'P1', path: 'docker-compose*.yml + nginx/ + monitoring/ + .github/workflows/', port: null,
    desc: '11 servicios base (postgres, redis, geth L2, consensus, batcher, api, aegis, ai-gateway, edge, control-center, obsidian-mcp). Nginx TLS/WAF, Prometheus+Grafana+Loki, CI 6 jobs. Cloud Run: 13 SubApps live; NO ejecutar gcp-deploy.sh (rota password Cloud SQL).',
    links: ['Aegis-AI', 'API-Backend', 'Control-Center'] },

  // SubApps (06-SubApps)
  { folder: '06-SubApps', title: 'Bezhas-Hub', cluster: 'finanzas-pagos', priority: 'P0', path: "App's secundarias/Bezhas-Hub/", port: 5173, domain: 'hub.bez.digital',
    desc: 'ERP B2B multi-tenant (org/site/membership), API keys con scope y metering, BeZhas_ID, 4 planes definitivos (config/plans.js única fuente), hot-wallet signing GCP KMS, simulador logístico 360°. Migraciones 012-014.',
    links: ['API-Backend', 'BeZhas-Pay', 'BeZhas-ID-Nota', 'BZ-CargoLink'] },
  { folder: '06-SubApps', title: 'BeZhas-Pay', cluster: 'finanzas-pagos', priority: 'P0', path: "App's secundarias/bezhas-pay-manager/", port: null, domain: 'pay.bez.digital',
    desc: 'Gestor de pagos: checkout hosted (pay.bez.digital/c/<token>), webhook MoonPay firmado, refunds, plugin WordPress Embedded Gateway v2.0 (35 tests). Liquidación en BEZ V1 Polygon.',
    links: ['API-Backend', 'Bezhas-Hub', 'BEZ-Wallet'] },
  { folder: '06-SubApps', title: 'BEZ-Wallet', cluster: 'finanzas-pagos', priority: 'P0', path: "App's secundarias/bez-wallet/", port: null, domain: 'wallet.bez.digital',
    desc: 'Wallet AA no-custodial (SmartWallet + Factory + Paymaster + WalletGuardian). Login/subscribe-with-wallet SIWE compartido (_shared/bezhas-wallet-auth.js).',
    links: ['Smart-Contracts', 'BeZhas-Pay', 'BZ-Gas-Tank'] },
  { folder: '06-SubApps', title: 'BZ-Capital', cluster: 'finanzas-pagos', priority: 'P1', path: "App's secundarias/BZ Capital/", port: null, domain: 'capital.bez.digital (ruta /defi)',
    desc: 'DeFi: pool interno BEZ/USDC (BeZhasDEX, reemplaza QuickSwap; oracle lee BEZHAS_DEX_ADDRESS), staking y farming (LP-token mismatch abierto).',
    links: ['Smart-Contracts', 'BeZhas-Pay'] },
  { folder: '06-SubApps', title: 'BZ-Gas-Tank', cluster: 'finanzas-pagos', priority: 'P1', path: "App's secundarias/gas-tank-manager/", port: null, domain: 'gas.bez.digital',
    desc: 'Paymaster manager: patrocinio de gas B2B, recargas y límites por tenant.',
    links: ['BEZ-Wallet', 'Smart-Contracts'] },
  { folder: '06-SubApps', title: 'BZ-CargoLink', cluster: 'logistica-rwa', priority: 'P1', path: "App's secundarias/BZ CargoLink/", port: 3017, domain: 'cargolink.bez.digital',
    desc: 'Logística: POS del cliente ↔ BeZhas_ID (un objeto B-UID + lifecycle, roles no pipelines), webhooks firmados fan-out, escrow BEZ. Permisos just-in-time (useClientPermission.js).',
    links: ['Bezhas-Hub', 'BeZhas-ID-Nota', 'BZ-PureScan', 'RWA-Gemelos-Digitales'] },
  { folder: '06-SubApps', title: 'BZ-PureScan', cluster: 'logistica-rwa', priority: 'P1', path: "App's secundarias/BZ PureScan/", port: null, domain: 'purescan.bez.digital',
    desc: 'Trazabilidad y certificación de pureza/calidad con QR verificable on-chain.',
    links: ['BZ-CargoLink', 'BZ-Vision-Scan'] },
  { folder: '06-SubApps', title: 'BZ-Vision-Scan', cluster: 'logistica-rwa', priority: 'P1', path: "App's secundarias/bez-vision-scan/", port: null, domain: 'vision.bez.digital',
    desc: 'Verificación visual con IA (inspección de mercancía/documentos) conectada al flujo logístico.',
    links: ['BZ-PureScan', 'BZ-CargoLink'] },
  { folder: '06-SubApps', title: 'RWA-Gemelos-Digitales', cluster: 'logistica-rwa', priority: 'P2', path: "App's secundarias/RWA gemelos digitales/", port: null, domain: null,
    desc: 'Gemelos digitales de activos reales: ShipTrack, CustomsClear, Port Finance, Maritime Insurance, Cold Chain, Real Estate.',
    links: ['BZ-CargoLink', 'Smart-Contracts'] },
  { folder: '06-SubApps', title: 'BZ-Energy', cluster: 'energia-iot', priority: 'P1', path: "App's secundarias/bez-energy/", port: 3019, domain: 'energy.bez.digital',
    desc: 'VPP: ingesta MQTT (vppMqttBroker.js + simulador), EnergyOracle.sol + EnergyCAEToken.sol + BeZhasVPP.sol (64 tests forge), feed OMIE, agente de arbitraje, bridge SCADA on-chain. NEXT: deploy Amoy + wire frontend.',
    links: ['Smart-Contracts', 'API-Backend'] },
  { folder: '06-SubApps', title: 'BZ-Edge-Manager', cluster: 'infra-devops', priority: 'P1', path: "App's secundarias/edge-node-manager/", port: null, domain: 'edge.bez.digital',
    desc: 'Gestión de edge nodes B2B: registro, salud, recompensas (EdgeNodeRewards).',
    links: ['Edge-Node', 'Infraestructura-Docker'] },
  { folder: '06-SubApps', title: 'BZ-Prestige', cluster: 'identidad-comunidad', priority: 'P2', path: "App's secundarias/BZ Prestige/", port: null, domain: 'prestige.bez.digital',
    desc: 'Reputación y prestigio empresarial dentro del ecosistema (score verificable).',
    links: ['BeZhas-ID-Nota', 'BZ-Sphere'] },
  { folder: '06-SubApps', title: 'BZ-Sphere', cluster: 'identidad-comunidad', priority: 'P2', path: "App's secundarias/BZ Sphere/", port: null, domain: 'sphere.bez.digital',
    desc: 'Red/comunidad del ecosistema de socios pre-verificados.',
    links: ['BZ-Prestige', 'BZ-Genesis'] },
  { folder: '06-SubApps', title: 'BZ-Genesis', cluster: 'identidad-comunidad', priority: 'P2', path: "App's secundarias/BZ Genesis/", port: null, domain: 'genesis.bez.digital',
    desc: 'Onboarding de nuevos socios al ecosistema (génesis de identidad y cuenta).',
    links: ['BeZhas-ID-Nota', 'BZ-Sphere'] },
  { folder: '06-SubApps', title: 'BeZhas-ID-Nota', cluster: 'identidad-comunidad', priority: 'P0', path: "Hub backend (multi-tenant) — identidad única B-UID", port: null, domain: null,
    desc: 'BeZhas_ID: identidad única por entidad (B-UID) compartida entre Hub, CargoLink, Prestige y Genesis. Claves con scope por rol; un objeto + lifecycle, los 4 actores son roles, no pipelines.',
    links: ['Bezhas-Hub', 'BZ-CargoLink', 'BZ-Prestige', 'BZ-Genesis'] },
  { folder: '06-SubApps', title: 'BeZhas-Docs', cluster: 'ia-conocimiento', priority: 'P2', path: "App's secundarias/BeZhas-Docs/", port: null, domain: null,
    desc: 'Documentación del ecosistema para desarrolladores y partners.',
    links: ['SKILL-Knowledge-Base', 'SDK-BeZhas'] },
];

function fm(pairs) {
  const lines = Object.entries(pairs)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => `"${x}"`).join(', ')}]` : JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n`;
}

async function writeIfChanged(relPath, content) {
  const absolute = path.join(vaultRoot, relPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const current = await fs.readFile(absolute, 'utf8').catch(() => null);
  if (current === content) return 'unchanged';
  await fs.writeFile(absolute, content);
  return current === null ? 'created' : 'updated';
}

const results = { created: 0, updated: 0, unchanged: 0 };
const track = (r) => { results[r] += 1; };

// Capa 2: entradas
for (const e of ENTRIES) {
  const clusterNote = `Cluster-${e.cluster}`;
  const body = fm({
    type: e.folder === '05-Platform' ? 'platform-service' : 'subapp',
    layer: 2,
    priority: e.priority,
    cluster: e.cluster,
    repo_path: e.path,
    port: e.port,
    domain: e.domain || null,
    tags: ['platform-map', e.cluster, e.priority.toLowerCase()],
  })
    + `# ${e.title.replaceAll('-', ' ')}\n\n`
    + `> Capa 2 · Prioridad **${e.priority}** · [[${clusterNote}]]\n\n`
    + `${e.desc}\n\n`
    + `**Ubicación:** \`${e.path}\`${e.port ? ` · puerto :${e.port}` : ''}${e.domain ? ` · ${e.domain}` : ''}\n\n`
    + `## Conexiones\n\n`
    + e.links.map((l) => `- [[${l}]]`).join('\n')
    + `\n- [[${clusterNote}]]\n- [[BeZhas-Platform-Master]]\n`;
  track(await writeIfChanged(path.join(e.folder, `${e.title}.md`), body));
}

// Capa 1: clusters
for (const [key, c] of Object.entries(CLUSTERS)) {
  const members = ENTRIES.filter((e) => e.cluster === key)
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.title.localeCompare(b.title));
  const body = fm({ type: 'cluster', layer: 1, cluster: key, members: members.length, tags: ['platform-map', 'cluster', key] })
    + `# ${c.title}\n\n`
    + `> Capa 1 · [[BeZhas-Platform-Master]]\n\n`
    + `${c.desc}\n\n`
    + `## Miembros (por prioridad)\n\n`
    + members.map((m) => `- **${m.priority}** [[${m.title}]] — ${m.desc.split('.')[0]}.`).join('\n')
    + '\n';
  track(await writeIfChanged(path.join('05-Platform', `Cluster-${key}.md`), body));
}

// Capa 0: master
const p0 = ENTRIES.filter((e) => e.priority === 'P0');
const master = fm({ type: 'master-map', layer: 0, clusters: Object.keys(CLUSTERS).length, services: ENTRIES.length, tags: ['platform-map', 'master'] })
  + `# BeZhas Platform Master\n\n`
  + `Hub central del ecosistema. Tres capas: **Capa 0** (este mapa) → **Capa 1** (clusters por tipo de información) → **Capa 2** (servicios core y SubApps). `
  + `Los agentes deben empezar aquí: baja por cluster, no por lista plana.\n\n`
  + `## Capa 1 — Clusters\n\n`
  + Object.entries(CLUSTERS).map(([key, c]) => `- [[Cluster-${key}]] — ${c.desc.split('.')[0]}.`).join('\n')
  + `\n\n## Ruta crítica (P0)\n\n`
  + p0.map((e) => `- [[${e.title}]] (${e.cluster})`).join('\n')
  + `\n\n## Reglas transversales\n\n`
  + `- PNPM v11+ SIEMPRE (nunca npm/yarn). Foundry, no Hardhat.\n`
  + `- Direcciones de contratos NUNCA se cambian sin confirmación — ver CLAUDE.md.\n`
  + `- Dos tokens, dos roles: [[BEZCoinV2-L2]] activa la conexión blockchain propia (gas nativo L2 chainId 2708); BEZ V1 Polygon \`0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8\` es la moneda de cambio/liquidación externa.\n`
  + `- Tras compilar contratos: sync-daemon → ABIs frontend.\n`
  + `- Memoria agéntica: [[Obsidian-Brain]] · decisiones en [[ADR-0001-Obsidian-as-Agent-Knowledge-Ops]].\n`
  + `\n## Mapas relacionados\n\n- [[BeZhas-Blockchain-Map]]\n- [[BeZhas-Autonomy-Loop.canvas]]\n`;
track(await writeIfChanged(path.join('03-Maps', 'BeZhas-Platform-Master.md'), master));

console.log(`[PlatformMap] vault=${vaultRoot}`);
console.log(`[PlatformMap] created=${results.created} updated=${results.updated} unchanged=${results.unchanged} (total ${ENTRIES.length + Object.keys(CLUSTERS).length + 1} notas)`);
