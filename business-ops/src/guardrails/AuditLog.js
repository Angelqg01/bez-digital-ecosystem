'use strict';

const crypto = require('node:crypto');

const GENESIS = '0'.repeat(64);

/** JSON.stringify determinista (claves ordenadas): el hash no puede depender
 *  del orden de inserción de las propiedades, o el mismo contenido lógico
 *  produciría hashes distintos según quién construyó el objeto. */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * AuditLog — registro de auditoría append-only por tenant, encadenado por hash
 * (estilo blockchain ligero: cada registro incluye el hash del anterior).
 *
 * Por qué encadenado: un `INSERT`-only en Postgres/SQLite impide que la app
 * "edite" un registro por accidente, pero no impide que alguien con acceso
 * directo a la base de datos reescriba una fila sin dejar rastro. El
 * encadenamiento lo convierte en detectable: cambiar cualquier campo de
 * cualquier registro pasado rompe su hash, y por tanto el `prevHash` de todo
 * lo que viene después. `verifyChain()` recalcula la cadena y señala dónde
 * se rompió. Es la pieza que hace este log defendible ante due diligence
 * (inversores, auditoría de cumplimiento) y no solo "un log más".
 *
 * Continuidad entre reinicios: `hydrate()` recupera el hash del último
 * registro persistido para que la cadena no se reinicie a cada arranque.
 */
class AuditLog {
  constructor({ tenantId, store = null } = {}) {
    this.tenantId = tenantId;
    this.store = store;
    this._buffer = [];
    this._lastHash = null; // null = todavía en génesis (hydrate() lo recupera si hay historia)
  }

  static get GENESIS() { return GENESIS; }

  /** Recupera el hash del último registro persistido, para continuar la cadena tras un reinicio. */
  async hydrate() {
    if (!this.store?.auditFor) return 0;
    const rows = await this.store.auditFor(this.tenantId);
    const last = rows[rows.length - 1];
    if (last?.hash) this._lastHash = last.hash;
    return rows.length;
  }

  log(entry) {
    const record = {
      tenantId: this.tenantId,
      ts: new Date().toISOString(),
      ...entry,
    };
    const prevHash = this._lastHash || GENESIS;
    const hash = AuditLog._hash(prevHash, record);
    record.prevHash = prevHash;
    record.hash = hash;
    this._lastHash = hash;

    this._buffer.push(record);
    if (this.store?.appendAudit) {
      this.store.appendAudit(record).catch(() => {});
    }
    // En desarrollo, además, eco por consola para visibilidad inmediata.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUDIT:${this.tenantId}] ${record.event}`, entry.taskId || entry.approvalId || '');
    }
    return record;
  }

  query(filter = {}) {
    return this._buffer.filter(r =>
      Object.entries(filter).every(([k, v]) => r[k] === v)
    );
  }

  /**
   * Verifica la integridad de la cadena. Por defecto relee TODO el historial
   * persistido (no solo el buffer en RAM, que se pierde al reiniciar) — es lo
   * que hace falta para que la verificación sirva de prueba ante un tercero.
   * @param {object[]} [records] - opcional, para verificar un lote ya en mano (tests).
   * @returns {{ok:boolean, checked:number, brokenAt?:object}}
   */
  async verifyChain(records) {
    const rows = records || (this.store?.auditFor ? await this.store.auditFor(this.tenantId) : this._buffer);
    return AuditLog._verifyRecords(rows);
  }

  static _verifyRecords(rows) {
    let expectedPrev = GENESIS;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.prevHash !== expectedPrev) {
        return { ok: false, checked: i, brokenAt: { index: i, event: r.event, reason: 'prevHash no enlaza con el registro anterior' } };
      }
      const recomputed = AuditLog._hash(r.prevHash, AuditLog._withoutChainFields(r));
      if (recomputed !== r.hash) {
        return { ok: false, checked: i, brokenAt: { index: i, event: r.event, reason: 'el contenido no coincide con su hash (posible alteración)' } };
      }
      expectedPrev = r.hash;
    }
    return { ok: true, checked: rows.length };
  }

  static _withoutChainFields(record) {
    const { prevHash, hash, ...rest } = record;
    return rest;
  }

  static _hash(prevHash, recordWithoutChainFields) {
    return crypto.createHash('sha256')
      .update(`${prevHash}|${stableStringify(recordWithoutChainFields)}`)
      .digest('hex');
  }
}

module.exports = AuditLog;
