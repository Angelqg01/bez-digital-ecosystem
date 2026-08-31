/**
 * apiSecurity — núcleo de seguridad de la API pública de BeZhas.
 *
 * Cierra tres huecos reales del gateway actual:
 *
 *   1) SCOPES NO APLICADOS. `api_keys.permissions` (jsonb) se guardaba pero
 *      nadie lo comprobaba: una clave emitida como solo-lectura podía escribir.
 *      → `requireScope('wallet:write')`
 *
 *   2) SIN FIRMA NI ANTI-REPLAY. Una API key en cabecera es un portador: si se
 *      filtra (log de proxy, CI, historial), sirve para siempre desde cualquier
 *      sitio. Firmar cada petición ata la llamada a su cuerpo, su instante y un
 *      nonce irrepetible — el estándar de Stripe/AWS para APIs institucionales.
 *      → `verifySignature()`
 *
 *   3) SIN IDEMPOTENCIA. Un reintento de red podía tokenizar o cobrar dos veces.
 *      → `idempotency()`
 *
 * ESCALABILIDAD: los almacenes de nonces y de idempotencia son INYECTABLES.
 * Por defecto usan un caché en memoria con TTL y tamaño acotado (válido para
 * un proceso); en producción multi-instancia se inyecta Redis, que ya existe en
 * el proyecto (`services/redis.service.js`), y el comportamiento no cambia.
 *
 * COMPATIBILIDAD: todo es OPT-IN por ruta. Las integraciones existentes siguen
 * funcionando hasta que decidas activar cada capa.
 */
const crypto = require('crypto');

// ── Caché con TTL y tamaño acotado (el límite evita agotar memoria por DoS) ──
function createMemoryStore({ max = 50000 } = {}) {
    const m = new Map();
    function prune() {
        const now = Date.now();
        for (const [k, v] of m) if (v.exp <= now) m.delete(k);
        if (m.size > max) {
            const excess = m.size - max;
            let i = 0;
            for (const k of m.keys()) { if (i++ >= excess) break; m.delete(k); }
        }
    }
    return {
        async get(k) { const v = m.get(k); if (!v) return null; if (v.exp <= Date.now()) { m.delete(k); return null; } return v.val; },
        async set(k, val, ttlMs) { prune(); m.set(k, { val, exp: Date.now() + ttlMs }); return true; },
        /** Inserta sólo si no existía. Base de la protección anti-replay. */
        async setNX(k, val, ttlMs) {
            prune();
            const cur = m.get(k);
            if (cur && cur.exp > Date.now()) return false;
            m.set(k, { val, exp: Date.now() + ttlMs });
            return true;
        },
        async del(k) { return m.delete(k); },
        get size() { return m.size; },
    };
}

function deny(res, status, code, message) {
    return res.status(status).json({ error: code, code, message });
}

/** Comparación en tiempo constante (evita filtrar el secreto por timing). */
function safeEqual(a, b) {
    const A = Buffer.from(String(a || ''), 'utf8');
    const B = Buffer.from(String(b || ''), 'utf8');
    if (A.length !== B.length) return false;
    return crypto.timingSafeEqual(A, B);
}

function sha256Hex(data) {
    return crypto.createHash('sha256').update(data || '').digest('hex');
}

/**
 * Cadena canónica que se firma. Incluir método, ruta, cuerpo e instante impide
 * reutilizar una firma para otra operación o repetirla más tarde.
 */
function canonicalString({ timestamp, nonce, method, path, bodyHash }) {
    return [String(timestamp), String(nonce), String(method || '').toUpperCase(), path, bodyHash].join('\n');
}

