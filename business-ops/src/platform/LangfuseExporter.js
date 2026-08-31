'use strict';

/**
 * LangfuseExporter — empuja cada llamada al modelo (ModelGateway.onUsage) como
 * una traza de Langfuse (trace + generation) vía POST /api/public/ingestion.
 *
 * Por qué fetch crudo y no el SDK oficial: mismo criterio que OtlpExporter —
 * este proyecto evita dependencias en piezas de infraestructura, y la API de
 * ingesta de Langfuse es HTTP+JSON estable, autenticada con Basic Auth usando
 * las claves pública/secreta del proyecto. Arrastrar el SDK entero para mandar
 * dos tipos de evento no compensa.
 *
 * Qué mapeo se hace: cada llamada al modelo = una traza con UNA generación
 * dentro. No se agrupan varias llamadas de una misma tarea de agente bajo la
 * misma traza porque BaseAgent no propaga un taskId hasta el gateway todavía
 * (ver docs/OBSERVABILIDAD-LANGFUSE.md). Aun así, cada llamada queda visible
 * con su prompt, respuesta, tokens, tenant y agente — que es lo que hace falta
 * para depurar producción y detectar regresiones de prompt.
 *
 * Cola con tope + envío por lotes: si Langfuse cae, la cola no crece sin
 * límite (se descartan los eventos más antiguos) y el servicio nunca se ve
 * afectado — un fallo de exportación solo se registra como aviso.
 *
 * Sin LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY/LANGFUSE_BASE_URL no hace nada,
 * igual que el resto de conectores sin credenciales.
 */
const crypto = require('node:crypto');

const MAX_QUEUE = 1000;   // best-effort: tope para que una caída larga no infle la memoria
const MAX_BATCH = 100;    // eventos por POST (Langfuse admite lotes de hasta 3.5MB; de sobra)

class LangfuseExporter {
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl    - p.ej. http://localhost:3000 (instancia self-hosted)
   * @param {string} opts.publicKey  - clave pública del proyecto Langfuse (pk-lf-...)
   * @param {string} opts.secretKey  - clave secreta del proyecto Langfuse (sk-lf-...)
   * @param {number} opts.intervalMs - cada cuánto se vacía la cola (def. 10s)
   * @param {function} opts.fetch    - inyectable para tests
   * @param {function} opts.clock    - inyectable para tests
   */
  constructor({
    baseUrl = process.env.LANGFUSE_BASE_URL || '',
    publicKey = process.env.LANGFUSE_PUBLIC_KEY || '',
    secretKey = process.env.LANGFUSE_SECRET_KEY || '',
    intervalMs = Number(process.env.LANGFUSE_FLUSH_INTERVAL_MS || 10_000),
    fetch: fetchImpl,
    clock = () => Date.now(),
  } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.publicKey = publicKey;
    this.secretKey = secretKey;
    this.intervalMs = intervalMs;
    this._fetch = fetchImpl || globalThis.fetch;
    this.clock = clock;
    this.enabled = Boolean(this.baseUrl && this.publicKey && this.secretKey);
    this._queue = [];
    this._timer = null;
    this.flushes = 0;
    this.dropped = 0;
    this.lastError = null;
  }

  /** Alimentado por ModelGateway.onUsage — misma forma de evento que Telemetry.recordModel. */
  recordModel(u = {}) {
    if (!this.enabled) return;
    const tenantId = u.meta?.tenantId || 'unknown';
    const agentId = u.meta?.agentId || 'unknown';
    const now = this.clock();
    const nowIso = new Date(now).toISOString();
    const latencyMs = typeof u.latencyMs === 'number' ? Math.max(0, u.latencyMs) : 0;
    const startIso = new Date(now - latencyMs).toISOString();
    const traceId = crypto.randomUUID();

    this._enqueue({
      id: crypto.randomUUID(),
      timestamp: nowIso,
      type: 'trace-create',
      body: {
        id: traceId,
        timestamp: nowIso,
        name: agentId,
        userId: tenantId,   // reutilizado como tenant: permite filtrar por cliente en el panel de Langfuse
        tags: [tenantId, agentId, u.tier || 'fast'].filter(Boolean),
        metadata: { tenantId, tier: u.tier, simulated: !!u.simulated, fallback: !!u.fallback },
      },
    });

    this._enqueue({
      id: crypto.randomUUID(),
      timestamp: nowIso,
      type: 'generation-create',
      body: {
        id: crypto.randomUUID(),
        traceId,
        name: `${agentId}:${u.tier || 'fast'}`,
        startTime: startIso,
        endTime: nowIso,
        model: u.model,
        input: { system: u.system, messages: u.input },
        output: u.output ?? null,
        usage: {
          input: u.usage?.inputTokens || 0,
          output: u.usage?.outputTokens || 0,
          unit: 'TOKENS',
        },
        metadata: { tenantId, simulated: !!u.simulated, fallback: !!u.fallback },
        level: u.error ? 'ERROR' : 'DEFAULT',
        statusMessage: u.error || undefined,
      },
    });
  }

  _enqueue(event) {
    this._queue.push(event);
    while (this._queue.length > MAX_QUEUE) {
      this._queue.shift();
      this.dropped++;
    }
  }

  /** Arranca el vaciado periódico. Idempotente; sin credenciales no hace nada. */
  start() {
    if (!this.enabled || this._timer) return false;
    this._timer = setInterval(() => { this.flush().catch(() => {}); }, this.intervalMs);
    if (this._timer.unref) this._timer.unref();   // no mantiene vivo el proceso
    return true;
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  /** Vacía hasta MAX_BATCH eventos. Nunca lanza: la observabilidad no puede tumbar el servicio. */
  async flush() {
    if (!this.enabled) return { sent: false, reason: 'sin credenciales de Langfuse' };
    if (!this._queue.length) return { sent: false, reason: 'cola vacía' };

    const batch = this._queue.splice(0, MAX_BATCH);
    try {
      const auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64');
      const res = await this._fetch(`${this.baseUrl}/api/public/ingestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify({ batch }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.flushes++;
      this.lastError = null;
      return { sent: true, count: batch.length };
    } catch (err) {
      // Un Langfuse caído no puede romper el producto: se pierde este lote y se
      // sigue — igual que OtlpExporter con las métricas.
      this.lastError = err.message;
      console.warn(`[langfuse] no se pudo exportar el lote: ${err.message}`);
      return { sent: false, reason: err.message };
    }
  }

  status() {
    return {
      enabled: this.enabled,
      baseUrl: this.baseUrl || null,
      intervalMs: this.intervalMs,
      queued: this._queue.length,
      flushes: this.flushes,
      dropped: this.dropped,
      lastError: this.lastError,
    };
  }
}

module.exports = LangfuseExporter;
