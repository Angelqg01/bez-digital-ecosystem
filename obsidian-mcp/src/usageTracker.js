import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Telemetría de uso de la red: cada llamada API/tool se registra como un
 * evento (source → target :: fn) con tokens consumidos y BEZ gastado.
 * El Brain Console lo dibuja en vivo sobre el grafo; los agentes lo leen
 * vía la tool get_usage_stats. Persistencia debounced en .obsidian/.
 */
export class UsageTracker {
  constructor(filePath, { maxRecent = 200 } = {}) {
    this.filePath = filePath;
    this.maxRecent = maxRecent;
    this.edges = new Map(); // "source→target::fn" -> {source,target,fn,calls,tokens,bez,lastTs}
    this.totals = { calls: 0, tokens: 0, bez: 0 };
    this.recent = [];
    this.saveTimer = null;
  }

  async load() {
    try {
      const raw = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.totals = raw.totals || this.totals;
      this.recent = raw.recent || [];
      for (const edge of raw.edges || []) {
        this.edges.set(`${edge.source}→${edge.target}::${edge.fn}`, edge);
      }
    } catch { /* first boot */ }
  }

  record({ source, target, fn, tokens = 0, bez = 0 }) {
    const ts = Date.now();
    const key = `${source}→${target}::${fn}`;
    const edge = this.edges.get(key) || { source, target, fn, calls: 0, tokens: 0, bez: 0, lastTs: 0 };
    edge.calls += 1;
    edge.tokens += tokens;
    edge.bez += bez;
    edge.lastTs = ts;
    this.edges.set(key, edge);
    this.totals.calls += 1;
    this.totals.tokens += tokens;
    this.totals.bez += bez;
    this.recent.push({ ts, source, target, fn, tokens, bez });
    if (this.recent.length > this.maxRecent) this.recent.splice(0, this.recent.length - this.maxRecent);
    this.#scheduleSave();
    return edge;
  }

  #scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(this.filePath, JSON.stringify({
          totals: this.totals,
          recent: this.recent.slice(-this.maxRecent),
          edges: [...this.edges.values()],
          savedAt: new Date().toISOString(),
        }));
      } catch { /* best-effort */ }
    }, 2000);
    this.saveTimer.unref?.();
  }

  summary({ limit = 10 } = {}) {
    const edges = [...this.edges.values()].sort((a, b) => b.calls - a.calls);
    const functions = new Map();
    const nodes = new Map();
    for (const edge of edges) {
      const fnItem = functions.get(edge.fn) || { fn: edge.fn, calls: 0, tokens: 0, bez: 0 };
      fnItem.calls += edge.calls;
      fnItem.tokens += edge.tokens;
      fnItem.bez += edge.bez;
      functions.set(edge.fn, fnItem);
      for (const name of [edge.source, edge.target]) {
        const nodeItem = nodes.get(name) || { name, calls: 0, tokens: 0, bez: 0 };
        nodeItem.calls += edge.calls;
        nodeItem.tokens += edge.tokens;
        nodeItem.bez += edge.bez;
        nodes.set(name, nodeItem);
      }
    }
    return {
      totals: this.totals,
      topEdges: edges.slice(0, Math.max(limit, 20)),
      topFunctions: [...functions.values()].sort((a, b) => b.calls - a.calls).slice(0, limit),
      topNodes: [...nodes.values()].sort((a, b) => b.calls - a.calls).slice(0, limit),
      recent: this.recent.slice(-20).reverse(),
      updatedAt: new Date().toISOString(),
    };
  }
}
