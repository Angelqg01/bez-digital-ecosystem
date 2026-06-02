const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chokidar = require('chokidar');
const matter = require('gray-matter');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VAULT_DIR = path.resolve(process.env.OBSIDIAN_VAULT_PATH || path.join(REPO_ROOT, 'docs', 'obsidian-vault'));
const CANVAS_FILE = path.join(VAULT_DIR, '03-Maps', 'BeZhas-Autonomy-Loop.canvas');
const WATCH_MODE = process.argv.includes('--watch');
const CORE_ID = 'bezhas-core';

const SYSTEM_NODES = [
  {
    id: 'director',
    text: 'DIRECTOR AGENT\nEstrategia, priorizacion, metacognicion, reportes y control HITL',
    x: -180,
    y: -560,
    width: 360,
    height: 140,
    color: '2',
  },
  {
    id: 'critic',
    text: 'CRITIC / SELF-EVALUATION\nValida planes, detecta fallos, calibra confianza y decide si actualizar auto-modelo',
    x: 360,
    y: -390,
    width: 390,
    height: 150,
    color: '5',
  },
  {
    id: 'runtime',
    text: 'AGENT RUNTIME\nToolRegistry + PermissionEngine + Orchestration + MCP proxy',
    x: -190,
    y: -260,
    width: 380,
    height: 130,
    color: '6',
  },
  {
    id: 'blockchain',
    text: 'BLOCKCHAIN CORE\nSmart contracts, validators, staking, bridge, payments, wallet guardian, sequencer',
    x: -720,
    y: 120,
    width: 390,
    height: 145,
    color: '3',
  },
  {
    id: 'aegis',
    text: 'AEGIS / MONITORING\nGas, fraude, compliance, validators, logs, Prometheus/Grafana',
    x: -720,
    y: -390,
    width: 380,
    height: 145,
    color: '4',
  },
  {
    id: 'obsidian',
    text: 'OBSIDIAN MCP\nVault Markdown local: episodios, decisiones, backlinks, Canvas y auto-modelo humano-legible',
    x: 360,
    y: 160,
    width: 400,
    height: 150,
    color: '6',
  },
  {
    id: 'memory',
    text: 'MEMORIA PERSISTENTE\nRedis: working memory\nPostgres: estado estructurado\nObsidian: memoria documental\nFuturo: Qdrant + Neo4j',
    x: -190,
    y: 410,
    width: 390,
    height: 170,
    color: '4',
  },
  {
    id: 'sectors',
    text: 'SECTORES BEZHAS\nFinanzas, Trading, Legal, DevOps, Marketing, Logistica, Retail, Documentos, Pagos',
    x: 700,
    y: 500,
    width: 390,
    height: 140,
    color: '3',
  },
  {
    id: 'telegram',
    text: 'TELEGRAM / HITL\nAlertas, confirmaciones, reportes de salud y decisiones Nivel 1-2',
    x: -760,
    y: 500,
    width: 380,
    height: 130,
    color: '6',
  },
  {
    id: 'loop',
    text: 'LOOP REAL\nPercibe -> Planifica -> Actua -> Evalua -> Consolida memoria -> Ajusta auto-modelo',
    x: 330,
    y: -80,
    width: 760,
    height: 120,
    color: '1',
  },
];

const SYSTEM_EDGES = [
  ['director', 'critic'],
  ['critic', 'runtime'],
  ['runtime', 'blockchain'],
  ['runtime', 'aegis'],
  ['runtime', 'sectors'],
  ['runtime', 'telegram'],
  ['aegis', 'critic'],
  ['critic', 'obsidian'],
  ['obsidian', 'memory'],
  ['memory', 'director'],
  ['blockchain', 'loop'],
  ['loop', 'obsidian'],
  ['telegram', 'director'],
];

const TYPE_COLORS = {
  core: '1',
  agent: '2',
  contract: '3',
  memory: '4',
  decision: '5',
  map: '6',
  episode: '4',
  sector: '3',
  standard: '0',
};

const TYPE_RADII = {
  core: 0,
  agent: 390,
  contract: 560,
  memory: 430,
  decision: 500,
  map: 660,
  episode: 610,
  sector: 560,
  standard: 620,
};

const TYPE_ANGLES = {
  agent: -90,
  memory: 18,
  decision: 72,
  map: 135,
  episode: 205,
  sector: 265,
  contract: 315,
  standard: 345,
};