function signRequest({ secret, timestamp, nonce, method, path, body }) {
    const bodyHash = sha256Hex(typeof body === 'string' ? body : JSON.stringify(body ?? ''));
    const canonical = canonicalString({ timestamp, nonce, method, path, bodyHash });
    return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

function createApiSecurity(deps = {}) {
    const nonceStore = deps.nonceStore || createMemoryStore({ max: 50000 });
    const idemStore = deps.idempotencyStore || createMemoryStore({ max: 20000 });
    const logger = deps.logger || console;
    // Las claves antiguas no tienen `permissions`. Con `true` (por defecto) se
    // les permite operar dentro de su tenant para no romper integraciones; pon
    // API_STRICT_SCOPES=true cuando hayas migrado todas las claves.
    const legacyKeysAllowAll = deps.legacyKeysAllowAll !== undefined
        ? deps.legacyKeysAllowAll
        : process.env.API_STRICT_SCOPES !== 'true';

    /** Scopes de la clave, tolerante al formato (array o jsonb string). */
    function keyScopes(req) {
        const raw = req.apiKeyRecord?.permissions;
        if (!raw) return null;
        let arr = raw;
        if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return null; } }
        if (!Array.isArray(arr)) return null;
        return arr.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
    }

    /** ¿`granted` cubre `needed`? Soporta comodines `*` y `recurso:*`. */
    function scopeSatisfies(granted, needed) {
        const g = String(granted).toLowerCase();
        const n = String(needed).toLowerCase();
        if (g === '*' || g === n) return true;
        if (g.endsWith(':*')) return n.startsWith(g.slice(0, -1));
        return false;
    }

    /**
     * Exige un scope concreto sobre la API key. Úsalo tras `apiKeyTenant`.
     * No hay herencia implícita: `wallet:write` NO concede `wallet:read`;
     * se conceden explícitamente o con comodín. Menos sorpresas, menos riesgo.
     */
    function requireScope(needed) {
        return function scopeGuard(req, res, next) {
            if (!req.apiKeyRecord) {
                return deny(res, 401, 'NO_API_KEY', 'Esta ruta requiere una API key.');
            }
            const scopes = keyScopes(req);
            if (scopes === null || scopes.length === 0) {
                if (legacyKeysAllowAll) {
                    logger.warn?.({ keyId: req.apiKeyId, needed },
                        '[apiSecurity] clave sin scopes operando en modo legado');
                    return next();
                }
                return deny(res, 403, 'NO_SCOPES', 'Esta API key no tiene scopes asignados.');
            }
            if (scopes.some((g) => scopeSatisfies(g, needed))) return next();
            return deny(res, 403, 'SCOPE_DENIED',
                `Esta API key no tiene el permiso '${needed}'.`);
        };
    }

    /**
     * Verifica la firma HMAC de la petición.
     * Cabeceras: X-BeZhas-Timestamp (epoch s), X-BeZhas-Nonce, X-BeZhas-Signature.
     * El secreto se resuelve con `resolveSecret(req)` (por defecto, el de la key).
     */
    function verifySignature(opts = {}) {
        const maxSkewSec = opts.maxSkewSec ?? 300;          // ±5 min
        const nonceTtlMs = opts.nonceTtlMs ?? (maxSkewSec * 2 + 60) * 1000;
        const resolveSecret = opts.resolveSecret
            || ((req) => req.apiKeyRecord?.signing_secret || req.apiKeyRecord?.webhook_secret || null);

        return async function signatureGuard(req, res, next) {
            try {
                const ts = req.get?.('X-BeZhas-Timestamp');
                const nonce = req.get?.('X-BeZhas-Nonce');
                const sig = req.get?.('X-BeZhas-Signature');
                if (!ts || !nonce || !sig) {
                    return deny(res, 401, 'SIGNATURE_REQUIRED',
                        'Faltan X-BeZhas-Timestamp, X-BeZhas-Nonce o X-BeZhas-Signature.');
                }

                const skew = Math.abs(Date.now() / 1000 - Number(ts));
                if (!Number.isFinite(skew) || skew > maxSkewSec) {
                    return deny(res, 401, 'TIMESTAMP_SKEW',
                        `El instante de la petición se desvía más de ${maxSkewSec}s del servidor.`);
                }

                const secret = await resolveSecret(req);
                if (!secret) {
                    return deny(res, 401, 'NO_SIGNING_SECRET',
                        'Esta API key no tiene secreto de firma configurado.');
                }

                // El cuerpo crudo es lo que se firma; si no está, se recompone.
                const body = req.rawBody !== undefined ? req.rawBody : JSON.stringify(req.body ?? '');
                const expected = signRequest({
                    secret, timestamp: ts, nonce,
                    method: req.method, path: req.originalUrl || req.url, body,
                });
                if (!safeEqual(sig, expected)) {
                    return deny(res, 401, 'BAD_SIGNATURE', 'La firma de la petición no es válida.');
                }

                // Anti-replay: el nonce sólo puede usarse una vez en su ventana.
                const fresh = await nonceStore.setNX(`nonce:${req.apiKeyId || 'anon'}:${nonce}`, 1, nonceTtlMs);
                if (!fresh) {
                    return deny(res, 409, 'REPLAY_DETECTED', 'Esta petición ya se procesó (nonce repetido).');
                }
                req.signatureVerified = true;
                return next();
            } catch (err) {
                return next(err);
            }
        };
    }

    /**
     * Idempotencia estilo Stripe: `Idempotency-Key` en la cabecera.
     * Misma clave + mismo cuerpo → se devuelve la respuesta guardada.
     * Misma clave + cuerpo distinto → 422 (uso incorrecto del cliente).
     * Petición aún en vuelo → 409, para que el cliente reintente.
     */
    function idempotency(opts = {}) {
        const ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;    // 24 h
        const required = !!opts.required;
        const methods = opts.methods || ['POST', 'PUT', 'PATCH'];

        return async function idempotencyGuard(req, res, next) {
            if (!methods.includes(req.method)) return next();
            const key = req.get?.('Idempotency-Key');
            if (!key) {
                if (required) {
                    return deny(res, 400, 'IDEMPOTENCY_KEY_REQUIRED',
                        'Esta operación requiere la cabecera Idempotency-Key.');
                }
                return next();
            }

            const scopeId = req.apiKeyId || req.tenant?.orgId || 'anon';
            const cacheKey = `idem:${scopeId}:${key}`;
            const bodyHash = sha256Hex(JSON.stringify(req.body ?? ''));

            const prev = await idemStore.get(cacheKey);
            if (prev) {
                if (prev.bodyHash !== bodyHash) {
                    return deny(res, 422, 'IDEMPOTENCY_KEY_REUSED',
                        'Esta Idempotency-Key ya se usó con un cuerpo distinto.');
                }
                if (prev.status === 'in_flight') {
                    return deny(res, 409, 'REQUEST_IN_FLIGHT',
                        'Una petición idéntica se está procesando. Reintenta en unos segundos.');
                }
                res.set('Idempotent-Replay', 'true');
                return res.status(prev.statusCode).json(prev.body);
            }

            await idemStore.set(cacheKey, { status: 'in_flight', bodyHash }, Math.min(ttlMs, 60000));

            // Captura la respuesta para poder repetirla ante un reintento.
            const originalJson = res.json.bind(res);
            res.json = (payload) => {
                const statusCode = res.statusCode || 200;
                if (statusCode >= 200 && statusCode < 300) {
                    idemStore.set(cacheKey, { status: 'done', statusCode, body: payload, bodyHash }, ttlMs)
                        .catch(() => {});
                } else {
                    // Un fallo no se cachea: el cliente debe poder reintentar.
                    idemStore.del(cacheKey).catch(() => {});
                }
                return originalJson(payload);
            };
            return next();
        };
    }

    return {
        requireScope, verifySignature, idempotency,
        signRequest, canonicalString, safeEqual, scopeSatisfies, keyScopes,
        nonceStore, idempotencyStore: idemStore, createMemoryStore,
    };
}

const _default = createApiSecurity();
module.exports = { createApiSecurity, createMemoryStore, signRequest, canonicalString, ..._default };
