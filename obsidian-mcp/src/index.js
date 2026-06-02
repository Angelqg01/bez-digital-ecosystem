import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { z } from 'zod';

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
  inbox: '99-Inbox',
};

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
  if (!normalized.toLowerCase().endsWith('.md') && !normalized.toLowerCase().endsWith('.canvas') && !normalized.toLowerCase().endsWith('.json')) {
    throw new Error('Only .md, .canvas and .json files are allowed');
  }
  return normalized;
}

function resolveVaultPath(relativePath) {
  const safe = assertSafeRelativePath(relativePath);
  const absolute = path.resolve(vaultRoot, safe);
  if (!absolute.startsWith(vaultRoot)) {
    throw new Error('Path escapes vault');
  }
  return { safe, absolute };
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

async function walkFiles(dir = vaultRoot) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.obsidian') continue;
      files.push(...await walkFiles(absolute));
    } else if (/\.(md|canvas|json)$/i.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
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

function extractLinks(content) {
  const links = new Set();
  const wiki = content.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g);
  for (const match of wiki) links.add(match[1].trim());
  const md = content.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g);
  for (const match of md) links.add(path.basename(match[1], '.md'));
  return [...links];
}

function noteTitleFromPath(absolute) {
  return path.basename(absolute).replace(/\.(md|canvas|json)$/i, '');
}

async function noteSummary(absolute) {
  const relativePath = path.relative(vaultRoot, absolute).replaceAll(path.sep, '/');
  const content = await readTextFile(absolute);
  return {
    path: relativePath,
    title: noteTitleFromPath(absolute),
    links: extractLinks(content),
    bytes: Buffer.byteLength(content),
    preview: content.replace(/^---[\s\S]*?---\s*/m, '').trim().slice(0, 300),
  };
}

const toolHandlers = {
  async list_notes(params = {}) {
    const limit = Number(params.limit || 100);
    const files = await walkFiles();
    const notes = await Promise.all(files.slice(0, limit).map(noteSummary));
    return { notes, count: notes.length, vaultRoot };
  },

  async search_vault(params = {}) {
    const schema = z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).optional(),
    });
    const { query, limit = 10 } = schema.parse(params);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const files = await walkFiles();
    const scored = [];
    for (const file of files) {
      const content = await readTextFile(file);
      const haystack = `${noteTitleFromPath(file)}\n${content}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length || 0), 0);
      if (score > 0) {
        scored.push({ ...(await noteSummary(file)), score });
      }
    }
    scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    return { results: scored.slice(0, limit), query };
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
    await fs.writeFile(absolute, body, { flag: 'wx' });
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
      await fs.writeFile(absolute, content);
    } else {
      await fs.appendFile(absolute, `\n\n${content.trim()}\n`);
    }
    return { path: safe.replaceAll(path.sep, '/'), updated: true, mode };
  },

  async get_related_notes(params = {}) {
    const schema = z.object({ path: z.string().min(1), limit: z.number().int().min(1).max(50).optional() });
    const { path: notePath, limit = 20 } = schema.parse(params);
    const { absolute } = resolveVaultPath(notePath);
    const content = await readTextFile(absolute);
    const title = noteTitleFromPath(absolute);
    const outgoing = extractLinks(content);
    const files = await walkFiles();
    const incoming = [];
    for (const file of files) {
      if (file === absolute) continue;
      const item = await readTextFile(file);
      if (extractLinks(item).includes(title) || item.includes(`[[${title}`)) {
        incoming.push(await noteSummary(file));
      }
    }
    return { outgoing, incoming: incoming.slice(0, limit) };
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
    await ensureVault();
    const files = await walkFiles();
    res.json({ status: 'ok', service: 'bezhas-obsidian-mcp', vaultRoot, notes: files.length, uptime: process.uptime() });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
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
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

await ensureVault();
app.listen(port, process.env.MCP_HOST || '0.0.0.0', () => {
  console.log(`[ObsidianMCP] HTTP tools on :${port}`);
  console.log(`[ObsidianMCP] Vault: ${vaultRoot}`);
});
