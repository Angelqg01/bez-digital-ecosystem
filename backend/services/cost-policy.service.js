/**
 * ============================================================================
 * COST POLICY — coste cero para el admin, mínimo para el resto
 * ============================================================================
 *
 * Dos palancas, ambas locales y sin dependencias:
 *
 *  1. Caché con TTL + consultas en vuelo compartidas para las herramientas MCP
 *     de solo lectura (explorer, analysis, defi, ...). Una ráfaga de peticiones
 *     idénticas paga UNA llamada a la API externa, no N.
 *  2. Contexto de coste: una petición con credenciales de admin se marca
 *     `billable: false`. El admin no consume créditos ni cuota.
 *
 * Nunca se cachean herramientas con efectos (trading, publicación, automatización):
 * repetir una orden no puede devolver «lo de hace un minuto».
 */

const READ_ONLY_TYPES = new Set(['explorer', 'analysis', 'defi', 'monitoring', 'governance', 'security']);

function envNumber(name, fallback) {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const DEFAULT_TTL_MS = envNumber('MCP_CACHE_TTL_MS', 60_000);
const MAX_ENTRIES = envNumber('MCP_CACHE_MAX_ENTRIES', 500);

/** Serialización estable: mismas claves en distinto orden dan la misma huella. */
function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** LRU con TTL. Map conserva el orden de inserción: re-insertar = «usado ahora». */
class TtlCache {
    constructor({ ttlMs = DEFAULT_TTL_MS, maxEntries = MAX_ENTRIES, now = Date.now } = {}) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.now = now;
        this.store = new Map();
        this.inflight = new Map();
        this.stats = { hits: 0, misses: 0, shared: 0 };
    }

    get(key) {
        const hit = this.store.get(key);
        if (!hit) return undefined;
        if (hit.expires <= this.now()) {
            this.store.delete(key);
            return undefined;
        }
        this.store.delete(key);
        this.store.set(key, hit);
        return hit.value;
    }

    set(key, value, ttlMs = this.ttlMs) {
        if (ttlMs <= 0) return;
        this.store.delete(key);
        this.store.set(key, { value, expires: this.now() + ttlMs });
        while (this.store.size > this.maxEntries) {
            this.store.delete(this.store.keys().next().value);
        }
    }

    /**
     * Devuelve el valor cacheado o ejecuta `loader` una sola vez aunque lleguen
     * varias peticiones a la vez. `shouldCache(valor)` evita guardar fallos.
     */
    async wrap(key, loader, { shouldCache = () => true, ttlMs } = {}) {
        const cached = this.get(key);
        if (cached !== undefined) {
            this.stats.hits++;
            return { value: cached, cached: true };
        }
        if (this.inflight.has(key)) {
            this.stats.shared++;
            return { value: await this.inflight.get(key), cached: true };
        }
        this.stats.misses++;
        const pending = (async () => {
            const value = await loader();
            if (shouldCache(value)) this.set(key, value, ttlMs);
            return value;
        })().finally(() => this.inflight.delete(key));
        this.inflight.set(key, pending);
        return { value: await pending, cached: false };
    }

    clear() {
        this.store.clear();
        this.inflight.clear();
    }

    get size() {
        return this.store.size;
    }
}

function isCacheableTool(tool) {
    return Boolean(tool) && READ_ONLY_TYPES.has(tool.type) && tool.cacheable !== false;
}

function cacheKey(toolName, params) {
    // `_context` es el estado del pipeline: cambia el resultado, así que forma parte de la clave.
    return `${toolName}:${stableStringify(params || {})}`;
}

/** Contexto de coste de una petición Express. Admin => no facturable. */
function costContextFromRequest(req) {
    const admin = Boolean(req && req.admin);
    return { admin, billable: !admin };
}

module.exports = {
    TtlCache,
    stableStringify,
    isCacheableTool,
    cacheKey,
    costContextFromRequest,
    READ_ONLY_TYPES,
};