function stableId(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walkMarkdown(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(absolute, base);
    if (!entry.name.endsWith('.md')) return [];
    return [{ absolute, relative: path.relative(base, absolute).replaceAll(path.sep, '/') }];
  });
}

function inferType(relative, data) {
  const explicit = String(data.type || data.canvasType || data.hierarchy || '').toLowerCase();
  if (explicit.includes('core')) return 'core';
  if (explicit.includes('agent')) return 'agent';
  if (explicit.includes('contract')) return 'contract';
  if (explicit.includes('memory') || explicit.includes('self')) return 'memory';
  if (explicit.includes('decision') || explicit.includes('adr')) return 'decision';
  if (explicit.includes('map')) return 'map';
  if (explicit.includes('episode')) return 'episode';
  if (explicit.includes('sector')) return 'sector';
  if (relative.startsWith('00-Episodic-Memory/')) return 'episode';
  if (relative.startsWith('01-Self-Model/')) return 'memory';
  if (relative.startsWith('02-Decisions/')) return 'decision';
  if (relative.startsWith('03-Maps/')) return 'map';
  if (relative.startsWith('04-Sectors/')) return 'sector';
  return 'standard';
}

function getTitle(relative, parsed) {
  if (parsed.data.title) return String(parsed.data.title);
  const heading = parsed.content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  return path.basename(relative, '.md');
}

function extractLinks(content) {
  const links = [];
  const regex = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
  let match;
  while ((match = regex.exec(content)) !== null) links.push(match[1].trim());
  return links;
}

function resolveLink(link, noteByStem, noteByPath) {
  const normalized = link.replace(/\.md$/i, '');
  return noteByStem.get(normalized.toLowerCase())
    || noteByPath.get(`${normalized}.md`.toLowerCase())
    || noteByPath.get(normalized.toLowerCase());
}

