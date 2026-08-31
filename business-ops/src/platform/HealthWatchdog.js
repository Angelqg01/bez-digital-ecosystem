'use strict';

const { evaluate, snapshotFor } = require('./AlertRules');

/**
 * HealthWatchdog — evalúa los umbrales de `AlertRules` cada cierto tiempo y
 * avisa a una persona cuando algo se sale de rango.
 *
 * Por qué NO va por el Scheduler (que ya existe para trabajos recurrentes):
 * el Scheduler mete el trabajo en la cola del tenant y consume su cuota del
 * plan. Vigilar la salud de la plataforma no puede gastarle llamadas al
 * cliente ni competir con su trabajo real por los huecos de concurrencia.
 *
 * Deduplicación: solo avisa cuando una alerta APARECE, y avisa otra vez cuando
 * se RESUELVE. Repetir el mismo aviso cada ciclo lo convierte en ruido, y una
 * alerta que se ignora es peor que no tenerla — da falsa sensación de control.
 */
class HealthWatchdog {
  /**
   * @param {object} opts
   * @param {object} opts.tenants     - TenantManager
   * @param {object} opts.telemetry
   * @param {object} opts.usageMeter
   * @param {object} opts.notifier    - HitlNotifier (usa .alert())
   * @param {number} opts.intervalMs  - def. 5 min
   * @param {object} opts.thresholds  - sobrescribe los umbrales por defecto
   * @param {function} opts.snapshotFn - inyectable (tests): de dónde salen las cifras
   */
  constructor({
    tenants, telemetry, usageMeter, notifier,
    intervalMs = 5 * 60_000, thresholds = {},
    clock = () => Date.now(), snapshotFn = snapshotFor,
  } = {}) {
    this.tenants = tenants;
    this.telemetry = telemetry;
    this.usageMeter = usageMeter;
    this.notifier = notifier;
    this.intervalMs = intervalMs;
    this.thresholds = thresholds;
    this.clock = clock;
    this.snapshotFn = snapshotFn;
    this._active = new Map();   // `${tenantId}:${alertId}` -> alerta activa
    this._timer = null;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => { this.check().catch(() => {}); }, this.intervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  /** Alertas actualmente activas (para el panel / un endpoint de estado). */
  active(tenantId = null) {
    return [...this._active.entries()]
      .filter(([k]) => !tenantId || k.startsWith(`${tenantId}:`))
      .map(([, a]) => a);
  }

  /**
   * Un ciclo: evalúa todos los tenants y notifica solo los cambios.
   * @returns {{fired: Array, cleared: Array}}
   */
  async check() {
    const fired = [];
    const cleared = [];
    const ids = this.tenants?.list ? this.tenants.list() : [];

    for (const tenantId of ids) {
      const space = this.tenants.get(tenantId);
      if (!space) continue;

      const snapshot = this.snapshotFn({
        telemetry: this.telemetry,
        usageMeter: this.usageMeter,
        orchestrator: space.orchestrator,
        tenantId,
      });
      const alerts = evaluate(snapshot, this.thresholds);
      const vistos = new Set();

      for (const alert of alerts) {
        const key = `${tenantId}:${alert.id}`;
        vistos.add(key);
        const previa = this._active.get(key);

        // Ya avisada y con la misma severidad: no repetir.
        if (previa && previa.severity === alert.severity) continue;

        const registro = { ...alert, tenantId, since: previa?.since || this.clock() };
        this._active.set(key, registro);
        fired.push(registro);
        await this._notify(tenantId, alert, previa ? 'empeora' : 'nueva');
      }

      // Lo que estaba activo y ya no aparece: se ha resuelto.
      for (const [key, alerta] of [...this._active]) {
        if (!key.startsWith(`${tenantId}:`) || vistos.has(key)) continue;
        this._active.delete(key);
        cleared.push(alerta);
        await this._notifyCleared(tenantId, alerta);
      }
    }

    return { fired, cleared };
  }

  async _notify(tenantId, alert, motivo) {
    if (!this.notifier?.alert) return;
    const icono = alert.severity === 'critical' ? '🔴' : '🟠';
    try {
      await this.notifier.alert({
        tenantId,
        department: 'operations',   // salud de plataforma → bot de DevOps
        title: `${icono} ${alert.title}${motivo === 'empeora' ? ' (empeorando)' : ''}`,
        lines: [alert.detail],
      });
    } catch (err) {
      console.warn(`[watchdog:${tenantId}] no se pudo avisar de ${alert.id}: ${err.message}`);
    }
  }

  async _notifyCleared(tenantId, alerta) {
    if (!this.notifier?.alert) return;
    try {
      await this.notifier.alert({
        tenantId,
        department: 'operations',
        title: `✅ Resuelto: ${alerta.title}`,
        lines: ['La condición que disparó el aviso ya no se cumple.'],
      });
    } catch { /* avisar de una resolución nunca debe romper el ciclo */ }
  }
}

module.exports = HealthWatchdog;
