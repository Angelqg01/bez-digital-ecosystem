/**
 * BeZhas Agent Runtime — TaskQueue
 * Cola de tareas con prioridades y control de concurrencia.
 *
 * Prioridades: critical > high > normal > low
 * Concurrencia: configurable (default: 5 tareas simultáneas)
 */

'use strict';

const EventEmitter = require('events');

const PRIORITY_MAP = { critical: 0, high: 1, normal: 2, low: 3 };

class TaskQueue extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.maxConcurrent = opts.maxConcurrent || 5;
    this._queue   = [];         // tareas pendientes, ordenadas por prioridad
    this._running = new Set();  // taskIds en ejecución ahora
    this._handler = null;       // función async (task) => result
    this._active  = false;
    this._drainTimer = null;
  }

  // ─────────────────────────────────────────────
  // CONTROL
  // ─────────────────────────────────────────────

  start(handler) {
    if (this._active) return;
    if (typeof handler !== 'function') throw new Error('Handler debe ser una función async');
    this._handler = handler;
    this._active  = true;
    this._tick();
    console.log(`[TaskQueue] ▶️  Iniciada. Concurrencia máx: ${this.maxConcurrent}`);
  }

  stop() {
    this._active = false;
    if (this._drainTimer) clearTimeout(this._drainTimer);
    console.log(`[TaskQueue] ⏹️  Detenida. Pendientes: ${this._queue.length}`);
  }

  // ─────────────────────────────────────────────
  // ENCOLAR
  // ─────────────────────────────────────────────

  enqueue(task) {
    const priority = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.normal;
    const entry = { ...task, _priority: priority, _enqueuedAt: Date.now() };

    // Inserción ordenada por prioridad (menor número = mayor urgencia)
    let i = this._queue.length;
    while (i > 0 && this._queue[i - 1]._priority > priority) i--;
    this._queue.splice(i, 0, entry);

    this.emit('enqueued', entry);
    this._tick();

    return entry.id;
  }

  // ─────────────────────────────────────────────
  // CANCELAR
  // ─────────────────────────────────────────────

  cancel(taskId) {
    const idx = this._queue.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      const [removed] = this._queue.splice(idx, 1);
      this.emit('cancelled', removed);
      console.log(`[TaskQueue] 🚫 Tarea cancelada: ${taskId}`);
      return true;
    }
    return false; // ya está en ejecución, no se puede cancelar
  }

  // ─────────────────────────────────────────────
  // ESTADO
  // ─────────────────────────────────────────────

  get size()       { return this._queue.length; }
  get activeCount(){ return this._running.size; }
  get isIdle()     { return this._queue.length === 0 && this._running.size === 0; }

  getStatus() {
    return {
      queued:     this._queue.length,
      running:    this._running.size,
      maxAllowed: this.maxConcurrent,
      active:     this._active,
      next:       this._queue[0]?.id || null,
    };
  }

  // ─────────────────────────────────────────────
  // DISPATCH INTERNO
  // ─────────────────────────────────────────────

  _tick() {
    if (!this._active) return;
    if (this._drainTimer) { clearTimeout(this._drainTimer); this._drainTimer = null; }

    // Procesar todo lo que quepa en el slot de concurrencia
    while (this._queue.length > 0 && this._running.size < this.maxConcurrent) {
      const task = this._queue.shift();
      this._dispatch(task);
    }

    // Si hay tareas corriendo, revisar de nuevo cuando termine alguna
    if (this._queue.length > 0 && this._running.size >= this.maxConcurrent) {
      // El _tick() siguiente se dispara desde _dispatch() al completar
    }

    // Idle drain
    if (this.isIdle) this.emit('drain');
  }

  async _dispatch(task) {
    this._running.add(task.id);
    const waitMs = Date.now() - task._enqueuedAt;
    console.log(`[TaskQueue] ⚙️  Ejecutando ${task.id} (prioridad: ${task.priority}, espera: ${waitMs}ms)`);
    this.emit('started', task);

    try {
      const result = await this._handler(task);
      this.emit('completed', { task, result });
    } catch (err) {
      console.error(`[TaskQueue] ❌ Error en ${task.id}:`, err.message);
      this.emit('failed', { task, error: err });
    } finally {
      this._running.delete(task.id);
      // Disparar siguiente ciclo tras completar
      this._drainTimer = setTimeout(() => this._tick(), 0);
    }
  }
}

module.exports = TaskQueue;
