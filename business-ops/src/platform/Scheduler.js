'use strict';

/**
 * Scheduler — agentes proactivos: la plataforma trabaja sin esperar solicitudes.
 *
 * Cada tenant define trabajos recurrentes ("cada hora revisa el sistema",
 * "cada día prepara el informe operativo") que el scheduler inyecta en su
 * Orchestrator como una solicitud más: pasan por la MISMA cola, cuota
 * (UsageMeter corta si se agota), guardrails y auditoría que una petición
 * humana. Un trabajo proactivo jamás tiene más permisos que uno reactivo.
 *
 * Los trabajos persisten como fact `scheduler:jobs` del tenant (SQLite/Postgres)
 * y se rehidratan al arrancar: un reinicio no borra la agenda de los agentes.
 */
const MIN_INTERVAL_MS = 60_000; // tope inferior: nada corre más de 1 vez/minuto

class Scheduler {
  /**
   * @param {object} opts
   * @param {object} opts.tenants - TenantManager (usa handle())
   * @param {object} opts.store   - persistencia (setFact/getFact), opcional
   * @param {number} opts.tickMs  - frecuencia del reloj interno (def. 30s)
   * @param {function} opts.clock - () => epoch ms, inyectable para tests
   */
  constructor({ tenants, store = null, tickMs = 30_000, clock = () => Date.now(), actions = {} } = {}) {
    this.tenants = tenants;
    this.store = store;
    this.tickMs = tickMs;
    this.clock = clock;
    this.actions = actions;   // acciones de plataforma: nombre -> async (tenantId) => any
    this._jobs = new Map();   // tenantId -> Map(jobId -> job)
    this._timer = null;
  }

  /** Arranca el reloj. Idempotente. */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => { this.tick().catch(() => {}); }, this.tickMs);
    if (this._timer.unref) this._timer.unref(); // no mantiene vivo el proceso
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  /** Carga los trabajos persistidos de estos tenants (llamar al arrancar). */
  async hydrate(tenantIds = []) {
    if (!this.store?.getFact) return 0;
    let n = 0;
    for (const tenantId of tenantIds) {
      const saved = await this.store.getFact({ tenantId, key: 'scheduler:jobs' });
      if (Array.isArray(saved)) {
        const map = new Map();
        for (const j of saved) map.set(j.id, j);
        this._jobs.set(tenantId, map);
        n += saved.length;
      }
    }
    return n;
  }

  /**
   * Crea o actualiza un trabajo recurrente del tenant. Tres formas:
   *  - { input: { text } }                  → se clasifica por palabras clave
   *  - { input: { type, department } }      → va directo al departamento
   *  - { action: 'digest' }                 → acción de plataforma registrada
   * @param {string} tenantId
   * @param {object} job - { id?, description?, everyMs, input?, action? }
   */
  async addJob(tenantId, { id, description = '', everyMs, input, action } = {}) {
    if (!everyMs || everyMs < MIN_INTERVAL_MS) {
      throw new Error(`everyMs mínimo: ${MIN_INTERVAL_MS}ms (1 minuto)`);
    }
    if (action) {
      if (!this.actions[action]) throw new Error(`acción desconocida: ${action}`);
    } else if (!input || !(input.text || (input.type && input.department))) {
      // El texto solo hace falta para clasificar. Un trabajo que ya dice a qué
      // departamento y tipo va está MEJOR especificado que uno que confía en
      // que unas palabras clave acierten, así que exigirle texto era al revés.
      throw new Error('input.text, o bien input.type + input.department, requeridos');
    }

    const jobs = this._jobs.get(tenantId) || new Map();
    const job = {
      id: id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description,
      everyMs,
      action: action || null,
      input: input ? { ...input, channel: input.channel || 'scheduler' } : null,
      lastRunAt: null,
      createdAt: this.clock(),
    };
    // Si es actualización, conserva el último run para no disparar en cascada.
    const prev = jobs.get(job.id);
    if (prev) job.lastRunAt = prev.lastRunAt;

    jobs.set(job.id, job);
    this._jobs.set(tenantId, jobs);
    await this._persist(tenantId);
    return job;
  }

  async removeJob(tenantId, jobId) {
    const jobs = this._jobs.get(tenantId);
    const existed = jobs ? jobs.delete(jobId) : false;
    if (existed) await this._persist(tenantId);
    return existed;
  }

  listJobs(tenantId) {
    return [...(this._jobs.get(tenantId)?.values() || [])];
  }

  /**
   * Un pulso del reloj: ejecuta los trabajos vencidos de todos los tenants.
   * Cada trabajo entra por tenants.handle() → cola + cuota + guardrails.
   */
  async tick() {
    const now = this.clock();
    const ran = [];
    for (const [tenantId, jobs] of this._jobs) {
      for (const job of jobs.values()) {
        const due = job.lastRunAt == null || now - job.lastRunAt >= job.everyMs;
        if (!due) continue;
        job.lastRunAt = now; // marca antes de ejecutar: un fallo no re-dispara en bucle
        try {
          if (job.action) {
            await this.actions[job.action](tenantId);
            ran.push({ tenantId, jobId: job.id, action: job.action });
          } else {
            const taskId = await this.tenants.handle(tenantId, job.input);
            ran.push({ tenantId, jobId: job.id, taskId });
          }
        } catch (err) {
          // Cuota agotada / tenant caído: se registra y se reintenta al vencer de nuevo.
          console.warn(`[scheduler:${tenantId}] ${job.id} falló: ${err.message}`);
          ran.push({ tenantId, jobId: job.id, error: err.message });
        }
      }
      await this._persist(tenantId); // asienta lastRunAt
    }
    return ran;
  }

  async _persist(tenantId) {
    if (!this.store?.setFact) return;
    try {
      await this.store.setFact({ tenantId, key: 'scheduler:jobs', value: this.listJobs(tenantId) });
    } catch (err) {
      console.warn(`[scheduler:${tenantId}] no se pudo persistir: ${err.message}`);
    }
  }

  /** '30m' | '2h' | '1d' | número de ms → ms. */
  static parseEvery(every) {
    if (typeof every === 'number') return every;
    const m = String(every).trim().match(/^(\d+)\s*(m|h|d)$/i);
    if (!m) throw new Error(`intervalo inválido: ${every} (usa 30m, 2h, 1d o ms)`);
    const n = Number(m[1]);
    const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2].toLowerCase()];
    return n * unit;
  }
}

Scheduler.MIN_INTERVAL_MS = MIN_INTERVAL_MS;
module.exports = Scheduler;
