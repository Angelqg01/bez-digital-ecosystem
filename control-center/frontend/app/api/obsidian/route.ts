import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export const dynamic = 'force-dynamic';

const VAULT_ROOT = path.resolve(process.cwd(), '../../docs/obsidian-vault');
const MAX_BYTES = 512_000;
const CANVAS_BUILDER = path.resolve(process.cwd(), '../../obsidian-mcp/scripts/bezhasCanvasBuilder.cjs');

type CanvasNode = {
  id: string;
  type: string;
  text?: string;
  file?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasEdge = {
  id: string;
  fromNode: string;
  toNode: string;
};

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function normalizeVaultPath(relativePath: string) {
  const safe = path.normalize(relativePath || '').replace(/^[/\\]+/, '');
  if (!safe || safe.includes('..') || path.isAbsolute(safe)) {
    throw new Error('Unsafe vault path');
  }
  if (!/\.(md|canvas|json)$/i.test(safe)) {
    throw new Error('Only .md, .canvas and .json are allowed');
  }
  const absolute = path.resolve(VAULT_ROOT, safe);
  if (!absolute.startsWith(VAULT_ROOT)) {
    throw new Error('Path escapes vault');
  }
  return { safe: safe.replaceAll(path.sep, '/'), absolute };
}

async function readText(absolute: string) {
  const stat = await fs.stat(absolute);
  if (stat.size > MAX_BYTES) throw new Error('File too large');
  return fs.readFile(absolute, 'utf8');
}

async function walk(dir = VAULT_ROOT): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.obsidian') continue;
      files.push(...await walk(absolute));
    } else if (/\.(md|canvas|json)$/i.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files;
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'note';
}

function extractLinks(content: string) {
  const links = new Set<string>();
  for (const match of content.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
    links.add(match[1].trim());
  }
  return [...links];
}

function preview(content: string) {
  return content.replace(/^---[\s\S]*?---\s*/m, '').trim().slice(0, 280);
}

async function buildSummary() {
  await fs.mkdir(VAULT_ROOT, { recursive: true });
  const files = await walk();
  const notes = await Promise.all(files.map(async (absolute) => {
    const relativePath = path.relative(VAULT_ROOT, absolute).replaceAll(path.sep, '/');
    const content = await readText(absolute);
    return {
      path: relativePath,
      title: path.basename(absolute).replace(/\.(md|canvas|json)$/i, ''),
      type: path.extname(absolute).slice(1),
      bytes: Buffer.byteLength(content),
      links: extractLinks(content),
      preview: preview(content),
    };
  }));

  const canvasPath = '03-Maps/BeZhas-Autonomy-Loop.canvas';
  const mapPath = '03-Maps/BeZhas-Blockchain-Map.md';
  const selfModelPath = '01-Self-Model/BeZhas-Director-Agent.self-model.json';
  const canvas = JSON.parse(await readText(normalizeVaultPath(canvasPath).absolute)) as { nodes: CanvasNode[]; edges: CanvasEdge[] };
  const mapMarkdown = await readText(normalizeVaultPath(mapPath).absolute);
  const selfModel = JSON.parse(await readText(normalizeVaultPath(selfModelPath).absolute));
  const episodes = notes.filter((note) => note.path.startsWith('00-Episodic-Memory/')).sort((a, b) => b.path.localeCompare(a.path));

  return {
    status: 'ok',
    vaultRoot: VAULT_ROOT,
    counts: {
      notes: notes.length,
      episodes: episodes.length,
      canvasNodes: canvas.nodes.length,
      canvasEdges: canvas.edges.length,
    },
    notes,
    episodes,
    canvasPath,
    canvas,
    mapPath,
    mapMarkdown,
    selfModelPath,
    selfModel,
    obsidianLinks: {
      canvas: `obsidian://open?path=${encodeURIComponent(path.join(VAULT_ROOT, canvasPath))}`,
      map: `obsidian://open?path=${encodeURIComponent(path.join(VAULT_ROOT, mapPath))}`,
      vault: `obsidian://open?path=${encodeURIComponent(VAULT_ROOT)}`,
    },
  };
}

export async function GET(req: NextRequest) {
    // Lee y escribe el vault de Obsidian en disco y lanza el canvas builder:
    // sin guarda, cualquiera podía leer la documentación interna del proyecto.
    const denied = await requireSuperAdmin();
    if (denied) return denied;

  try {
    const url = new URL(req.url);
    const notePath = url.searchParams.get('path');
    if (notePath) {
      const { safe, absolute } = normalizeVaultPath(notePath);
      return json({ status: 'ok', path: safe, content: await readText(absolute) });
    }
    return json(await buildSummary());
  } catch (error) {
    return json({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
    // Lee y escribe el vault de Obsidian en disco y lanza el canvas builder:
    // sin guarda, cualquiera podía leer la documentación interna del proyecto.
    const denied = await requireSuperAdmin();
    if (denied) return denied;

  try {
    const body = await req.json();
    const action = body?.action;

    if (action === 'record_episode') {
      const agent = String(body.agent || 'director-agent');
      const goal = String(body.goal || 'profile obsidian check');
      const result = String(body.result || 'recorded from admin profile');
      const id = crypto.randomUUID().slice(0, 8);
      const title = `${new Date().toISOString().slice(0, 10)} ${agent} ${id}`;
      const relativePath = `00-Episodic-Memory/${slugify(title)}.md`;
      const { absolute, safe } = normalizeVaultPath(relativePath);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, [
        '---',
        'type: episode',
        `agent: ${JSON.stringify(agent)}`,
        `created: ${JSON.stringify(new Date().toISOString())}`,
        'tags: ["admin-profile", "obsidian", "feedback-loop"]',
        '---',
        '',
        `# ${title}`,
        '',
        '## Goal',
        goal,
        '',
        '## Result',
        result,
        '',
        '## Evaluation',
        '```json',
        JSON.stringify(body.evaluation || { goal_achieved: true, update_self_model: false }, null, 2),
        '```',
        '',
        '[[BeZhas-Director-Agent.self-model]]',
      ].join('\n'));
      return json({ status: 'ok', path: safe });
    }

    if (action === 'update_self_model') {
      const { absolute, safe } = normalizeVaultPath('01-Self-Model/BeZhas-Director-Agent.self-model.json');
      const current = JSON.parse(await readText(absolute));
      const updated = {
        ...current,
        ...(body.patch || {}),
        last_self_update: new Date().toISOString(),
        last_update_reason: body.reason || 'admin-profile obsidian update',
      };
      await fs.writeFile(absolute, JSON.stringify(updated, null, 2));
      return json({ status: 'ok', path: safe, selfModel: updated });
    }

    if (action === 'rebuild_canvas') {
      const output = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, [CANVAS_BUILDER], {
          cwd: path.dirname(CANVAS_BUILDER),
          env: { ...process.env, OBSIDIAN_VAULT_PATH: VAULT_ROOT },
          windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code !== 0) reject(new Error(stderr || `Canvas builder exited with ${code}`));
          else resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        });
      });
      const summary = await buildSummary();
      return json({ status: 'ok', output, counts: summary.counts });
    }

    return json({ status: 'error', error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return json({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
