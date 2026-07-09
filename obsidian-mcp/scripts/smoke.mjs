// Smoke test: boots the MCP server against a temp vault and exercises every tool.
// Usage: node scripts/smoke.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const PORT = 41707;
const BASE = `http://127.0.0.1:${PORT}`;
const vault = await fs.mkdtemp(path.join(os.tmpdir(), 'bezhas-vault-'));

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: path.resolve(import.meta.dirname, '..'),
  env: {
    ...process.env,
    MCP_PORT: String(PORT),
    OBSIDIAN_VAULT_PATH: vault,
    MCP_HOST: '127.0.0.1',
    OLLAMA_HOST: 'http://127.0.0.1:1', // unreachable on purpose: semantic must fall back
    ALLOW_TEST_SHUTDOWN: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (c) => { serverLog += c; });
server.stderr.on('data', (c) => { serverLog += c; });

async function waitForHealth(retries = 50) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return res.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server never became healthy.\n${serverLog}`);
}

async function tool(name, params = {}) {
  const res = await fetch(`${BASE}/tools/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`${name} failed: ${json.error}`);
  return json.data;
}

let failed = false;
try {
  const health = await waitForHealth();
  assert.equal(health.status, 'ok');

  // create + backlink pair
  await tool('create_note', {
    title: 'Staking Strategy',
    folder: '04-Sectors',
    content: 'BEZ staking rewards analysis. See [[Treasury Policy]].',
    metadata: { type: 'knowledge', tags: ['staking', 'defi'] },
  });
  await tool('create_note', {
    title: 'Treasury Policy',
    folder: '02-Decisions',
    content: 'Treasury allocation rules for staking pools.',
    metadata: { type: 'decision', tags: ['treasury'] },
  });

  // weighted search: title match should outrank body match
  const search = await tool('search_vault', { query: 'staking' });
  assert.ok(search.results.length >= 2, 'expected 2+ staking results');
  assert.equal(search.results[0].title, 'Staking-Strategy', 'title match should rank first');

  // tag filter
  const filtered = await tool('search_vault', { query: 'staking', tags: ['treasury'] });
  assert.equal(filtered.results.length, 1);
  assert.equal(filtered.results[0].title, 'Treasury-Policy');

  // backlinks from the index
  const related = await tool('get_related_notes', { path: '02-Decisions/Treasury-Policy.md' });
  assert.ok(related.incoming.some((n) => n.title === 'Staking-Strategy'), 'backlink missing');

  // episodic memory
  const episode = await tool('record_episode', {
    agent: 'smoke-agent',
    goal: 'verify brain',
    action: 'ran smoke test',
    result: 'ok',
    tags: ['test'],
  });
  assert.ok(episode.created);

  // recency
  const recent = await tool('get_recent_notes', { limit: 5 });
  assert.ok(recent.notes.length >= 3);

  // tags + graph
  const tags = await tool('get_tags');
  assert.ok(tags.tags.some((t) => t.tag === 'staking'));
  const graph = await tool('get_graph');
  assert.ok(graph.edges.some((e) => e.from.includes('Staking-Strategy') && e.to.includes('Treasury-Policy')));

  // update + size guard
  await tool('update_note', { path: '02-Decisions/Treasury-Policy.md', content: 'Amendment: max 20% per pool.' });
  const note = await tool('get_note', { path: '02-Decisions/Treasury-Policy.md' });
  assert.ok(note.content.includes('Amendment'));
  await assert.rejects(
    tool('update_note', { path: '02-Decisions/Treasury-Policy.md', content: 'x'.repeat(600_000), mode: 'replace' }),
    /max note size/,
  );

  // self-model
  const self = await tool('update_self_model', {
    patch: { performance_history: { tasks_completed: 1 } },
    reason: 'smoke test',
  });
  assert.equal(self.self_model.performance_history.tasks_completed, 1);

  // semantic search degrades to lexical when Ollama is unreachable
  const sem = await tool('semantic_search', { query: 'staking rewards' });
  assert.equal(sem.mode, 'lexical-fallback');
  assert.ok(sem.results.length >= 1);

  // vault fingerprint is deterministic
  const fp1 = await tool('get_vault_fingerprint');
  const fp2 = await tool('get_vault_fingerprint');
  assert.match(fp1.root, /^0x[0-9a-f]{64}$/);
  assert.equal(fp1.root, fp2.root);
  assert.ok(fp1.notes >= 4);

  // anchor record
  const anchor = await tool('record_anchor', { root: fp1.root, chainId: 137, network: 'polygon', notes: fp1.notes });
  assert.ok(anchor.created);

  // consolidation: plant an old episode, dry-run first, then execute
  const oldEpisode = [
    '---', 'type: "episode"', 'agent: "trading-agent"', 'created: "2026-01-15T10:00:00.000Z"', '---',
    '', '# 2026-01-15 trading-agent aaaa1111', '',
    '## Goal\nRebalance BEZ/USDC pool', '', '## Result\nRebalanced, slippage 0.2%', '',
  ].join('\n');
  await fs.writeFile(path.join(vault, '00-Episodic-Memory', '2026-01-15-trading-agent-aaaa1111.md'), oldEpisode);
  const dry = await tool('consolidate_episodes', { olderThanDays: 30, dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.ok(dry.consolidated >= 1, 'dry-run should plan at least one digest');
  assert.equal(dry.archived, 0);
  const real = await tool('consolidate_episodes', { olderThanDays: 30, dryRun: false });
  assert.ok(real.archived >= 1, 'old episode should be archived');
  const digest = await tool('get_note', { path: '00-Episodic-Memory/consolidated/Digest-2026-01-trading-agent.md' });
  assert.ok(digest.content.includes('Rebalance BEZ/USDC pool'));
  await assert.rejects(tool('get_note', { path: '00-Episodic-Memory/2026-01-15-trading-agent-aaaa1111.md' }), /ENOENT|no such/i);

  // usage telemetry: ingest → summary → tool
  await fetch(`${BASE}/telemetry/usage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events: [
      { source: 'trading-agent', target: 'Obsidian-Brain', fn: 'obsidian:search_vault', tokens: 400 },
      { source: 'trading-agent', target: 'Obsidian-Brain', fn: 'obsidian:search_vault', tokens: 350 },
      { source: 'BeZhas-Pay', target: 'BEZCoinV2-L2', fn: 'l2.sendRawTransaction', bez: 0.05 },
    ] }),
  }).then((r) => r.json());
  const summary = await fetch(`${BASE}/telemetry/summary`).then((r) => r.json());
  assert.ok(summary.totals.calls >= 3, 'telemetry should count events');
  const searchFn = summary.topFunctions.find((f) => f.fn === 'obsidian:search_vault');
  assert.ok(searchFn && searchFn.calls >= 2, 'search_vault usage aggregated');
  const l2Edge = summary.topEdges.find((e) => e.target === 'BEZCoinV2-L2');
  assert.ok(l2Edge && l2Edge.bez > 0, 'L2 token edge tracks BEZ spend');
  const usageTool = await tool('get_usage_stats', { limit: 50 });
  assert.ok(usageTool.topNodes.some((n) => n.name === 'BEZCoinV2-L2'));
  assert.ok(usageTool.totals.bez > 0);
  // reading the graph via the tool endpoint is itself recorded
  const before = (await fetch(`${BASE}/telemetry/summary`).then((r) => r.json())).totals.calls;
  await tool('get_graph');
  const after = (await fetch(`${BASE}/telemetry/summary`).then((r) => r.json())).totals.calls;
  assert.ok(after > before, 'tool calls should be tracked');

  // ingest: raw layer immutable + source note + log entry
  const ingest = await tool('ingest_source', {
    title: 'MiCA Reglamento Resumen',
    summary: 'Resumen del reglamento MiCA aplicable a BEZ-Coin: clasificación de tokens, obligaciones de emisor y gates de volumen KYC.',
    raw_filename: 'mica-resumen.md',
    raw_content: '# MiCA\n\nTexto fuente original inmutable.',
    key_points: ['BEZ es utility token', 'KYC por tramos de volumen'],
    entities: ['Staking Strategy'],
    contradictions: ['La nota Treasury-Policy dice X pero MiCA exige Y'],
    tags: ['compliance'],
  });
  assert.ok(ingest.created && ingest.logged);
  assert.equal(ingest.source_file, 'raw/mica-resumen.md');
  const srcNote = await tool('get_note', { path: ingest.path });
  assert.ok(srcNote.content.includes('⚠️'));
  // raw is write-once
  await assert.rejects(tool('ingest_source', {
    title: 'Dup', summary: 'duplicado de fuente cruda no permitido',
    raw_filename: 'mica-resumen.md', raw_content: 'overwrite attempt',
  }), /EEXIST|file already exists/i);
  // raw layer must NOT be in the graph
  const g2 = await tool('get_graph');
  assert.ok(!g2.nodes.some((n) => n.id.startsWith('07-Sources/raw/')), 'raw layer must stay out of the graph');
  assert.ok(g2.nodes.some((n) => n.id === ingest.path), 'source note must be in the graph');
  // log.md is parseable
  const log = await tool('get_note', { path: 'log.md' });
  assert.ok(/## \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] ingest \| MiCA Reglamento Resumen/.test(log.content));

  // UI is served and wires the telemetry poller
  const ui = await fetch(`${BASE}/ui`).then((r) => r.text());
  assert.ok(ui.includes('BeZhas Brain Console'));
  assert.ok(ui.includes('/telemetry/summary'));

  // path traversal still blocked
  await assert.rejects(tool('get_note', { path: '../secrets.md' }), /Unsafe|escapes/);

  console.log('SMOKE OK — all tools verified');
} catch (error) {
  failed = true;
  console.error('SMOKE FAILED:', error.message);
} finally {
  // graceful stop (Windows kill = TerminateProcess, which trips the chokidar watcher)
  const exited = new Promise((r) => server.on('close', r));
  await fetch(`${BASE}/shutdown`, { method: 'POST' }).catch(() => server.kill());
  await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
  if (server.exitCode === null) server.kill();
  await fs.rm(vault, { recursive: true, force: true }).catch(() => {});
}
process.exit(failed ? 1 : 0);
