'use strict';

/**
 * RateLimiter — límite de peticiones por ventana fija, por tenant.
 *
 * En memoria (suficiente para un nodo). En producción multi-nodo: respaldar en
 * Redis. `clock` se inyecta para tests.
 */
class RateLimiter {
  constructor({ limit = 120, windowMs = 60000, clock = () => Date.now() } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
    this._limits = {};          // id -> límite específico
    this._buckets = new Map();  // id -> { windowStart, count }
  }

  /** Fija un límite por tenant (p.ej. del plan). */
  setLimit(id, limit) {
    if (limit != null) this._limits[id] = limit;
  }

  /**
   * Consume una petición del cupo del id.
   * @returns {{allowed:boolean, remaining:number, limit:number, retryAfterMs:number}}
   */
  consume(id = 'global') {
    const limit = this._limits[id] ?? this.limit;
    const now = this.clock();
    let b = this._buckets.get(id);
    if (!b || now - b.windowStart >= this.windowMs) {
      b = { windowStart: now, count: 0 };
      this._buckets.set(id, b);
    }
    const allowed = b.count < limit;
    if (allowed) b.count++;
    return {
      allowed,
      remaining: Math.max(0, limit - b.count),
      limit,
      retryAfterMs: allowed ? 0 : this.windowMs - (now - b.windowStart),
    };
  }
}

module.exports = RateLimiter;
