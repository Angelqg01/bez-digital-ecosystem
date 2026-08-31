'use strict';

const fs = require('fs');
const path = require('path');
// node:sqlite viene incluido en Node ≥22.5 (API síncrona, sin dependencias).
// Aviso "experimental" esperado: la API es estable para nuestro uso (CRUD básico).
const { DatabaseSync } = require('node:sqlite');

/**
 * SqliteStore — base de datos interna embebida (fichero local).
 *
 * Cumple el mismo contrato Store que InMemoryStore/PostgresStore y añade la
 * persistencia de plataforma que hace al SaaS sobrevivir a reinicios:
 * tenants aprovisionados y hashes de claves de API.
 *
 * Es el punto medio del despliegue: sin infraestructura (como InMemory) pero
 * durable (como Postgres). Ideal para desarrollo, demos y la app instalable
 * del stack soberano. En producción multi-nodo → PostgresStore.
 */
class SqliteStore {
  constructor({ filePath } = {}) {
    if (!filePath) throw new Error('SqliteStore: filePath requerido');
    this.filePath = filePath;
    this.db = null;
  }

  async connect() {
    if (this.db) return true;            // idempotente
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.db = new DatabaseSync(this.filePath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this._createTables();
    this._migrate();
    return true;
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        event TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        ts TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log (tenant_id, id);

      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        agent_id TEXT,
        summary TEXT,
        outcome TEXT,
        embedding TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inter_tenant ON interactions (tenant_id, agent_id, id);

      CREATE TABLE IF NOT EXISTS facts (
        tenant_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (tenant_id, key)
      );

      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        plan TEXT NOT NULL,
        departments TEXT NOT NULL DEFAULT '[]',
        business_id TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        tenant_id TEXT PRIMARY KEY,
        key_hash TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        type TEXT,
        department TEXT,
        payload TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        error TEXT,
        result TEXT,
        created_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks (tenant_id, created_at);

      CREATE TABLE IF NOT EXISTS approvals (
        approval_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        agent_id TEXT,
        action TEXT NOT NULL DEFAULT '{}',
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        resolved_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_appr_tenant ON approvals (tenant_id, status);
    `);
  }

  /** Migraciones idempotentes para bases de datos creadas por versiones previas. */
  _migrate() {
    const cols = this.db.prepare('PRAGMA table_info(tenants)').all().map((c) => c.name);
    if (!cols.includes('business_id')) {
      this.db.exec('ALTER TABLE tenants ADD COLUMN business_id TEXT');
    }
  }

  async disconnect() {
    if (this.db) this.db.close();
    this.db = null;
    return true;
  }

  _ready() {
    if (!this.db) throw new Error('SqliteStore: llama a connect() primero');
  }

  // ── Auditoría (append-only) ──
  async appendAudit(record) {
    this._ready();
    const { tenantId, event, ts, ...rest } = record;
    this.db.prepare('INSERT INTO audit_log (tenant_id, event, data, ts) VALUES (?, ?, ?, COALESCE(?, strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')))')
      .run(tenantId, event, JSON.stringify(rest), ts || null);
    return true;
  }

  auditFor(tenantId) {
    this._ready();
    return this.db.prepare('SELECT tenant_id AS tenantId, event, data, ts FROM audit_log WHERE tenant_id = ? ORDER BY id')
      .all(tenantId)
      .map((r) => ({ tenantId: r.tenantId, event: r.event, ts: r.ts, ...JSON.parse(r.data) }));
  }

  // ── Memoria episódica ──
  async saveInteraction({ tenantId, agentId, summary, outcome, embedding = null }) {
    this._ready();
    this.db.prepare('INSERT INTO interactions (tenant_id, agent_id, summary, outcome, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tenantId, agentId ?? null, summary ?? null, outcome ?? null,
           embedding ? JSON.stringify(embedding) : null, Date.now());
    return true;
  }

  async recallInteractions({ tenantId, agentId, embedding = null, k = 5 }) {
    this._ready();
    // orden por id DESC (no por created_at): Date.now() tiene resolución de
    // milisegundo y varias inserciones rápidas seguidas pueden empatar,
    // volviendo el orden cronológico ambiguo — el id autoincremental de
    // SQLite es monótono y desempata de forma determinista.
    const rows = this.db.prepare(
      `SELECT id, tenant_id AS tenantId, agent_id AS agentId, summary, outcome, embedding, created_at AS at
         FROM interactions
        WHERE tenant_id = ? AND (? IS NULL OR agent_id = ?)
        ORDER BY id DESC`
    ).all(tenantId, agentId ?? null, agentId ?? null)
      .map((r) => ({ ...r, embedding: r.embedding ? JSON.parse(r.embedding) : null }));

    if (embedding && rows.some(r => r.embedding)) {
      // Sin umbral duro: siempre se devuelven los k más similares disponibles.
      return rows
        .filter(r => r.embedding)
        .map(r => ({
          ...r,
          score: SqliteStore._cosine(embedding, r.embedding)
        }))
        .sort((x, y) => y.score - x.score)
        .slice(0, k);
    }

    return rows.slice(0, k);
  }

  static _cosine(a, b) {
    const n = Math.min(a.length, b.length);
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  // ── Memoria semántica (hechos/perfiles) ──
  async setFact({ tenantId, key, value }) {
    this._ready();
    this.db.prepare('INSERT INTO facts (tenant_id, key, value) VALUES (?, ?, ?) ON CONFLICT (tenant_id, key) DO UPDATE SET value = excluded.value')
      .run(tenantId, key, JSON.stringify(value));
    return true;
  }

  async getFact({ tenantId, key }) {
    this._ready();
    const row = this.db.prepare('SELECT value FROM facts WHERE tenant_id = ? AND key = ?').get(tenantId, key);
    return row ? JSON.parse(row.value) : null;
  }

  // ── Plataforma: tenants aprovisionados (para rehidratar al arrancar) ──
  async upsertTenant({ tenantId, plan, departments = [], businessId = null }) {
    this._ready();
    this.db.prepare('INSERT INTO tenants (tenant_id, plan, departments, business_id) VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id) DO UPDATE SET plan = excluded.plan, departments = excluded.departments, business_id = COALESCE(excluded.business_id, tenants.business_id)')
      .run(tenantId, plan, JSON.stringify(departments), businessId);
    return true;
  }

  async listTenants() {
    this._ready();
    return this.db.prepare('SELECT tenant_id AS tenantId, plan, departments, business_id AS businessId FROM tenants ORDER BY created_at')
      .all()
      .map((r) => ({ tenantId: r.tenantId, plan: r.plan, departments: JSON.parse(r.departments), businessId: r.businessId }));
  }

  async deleteTenant(tenantId) {
    this._ready();
    this.db.prepare('DELETE FROM tenants WHERE tenant_id = ?').run(tenantId);
    this.db.prepare('DELETE FROM api_keys WHERE tenant_id = ?').run(tenantId);
    return true;
  }

  // ── Plataforma: tareas (durabilidad de la cola) ──
  async upsertTask(task) {
    this._ready();
    this.db.prepare(
      // created_at con respaldo: si quien escribe no la trae, la pone la base.
      // Sin fecha, el historial del panel quedaría sin orden definido.
      `INSERT INTO tasks (id, tenant_id, type, department, payload, status, error, result, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')), strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT (id) DO UPDATE SET
         status = excluded.status, error = excluded.error, result = excluded.result,
         updated_at = excluded.updated_at`
    ).run(
      task.id, task.tenantId, task.type ?? null, task.department ?? null,
      JSON.stringify(task.payload ?? {}), task.status,
      task.error ?? null, task.result !== undefined ? JSON.stringify(task.result) : null,
      task.createdAt ?? null
    );
    return true;
  }

  /** Una tarea por id (para consultarla aunque ya no esté en la ventana caliente). */
  async getTask({ tenantId, taskId }) {
    this._ready();
    const r = this.db.prepare(
      `SELECT id, tenant_id AS tenantId, type, department, payload, status, error, result, created_at AS createdAt
         FROM tasks WHERE tenant_id = ? AND id = ?`
    ).get(tenantId, taskId);
    if (!r) return null;
    return {
      ...r,
      payload: JSON.parse(r.payload || '{}'),
      result: r.result ? JSON.parse(r.result) : undefined,
    };
  }

  async listTasks({ tenantId, statuses = null, limit = 50 } = {}) {
    this._ready();
    const rows = this.db.prepare(
      `SELECT id, tenant_id AS tenantId, type, department, payload, status, error, result, created_at AS createdAt
         FROM tasks WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`
    ).all(tenantId, limit);
    return rows
      .filter((r) => !statuses || statuses.includes(r.status))
      .map((r) => ({
        ...r,
        payload: JSON.parse(r.payload || '{}'),
        result: r.result ? JSON.parse(r.result) : undefined,
      }));
  }

  // ── Plataforma: aprobaciones HITL (la decisión humana no se pierde) ──
  async upsertApproval(a) {
    this._ready();
    this.db.prepare(
      `INSERT INTO approvals (approval_id, tenant_id, agent_id, action, reason, status, note, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (approval_id) DO UPDATE SET
         status = excluded.status, note = excluded.note, resolved_at = excluded.resolved_at`
    ).run(
      a.approvalId, a.tenantId, a.agentId ?? null, JSON.stringify(a.action ?? {}),
      a.reason ?? null, a.status || 'pending', a.note ?? null, a.resolvedAt ?? null
    );
    return true;
  }

  async listApprovals({ tenantId, status = null } = {}) {
    this._ready();
    return this.db.prepare(
      `SELECT approval_id AS approvalId, tenant_id AS tenantId, agent_id AS agentId,
              action, reason, status, note, created_at AS createdAt, resolved_at AS resolvedAt
         FROM approvals WHERE tenant_id = ? AND (? IS NULL OR status = ?) ORDER BY created_at`
    ).all(tenantId, status, status)
      .map((r) => ({ ...r, action: JSON.parse(r.action || '{}') }));
  }

  // ── Plataforma: hashes de claves de API (nunca la clave en claro) ──
  async setApiKeyHash({ tenantId, hash }) {
    this._ready();
    this.db.prepare('INSERT INTO api_keys (tenant_id, key_hash) VALUES (?, ?) ON CONFLICT (tenant_id) DO UPDATE SET key_hash = excluded.key_hash')
      .run(tenantId, hash);
    return true;
  }

  async listApiKeyHashes() {
    this._ready();
    return this.db.prepare('SELECT tenant_id AS tenantId, key_hash AS hash FROM api_keys').all();
  }
}

module.exports = SqliteStore;
