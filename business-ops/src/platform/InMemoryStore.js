'use strict';

/**
 * InMemoryStore — adaptador de referencia del contrato Store.
 *
 * Implementa toda la interfaz pero guarda en RAM: NO sobrevive a reinicios.
 * Sirve como (a) implementación por defecto sin infraestructura, y
 * (b) doble de pruebas para verificar el cableado de Memory/Audit sin Postgres.
 *
 * El mismo contrato lo cumple PostgresStore (durable, con RLS por tenant).
 */
class InMemoryStore {
  constructor() {
    this._audit = [];           // [{ tenantId, event, ts, ... }]
    this._interactions = [];    // [{ tenantId, agentId, summary, outcome, embedding, at }]
    this._facts = new Map();    // `${tenantId}::${key}` -> value
  }

  async connect() { return true; }
  async disconnect() { return true; }

  // ── Auditoría ──
  async appendAudit(record) {
    this._audit.push(record);
    return true;
  }

  // ── Memoria episódica ──
  async saveInteraction({ tenantId, agentId, summary, outcome, embedding = null }) {
    this._interactions.push({ tenantId, agentId, summary, outcome, embedding, at: Date.now() });
    return true;
  }

  async recallInteractions({ tenantId, agentId, embedding = null, k = 5 }) {
    const list = this._interactions
      .filter(i => i.tenantId === tenantId && (!agentId || i.agentId === agentId));

    if (embedding && list.some(i => i.embedding)) {
      // Sin umbral duro: siempre se devuelven los k más similares disponibles
      // (mismo criterio que MemoryManager.recall) — el score va en el resultado.
      return list
        .filter(i => i.embedding)
        .map(i => ({
          ...i,
          score: InMemoryStore._cosine(embedding, i.embedding)
        }))
        .sort((x, y) => y.score - x.score)
        .slice(0, k);
    }

    return list
      .slice(-k)
      .reverse();
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
    this._facts.set(`${tenantId}::${key}`, value);
    return true;
  }

  async getFact({ tenantId, key }) {
    const v = this._facts.get(`${tenantId}::${key}`);
    return v === undefined ? null : v;
  }

  // ── Plataforma: tenants aprovisionados (mismo contrato que SqliteStore) ──
  async upsertTenant({ tenantId, plan, departments = [], businessId = null }) {
    if (!this._tenants) this._tenants = new Map();
    const prev = this._tenants.get(tenantId) || {};
    this._tenants.set(tenantId, { tenantId, plan, departments, businessId: businessId ?? prev.businessId ?? null });
    return true;
  }

  async listTenants() {
    return this._tenants ? [...this._tenants.values()] : [];
  }

  async deleteTenant(tenantId) {
    if (this._tenants) this._tenants.delete(tenantId);
    if (this._apiKeys) this._apiKeys.delete(tenantId);
    return true;
  }

  // ── Plataforma: hashes de claves de API ──
  async setApiKeyHash({ tenantId, hash }) {
    if (!this._apiKeys) this._apiKeys = new Map();
    this._apiKeys.set(tenantId, hash);
    return true;
  }

  async listApiKeyHashes() {
    return this._apiKeys ? [...this._apiKeys.entries()].map(([tenantId, hash]) => ({ tenantId, hash })) : [];
  }

  // ── Plataforma: tareas (mismo contrato que SqliteStore) ──
  async upsertTask(task) {
    if (!this._tasks) this._tasks = new Map();
    const prev = this._tasks.get(task.id) || {};
    // createdAt con respaldo (igual que Sqlite/Postgres): la fecha la pone el
    // store si quien escribe no la trae, y no cambia en actualizaciones.
    const createdAt = prev.createdAt || task.createdAt || new Date().toISOString();
    this._tasks.set(task.id, { ...prev, ...task, createdAt });
    return true;
  }

  /** Una tarea por id (para consultarla aunque ya no esté en la ventana caliente). */
  async getTask({ tenantId, taskId }) {
    const t = this._tasks?.get(taskId);
    return t && t.tenantId === tenantId ? t : null;
  }

  async listTasks({ tenantId, statuses = null, limit = 50 } = {}) {
    if (!this._tasks) return [];
    return [...this._tasks.values()]
      .filter((t) => t.tenantId === tenantId && (!statuses || statuses.includes(t.status)))
      .slice(-limit)
      .reverse();
  }

  // ── Plataforma: aprobaciones HITL ──
  async upsertApproval(a) {
    if (!this._approvals) this._approvals = new Map();
    this._approvals.set(a.approvalId, { ...(this._approvals.get(a.approvalId) || {}), ...a });
    return true;
  }

  async listApprovals({ tenantId, status = null } = {}) {
    if (!this._approvals) return [];
    return [...this._approvals.values()]
      .filter((a) => a.tenantId === tenantId && (!status || a.status === status));
  }

  // ── Utilidad para tests / observabilidad ──
  auditFor(tenantId) {
    return this._audit.filter(r => r.tenantId === tenantId);
  }
}

module.exports = InMemoryStore;
