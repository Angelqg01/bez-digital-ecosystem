// Optimización diaria del flujo del Brain. Standalone: no necesita el servidor.
//   1. Regenera el mapa de plataforma (idempotente)
//   2. Consolida episodios antiguos (>30d) en digests
//   3. Sincroniza embeddings si Ollama está disponible
//   4. Detecta notas huérfanas y links muertos
//   5. Calcula el fingerprint merkle del vault
//   6. Escribe 03-Maps/Brain-Daily-Report.md + episodio de mantenimiento
// Uso: node scripts/brainDaily.mjs [--dry-run]
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VaultIndex, normalizeLinkKey } from '../src/vaultIndex.js';
import { SemanticIndex } from '../src/semanticIndex.js';
import { consolidateEpisodes, vaultFingerprint, appendLog } from '../src/brainOps.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const vaultRoot = path.resolve(process.env.OBSIDIAN_VAULT_PATH || path.join(here, '..', '..', 'docs', 'obsidian-vault'));
const dryRun = process.argv.includes('--dry-run');
const stamp = new Date().toISOString();

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: path.resolve(here, '..'),
      env: { ...process.env, OBSIDIAN_VAULT_PATH: vaultRoot },
      windowsHide: true,
    });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(out))));
  });
}

// 1. Mapa de plataforma
const mapOut = await runNode(path.join(here, 'buildPlatformMap.mjs'));

// 2. Consolidación
const consolidation = await consolidateEpisodes(vaultRoot, { olderThanDays: 30, dryRun });

// Índice fresco (después de consolidar)
const index = new VaultIndex(vaultRoot);
await index.build();

// 3. Embeddings (opcional)
const semantic = new SemanticIndex(index);
let semanticStatus = 'OFF (Ollama no disponible)';
if (await semantic.isReachable()) {
  try {
    const { embedded, total } = await semantic.sync();
    semanticStatus = `ON — ${embedded} re-embebidas, ${total} vectores (${semantic.model})`;
  } catch (error) {
    semanticStatus = `ERROR — ${error.message}`;
  }
}

// 4. Huérfanas y links muertos
const linked = new Set();
for (const entry of index.notes.values()) {
  for (const link of entry.links) {
    const target = index.titleToPath.get(normalizeLinkKey(link));
    if (target) linked.add(target);
  }
}
const orphans = [...index.notes.values()]
  .filter((entry) => !linked.has(entry.path) && entry.links.length === 0)
  .map((entry) => entry.path);
// [[00-Episodic-Memory]] y similares apuntan a carpetas del vault, no a notas
const folderNames = new Set(
  (await fs.readdir(vaultRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => normalizeLinkKey(entry.name)),
);
const deadLinks = [];
for (const entry of index.notes.values()) {
  for (const link of entry.links) {
    const key = normalizeLinkKey(link);
    if (!index.titleToPath.has(key) && !folderNames.has(key)) {
      deadLinks.push({ from: entry.path, to: link });
    }
  }
}

// 5. Fingerprint
const fp = await vaultFingerprint(vaultRoot, [...index.notes.keys()]);

// 6. Reporte + episodio
const stats = index.stats();
const report = [
  '---',
  'type: report',
  `created: "${stamp}"`,
  'tags: ["brain-daily", "maintenance"]',
  `summary: ${JSON.stringify(`Brain daily: ${stats.notes} notas, ${orphans.length} huérfanas, ${deadLinks.length} links muertos, ${consolidation.archived} episodios archivados.`)}`,
  '---',
  '',
  '# Brain Daily Report',
  '',
  `> Última ejecución: ${stamp}${dryRun ? ' · **DRY-RUN**' : ''}`,
  '',
  `| Métrica | Valor |`,
  `| --- | --- |`,
  `| Notas | ${stats.notes} (${(stats.bytes / 1024).toFixed(1)} KB) |`,
  `| Semántica | ${semanticStatus} |`,
  `| Digests creados | ${consolidation.consolidated} |`,
  `| Episodios archivados | ${consolidation.archived} |`,
  `| Huérfanas | ${orphans.length} |`,
  `| Links muertos | ${deadLinks.length} |`,
  `| Merkle root | \`${fp.root}\` |`,
  '',
  '## Huérfanas (conectar o archivar)',
  '',
  ...(orphans.length ? orphans.map((p) => `- \`${p}\``) : ['- ninguna ✅']),
  '',
  '## Links muertos (crear nota destino o corregir)',
  '',
  ...(deadLinks.length ? deadLinks.slice(0, 30).map((d) => `- \`${d.from}\` → \`[[${d.to}]]\``) : ['- ninguno ✅']),
  '',
  '## Anclaje',
  '',
  `Root listo para publicar vía blockchain-agent → QualityOracle. Tras el tx, registrar con \`record_anchor\`.`,
  '',
  '[[BeZhas-Platform-Master]] · [[Obsidian-Brain]]',
  '',
].join('\n');

if (!dryRun) {
  await fs.writeFile(path.join(vaultRoot, '03-Maps', 'Brain-Daily-Report.md'), report);
  // un episodio por día: re-ejecutar el mismo día sobreescribe, no duplica
  const episodePath = path.join(vaultRoot, '00-Episodic-Memory', `${stamp.slice(0, 10)}-brain-daily.md`);
  await fs.writeFile(episodePath, [
    '---', 'type: "episode"', 'agent: "brain-daily"', `created: "${stamp}"`, 'tags: ["memory", "maintenance"]', '---',
    '', `# ${stamp.slice(0, 10)} brain-daily`, '',
    '## Goal\nOptimización diaria del flujo del Brain', '',
    `## Action\nMapa de plataforma + consolidación + embeddings + salud del grafo + fingerprint`, '',
    `## Result\n${stats.notes} notas · ${consolidation.archived} archivados · ${orphans.length} huérfanas · ${deadLinks.length} links muertos · root ${fp.root.slice(0, 18)}…`, '',
    '## Links', '[[Brain-Daily-Report]]', '',
  ].join('\n'));
  await appendLog(vaultRoot, 'daily',
    `${stats.notes} notas`,
    `${consolidation.archived} archivados · ${orphans.length} huérfanas · ${deadLinks.length} links muertos · root ${fp.root.slice(0, 18)}…`);
}

console.log(mapOut);
console.log(`[BrainDaily] notas=${stats.notes} digests=${consolidation.consolidated} archivados=${consolidation.archived}`);
console.log(`[BrainDaily] huérfanas=${orphans.length} linksMuertos=${deadLinks.length}`);
console.log(`[BrainDaily] semántica: ${semanticStatus}`);
console.log(`[BrainDaily] root=${fp.root}`);
console.log(`[BrainDaily] ${dryRun ? 'DRY-RUN (sin escribir reporte)' : 'reporte: 03-Maps/Brain-Daily-Report.md'}`);
