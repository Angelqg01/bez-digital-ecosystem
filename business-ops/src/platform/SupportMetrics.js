'use strict';

/**
 * SupportMetrics — KPIs de Atención al Cliente por tenant.
 *
 * Se suscribe al EventBus de cada tenant y agrega en vivo: tickets atendidos,
 * resueltos sin humano, escalados, fallidos, desglose por categoría y latencia
 * media. Es observación pasiva: no toca el flujo.
 */
class SupportMetrics {
  constructor({ clock = () => Date.now() } = {}) {
    this.clock = clock;
    this._byTenant = new Map();
  }

  /** Suscribe las métricas al bus de un tenant (llamar en el aprovisionamiento). */
  attach(bus, tenantId) {
    if (!bus) return;
    bus.on('task:completed', (task) => this._onCompleted(tenantId, task));
    bus.on('task:failed', (task) => this._onFailed(tenantId, task));
  }

  _acc(tenantId) {
    if (!this._byTenant.has(tenantId)) {
      this._byTenant.set(tenantId, {
        handled: 0, resolved: 0, escalated: 0, failed: 0,
        byCategory: {}, _latencySum: 0, _latencyN: 0,
      });
    }
    return this._byTenant.get(tenantId);
  }

  _onCompleted(tenantId, task) {
    if (task?.department !== 'support') return;
    const a = this._acc(tenantId);
    a.handled++;
    if (task.result?.outcome === 'escalated') a.escalated++;
    else a.resolved++;

    const cat = task.result?.triage?.category || 'general';
    a.byCategory[cat] = (a.byCategory[cat] || 0) + 1;

    const latency = this._latency(task);
    if (latency != null) { a._latencySum += latency; a._latencyN++; }
  }

  _onFailed(tenantId, task) {
    if (task?.department !== 'support') return;
    this._acc(tenantId).failed++;
  }

  _latency(task) {
    if (!task.createdAt) return null;
    const start = Date.parse(task.createdAt);
    return Number.isNaN(start) ? null : Math.max(0, this.clock() - start);
  }

  /** Informe de KPIs de un tenant. */
  report(tenantId) {
    const a = this._acc(tenantId);
    return {
      handled: a.handled,
      resolved: a.resolved,
      escalated: a.escalated,
      failed: a.failed,
      resolutionRate: a.handled ? a.resolved / a.handled : 0,
      escalationRate: a.handled ? a.escalated / a.handled : 0,
      avgLatencyMs: a._latencyN ? Math.round(a._latencySum / a._latencyN) : 0,
      byCategory: { ...a.byCategory },
    };
  }
}

module.exports = SupportMetrics;
