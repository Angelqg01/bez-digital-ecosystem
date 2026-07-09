import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import chokidar from 'chokidar';
import { VaultIndex, NOTE_RE, extractLinks } from './vaultIndex.js';
import { SemanticIndex } from './semanticIndex.js';
import { consolidateEpisodes, vaultFingerprint, appendLog } from './brainOps.js';
import { UsageTracker } from './usageTracker.js';
import { BRAIN_UI_HTML } from './ui.js';

const app = express();
const port = Number(process.env.MCP_PORT || process.env.OBSIDIAN_MCP_PORT || 4007);
const vaultRoot = path.resolve(process.env.OBSIDIAN_VAULT_PATH || '/vault');
const maxBytes = Number(process.env.OBSIDIAN_MAX_NOTE_BYTES || 512_000);
const builderPath = path.resolve(process.env.BEZHAS_CANVAS_BUILDER || path.join(process.cwd(), 'scripts', 'bezhasCanvasBuilder.cjs'));

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const folders = {
  episodes: '00-Episodic-Memory',
  selfModel: '01-Self-Model',
  decisions: '02-Decisions',
  maps: '03-Maps',
  sectors: '04-Sectors',
  sources: '07-Sources',
  inbox: '99-Inbox',
};

const index = new VaultIndex(vaultRoot, { maxBytes });
const semantic = new SemanticIndex(index);
const usage = new UsageTracker(path.join(vaultRoot, '.obsidian', 'bezhas-usage.json'));

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || 'note')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'note';
}

function assertSafeRelativePath(relativePath) {
  const normalized = path.normalize(String(relativePath || '')).replace(/^([/\\])+/, '');
  if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('Unsafe note path');
  }
  if (!NOTE_RE.test(normalized)) {
    throw new Error('Only .md, .canvas and .json files are allowed');
  }
  return normalized;
}

function resolveVaultPath(relativePath) {
  const safe = assertSafeRelativePath(relativePath);
  const absolute = path.resolve(vaultRoot, safe);
  if (absolute !== vaultRoot && !absolute.startsWith(vaultRoot + path.sep)) {
    throw new Error('Path escapes vault');
  }
  return { safe, absolute };
}

function assertWriteSize(bytes) {
  if (bytes > maxBytes) {
    throw new Error(`Write exceeds max note size ${maxBytes} bytes`);
  }
}

async function ensureVault() {
  await fs.mkdir(vaultRoot, { recursive: true });
  await Promise.all(Object.values(folders).map((folder) => fs.mkdir(path.join(vaultRoot, folder), { recursive: true })));

  const selfModelPath = path.join(vaultRoot, folders.selfModel, 'BeZhas-Director-Agent.self-model.json');
  try {
    await fs.access(selfModelPath);
  } catch {
    await fs.writeFile(selfModelPath, JSON.stringify({
      identity: {
        name: 'BeZhas Director Agent',
        purpose: 'Orquestar BeZhas con memoria persistente, evaluacion y expansion controlada',
      },
      capabilities: {
        confirmed_strong: ['orquestacion', 'documentacion viva', 'analisis operativo'],
        confirmed_weak: ['acciones irreversibles sin aprobacion humana'],
        uncertain: ['prediccion de mercado volatil'],
      },
      behavioral_patterns: {
        tends_to: ['priorizar seguridad y rentabilidad medible'],
        avoids: ['cambios mainnet sin confirmacion'],
        bias_detected: [],
      },
      performance_history: {
        tasks_completed: 0,
        success_rate: null,
        avg_iterations_to_success: null,
      },
      decision_levels: {
        level_0: ['leer datos', 'actualizar memoria', 'generar reportes'],
        level_1: ['notificar ajustes internos no destructivos'],
        level_2: ['contratos inteligentes', 'fondos', 'acciones irreversibles'],
        level_3: ['valores core', 'proposito', 'identidad'],
      },
      last_self_update: nowIso(),
    }, null, 2));
  }

  await fs.mkdir(path.join(vaultRoot, folders.sources, 'raw'), { recursive: true });

  const logPath = path.join(vaultRoot, 'log.md');
  try {
    await fs.access(logPath);
  } catch {
    await fs.writeFile(logPath, [
      '---', 'type: log', 'summary: Registro cronologico append-only del Brain (ingests, dailies, anclajes).', '---',
      '', '# Brain Log', '',
      'Registro del wiki [[BeZhas-Platform-Master]] — convenciones en [[_SCHEMA]].',
      'Formato: `## [fecha] op | titulo`. Parseable: `grep "^## \\[" log.md | tail -5`.', '', '',
    ].join('\n'));
  }

  const indexPath = path.join(vaultRoot, 'README.md');
  try {
    await fs.access(indexPath);
  } catch {
    await fs.writeFile(indexPath, [
      '# BeZhas Obsidian Vault',
      '',
      'Vault operativo para memoria documental de agentes BeZhas.',
      '',
      '- [[00-Episodic-Memory]]: acciones, resultados y feedback.',
      '- [[01-Self-Model]]: auto-modelo versionado del Director Agent.',
      '- [[02-Decisions]]: decisiones humanas y agénticas trazables.',
      '- [[03-Maps]]: Canvas y mapas del ecosistema.',
      '- [[04-Sectors]]: conocimiento por vertical.',
      '',
    ].join('\n'));
  }
}

