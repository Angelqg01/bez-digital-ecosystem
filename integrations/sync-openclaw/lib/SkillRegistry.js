/**
 * SkillRegistry.js
 * Registro centralizado de skills OpenClaw
 *
 * - Carga skills desde el directorio canónico (~/.openclaw/skills/)
 * - Sincroniza skills desde BeZhas_Blockchain y BeZhas_web3
 * - Valida manifests de cada skill
 * - Hot-reload opcional en modo desarrollo
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const config = require('./ConfigManager');

const CANONICAL_SKILLS_DIR  = path.join(os.homedir(), '.openclaw', 'skills');
const REQUIRED_MANIFEST_KEYS = ['name', 'version', 'entry'];

// ─── Plataformas fuente de skills ─────────────────────────────────────────────
const SKILL_SOURCES = {
  blockchain: {
    label:    'BeZhas_Blockchain',
    resolve:  () => path.join(
      process.env.BEZHAS_BLOCKCHAIN_PATH ||
      path.join(os.homedir(), 'BeZhas', 'BeZhas Blockchain'),
      'openclaw-skills',
    ),
  },
  web3: {
    label:   'BeZhas_web3',
    resolve: () => path.join(
      process.env.BEZHAS_WEB3_PATH ||
      path.join(os.homedir(), 'BeZhas', 'BeZhas Web', 'bezhas-web3'),
      'src', 'openclaw-skills',
    ),
  },
};

// ─── Clase SkillRegistry ──────────────────────────────────────────────────────
class SkillRegistry {
  constructor() {
    this._skills    = new Map();    // name → { manifest, entryPath, source }
    this._loaded    = false;
    this._watcher   = null;
  }

  // ── Carga completa ──────────────────────────────────────────────────────────
  async load() {
    await config.load();
    await fs.promises.mkdir(CANONICAL_SKILLS_DIR, { recursive: true });

    // 1. Sincronizar desde las plataformas fuente → directorio canónico
    await this._syncFromSources();

    // 2. Cargar desde el directorio canónico
    await this._loadFromDirectory(CANONICAL_SKILLS_DIR, 'canonical');

    // 3. Aplicar estado habilitado/deshabilitado desde la config
    this._applyConfigState();

    this._loaded = true;
    console.log(`[SkillRegistry] ✓ ${this._skills.size} skills cargados`);
    return this.getAll();
  }

  // ── Registro manual ─────────────────────────────────────────────────────────
  register(name, definition) {
    this._validateManifest({ name, ...definition });
    this._skills.set(name, {
      name,
      ...definition,
      _source:     'manual',
      _loadedAt:   new Date().toISOString(),
    });
  }

  // ── Consulta ────────────────────────────────────────────────────────────────
  get(name) {
    return this._skills.get(name);
  }

  getAll() {
    return Object.fromEntries(this._skills);
  }

  getEnabled() {
    return [...this._skills.values()].filter(s => s.enabled !== false);
  }

  has(name) {
    return this._skills.has(name);
  }

  // ── Estado ──────────────────────────────────────────────────────────────────
  enable(name)  { this._setEnabled(name, true); }
  disable(name) { this._setEnabled(name, false); }

  _setEnabled(name, enabled) {
    const skill = this._skills.get(name);
    if (!skill) throw new Error(`Skill no encontrado: ${name}`);
    skill.enabled = enabled;
    config.set(`skills.entries.${name}.enabled`, enabled);
  }

  // ── Serialización para OpenClaw ─────────────────────────────────────────────
  toOpenClawConfig() {
    const entries = {};
    for (const [name, skill] of this._skills) {
      entries[name] = {
        enabled: skill.enabled !== false,
        config:  skill.config || {},
      };
      // Asegurar que el apiUrl apunta siempre al backend unificado
      if (!entries[name].config.apiUrl) {
        entries[name].config.apiUrl = config.getUnifiedApiUrl();
      }
    }
    return { entries };
  }

  // ── Sync desde fuentes ──────────────────────────────────────────────────────
  async _syncFromSources() {
    const results = { synced: 0, skipped: 0, errors: [] };

    for (const [platform, source] of Object.entries(SKILL_SOURCES)) {
      const srcDir = source.resolve();

      if (!fs.existsSync(srcDir)) {
        console.warn(`[SkillRegistry] ⚠ Directorio ${source.label} no encontrado: ${srcDir}`);
        continue;
      }

      let entries;
      try {
        entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
      } catch { continue; }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillSrc  = path.join(srcDir, entry.name);
        const skillDest = path.join(CANONICAL_SKILLS_DIR, entry.name);

        try {
          const synced = await this._syncSkillDir(skillSrc, skillDest, platform);
          if (synced) results.synced++;
          else results.skipped++;
        } catch (err) {
          results.errors.push({ skill: entry.name, error: err.message });
          console.error(`[SkillRegistry] ✗ Error sincronizando ${entry.name}:`, err.message);
        }
      }
    }

    if (results.errors.length) {
      console.warn(`[SkillRegistry] Sync completado con ${results.errors.length} errores`);
    } else {
      console.log(`[SkillRegistry] Sync: ${results.synced} skills copiados, ${results.skipped} sin cambios`);
    }
  }

  async _syncSkillDir(src, dest, platform) {
    const manifestSrc = path.join(src, 'manifest.json');
    if (!fs.existsSync(manifestSrc)) {
      console.warn(`[SkillRegistry] ⚠ Sin manifest.json en ${src} — omitido`);
      return false;
    }

    const manifest = JSON.parse(await fs.promises.readFile(manifestSrc, 'utf8'));
    this._validateManifest(manifest);

    // Evitar sobreescritura si mismo hash
    const destManifest = path.join(dest, 'manifest.json');
    if (fs.existsSync(destManifest)) {
      const existing = JSON.parse(await fs.promises.readFile(destManifest, 'utf8'));
      if (existing.version === manifest.version && existing._sourcePlatform === platform) {
        return false;   // sin cambios
      }
    }

    await fs.promises.mkdir(dest, { recursive: true });
    await this._copyDir(src, dest);

    // Marcar origen
    manifest._sourcePlatform = platform;
    manifest._syncedAt       = new Date().toISOString();
    await fs.promises.writeFile(destManifest, JSON.stringify(manifest, null, 2));

    return true;
  }

  async _copyDir(src, dest) {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath  = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true });
        await this._copyDir(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  async _loadFromDirectory(dir, source) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir      = path.join(dir, entry.name);
      const manifestPath  = path.join(skillDir, 'manifest.json');
      const indexPath     = path.join(skillDir, 'index.js');

      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest  = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
        this._validateManifest(manifest);

        const entryFile = path.join(skillDir, manifest.entry || 'index.js');

        this._skills.set(manifest.name, {
          ...manifest,
          enabled:   true,
          entryPath: entryFile,
          _source:   source,
          _dir:      skillDir,
          _loadedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`[SkillRegistry] ✗ Error cargando ${entry.name}:`, err.message);
      }
    }
  }

  _applyConfigState() {
    const entries = config.get('skills.entries', {});
    for (const [name, cfg] of Object.entries(entries)) {
      const skill = this._skills.get(name);
      if (skill) {
        skill.enabled = cfg.enabled !== false;
        skill.config  = { ...(skill.config || {}), ...(cfg.config || {}) };
        // Normalizar apiUrl al backend unificado
        if (!skill.config.apiUrl) skill.config.apiUrl = config.getUnifiedApiUrl();
      } else if (cfg.enabled !== false) {
        // Skill en config pero sin directorio — stub
        this._skills.set(name, {
          name,
          version:  '0.0.0',
          enabled:  cfg.enabled !== false,
          config:   { apiUrl: config.getUnifiedApiUrl(), ...(cfg.config || {}) },
          _source:  'config-only',
          _stub:    true,
          _loadedAt: new Date().toISOString(),
        });
      }
    }
  }

  _validateManifest(manifest) {
    for (const key of REQUIRED_MANIFEST_KEYS) {
      if (!manifest[key]) throw new Error(`Manifest inválido: falta '${key}'`);
    }
  }

  // ── Hot-reload ──────────────────────────────────────────────────────────────
  watchSkills() {
    if (this._watcher) return;
    this._watcher = fs.watch(CANONICAL_SKILLS_DIR, { recursive: true }, async (event, filename) => {
      if (!filename?.endsWith('manifest.json')) return;
      console.log(`[SkillRegistry] 🔄 Cambio detectado en skills, recargando...`);
      await this.load();
    });
  }

  stopWatch() {
    this._watcher?.close();
    this._watcher = null;
  }
}

module.exports = new SkillRegistry();
module.exports.SkillRegistry = SkillRegistry;
