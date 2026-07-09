import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import matter from 'gray-matter';

const EPISODE_FOLDER = '00-Episodic-Memory';
const CONSOLIDATED_DIR = path.join(EPISODE_FOLDER, 'consolidated');
const ARCHIVE_DIR = path.join(EPISODE_FOLDER, 'archive');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * log.md: registro cronológico append-only del wiki. Prefijo uniforme
 * `## [fecha] op | título` — parseable con grep/Select-String.
 */
export async function appendLog(vaultRoot, op, title, detail = '') {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const entry = `## [${stamp}] ${op} | ${title}\n${detail ? `${detail}\n` : ''}\n`;
  await fs.appendFile(path.join(vaultRoot, 'log.md'), entry);
}

function extractSection(body, heading) {
  const match = body.match(new RegExp(`##\\s*${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i'));
  return match ? match[1].trim().replace(/\s+/g, ' ').slice(0, 240) : '';
}

function episodeDate(frontmatterData, fileName) {
  const created = frontmatterData.created ? new Date(frontmatterData.created) : null;
  if (created && !Number.isNaN(created.getTime())) return created;
  const fromName = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
  if (fromName) return new Date(fromName[1]);
  return null;
}

/**
 * "Sleep" for the episodic memory: episodes older than the cutoff are
 * summarized into one digest per agent+month and the originals moved to
 * archive/. Digests keep [[links]] to every archived episode so the graph
 * stays navigable while 00-Episodic-Memory stays small.
 */
export async function consolidateEpisodes(vaultRoot, { olderThanDays = 30, dryRun = true } = {}) {
  const episodesAbs = path.join(vaultRoot, EPISODE_FOLDER);
  const cutoff = Date.now() - olderThanDays * 86_400_000;
  let files = [];
  try {
    files = (await fs.readdir(episodesAbs, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name);
  } catch {
    return { consolidated: 0, archived: 0, digests: [], dryRun };
  }

  const groups = new Map(); // `${agent}|${yyyy-mm}` -> [{file, date, goal, result}]
  for (const fileName of files) {
    const absolute = path.join(episodesAbs, fileName);
    const raw = await fs.readFile(absolute, 'utf8');
    const parsed = matter(raw);
    if ((parsed.data.type || 'episode') !== 'episode') continue;
    const date = episodeDate(parsed.data, fileName);
    if (!date || date.getTime() > cutoff) continue;
    const agent = parsed.data.agent || 'unknown-agent';
    const month = date.toISOString().slice(0, 7);
    const key = `${agent}|${month}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      file: fileName,
      date: date.toISOString().slice(0, 10),
      goal: extractSection(parsed.content, 'Goal'),
      result: extractSection(parsed.content, 'Result'),
    });
  }

  const digests = [];
  let archived = 0;
  for (const [key, episodes] of groups) {
    const [agent, month] = key.split('|');
    episodes.sort((a, b) => a.date.localeCompare(b.date));
    const digestName = `Digest-${month}-${agent}.md`;
    const digestRel = path.join(CONSOLIDATED_DIR, digestName).replaceAll(path.sep, '/');
    digests.push({ path: digestRel, agent, month, episodes: episodes.length });
    if (dryRun) continue;

    const archiveMonthAbs = path.join(vaultRoot, ARCHIVE_DIR, month);
    await fs.mkdir(archiveMonthAbs, { recursive: true });
    await fs.mkdir(path.join(vaultRoot, CONSOLIDATED_DIR), { recursive: true });

    const lines = episodes.map((ep) => [
      `### ${ep.date} — [[${ep.file.replace(/\.md$/, '')}]]`,
      ep.goal ? `- **Goal:** ${ep.goal}` : null,
      ep.result ? `- **Result:** ${ep.result}` : null,
    ].filter(Boolean).join('\n'));
    const body = [
      '---',
      'type: digest',
      `agent: "${agent}"`,
      `month: "${month}"`,
      `episodes: ${episodes.length}`,
      `created: "${new Date().toISOString()}"`,
      'tags: ["memory", "consolidated"]',
      '---',
      '',
      `# Digest ${month} — ${agent}`,
      '',
      `${episodes.length} episodios consolidados. Originales en \`${ARCHIVE_DIR.replaceAll(path.sep, '/')}/${month}/\`.`,
      '',
      ...lines,
      '',
    ].join('\n');
    await fs.writeFile(path.join(vaultRoot, digestRel), body);
    for (const ep of episodes) {
      await fs.rename(path.join(episodesAbs, ep.file), path.join(archiveMonthAbs, ep.file));
      archived += 1;
    }
  }

  return { consolidated: digests.length, archived, digests, dryRun, olderThanDays };
}

/**
 * Deterministic fingerprint of the whole vault: sha256 leaf per note
 * (path + content), merkle-folded to a single root. The blockchain-agent
 * can publish the root on-chain (QualityOracle) for immutable audit.
 */
export async function vaultFingerprint(vaultRoot, notePaths) {
  const sorted = [...notePaths].sort();
  const leaves = [];
  for (const relPath of sorted) {
    const content = await fs.readFile(path.join(vaultRoot, relPath));
    leaves.push(sha256(Buffer.concat([Buffer.from(`${relPath}\0`), content])));
  }
  let level = leaves.length ? [...leaves] : [sha256('empty-vault')];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? sha256(level[i] + level[i + 1]) : level[i]);
    }
    level = next;
  }
  return {
    algorithm: 'sha256-merkle',
    root: `0x${level[0]}`,
    notes: sorted.length,
    computedAt: new Date().toISOString(),
    anchorPayload: { root: `0x${level[0]}`, count: sorted.length, source: 'bezhas-obsidian-vault' },
  };
}
