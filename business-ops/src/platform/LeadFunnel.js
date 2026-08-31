'use strict';

const LeadOutcomeTracker = require('./LeadOutcomeTracker');

/**
 * LeadFunnel — orquestador end-to-end de captación:
 *
 *   fuentes ─→ scorer ─→ pitch-matcher ─→ outreach (HITL) ─→ outcome-tracker
 *                                                                    │
 *                                                              pesos aprendidos
 *                                                              ↑ realimentan
 *                                                              pitch-matcher y
 *                                                              priorización de
 *                                                              fuentes
 *
 * Diseño explícito:
 *   1. Cada envío en frío pasa por HITL — la línea roja `cold_outbound` en
 *      RedLines.js NO se puentea aquí; el OutreachAgent llama a `act()` con
 *      `cold: true` y el humano aprueba/rechaza en Telegram.
 *   2. Dedup por `email|company`: si el mismo lead entra por dos fuentes en
 *      la misma corrida, solo se procesa la primera. La segunda queda
 *      registrada en el tracker como duplicado (no gasta modelo).
 *   3. Presupuesto: `maxLeadsPerRun` protege la cuota del tenant.
 *   4. Aprendizaje: al terminar el run, los pesos del tracker se pasan al
 *      pitch-matcher para la SIGUIENTE ronda; no se aplican retroactivamente
 *      a leads ya procesados (evita ordering non-determinism).
 */
class LeadFunnel {
  /**
   * @param {object} opts
   * @param {string} opts.tenantId
   * @param {object} opts.tracker           - LeadOutcomeTracker
   * @param {object} opts.agents            - { scorer, matcher, outreach }
   * @param {Array}  opts.sources           - fuentes con .discover(icp, opts)
   * @param {number} opts.maxLeadsPerRun    - tope duro (def. 50)
   * @param {number} opts.minScoreToOutreach - por debajo de esto no se envía (def. 60)
   * @param {object} opts.bus               - EventBus opcional
   */
  constructor({
    tenantId, tracker, agents, sources = [],
    maxLeadsPerRun = 50, minScoreToOutreach = 60, bus = null,
  } = {}) {
    if (!agents?.scorer)   throw new Error('LeadFunnel: agents.scorer requerido');
    if (!agents?.matcher)  throw new Error('LeadFunnel: agents.matcher requerido');
    if (!agents?.outreach) throw new Error('LeadFunnel: agents.outreach requerido');
    this.tenantId = tenantId;
    this.tracker = tracker || new LeadOutcomeTracker({ tenantId });
    this.agents = agents;
    this.sources = sources;
    this.maxLeadsPerRun = maxLeadsPerRun;
    this.minScoreToOutreach = minScoreToOutreach;
    this.bus = bus;
  }

  /** Añade una fuente en caliente. Útil para tests y para plugins on-demand. */
  addSource(src) { this.sources.push(src); return this; }

  /**
   * Corre un ciclo completo: descubre, puntúa, personaliza, envía.
   * @param {object} icp     - Perfil de cliente ideal del tenant (sector, pain, geo...)
   * @returns resumen del ciclo
   */
  async run(icp = {}) {
    // Aplicar pesos aprendidos ANTES de este ciclo (no durante — evita orden).
    this.agents.matcher.weights = this.tracker.pitchWeights();

    // Priorizar fuentes por rendimiento histórico: las que mejor cierran
    // gastan primero el presupuesto de descubrimiento.
    const ranking = new Map(this.tracker.sourceRanking().map((r, i) => [r.source, i]));
    const orderedSources = [...this.sources].sort((a, b) => {
      const ra = ranking.has(a.name) ? ranking.get(a.name) : this.sources.length;
      const rb = ranking.has(b.name) ? ranking.get(b.name) : this.sources.length;
      return ra - rb;
    });

    // Descubrir en paralelo — cada fuente devuelve como mucho su parte del budget.
    const perSourceLimit = Math.max(5, Math.ceil(this.maxLeadsPerRun / Math.max(1, orderedSources.length)));
    const buckets = await Promise.all(
      orderedSources.map((s) => this._safeDiscover(s, icp, perSourceLimit)),
    );

    // Dedup preservando la fuente ganadora (primera aparición).
    const seen = new Set();
    const leads = [];
    for (const bucket of buckets) {
      for (const lead of bucket) {
        const k = LeadFunnel._dedupKey(lead);
        if (seen.has(k)) continue;
        seen.add(k);
        leads.push(lead);
        if (leads.length >= this.maxLeadsPerRun) break;
      }
      if (leads.length >= this.maxLeadsPerRun) break;
    }

    const processed = [];
    for (const lead of leads) processed.push(await this._processOne(lead));

    const summary = {
      discovered: leads.length,
      scored: processed.filter((p) => p.score != null).length,
      outreached: processed.filter((p) => p.sent).length,
      belowThreshold: processed.filter((p) => p.score != null && p.score < this.minScoreToOutreach).length,
      failed: processed.filter((p) => p.error).length,
      bySource: LeadFunnel._countBy(processed, (p) => p.source),
    };
    this.bus?.emit('sales:funnel_run', { tenantId: this.tenantId, summary });
    return { summary, processed };
  }

  async _safeDiscover(source, icp, limit) {
    try {
      const arr = await source.discover(icp, { limit });
      return Array.isArray(arr) ? arr : [];
    } catch (err) {
      console.warn(`[funnel:${this.tenantId}] fuente ${source.name} falló: ${err.message}`);
      return [];
    }
  }

  async _processOne(lead) {
    const source = lead._source || 'unknown';
    try {
      // 1. Puntuar. Los agentes exponen `run(task)` (contrato de BaseAgent).
      const scoreRes = await this.agents.scorer.run({ type: 'sales:score', payload: { lead } });
      const score = scoreRes?.score ?? 0;
      const segment = scoreRes?.segment || 'sin_clasificar';

      if (score < this.minScoreToOutreach) {
        // Registramos la decisión para que el tracker sepa qué NO enviamos.
        return { lead, source, score, segment, sent: false, reason: 'below_threshold' };
      }

      // 2. Elegir producto + ángulo.
      const matchRes = await this.agents.matcher.run({ type: 'sales:match-pitch', payload: { lead, segment } });

      // 3. Outreach en frío → HITL vía cold_outbound.
      const outRes = await this.agents.outreach.run({
        type: 'sales:outreach',
        payload: { lead, offer: matchRes.offer, cold: true },
      });

      const sent = !!(outRes?.send?.sent);
      // Registrar el intento: 'delivered' si el HITL aprobó, 'ignored' si no.
      await this.tracker.record({
        leadKey: LeadFunnel._dedupKey(lead),
        source, segment, subApp: matchRes.subApp,
        outcome: sent ? 'delivered' : 'ignored',
      });

      return {
        lead, source, score, segment, subApp: matchRes.subApp,
        offer: matchRes.offer, sent, hitlPending: outRes?.send?.status === 'pending',
      };
    } catch (err) {
      return { lead, source, error: err.message };
    }
  }

  /** API pública para hooks del EmailConnector / webhooks del CRM. */
  async recordOutcome(ev) { return this.tracker.record(ev); }

  static _dedupKey(lead) {
    const email = String(lead.email || '').toLowerCase().trim();
    const company = String(lead.company || '').toLowerCase().trim();
    return email || company || JSON.stringify(lead).slice(0, 64);
  }

  static _countBy(arr, fn) {
    const m = {};
    for (const x of arr) { const k = fn(x); m[k] = (m[k] || 0) + 1; }
    return m;
  }
}

module.exports = LeadFunnel;
