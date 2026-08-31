'use strict';

/**
 * TaskQueue — cola de tareas con concurrencia limitada por tenant.
 * En producción se respalda con Redis (BullMQ). Esta implementación
 * en memoria sirve para desarrollo y como contrato de interfaz.
 *
 * Aparcado (park/unpark): una tarea que se queda esperando una decisión humana
 * (HITL) puede tardar horas. Mientras espera NO debe retener un hueco de
 * concurrencia — si lo retuviera, N aprobaciones pendientes congelarían al
 * tenant entero. `park()` devuelve el hueco a la cola y `unpark()` lo vuelve a
 * pedir cuando llega la decisión, con PRIORIDAD sobre el trabajo nuevo: lo que
 * un humano ya aprobó se termina antes de empezar nada más.
 */
class TaskQueue {
  constructor({ maxConcurrent = 5 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this._queue = [];
    this._active = 0;
    this._resuming = [];   // resolvers de tareas aparcadas que quieren volver a entrar
    this._handler = null;
    this._running = false;
  }

  start(handler) {
    this._handler = handler;
    this._running = true;
    this._drain();
  }

  stop() {
    this._running = false;
  }

  async enqueue(task) {
    this._queue.push(task);
    this._drain();
    return task.id;
  }

  /** Libera el hueco de una tarea que queda esperando a un humano. */
  park() {
    if (this._active > 0) this._active--;
    this._drain();
  }

  /**
   * Vuelve a reservar hueco tras la decisión humana. Si la cola está llena,
   * espera turno (por delante de las tareas nuevas que aún no han empezado).
   */
  async unpark() {
    // Con la cola parada no bloqueamos una acción ya aprobada por un humano.
    if (!this._running || this._active < this.maxConcurrent) {
      this._active++;
      return;
    }
    return new Promise((resolve) => { this._resuming.push(resolve); });
  }

  _drain() {
    if (!this._running || !this._handler) return;

    // 1) Primero, las tareas ya aprobadas que esperan reanudarse.
    while (this._active < this.maxConcurrent && this._resuming.length) {
      const resume = this._resuming.shift();
      this._active++;          // el hueco se contabiliza aquí, no en unpark()
      resume();
    }

    // 2) Después, trabajo nuevo.
    while (this._active < this.maxConcurrent && this._queue.length) {
      const task = this._queue.shift();
      this._active++;
      Promise.resolve(this._handler(task))
        .catch(() => {})
        .finally(() => {
          this._active--;
          this._drain();
        });
    }
  }

  get size() { return this._queue.length; }

  /** Tareas aparcadas esperando decisión humana (observabilidad). */
  get parked() { return this._resuming.length; }
}

module.exports = TaskQueue;
