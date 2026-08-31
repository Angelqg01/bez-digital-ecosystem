'use strict';

/**
 * SalesAutonomy — "autonomy dial" del Escuadrón de Ventas, por tenant.
 * Paridad competitiva con las plataformas de AI SDR (Artisan/11x): que sales
 * ops pueda decidir cuánto delega en el agente sin tocar código.
 *
 * IMPORTANTE — esto NUNCA toca las líneas rojas (cold_outbound, money_movement,
 * legal_commitment, pricing_concession...): esas son intocables por diseño
 * (ver RedLines.js / PolicyEngine: "las líneas rojas se evalúan ANTES y no se
 * pueden relajar"). El dial solo decide cuánta aprobación exige el sistema en
 * las acciones que SÍ son discreción del tenant. "full_auto" significa "tan
 * autónomo como el producto permite", no "saltarse los guardrails".
 *
 * Se implementa como un preset de overrides del PolicyEngine del tenant — el
 * mismo mecanismo que ya existía para que un tenant endureciera una categoría
 * a mano (PUT /tenants/:id/policies/:category). El dial es solo un atajo que
 * aplica varios de golpe con un nombre memorable.
 *
 * Niveles (de menos a más autonomía):
 *   - manual:    aprobación humana para CUALQUIER envío (aunque sea cálido),
 *                agendar reunión o escribir en el CRM.
 *   - assist (por defecto, hoy el comportamiento real del producto): el envío
 *                (respuestas cálidas y propuestas) sigue pidiendo un vistazo;
 *                agendar una demo o poner al día el CRM no lo pide.
 *   - full_auto: nada además de las líneas rojas — el agente agenda, sincroniza
 *                y envía lo cálido solo; el frío (cold_outbound) SIGUE pasando
 *                por HITL siempre, no hay forma de desactivarlo.
 */
const LEVELS = {
  manual: { outbound: 'always_approve', 'calendar:scheduleMeeting': 'always_approve', 'crm:upsertLead': 'always_approve' },
  assist: { outbound: 'always_approve', 'calendar:scheduleMeeting': null, 'crm:upsertLead': null },
  full_auto: { outbound: null, 'calendar:scheduleMeeting': null, 'crm:upsertLead': null },
};

const DEFAULT_LEVEL = 'assist';

class SalesAutonomy {
  /**
   * @param {object} opts
   * @param {string} opts.tenantId
   * @param {object} opts.guardrails - PolicyEngine del tenant (el dial escribe en sus overrides)
   * @param {object} opts.store      - persistencia opcional (fact 'sales:autonomy')
   */
  constructor({ tenantId, guardrails, store = null } = {}) {
    this.tenantId = tenantId;
    this.guardrails = guardrails;
    this.store = store;
    this.level = DEFAULT_LEVEL;
  }

  static get LEVELS() { return Object.keys(LEVELS); }
  static get DEFAULT_LEVEL() { return DEFAULT_LEVEL; }

  /** Recupera el nivel persistido (si lo hay) y lo aplica a los overrides del guardrails. */
  async hydrate() {
    if (this.store?.getFact) {
      const saved = await this.store.getFact({ tenantId: this.tenantId, key: 'sales:autonomy' });
      if (saved && LEVELS[saved]) this.level = saved;
    }
    this._apply(null);
    return this.level;
  }

  /** Cambia de nivel. `actor` (opcional): quién lo cambió, para el rastro de auditoría. */
  set(level, actor = null) {
    if (!LEVELS[level]) throw new Error(`nivel de autonomía inválido: ${level} (usa ${SalesAutonomy.LEVELS.join(' | ')})`);
    this.level = level;
    this._apply(actor);
    if (this.store?.setFact) {
      Promise.resolve(this.store.setFact({ tenantId: this.tenantId, key: 'sales:autonomy', value: this.level }))
        .catch((err) => console.warn(`[autonomy:${this.tenantId}] no se pudo persistir: ${err.message}`));
    }
    return this.describe();
  }

  /** Aplica el preset del nivel actual como overrides — solo toca lo que de verdad cambia,
   *  para no dejar ruido de auditoría redundante en cada hidratación/arranque. */
  _apply(actor) {
    const current = this.guardrails.getOverrides();
    for (const [key, rule] of Object.entries(LEVELS[this.level])) {
      if (rule) {
        if (current[key] !== rule) this.guardrails.setOverride(key, rule, actor);
      } else if (current[key]) {
        this.guardrails.removeOverride(key, actor);
      }
    }
  }

  describe() {
    return {
      level: this.level,
      overrides: LEVELS[this.level],
      redLinesUnaffected: true,
      note: 'Las líneas rojas (cold_outbound, money_movement, legal_commitment, pricing_concession, ...) siempre requieren aprobación humana, sin importar el nivel.',
    };
  }
}

module.exports = SalesAutonomy;
