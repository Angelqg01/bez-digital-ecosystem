'use strict';

/**
 * Store de express-rate-limit sobre Redis (ventana fija con INCR + EXPIRE, vía cache/redis.checkRateLimit), para que el
 * límite sea de TODAS las instancias de Cloud Run y no de cada una. Sin Redis (o si no responde) cae a un contador en
 * memoria de la instancia: es el comportamiento anterior, nunca peor.
 */
const { checkRateLimit } = require('../cache/redis');

class SharedRateLimitStore {
    /** @param {{prefix?: string, check?: Function}} opts  `check` sólo para tests */
    constructor({ prefix = 'rl', check = checkRateLimit } = {}) {
        this.prefix = prefix;
        this.check = check;
        this.local = new Map(); // key → { hits, reset }
    }

    init(options) { this.windowMs = options.windowMs; this.limit = options.limit ?? options.max; }
    prefijo(key) { return `${this.prefix}:${key}`; }

    async increment(key) {
        const windowSec = Math.max(1, Math.ceil(this.windowMs / 1000));
        try {
            const r = await this.check(this.prefijo(key), this.limit, windowSec);
            if (r && !r.degraded) return { totalHits: r.count, resetTime: new Date(Date.now() + (r.resetInSec || windowSec) * 1000) };
        } catch (_) { /* cae al contador local */ }
        const ahora = Date.now();
        let e = this.local.get(key);
        if (!e || e.reset <= ahora) { e = { hits: 0, reset: ahora + this.windowMs }; this.local.set(key, e); }
        e.hits += 1;
        if (this.local.size > 10000) for (const [k, v] of this.local) if (v.reset <= ahora) this.local.delete(k);
        return { totalHits: e.hits, resetTime: new Date(e.reset) };
    }

    async decrement(key) { const e = this.local.get(key); if (e && e.hits > 0) e.hits -= 1; }
    async resetKey(key) { this.local.delete(key); }
}

module.exports = { SharedRateLimitStore };
