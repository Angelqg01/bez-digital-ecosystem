'use strict';

/**
 * LeadOutcomeTracker — registra qué pasa con cada lead tras el outreach y
 * convierte esos eventos en pesos que reentrenan al PitchMatcher y al
 * priorizador de fuentes.
 *
 * Modelo simple, honesto y auditable: contamos éxitos y ensayos por
 * combinación `(source, segment, subApp)` y aplicamos un multiplicador tipo
 * "bandit greedy" con suavizado (Laplace) para no penalizar combinaciones
 * nuevas por falta de muestras. Preferimos algo predecible y explicable a un
 * bandit sofisticado que nadie podría depurar en producción.
 *
 * Los outcomes se persisten como fact del tenant `sales:outcomes`, así que
 * sobreviven a reinicios y son inspeccionables desde el panel.
 */

// Cada outcome vale un score entre 0 y 1 según su peso comercial.
const OUTCOME_SCORES = {
  ignored:    0.00,
  delivered:  0.05,   // llegó pero sin señal
  opened:     0.15,
  replied:    0.50,
  meeting:    0.80,
  closed_won: 1.00,
  closed_lost: 0.10,  // cierra el ciclo aunque no gane
};

const VALID_OUTCOMES = new Set(Object.keys(OUTCOME_SCORES));

class LeadOutcomeTracker {
  /**
   * @param {object} opts
   * @param {string} opts.tenantId
   * @param {object} opts.store       - persistencia (opcional; sin él, solo en memoria)
   * @param {number} opts.smoothing   - α de Laplace (def. 1) — evita ceros y overfitting
   */
  constructor({ tenantId, store = null, smoothing = 1 } = {}) {
    this.tenantId = tenantId;
    this.store = store;
    this.alpha = smoothing;
    // `key -> { attempts, wins }` donde key = `${source}|${segment}|${subApp}`.
    this._stats = new Map();
    // Historial reciente para debug/panel: array acotado, no ilimitado.
    this._recent = [];
    this._maxRecent = 500;
  }

  /** Carga los outcomes persistidos del tenant. Idempotente. */
  async hydrate() {
    if (!this.store?.getFact) return 0;
    const saved = await this.store.getFact({ tenantId: this.tenantId, key: 'sales:outcomes' });
    if (!saved) return 0;
    if (saved.stats) for (const [k, v] of Object.entries(saved.stats)) this._stats.set(k, v);
    if (Array.isArray(saved.recent)) this._recent = saved.recent.slice(-this._maxRecent);
    return this._stats.size;
  }

  async _persist() {
    if (!this.store?.setFact) return;
    try {
      await this.store.setFact({
        tenantId: this.tenantId,
        key: 'sales:outcomes',
        value: { stats: Object.fromEntries(this._stats), recent: this._recent.slice(-this._maxRecent) },
      });
    } catch (err) {
      console.warn(`[outcome:${this.tenantId}] no se pudo persistir: ${err.message}`);
    }
  }

  /**
   * Registra el desenlace de un intento de outreach.
   * @param {object} ev
   * @param {string} ev.leadKey    - id/email del lead (para deduplicar historial)
   * @param {string} ev.source     - fuente que trajo el lead
   * @param {string} ev.segment
   * @param {string} ev.subApp
   * @param {string} ev.outcome    - uno de OUTCOME_SCORES
   * @param {number} [ev.at]       - ms epoch (para tests)
   */
  async record(ev) {
    if (!VALID_OUTCOMES.has(ev.outcome)) {
      throw new Error(`outcome inválido: ${ev.outcome}`);
    }
    const key = `${ev.source || 'unknown'}|${ev.segment || 'unknown'}|${ev.subApp || 'unknown'}`;
    const cur = this._stats.get(key) || { attempts: 0, wins: 0 };
    cur.attempts++;
    cur.wins += OUTCOME_SCORES[ev.outcome];
    this._stats.set(key, cur);

    this._recent.push({ ...ev, at: ev.at ?? this._now() });
    if (this._recent.length > this._maxRecent) this._recent.splice(0, this._recent.length - this._maxRecent);

    await this._persist();
    return cur;
  }

  _now() { return Date.now(); }

  /**
   * Pesos aprendidos para el PitchMatcher: multiplicador por (segment, subApp).
   * Media suavizada con Laplace: `(wins+α) / (attempts+2α)`, normalizado por la
   * media global para que sea un factor "mejor/peor que la media".
   */
  pitchWeights() {
    const w = new Map();
    if (!this._stats.size) return w;

    const items = [];
    for (const [key, s] of this._stats) {
      const [, segment, subApp] = key.split('|');
      const rate = (s.wins + this.alpha) / (s.attempts + 2 * this.alpha);
      items.push({ segment, subApp, rate });
    }
    const media = items.reduce((a, x) => a + x.rate, 0) / items.length;
    if (media <= 0) return w;
    for (const { segment, subApp, rate } of items) {
      // Acotamos en [0.25, 4] para que una racha no dispare ni entierre.
      const factor = Math.max(0.25, Math.min(4, rate / media));
      w.set(`${segment}:${subApp}`, factor);
    }
    return w;
  }

  /**
   * Ranking de fuentes por rendimiento (media suavizada). Sirve para que
   * LeadFunnel priorice qué fuente encuestar primero cuando hay presupuesto
   * de concurrencia limitado.
   */
  sourceRanking() {
    const agg = new Map();   // source -> { attempts, wins }
    for (const [key, s] of this._stats) {
      const [source] = key.split('|');
      const cur = agg.get(source) || { attempts: 0, wins: 0 };
      cur.attempts += s.attempts;
      cur.wins += s.wins;
      agg.set(source, cur);
    }
    return [...agg.entries()]
      .map(([source, s]) => ({
        source,
        attempts: s.attempts,
        rate: (s.wins + this.alpha) / (s.attempts + 2 * this.alpha),
      }))
      .sort((a, b) => b.rate - a.rate);
  }

  snapshot() {
    return {
      combos: this._stats.size,
      recent: this._recent.length,
      topPitch: [...this.pitchWeights().entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      sources: this.sourceRanking(),
    };
  }
}

LeadOutcomeTracker.OUTCOME_SCORES = OUTCOME_SCORES;
LeadOutcomeTracker.VALID_OUTCOMES = VALID_OUTCOMES;
module.exports = LeadOutcomeTracker;
