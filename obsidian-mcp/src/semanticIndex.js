import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Semantic layer over the VaultIndex: embeddings via Ollama (local, free),
 * cosine similarity in memory, vectors cached on disk so notes are only
 * re-embedded when their content changes. If Ollama is unreachable the
 * caller falls back to lexical search — the Brain never hard-depends on it.
 */
export class SemanticIndex {
  constructor(vaultIndex, {
    ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434',
    model = process.env.EMBEDDINGS_MODEL || 'nomic-embed-text',
    cacheDir = null,
    timeoutMs = 8000,
  } = {}) {
    this.vaultIndex = vaultIndex;
    this.ollamaHost = ollamaHost.replace(/\/$/, '');
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.cachePath = path.join(cacheDir || path.join(vaultIndex.vaultRoot, '.obsidian'), 'bezhas-embeddings.json');
    this.vectors = new Map(); // relPath -> { hash, vector }
    this.loaded = false;
  }

  contentHash(entry) {
    return crypto.createHash('sha256').update(entry.searchText).digest('hex').slice(0, 16);
  }

  async loadCache() {
    if (this.loaded) return;
    try {
      const raw = JSON.parse(await fs.readFile(this.cachePath, 'utf8'));
      if (raw.model === this.model) {
        for (const [notePath, item] of Object.entries(raw.entries || {})) {
          this.vectors.set(notePath, item);
        }
      }
    } catch { /* no cache yet */ }
    this.loaded = true;
  }

  async saveCache() {
    await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
    await fs.writeFile(this.cachePath, JSON.stringify({
      model: this.model,
      updatedAt: new Date().toISOString(),
      entries: Object.fromEntries(this.vectors),
    }));
  }

  async embed(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.ollamaHost}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text.slice(0, 8000) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Ollama embeddings HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json.embedding) || !json.embedding.length) {
        throw new Error('Ollama returned empty embedding');
      }
      return json.embedding;
    } finally {
      clearTimeout(timer);
    }
  }

  async isReachable() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${this.ollamaHost}/api/tags`, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Embed every stale/missing note (bounded concurrency), prune deleted ones. */
  async sync() {
    await this.loadCache();
    const entries = [...this.vaultIndex.notes.values()];
    const alive = new Set(entries.map((entry) => entry.path));
    for (const notePath of this.vectors.keys()) {
      if (!alive.has(notePath)) this.vectors.delete(notePath);
    }
    const stale = entries.filter((entry) => this.vectors.get(entry.path)?.hash !== this.contentHash(entry));
    const CONCURRENCY = 4;
    let embedded = 0;
    for (let i = 0; i < stale.length; i += CONCURRENCY) {
      const batch = stale.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (entry) => {
        const vector = await this.embed(`${entry.title}\n${entry.tags.join(' ')}\n${entry.preview}\n${entry.searchText.slice(0, 4000)}`);
        this.vectors.set(entry.path, { hash: this.contentHash(entry), vector });
        embedded += 1;
      }));
    }
    if (embedded > 0) await this.saveCache();
    return { embedded, total: this.vectors.size };
  }

  static cosine(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  async search(query, { limit = 10, minScore = 0.35 } = {}) {
    const { embedded } = await this.sync();
    const queryVector = await this.embed(query);
    const scored = [];
    for (const [notePath, item] of this.vectors) {
      const entry = this.vaultIndex.notes.get(notePath);
      if (!entry) continue;
      const score = SemanticIndex.cosine(queryVector, item.vector);
      if (score >= minScore) {
        scored.push({ ...this.vaultIndex.summaryOf(entry), score: Number(score.toFixed(4)) });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, limit), embedded, model: this.model };
  }
}
