'use strict';

const { crossesRedLine } = require('./RedLines');

/**
 * PolicyEngine — decide si una acción se permite, se bloquea o requiere aprobación humana.
 * Combina las líneas rojas universales con la política específica del tenant/plan.
 */
class PolicyEngine {
  constructor({ tenantId, plan = 'starter', overrides = {}, audit = null } = {}) {
    this.tenantId = tenantId;
    this.plan = plan;
    this.overrides = overrides; // permite a un tenant endurecer reglas, nunca relajar líneas rojas
    this.audit = audit;         // opcional: cada decisión y cada cambio de política queda auditado
  }

  // Reglas que un tenant puede aplicar a una categoría. Solo endurecen:
  // no existe "permitir" — las líneas rojas se evalúan antes y no se pueden relajar.
  static get RULES() { return ['always_approve', 'block']; }

  /**
   * Endurece una categoría: 'always_approve' (pide aprobación) o 'block' (la prohíbe).
   * `actor` (opcional): quién hizo el cambio (admin/tenant), para el rastro de auditoría —
   * qué política rige hoy no sirve de nada en una due diligence si no se sabe quién la puso.
   */
  setOverride(category, rule, actor = null) {
    if (!category) throw new Error('category requerida');
    if (!PolicyEngine.RULES.includes(rule)) {
      throw new Error(`regla inválida: ${rule} (usa ${PolicyEngine.RULES.join(' | ')})`);
    }
    const previous = this.overrides[category] || null;
    this.overrides[category] = rule;
    this.audit?.log({ tenantId: this.tenantId, event: 'policy:override_set', category, rule, previous, actor });
    return this.getOverrides();
  }

  removeOverride(category, actor = null) {
    const previous = this.overrides[category] || null;
    delete this.overrides[category];
    if (previous) {
      this.audit?.log({ tenantId: this.tenantId, event: 'policy:override_removed', category, previous, actor });
    }
    return this.getOverrides();
  }

  getOverrides() {
    return { ...this.overrides };
  }

  /**
   * @param {object} ctx - { tenantId, agentId, action }
   * @returns {{allowed:boolean, requiresApproval:boolean, reason:string}}
   */
  evaluate({ agentId, action }) {
    const verdict = this._decide(action);
    // Cada decisión queda auditada — no solo las que llegan a HITL. Sin esto,
    // un "blocked" (categoría bloqueada por política del tenant) no dejaba
    // ningún rastro: la acción simplemente no pasaba, y nadie podía responder
    // después "¿por qué se bloqueó esto el martes?".
    this.audit?.log({
      tenantId: this.tenantId, event: 'policy:decision', agentId,
      action, decision: PolicyEngine._label(verdict), rule: verdict.rule, reason: verdict.reason,
    });
    return { allowed: verdict.allowed, requiresApproval: verdict.requiresApproval, reason: verdict.reason };
  }

  static _label(v) {
    if (v.requiresApproval) return 'requires_approval';
    return v.allowed ? 'allowed' : 'blocked';
  }

  /** Lógica pura de decisión (sin efectos secundarios) — evaluate() la envuelve con auditoría. */
  _decide(action) {
    // Cuenta vetada (Acuerdo V1 / partner confirmado / exclusión explícita):
    // bloqueo DURO — no se contacta ni con aprobación humana. Se evalúa antes
    // que nada. El agente marca action.excluded consultando el perfil de negocio.
    if (action.excluded) {
      return { allowed: false, requiresApproval: false, rule: 'excluded_account', reason: 'Cuenta excluida (Acuerdo V1 / partner confirmado): contacto prohibido.' };
    }

    const red = crossesRedLine(action);
    if (red) {
      return {
        allowed: false,
        requiresApproval: true,
        rule: `redline:${red.id}`,
        reason: `Línea roja: ${red.label}. Requiere aprobación humana.`,
      };
    }

    // Reglas por plan (ejemplo: límite de acciones costosas en planes bajos).
    // Un override puede apuntar a la categoría entera ('crm') o a un método
    // concreto ('crm:upsertLead') — el específico gana. Sin esto, endurecer
    // una escritura (upsertLead) endurecía también la lectura previa
    // (listLeads) que la precede, y agentes como CRMSyncAgent/MeetingBookerAgent
    // necesitan leer sin fricción para poder decidir qué escribir.
    const specificKey = action.method ? `${action.category}:${action.method}` : null;
    const matchedKey = specificKey && this.overrides[specificKey] ? specificKey : action.category;
    const tenantRule = this.overrides[matchedKey];
    if (tenantRule === 'always_approve') {
      return { allowed: false, requiresApproval: true, rule: `override:${matchedKey}:always_approve`, reason: `Política del cliente: ${matchedKey} requiere aprobación.` };
    }
    if (tenantRule === 'block') {
      return { allowed: false, requiresApproval: false, rule: `override:${matchedKey}:block`, reason: `Política del cliente: ${matchedKey} bloqueada.` };
    }

    return { allowed: true, requiresApproval: false, rule: null, reason: 'ok' };
  }
}

module.exports = PolicyEngine;
