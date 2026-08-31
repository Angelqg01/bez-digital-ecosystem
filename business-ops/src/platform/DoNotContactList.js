'use strict';

/**
 * DoNotContactList — lista dinámica de "no contactar" por tenant, a nivel de
 * empresa/deal. Complementa (no sustituye) los `excludedAccounts`/`excludedTags`
 * estáticos de BusinessProfile: esos vienen del perfil de negocio (config fija
 * del tenant en `config/business/<id>.json`); esta lista la gestiona el propio
 * tenant en caliente vía API — un prospecto pide que no le escriban más, un
 * comercial marca una cuenta como cerrada para siempre — sin tocar config ni
 * redesplegar.
 *
 * Persistencia: un solo fact por tenant (mismo patrón que CostTracker/BusinessProfile),
 * no una tabla nueva — es una lista pequeña, no un histórico que crece sin fin.
 */
class DoNotContactList {
  constructor({ tenantId, store = null } = {}) {
    this.tenantId = tenantId;
    this.store = store;
    this._entries = new Map(); // key normalizada -> { key, company, domain, reason, actor, addedAt }
  }

  async hydrate() {
    if (!this.store?.getFact) return 0;
    const saved = await this.store.getFact({ tenantId: this.tenantId, key: 'sales:dnc' });
    if (Array.isArray(saved)) {
      for (const e of saved) if (e?.key) this._entries.set(e.key, e);
    }
    return this._entries.size;
  }

  _persist() {
    if (!this.store?.setFact) return;
    Promise.resolve(this.store.setFact({ tenantId: this.tenantId, key: 'sales:dnc', value: [...this._entries.values()] }))
      .catch((err) => console.warn(`[dnc:${this.tenantId}] no se pudo persistir: ${err.message}`));
  }

  static _key({ company, domain } = {}) {
    return String(domain || company || '').toLowerCase().trim();
  }

  /** Añade una empresa (por nombre, coincidencia por substring como BusinessProfile.isExcluded)
   *  o un dominio de email (coincidencia exacta) a la lista. */
  add({ company = null, domain = null, reason = '', actor = null } = {}) {
    const key = DoNotContactList._key({ company, domain });
    if (!key) throw new Error('company o domain requerido');
    const entry = { key, company: company || null, domain: domain ? domain.toLowerCase().trim() : null, reason, actor, addedAt: new Date().toISOString() };
    this._entries.set(key, entry);
    this._persist();
    return entry;
  }

  remove(key, actor = null) {
    const k = String(key || '').toLowerCase().trim();
    const existed = this._entries.delete(k);
    if (existed) this._persist();
    return existed;
  }

  list() {
    return [...this._entries.values()];
  }

  /** ¿Este lead está en la lista? Por nombre de empresa (substring) o por dominio del email. */
  isListed({ company = '', email = '' } = {}) {
    const c = String(company).toLowerCase().trim();
    const domain = String(email).split('@')[1]?.toLowerCase().trim() || '';
    for (const entry of this._entries.values()) {
      if (entry.company && c && c.includes(entry.key)) return entry;
      if (entry.domain && domain && domain === entry.domain) return entry;
    }
    return null;
  }
}

module.exports = DoNotContactList;