function polar(radius, angleDeg) {
  const angle = (angleDeg * Math.PI) / 180;
  return { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
}

function layoutNotes(notes) {
  const groups = notes.reduce((acc, note) => {
    if (!acc[note.type]) acc[note.type] = [];
    acc[note.type].push(note);
    return acc;
  }, {});

  for (const [type, group] of Object.entries(groups)) {
    const baseAngle = TYPE_ANGLES[type] ?? TYPE_ANGLES.standard;
    const radius = TYPE_RADII[type] ?? TYPE_RADII.standard;
    const spread = Math.min(76, Math.max(24, group.length * 18));
    group.forEach((note, index) => {
      const offset = group.length === 1 ? 0 : -spread / 2 + (spread / (group.length - 1)) * index;
      const p = polar(radius + (index % 2) * 80, baseAngle + offset);
      note.x = p.x;
      note.y = p.y;
    });
  }
}

function formatText(note) {
  const meta = [];
  if (note.data.roi) meta.push(`ROI: ${note.data.roi}`);
  if (note.data.token) meta.push(`Token: ${note.data.token}`);
  if (note.data.status) meta.push(`Status: ${note.data.status}`);
  if (note.data.agent) meta.push(`Agent: ${note.data.agent}`);

  return [
    `# ${note.title}`,
    note.summary || note.preview,
    meta.length ? meta.join(' | ') : '',
  ].filter(Boolean).join('\n');
}

function buildCanvas() {
  ensureDir(VAULT_DIR);
  ensureDir(path.dirname(CANVAS_FILE));

  const markdownFiles = walkMarkdown(VAULT_DIR);
  const notes = markdownFiles.map((file) => {
    const raw = fs.readFileSync(file.absolute, 'utf8');
    const parsed = matter(raw);
    const type = inferType(file.relative, parsed.data || {});
    const title = getTitle(file.relative, parsed);
    const preview = parsed.content.replace(/^#\s+.+$/m, '').replace(/\s+/g, ' ').trim().slice(0, 160);
    return {
      ...file,
      id: `note-${stableId(file.relative)}`,
      stem: path.basename(file.relative, '.md'),
      title,
      type,
      data: parsed.data || {},
      content: parsed.content,
      links: extractLinks(parsed.content),
      summary: parsed.data.summary ? String(parsed.data.summary) : '',
      preview,
      x: 0,
      y: 0,
    };
  });

  layoutNotes(notes);
  const noteByStem = new Map(notes.map((note) => [note.stem.toLowerCase(), note]));
  const noteByPath = new Map(notes.map((note) => [note.relative.toLowerCase(), note]));

  const nodes = [
    {
      id: CORE_ID,
      type: 'text',
      text: '# BeZhas Blockchain Core\nDirector Agent + Runtime + Smart Contracts + $BEZ\n\nAutonomia = Memoria + Percepcion + Evaluacion + Accion + Feedback',
      x: -220,
      y: -120,
      width: 440,
      height: 240,
      color: TYPE_COLORS.core,
    },
    ...SYSTEM_NODES.map((node) => ({ ...node, type: 'text' })),
    ...notes.map((note) => ({
      id: note.id,
      type: note.type === 'map' ? 'file' : 'text',
      file: note.type === 'map' ? note.relative : undefined,
      text: note.type === 'map' ? undefined : formatText(note),
      x: note.x,
      y: note.y,
      width: note.type === 'episode' ? 340 : 360,
      height: note.type === 'episode' ? 150 : 170,
      color: TYPE_COLORS[note.type] || TYPE_COLORS.standard,
    })),
  ];

  const edges = [];
  for (const [fromNode, toNode] of SYSTEM_EDGES) {
    edges.push({
      id: `edge-${stableId(`${fromNode}->${toNode}`)}`,
      fromNode,
      fromSide: 'right',
      toNode,
      toSide: 'left',
      color: '6',
    });
  }
  edges.push(
    { id: `edge-${stableId('runtime->core')}`, fromNode: 'runtime', fromSide: 'bottom', toNode: CORE_ID, toSide: 'top', color: '1' },
    { id: `edge-${stableId('core->blockchain')}`, fromNode: CORE_ID, fromSide: 'left', toNode: 'blockchain', toSide: 'right', color: '3' },
    { id: `edge-${stableId('core->memory')}`, fromNode: CORE_ID, fromSide: 'bottom', toNode: 'memory', toSide: 'top', color: '4' },
  );

  for (const note of notes) {
    const hierarchy = String(note.data.hierarchy || '').toLowerCase();
    if (note.type !== 'map' || hierarchy.includes('core') || note.links.length === 0) {
      const targetNode = note.type === 'episode' ? 'loop'
        : note.type === 'decision' ? 'critic'
        : note.type === 'map' ? 'obsidian'
        : note.type === 'memory' ? 'memory'
        : CORE_ID;
      edges.push({
        id: `edge-${stableId(`${note.id}->${CORE_ID}`)}`,
        fromNode: note.id,
        fromSide: 'left',
        toNode: targetNode,
        toSide: 'right',
        color: TYPE_COLORS[note.type] || TYPE_COLORS.standard,
      });
    }

    for (const link of note.links) {
      const target = resolveLink(link, noteByStem, noteByPath);
      if (!target || target.id === note.id) continue;
      edges.push({
        id: `edge-${stableId(`${note.id}->${target.id}`)}`,
        fromNode: note.id,
        fromSide: 'right',
        toNode: target.id,
        toSide: 'left',
        color: TYPE_COLORS[note.type] || TYPE_COLORS.standard,
      });
    }
  }

  const uniqueEdges = Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
  const canvas = { nodes, edges: uniqueEdges };
  fs.writeFileSync(CANVAS_FILE, JSON.stringify(canvas, null, 2));
  console.log(`[BeZhasCanvas] ${new Date().toISOString()} mapa actualizado: ${nodes.length} nodos, ${uniqueEdges.length} enlaces`);
  return canvas;
}

function watchCanvas() {
  console.log(`[BeZhasCanvas] observando vault: ${VAULT_DIR}`);
  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { buildCanvas(); } catch (error) { console.error('[BeZhasCanvas]', error.message); }
    }, 180);
  };

  chokidar.watch(VAULT_DIR, {
    ignored: [/(^|[/\\])\../, CANVAS_FILE],
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 250, pollInterval: 50 },
  })
    .on('add', (filePath) => filePath.endsWith('.md') && schedule())
    .on('change', (filePath) => filePath.endsWith('.md') && schedule())
    .on('unlink', (filePath) => filePath.endsWith('.md') && schedule());
}

buildCanvas();
if (WATCH_MODE) watchCanvas();
