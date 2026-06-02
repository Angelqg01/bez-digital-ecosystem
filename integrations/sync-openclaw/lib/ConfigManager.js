/**
 * ConfigManager.js
 * Motor central de configuración unificada OpenClaw
 *
 * Resolución de config por prioridad (mayor → menor):
 *   1. ENV vars  (OPENCLAW_API_URL, OPENCLAW_ADMIN_TOKEN…)
 *   2. ~/.openclaw/openclaw.json          ← archivo canónico
 *   3. ./openclaw.local.json              ← overrides locales (gitignored)
 *   4. Defaults internos
 *
 * Un único ConfigManager es compartido por BeZhas_Blockchain y BeZhas_web3
 * a través del mismo proceso/backend o via archivo canonico en disco.
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const crypto  = require('crypto');

// ─── Constantes ──────────────────────────────────────────────────────────────
const CANONICAL_DIR  = path.join(os.homedir(), '.openclaw');
const CANONICAL_FILE = path.join(CANONICAL_DIR, 'openclaw.json');
const LOCK_FILE      = path.join(CANONICAL_DIR, 'openclaw.lock');
const BACKUP_DIR     = path.join(CANONICAL_DIR, 'backups');
const LOCAL_OVERRIDE = path.join(process.cwd(), 'openclaw.local.json');

const CONFIG_VERSION = 2;
const LOCK_TIMEOUT   = 5_000;   // ms — evitar escrituras concurrentes

// ─── Defaults del sistema ─────────────────────────────────────────────────────
const SYSTEM_DEFAULTS = {
  version:    CONFIG_VERSION,
  apiUrl:     'http://localhost:3001',
  adminToken: '',
  jwtExpiry:  '24h',
  retryPolicy: {
    maxRetries:    3,
    backoffMs:     500,
    backoffFactor: 2,
  },
  platforms: {
    blockchain: {
      enabled:    true,
      baseUrl:    'http://localhost:3001',
      namespace:  'blockchain',
      healthPath: '/health',
    },
    web3: {
      enabled:    true,
      baseUrl:    'http://localhost:3002',
      namespace:  'web3',
      healthPath: '/health',
    },
  },
  skills: {
    directory:  path.join(CANONICAL_DIR, 'skills'),
    autoReload: false,
    entries: {
      'bezhas-growth': {
        enabled: true,
        config: {
          apiUrl:        'http://localhost:3001',
          defaultSector: 'logistics',
        },
      },
      'sdr-outreach':        { enabled: true, config: {} },
      'solutions-engineer':  { enabled: true, config: {} },
      'deal-bridge':         { enabled: true, config: {} },
    },
  },
  logging: {
    level:      'info',
    file:       path.join(CANONICAL_DIR, 'openclaw.log'),
    maxSizeMb:  10,
  },
};

// ─── Clase ConfigManager (Singleton) ─────────────────────────────────────────
class ConfigManager {
  constructor() {
    this._config    = null;
    this._watchers  = new Map();   // onChange callbacks
    this._fsWatcher = null;
    this._dirty     = false;
    this._saveTimer = null;
  }

  // ── Inicialización ──────────────────────────────────────────────────────────
  /**
   * Carga y resuelve la configuración completa.
   * Seguro llamar múltiples veces — cachea tras la primera carga.
   */
  async load(forceReload = false) {
    if (this._config && !forceReload) return this._config;

    await fs.promises.mkdir(CANONICAL_DIR, { recursive: true });
    await fs.promises.mkdir(BACKUP_DIR,    { recursive: true });

    const layers = await Promise.all([
      this._readFileLayer(CANONICAL_FILE),
      this._readFileLayer(LOCAL_OVERRIDE),
      this._readEnvLayer(),
    ]);

    this._config = this._deepMerge(
      SYSTEM_DEFAULTS,
      layers[0],   // canonical
      layers[1],   // local override
      layers[2],   // env vars
    );

    this._validate(this._config);
    this._normalizeSkillUrls(this._config);

    return this._config;
  }

  // ── Acceso ──────────────────────────────────────────────────────────────────
  get(keyPath, fallback = undefined) {
    if (!this._config) throw new Error('ConfigManager: llama a load() primero');
    return keyPath.split('.').reduce((obj, key) => obj?.[key], this._config) ?? fallback;
  }

  getAll() {
    if (!this._config) throw new Error('ConfigManager: llama a load() primero');
    return structuredClone(this._config);
  }

  /** Devuelve la config sanitizada (sin token JWT) para logs/debug */
  getSafe() {
    const c = this.getAll();
    if (c.adminToken) c.adminToken = `${c.adminToken.slice(0, 8)}…[REDACTED]`;
    return c;
  }

  // ── Mutación ────────────────────────────────────────────────────────────────
  /**
   * Actualiza un valor y encola escritura a disco (debounced 300ms).
   * @param {string}  keyPath  - e.g. 'skills.entries.bezhas-growth.enabled'
   * @param {*}       value
   * @param {boolean} persist  - false → sólo en memoria
   */
  set(keyPath, value, persist = true) {
    if (!this._config) throw new Error('ConfigManager: llama a load() primero');

    const keys = keyPath.split('.');
    let target = this._config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (target[keys[i]] === undefined) target[keys[i]] = {};
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;

    if (persist) {
      this._dirty = true;
      this._debouncedSave();
    }

    this._notify('change', keyPath, value);
  }

  // ── Persistencia ────────────────────────────────────────────────────────────
  async save() {
    if (!this._config) return;

    const acquiredLock = await this._acquireLock();
    if (!acquiredLock) throw new Error('OpenClaw config bloqueada por otro proceso');

    try {
      // Backup previo
      if (fs.existsSync(CANONICAL_FILE)) {
        const stamp  = new Date().toISOString().replace(/[:.]/g, '-');
        const backup = path.join(BACKUP_DIR, `openclaw.${stamp}.json`);
        await fs.promises.copyFile(CANONICAL_FILE, backup);
        await this._pruneBackups(10);   // conservar últimos 10
      }

      const toWrite = structuredClone(this._config);
      toWrite._savedAt = new Date().toISOString();
      toWrite._checksum = this._checksum(toWrite);

      await fs.promises.writeFile(
        CANONICAL_FILE,
        JSON.stringify(toWrite, null, 2),
        'utf8',
      );

      this._dirty = false;
    } finally {
      await this._releaseLock();
    }
  }

  // ── Watch en tiempo real ────────────────────────────────────────────────────
  watchFile(callback) {
    if (this._fsWatcher) return;     // ya activo

    this._fsWatcher = fs.watch(CANONICAL_DIR, { persistent: false }, async (event, filename) => {
      if (filename !== 'openclaw.json') return;
      try {
        await this.load(true);
        callback('reload', this._config);
      } catch (err) {
        callback('error', err);
      }
    });
  }

  stopWatch() {
    this._fsWatcher?.close();
    this._fsWatcher = null;
  }

  // ── Event bus interno ───────────────────────────────────────────────────────
  on(event, id, callback) {
    if (!this._watchers.has(event)) this._watchers.set(event, new Map());
    this._watchers.get(event).set(id, callback);
  }

  off(event, id) {
    this._watchers.get(event)?.delete(id);
  }

  _notify(event, ...args) {
    this._watchers.get(event)?.forEach(cb => {
      try { cb(...args); } catch { /* ignorar errores de watchers */ }
    });
  }

  // ── Skill helpers ───────────────────────────────────────────────────────────
  getSkill(skillName) {
    return this.get(`skills.entries.${skillName}`);
  }

  setSkillEnabled(skillName, enabled) {
    this.set(`skills.entries.${skillName}.enabled`, enabled);
  }

  getEnabledSkills() {
    const entries = this.get('skills.entries', {});
    return Object.entries(entries)
      .filter(([, cfg]) => cfg.enabled !== false)
      .map(([name, cfg]) => ({ name, ...cfg }));
  }

  // ── Platform helpers ────────────────────────────────────────────────────────
  getPlatformConfig(name) {
    return this.get(`platforms.${name}`);
  }

  getUnifiedApiUrl() {
    // La fuente de verdad del apiUrl es siempre platforms.blockchain.baseUrl
    return this.get('platforms.blockchain.baseUrl') || this.get('apiUrl');
  }

  getAdminToken() {
    return this.get('adminToken');
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  async _readFileLayer(filePath) {
    try {
      const raw  = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      this._verifyChecksum(parsed);
      return parsed;
    } catch (err) {
      if (err.code === 'ENOENT') return {};
      if (err.code === 'CHECKSUM_MISMATCH') {
        console.warn(`[ConfigManager] ⚠ Checksum inválido en ${filePath} — usando como está`);
        try { return JSON.parse(await fs.promises.readFile(filePath, 'utf8')); }
        catch { return {}; }
      }
      throw err;
    }
  }

  _readEnvLayer() {
    const env = {};
    if (process.env.OPENCLAW_API_URL)     env.apiUrl     = process.env.OPENCLAW_API_URL;
    if (process.env.OPENCLAW_ADMIN_TOKEN) env.adminToken = process.env.OPENCLAW_ADMIN_TOKEN;
    if (process.env.OPENCLAW_LOG_LEVEL)   env.logging    = { level: process.env.OPENCLAW_LOG_LEVEL };

    if (process.env.OPENCLAW_BLOCKCHAIN_URL) {
      env.platforms = { blockchain: { baseUrl: process.env.OPENCLAW_BLOCKCHAIN_URL } };
    }
    if (process.env.OPENCLAW_WEB3_URL) {
      env.platforms = env.platforms || {};
      env.platforms.web3 = { baseUrl: process.env.OPENCLAW_WEB3_URL };
    }
    return env;
  }

  _deepMerge(...sources) {
    const output = {};
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const [key, val] of Object.entries(src)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          output[key] = this._deepMerge(output[key] || {}, val);
        } else if (val !== undefined && val !== null && val !== '') {
          output[key] = val;
        }
      }
    }
    return output;
  }

  _validate(config) {
    const errors = [];
    if (!config.apiUrl)     errors.push('apiUrl es requerido');
    if (!config.adminToken) {
      console.warn('[ConfigManager] ⚠ adminToken vacío — configura OPENCLAW_ADMIN_TOKEN');
    }
    if (errors.length) throw new Error(`ConfigManager validación: ${errors.join(', ')}`);
  }

  /** Propaga el apiUrl canónico a todos los skills que no tienen apiUrl propio */
  _normalizeSkillUrls(config) {
    const canonical = config.platforms?.blockchain?.baseUrl || config.apiUrl;
    const entries   = config.skills?.entries || {};
    for (const [, skill] of Object.entries(entries)) {
      if (skill.config && !skill.config.apiUrl) {
        skill.config.apiUrl = canonical;
      }
    }
  }

  _checksum(obj) {
    const { _checksum: _c, ...rest } = obj;
    return crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 16);
  }

  _verifyChecksum(obj) {
    if (!obj._checksum) return;
    const expected = this._checksum(obj);
    if (expected !== obj._checksum) {
      const err = new Error('Checksum mismatch');
      err.code  = 'CHECKSUM_MISMATCH';
      throw err;
    }
  }

  _debouncedSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save().catch(console.error), 300);
  }

  async _acquireLock() {
    const start = Date.now();
    while (fs.existsSync(LOCK_FILE)) {
      if (Date.now() - start > LOCK_TIMEOUT) return false;
      await new Promise(r => setTimeout(r, 50));
    }
    await fs.promises.writeFile(LOCK_FILE, String(process.pid));
    return true;
  }

  async _releaseLock() {
    await fs.promises.unlink(LOCK_FILE).catch(() => {});
  }

  async _pruneBackups(keep) {
    const files = (await fs.promises.readdir(BACKUP_DIR))
      .filter(f => f.startsWith('openclaw.') && f.endsWith('.json'))
      .sort()
      .reverse();
    for (const old of files.slice(keep)) {
      await fs.promises.unlink(path.join(BACKUP_DIR, old)).catch(() => {});
    }
  }
}

// Singleton compartido por todo el proceso
const instance = new ConfigManager();

module.exports = instance;
module.exports.ConfigManager = ConfigManager;   // para tests unitarios
