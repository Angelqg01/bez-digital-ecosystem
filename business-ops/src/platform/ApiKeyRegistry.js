'use strict';

const crypto = require('crypto');

/**
 * ApiKeyRegistry — emite y resuelve claves de API por tenant.
 *
 * Guarda solo el hash de la clave (la clave en claro se muestra una vez al
 * emitirla). Reemitir rota la clave anterior. Con un `store` que implemente
 * setApiKeyHash/listApiKeyHashes (SqliteStore/InMemoryStore), los hashes
 * persisten y se rehidratan al arrancar; sin store, solo en memoria.
 */
class ApiKeyRegistry {
  constructor({ store } = {}) {
    this._byHash = new Map();   // sha256(key) -> tenantId
    this._byTenant = new Map(); // tenantId -> sha256(key) actual
    this._store = store || null;
  }

  /** Carga los hashes persistidos (llamar tras store.connect()). */
  async hydrate() {
    if (!this._store || typeof this._store.listApiKeyHashes !== 'function') return 0;
    const rows = await this._store.listApiKeyHashes();
    for (const { tenantId, hash } of rows) {
      this._byHash.set(hash, tenantId);
      this._byTenant.set(tenantId, hash);
    }
    return rows.length;
  }

  /** Emite (o rota) la clave de un tenant. Devuelve la clave en claro UNA vez. */
  issue(tenantId) {
    const key = `sk_${crypto.randomBytes(24).toString('hex')}`;
    const hash = ApiKeyRegistry._hash(key);
    const prev = this._byTenant.get(tenantId);
    if (prev) this._byHash.delete(prev);
    this._byHash.set(hash, tenantId);
    this._byTenant.set(tenantId, hash);
    if (this._store && typeof this._store.setApiKeyHash === 'function') {
      // Persistencia best-effort: si falla no rompe el alta (la clave vive en RAM).
      Promise.resolve(this._store.setApiKeyHash({ tenantId, hash }))
        .catch((err) => console.warn(`[apikeys] no se pudo persistir la clave de ${tenantId}: ${err.message}`));
    }
    return key;
  }

  /** Devuelve el tenant dueño de la clave, o null. */
  resolve(key) {
    if (!key) return null;
    return this._byHash.get(ApiKeyRegistry._hash(key)) || null;
  }

  revoke(tenantId) {
    const hash = this._byTenant.get(tenantId);
    if (hash) { this._byHash.delete(hash); this._byTenant.delete(tenantId); }
  }

  static _hash(key) {
    return crypto.createHash('sha256').update(String(key)).digest('hex');
  }
}

module.exports = ApiKeyRegistry;