async function readTextFile(absolute) {
  const stat = await fs.stat(absolute);
  if (stat.size > maxBytes) {
    throw new Error(`Note exceeds max size ${maxBytes}`);
  }
  return fs.readFile(absolute, 'utf8');
}

function frontmatter(metadata = {}) {
  const clean = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? `[${value.map((item) => `"${String(item).replaceAll('"', '\\"')}"`).join(', ')}]` : JSON.stringify(value)}`);
  return clean.length ? `---\n${clean.join('\n')}\n---\n\n` : '';
}

const toolHandlers = {
  async list_notes(params = {}) {
    const limit = Number(params.limit || 100);
    const notes = index.list(limit);
    return { notes, count: notes.length, vaultRoot };
  },

  async search_vault(params = {}) {
    const schema = z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
      folder: z.string().optional(),
      tags: z.array(z.string()).optional(),
    });
    const { query, limit = 10, folder, tags } = schema.parse(params);
    return { results: index.search(query, { limit, folder, tags }), query };
  },

  async get_note(params = {}) {
    const schema = z.object({ path: z.string().min(1) });
    const { path: notePath } = schema.parse(params);
    const { safe, absolute } = resolveVaultPath(notePath);
    const content = await readTextFile(absolute);
    return { path: safe.replaceAll(path.sep, '/'), content, links: extractLinks(content) };
  },

  async create_note(params = {}) {
    const schema = z.object({
      title: z.string().min(1),
      folder: z.string().optional(),
      content: z.string().default(''),
      metadata: z.record(z.string(), z.any()).optional(),
    });
    const { title, folder = folders.inbox, content, metadata = {} } = schema.parse(params);
    const relativePath = path.join(folder, `${slugify(title)}.md`);
    const { safe, absolute } = resolveVaultPath(relativePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    const body = `${frontmatter({ ...metadata, created: nowIso() })}# ${title}\n\n${content.trim()}\n`;
    assertWriteSize(Buffer.byteLength(body));
    await fs.writeFile(absolute, body, { flag: 'wx' });
    await index.refreshFile(absolute);
    return { path: safe.replaceAll(path.sep, '/'), created: true };
  },

  async update_note(params = {}) {
    const schema = z.object({
      path: z.string().min(1),
      content: z.string().min(1),
      mode: z.enum(['replace', 'append']).default('append'),
    });
    const { path: notePath, content, mode } = schema.parse(params);
    const { safe, absolute } = resolveVaultPath(notePath);
    if (mode === 'replace') {
      assertWriteSize(Buffer.byteLength(content));
      await fs.writeFile(absolute, content);
    } else {
      const stat = await fs.stat(absolute).catch(() => ({ size: 0 }));
      assertWriteSize(stat.size + Buffer.byteLength(content) + 2);
      await fs.appendFile(absolute, `\n\n${content.trim()}\n`);
    }
    await index.refreshFile(absolute);
    return { path: safe.replaceAll(path.sep, '/'), updated: true, mode };
  },

  async get_related_notes(params = {}) {
    const schema = z.object({ path: z.string().min(1), limit: z.number().int().min(1).max(50).optional() });
    const { path: notePath, limit = 20 } = schema.parse(params);
    const { safe } = resolveVaultPath(notePath);
    return index.related(safe.replaceAll(path.sep, '/'), limit);
  },

  async get_recent_notes(params = {}) {
    const schema = z.object({
      limit: z.number().int().min(1).max(50).optional(),
      folder: z.string().optional(),
    });
    const { limit = 10, folder } = schema.parse(params);
    return { notes: index.recent(limit, folder || null) };
  },

  async get_tags() {
    return { tags: index.tags() };
  },

  async semantic_search(params = {}) {
    const schema = z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
      minScore: z.number().min(0).max(1).optional(),
    });
    const { query, limit = 10, minScore } = schema.parse(params);
    try {
      const { results, model } = await semantic.search(query, { limit, minScore });
      return { results, query, mode: 'semantic', model };
    } catch (error) {
      // Ollama down or model missing: degrade to lexical so agents never block
      return {
        results: index.search(query, { limit }),
        query,
        mode: 'lexical-fallback',
        reason: error.message,
      };
    }
  },

  async consolidate_episodes(params = {}) {
    const schema = z.object({
      olderThanDays: z.number().int().min(1).max(3650).optional(),
      dryRun: z.boolean().optional(),
    });
    const { olderThanDays = 30, dryRun = true } = schema.parse(params);
    const result = await consolidateEpisodes(vaultRoot, { olderThanDays, dryRun });
    if (!dryRun && result.archived > 0) {
      await index.build();
      await appendLog(vaultRoot, 'consolidate', `${result.consolidated} digests`, `${result.archived} episodios archivados`);
    }
    return result;
  },

  async get_vault_fingerprint() {
    return vaultFingerprint(vaultRoot, [...index.notes.keys()]);
  },

  async get_usage_stats(params = {}) {
    const schema = z.object({ limit: z.number().int().min(1).max(50).optional() });
    const { limit = 10 } = schema.parse(params);
    return usage.summary({ limit });
  },

  async record_anchor(params = {}) {
    const schema = z.object({
      root: z.string().regex(/^0x[0-9a-f]{64}$/i),
      txHash: z.string().optional(),
      chainId: z.number().int().optional(),
      network: z.string().optional(),
      notes: z.number().int().optional(),
    });
    const anchor = schema.parse(params);
    const stamp = nowIso();
    await appendLog(vaultRoot, 'anchor', anchor.root.slice(0, 18), anchor.txHash ? `tx ${anchor.txHash}` : 'sin tx');
    return toolHandlers.create_note({
      title: `Anchor ${stamp.slice(0, 19).replace(/[:T]/g, '-')}`,
      folder: folders.decisions,
      content: [
        `Merkle root del vault publicado como evidencia inmutable.`,
        '',
        `- **Root:** \`${anchor.root}\``,
        anchor.txHash ? `- **Tx:** \`${anchor.txHash}\`` : null,
        anchor.chainId ? `- **Chain ID:** ${anchor.chainId}` : null,
        anchor.network ? `- **Red:** ${anchor.network}` : null,
        anchor.notes ? `- **Notas cubiertas:** ${anchor.notes}` : null,
        '',
        '[[ADR-0002-Brain-Index-Optimization]]',
      ].filter(Boolean).join('\n'),
      metadata: { type: 'anchor', tags: ['audit', 'on-chain'] },
    });
  },

  async get_graph() {
    return index.graph();
  },

  async ingest_source(params = {}) {
    const schema = z.object({
      title: z.string().min(1),
      summary: z.string().min(10),
      raw_filename: z.string().regex(/^[\w][\w .()-]{0,120}\.\w{1,8}$/).optional(),
      raw_content: z.string().optional(),
      source_file: z.string().optional(),
      key_points: z.array(z.string()).optional(),
      entities: z.array(z.string()).optional(),
      contradictions: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      agent: z.string().default('director-agent'),
    });
    const src = schema.parse(params);

    // capa cruda inmutable: se escribe una vez (flag wx), nunca se sobreescribe
    let sourceFile = src.source_file || null;
    if (src.raw_content && src.raw_filename) {
      const rawAbs = path.join(vaultRoot, folders.sources, 'raw', src.raw_filename);
      await fs.writeFile(rawAbs, src.raw_content, { flag: 'wx' });
      sourceFile = `raw/${src.raw_filename}`;
    }

    const body = [
      `> Fuente ingerida al wiki. Original inmutable en \`07-Sources/${sourceFile || 'n/a'}\`.`,
      '',
      '## Resumen',
      '',
      src.summary.trim(),
      ...(src.key_points?.length ? ['', '## Puntos clave', '', ...src.key_points.map((k) => `- ${k}`)] : []),
      ...(src.entities?.length ? ['', '## Entidades relacionadas', '', ...src.entities.map((e) => `- [[${e}]]`)] : []),
      ...(src.contradictions?.length ? ['', '## Contradicciones detectadas (resolver en lint)', '', ...src.contradictions.map((c) => `- ⚠️ ${c}`)] : []),
      '',
      '[[BeZhas-Platform-Master]]',
    ].join('\n');

    const note = await toolHandlers.create_note({
      title: src.title,
      folder: folders.sources,
      content: body,
      metadata: {
        type: 'source',
        agent: src.agent,
        source_file: sourceFile,
        tags: ['source', ...(src.tags || [])],
      },
    });
    await appendLog(vaultRoot, 'ingest', src.title,
      `${src.entities?.length || 0} entidades enlazadas · ${src.contradictions?.length || 0} contradicciones · ${note.path}`);
    return { ...note, source_file: sourceFile, logged: true };
  },

  async record_episode(params = {}) {
    const schema = z.object({
      agent: z.string().default('director-agent'),
      goal: z.string().min(1),
      action: z.string().min(1),
      result: z.string().min(1),
      evaluation: z.record(z.string(), z.any()).optional(),
      tags: z.array(z.string()).optional(),
    });
    const episode = schema.parse(params);
    const id = crypto.randomUUID().slice(0, 8);
    const title = `${nowIso().slice(0, 10)} ${episode.agent} ${id}`;
    const content = [
      `## Goal\n${episode.goal}`,
      `## Action\n${episode.action}`,
      `## Result\n${episode.result}`,
      `## Evaluation\n\`\`\`json\n${JSON.stringify(episode.evaluation || {}, null, 2)}\n\`\`\``,
      '## Links',
      '[[BeZhas-Director-Agent.self-model]]',
    ].join('\n\n');
    return toolHandlers.create_note({
      title,
      folder: folders.episodes,
      content,
      metadata: {
        type: 'episode',
        agent: episode.agent,
        tags: episode.tags || ['memory', 'feedback-loop'],
      },
    });
  },

  async update_self_model(params = {}) {
    const schema = z.object({
      patch: z.record(z.string(), z.any()),
      reason: z.string().min(1),
      agent: z.string().default('director-agent'),
    });
    const { patch, reason, agent } = schema.parse(params);
    const relative = path.join(folders.selfModel, 'BeZhas-Director-Agent.self-model.json');
    const { absolute } = resolveVaultPath(relative);
    const current = JSON.parse(await readTextFile(absolute));
    const updated = {
      ...current,
      ...patch,
      last_self_update: nowIso(),
      last_update_reason: reason,
      last_update_agent: agent,
    };
    await fs.writeFile(absolute, JSON.stringify(updated, null, 2));
    await index.refreshFile(absolute);
    return { path: relative.replaceAll(path.sep, '/'), updated: true, self_model: updated };
  },

  async rebuild_canvas() {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [builderPath], {
        cwd: process.cwd(),
        env: { ...process.env, OBSIDIAN_VAULT_PATH: vaultRoot },
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Canvas builder exited with ${code}`));
          return;
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
    const relative = path.join(folders.maps, 'BeZhas-Autonomy-Loop.canvas');
    const { absolute } = resolveVaultPath(relative);
    await index.refreshFile(absolute);
    const canvas = JSON.parse(await readTextFile(absolute));
    return {
      rebuilt: true,
      path: relative.replaceAll(path.sep, '/'),
      nodes: canvas.nodes?.length || 0,
      edges: canvas.edges?.length || 0,
      output,
    };
  },
};

app.get('/health', async (_req, res) => {
  try {
    const reachable = await semantic.isReachable();
    res.json({
      status: 'ok',
      service: 'bezhas-obsidian-mcp',
      vaultRoot,
      ...index.stats(),
      semantic: { reachable, model: semantic.model, host: semantic.ollamaHost, cached: semantic.vectors.size },
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get(['/', '/ui'], (_req, res) => {
  res.type('html').send(BRAIN_UI_HTML);
});

app.get('/tools', (_req, res) => {
  res.json({ tools: Object.keys(toolHandlers) });
});

app.post('/tools/:tool', async (req, res) => {
  const handler = toolHandlers[req.params.tool];
  if (!handler) {
    res.status(404).json({ success: false, error: `Unknown tool: ${req.params.tool}` });
    return;
  }
  try {
    const data = await handler(req.body || {});
    // toda llamada de un agente al Brain queda en la telemetría del mapa
    if (req.params.tool !== 'get_usage_stats') {
      usage.record({
        source: req.get('x-bezhas-agent') || req.body?.agent || 'agent-runtime',
        target: 'Obsidian-Brain',
        fn: `obsidian:${req.params.tool}`,
      });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Ingesta de telemetría desde el resto de la red (API :3001, gateway, SubApps):
// POST /telemetry/usage  { source, target, fn, tokens?, bez? }  o  { events: [...] }
const usageEventSchema = z.object({
  source: z.string().min(1).max(80),
  target: z.string().min(1).max(80),
  fn: z.string().min(1).max(160),
  tokens: z.number().min(0).optional(),
  bez: z.number().min(0).optional(),
});
app.post('/telemetry/usage', (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [req.body];
    const parsed = events.map((event) => usageEventSchema.parse(event));
    for (const event of parsed) usage.record(event);
    res.json({ success: true, recorded: parsed.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/telemetry/summary', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json(usage.summary({ limit }));
});

await ensureVault();
await index.build();
await usage.load();

// External edits (Obsidian desktop, git pull, canvas builder --watch) land in
// the index without a restart. Writes through the HTTP tools refresh eagerly,
// so the watcher only has to cover out-of-band changes.
const watcher = chokidar.watch(vaultRoot, {
  ignored: (watchedPath) => watchedPath.includes('.obsidian') || watchedPath.includes('.trash'),
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
});
watcher
  .on('add', (file) => index.refreshFile(file))
  .on('change', (file) => index.refreshFile(file))
  .on('unlink', (file) => index.removeFile(file));

// Autopilot: la parte mecánica del brain-daily corre sola cada 24h dentro del
// contenedor (consolidación + embeddings). La parte con criterio (huérfanas,
// links muertos, anclaje) la cubre el skill /brain-daily.
if (process.env.BRAIN_AUTOPILOT !== '0') {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const autopilot = setInterval(async () => {
    try {
      const result = await consolidateEpisodes(vaultRoot, { olderThanDays: 30, dryRun: false });
      if (result.archived > 0) await index.build();
      if (await semantic.isReachable()) await semantic.sync();
      console.log(`[ObsidianMCP] autopilot: ${result.archived} episodios archivados, ${index.stats().notes} notas`);
    } catch (error) {
      console.error(`[ObsidianMCP] autopilot error: ${error.message}`);
    }
  }, Number(process.env.BRAIN_AUTOPILOT_INTERVAL_MS || DAY_MS));
  autopilot.unref();
}

async function shutdown() {
  await watcher.close().catch(() => {});
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, shutdown);
}
// Windows no entrega señales a procesos hijos: los tests cierran por HTTP
if (process.env.ALLOW_TEST_SHUTDOWN === '1') {
  app.post('/shutdown', (_req, res) => {
    res.json({ bye: true });
    setTimeout(shutdown, 50);
  });
}

app.listen(port, process.env.MCP_HOST || '0.0.0.0', () => {
  console.log(`[ObsidianMCP] HTTP tools on :${port}`);
  console.log(`[ObsidianMCP] Vault: ${vaultRoot} (${index.stats().notes} notes indexed)`);
});
