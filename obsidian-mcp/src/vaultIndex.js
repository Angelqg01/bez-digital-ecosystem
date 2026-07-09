import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export const NOTE_RE = /\.(md|canvas|json)$/i;

const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
const MD_LINK_RE = /\[[^\]]+\]\(([^)]+\.md)\)/g;

export function extractLinks(content) {
  // wiki syntax inside code (fenced or inline) is documentation, not a link
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const links = new Set();
  for (const match of withoutCode.matchAll(WIKI_LINK_RE)) links.add(match[1].trim());
  for (const match of withoutCode.matchAll(MD_LINK_RE)) links.add(path.basename(match[1], '.md'));
  return [...links];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(haystack, term) {
  return haystack.match(new RegExp(escapeRegExp(term), 'g'))?.length || 0;
}

// create_note slugifies titles (spaces -> dashes), so a wiki link written as
// [[Treasury Policy]] must still resolve to Treasury-Policy.md. Links may also
// carry the extension ([[Foo.canvas]]) while note titles never do.
export function normalizeLinkKey(value) {
  return String(value).toLowerCase().trim().replace(NOTE_RE, '').replace(/\s+/g, '-');
}

function normalizeTags(raw) {
  if (Array.isArray(raw)) return raw.map((tag) => String(tag).toLowerCase());
  if (typeof raw === 'string') return raw.split(/[,\s]+/).filter(Boolean).map((tag) => tag.toLowerCase());
  return [];
}

/**
 * In-memory index of the vault. All read tools (search, backlinks, graph,
 * tags, recency) are served from here instead of re-reading the vault from
 * disk on every request. Mutations go through refreshFile()/removeFile(),
 * driven by the write handlers and the filesystem watcher.
 */
export class VaultIndex {
  constructor(vaultRoot, { maxBytes = 512_000 } = {}) {
    this.vaultRoot = vaultRoot;
    this.maxBytes = maxBytes;
    this.notes = new Map(); // relPath -> entry
    this.backlinks = new Map(); // lowercased target title -> Set<relPath>
    this.titleToPath = new Map(); // lowercased title -> relPath
    this.builtAt = null;
  }

  toRelative(absolute) {
    return path.relative(this.vaultRoot, absolute).replaceAll(path.sep, '/');
  }

  async build() {
    this.notes.clear();
    const files = await this.#walk(this.vaultRoot);
    await Promise.all(files.map((absolute) => this.#indexFile(absolute).catch(() => {})));
    this.#rebuildGraph();
    this.builtAt = new Date().toISOString();
  }

  async #walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.obsidian' || entry.name === '.trash') continue;
        // 07-Sources/raw es la capa inmutable de fuentes: se lee, no se indexa
        if (this.toRelative(absolute) === '07-Sources/raw') continue;
        files.push(...await this.#walk(absolute));
      } else if (NOTE_RE.test(entry.name)) {
        files.push(absolute);
      }
    }
    return files;
  }

  async #indexFile(absolute) {
    const stat = await fs.stat(absolute);
    if (stat.size > this.maxBytes) return;
    const raw = await fs.readFile(absolute, 'utf8');
    const relPath = this.toRelative(absolute);
    const title = path.basename(absolute).replace(NOTE_RE, '');
    const isMarkdown = absolute.toLowerCase().endsWith('.md');

    let frontmatter = {};
    let body = raw;
    if (isMarkdown) {
      try {
        const parsed = matter(raw);
        frontmatter = parsed.data || {};
        body = parsed.content;
      } catch {
        // malformed frontmatter: index the raw content
      }
    }

    const tags = normalizeTags(frontmatter.tags);
    this.notes.set(relPath, {
      path: relPath,
      title,
      folder: relPath.includes('/') ? relPath.slice(0, relPath.indexOf('/')) : '',
      mtimeMs: stat.mtimeMs,
      bytes: Buffer.byteLength(raw),
      links: extractLinks(raw),
      tags,
      type: frontmatter.type || null,
      summary: frontmatter.summary || '',
      preview: body.trim().slice(0, 300),
      searchTitle: title.toLowerCase(),
      searchText: `${title}\n${tags.join(' ')}\n${frontmatter.summary || ''}\n${body}`.toLowerCase(),
    });
  }

  #rebuildGraph() {
    this.backlinks.clear();
    this.titleToPath.clear();
    for (const entry of this.notes.values()) {
      const key = normalizeLinkKey(entry.title);
      if (!this.titleToPath.has(key)) {
        this.titleToPath.set(key, entry.path);
      }
    }
    for (const entry of this.notes.values()) {
      for (const link of entry.links) {
        const key = normalizeLinkKey(link);
        if (!this.backlinks.has(key)) this.backlinks.set(key, new Set());
        this.backlinks.get(key).add(entry.path);
      }
    }
  }

  async refreshFile(absolute) {
    if (!NOTE_RE.test(absolute)) return;
    // la capa cruda tampoco entra por el watcher ni por escrituras directas
    if (this.toRelative(absolute).startsWith('07-Sources/raw/')) return;
    try {
      await this.#indexFile(absolute);
    } catch {
      this.notes.delete(this.toRelative(absolute));
    }
    this.#rebuildGraph();
  }

  removeFile(absolute) {
    this.notes.delete(this.toRelative(absolute));
    this.#rebuildGraph();
  }

  summaryOf(entry) {
    return {
      path: entry.path,
      title: entry.title,
      links: entry.links,
      tags: entry.tags,
      bytes: entry.bytes,
      preview: entry.preview,
    };
  }

  list(limit = 100) {
    return [...this.notes.values()].slice(0, limit).map((entry) => this.summaryOf(entry));
  }

  /**
   * Weighted search: title hits x8, tag hits x4, summary hits x2, body x1,
   * exact-phrase bonus +6. Optional folder/tags filters narrow the scope.
   */
  search(query, { limit = 10, folder = null, tags = null } = {}) {
    const lowered = query.toLowerCase();
    const terms = lowered.split(/\s+/).filter(Boolean);
    const wantedTags = normalizeTags(tags);
    const scored = [];
    for (const entry of this.notes.values()) {
      if (folder && entry.folder !== folder) continue;
      if (wantedTags.length && !wantedTags.every((tag) => entry.tags.includes(tag))) continue;
      let score = 0;
      for (const term of terms) {
        score += countOccurrences(entry.searchTitle, term) * 8;
        score += entry.tags.reduce((acc, tag) => acc + countOccurrences(tag, term), 0) * 4;
        score += countOccurrences(entry.summary.toLowerCase(), term) * 2;
        score += countOccurrences(entry.searchText, term);
      }
      if (terms.length > 1 && entry.searchText.includes(lowered)) score += 6;
      if (score > 0) scored.push({ ...this.summaryOf(entry), score });
    }
    scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    return scored.slice(0, limit);
  }

  related(relPath, limit = 20) {
    const entry = this.notes.get(relPath);
    if (!entry) throw new Error(`Note not indexed: ${relPath}`);
    const incomingPaths = this.backlinks.get(normalizeLinkKey(entry.title)) || new Set();
    const incoming = [...incomingPaths]
      .filter((source) => source !== relPath)
      .map((source) => this.notes.get(source))
      .filter(Boolean)
      .slice(0, limit)
      .map((item) => this.summaryOf(item));
    return { outgoing: entry.links, incoming };
  }

  recent(limit = 10, folder = null) {
    return [...this.notes.values()]
      .filter((entry) => !folder || entry.folder === folder)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit)
      .map((entry) => this.summaryOf(entry));
  }

  tags() {
    const counts = new Map();
    for (const entry of this.notes.values()) {
      for (const tag of entry.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }

  graph() {
    const nodes = [...this.notes.values()].map((entry) => ({
      id: entry.path,
      title: entry.title,
      folder: entry.folder,
      type: entry.type,
      tags: entry.tags,
    }));
    const edges = [];
    for (const entry of this.notes.values()) {
      for (const link of entry.links) {
        const target = this.titleToPath.get(normalizeLinkKey(link));
        if (target && target !== entry.path) {
          edges.push({ from: entry.path, to: target });
        }
      }
    }
    const orphans = nodes
      .filter((node) => !edges.some((edge) => edge.from === node.id || edge.to === node.id))
      .map((node) => node.id);
    return { nodes, edges, orphans };
  }

  stats() {
    let bytes = 0;
    const folders = new Map();
    for (const entry of this.notes.values()) {
      bytes += entry.bytes;
      folders.set(entry.folder, (folders.get(entry.folder) || 0) + 1);
    }
    return {
      notes: this.notes.size,
      bytes,
      folders: Object.fromEntries(folders),
      builtAt: this.builtAt,
    };
  }
}
