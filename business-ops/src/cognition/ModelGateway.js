'use strict';

/**
 * ModelGateway — única puerta hacia los modelos de IA.
 *
 * Los agentes piden un "tier" (frontier | mid | fast) y el gateway elige el
 * modelo concreto. Esto permite cambiar de proveedor o versión sin tocar un
 * solo agente, y centralizar coste, reintentos, timeout y telemetría.
 *
 * Resiliencia: reintenta errores transitorios (429, 5xx, red, timeout) con
 * backoff exponencial + jitter, igual que hace el SDK de Anthropic.
 */
class ModelGateway {
  /**
   * @param {object} opts
   * @param {object} opts.providers - { anthropic: clientSDK, ... }
   * @param {object} opts.tierMap   - { frontier:{provider,model}, mid:{...}, fast:{...} }
   * @param {function} opts.onUsage - callback de telemetría/coste (opcional)
   * @param {number} opts.maxRetries - reintentos ante errores transitorios (def. 2)
   * @param {number} opts.baseDelayMs - base del backoff exponencial (def. 500)
   * @param {number} opts.maxDelayMs - tope del backoff (def. 8000)
   * @param {number} opts.timeoutMs - timeout por intento (def. 60000)
   * @param {boolean} opts.fallbackToSimulated - si el proveedor falla tras los
   *   reintentos, responde en modo simulado en vez de propagar el error. La
   *   tarea sigue viva (degradación) y el fallo queda en el resultado y en la
   *   telemetría. Por defecto false: quien orquesta decide (el server lo activa).
   * @param {function} opts.sleep   - inyectable para tests (def. setTimeout)
   * @param {function} opts.random  - inyectable para tests (def. Math.random)
   */
  constructor({
    providers = {}, tierMap = {}, onUsage = null,
    maxRetries = 2, baseDelayMs = 500, maxDelayMs = 8000, timeoutMs = 60000,
    fallbackToSimulated = false,
    sleep, random,
  } = {}) {
    this.providers = providers;
    this.tierMap = Object.keys(tierMap).length ? tierMap : ModelGateway.DEFAULT_TIERS;
    this.onUsage = onUsage;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.timeoutMs = timeoutMs;
    this.fallbackToSimulated = fallbackToSimulated;
    this.sleep = sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.random = random || Math.random;
  }

  static get DEFAULT_TIERS() {
    return {
      frontier: { provider: 'anthropic', model: 'claude-opus-4-8' },
      mid:      { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      fast:     { provider: 'anthropic', model: 'claude-haiku-4-5' },
    };
  }

  /**
   * @param {object} req - { tier, system, messages, maxTokens, meta }
   * @returns {Promise<{text, usage, model}>}
   */
  async complete(req) {
    const route = this.tierMap[req.tier] || this.tierMap.fast;
    const provider = this.providers[route.provider];

    if (!provider) {
      // Modo desarrollo sin claves: respuesta simulada para poder probar el flujo.
      const result = this._simulated(req, route);
      this._emitUsage(req, route, result.usage, true, { latencyMs: 0, output: result.text });
      return result;
    }

    const t0 = this._now();
    try {
      const result = await this._withRetries(() => this._callProvider(provider, route, req));
      this._emitUsage(req, route, result.usage, false, { latencyMs: this._now() - t0, output: result.text });
      return result;
    } catch (err) {
      if (!this.fallbackToSimulated) throw err;
      // Degradación: el proveedor está caído/sin crédito/sin modelo. Mejor una
      // respuesta simulada marcada que una tarea muerta. El fallo queda visible
      // en el resultado (fallback + error) y en la telemetría.
      console.warn(`[gateway] proveedor ${route.provider} falló (${err.message}); degradando a simulado`);
      const result = this._simulated(req, route);
      result.fallback = true;
      result.error = err.message;
      this._emitUsage(req, route, result.usage, true, { latencyMs: this._now() - t0, fallback: true, output: result.text, error: err.message });
      return result;
    }
  }

  _now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }

  /**
   * Como complete(), pero con tool-use: pasa las herramientas al proveedor y
   * devuelve las invocaciones que el modelo pide, además del texto.
   *
   * @param {object} req - { tier, system, messages, tools, maxTokens, meta }
   *   req.tools: [{ name, description, input_schema }] (formato Anthropic)
   * @returns {Promise<{text, toolCalls, content, stopReason, usage, model}>}
   *   toolCalls: [{ id, name, input }] — vacío si el modelo respondió solo texto.
   *   content: los bloques crudos del asistente (para reinyectarlos en messages).
   */
  async completeWithTools(req) {
    const route = this.tierMap[req.tier] || this.tierMap.fast;
    const provider = this.providers[route.provider];

    if (!provider) {
      const result = this._simulated(req, route);
      this._emitUsage(req, route, result.usage, true, { latencyMs: 0, output: result.text });
      return result;
    }

    const t0 = this._now();
    try {
      const result = await this._withRetries(() => this._callProviderWithTools(provider, route, req));
      this._emitUsage(req, route, result.usage, false, { latencyMs: this._now() - t0, output: result.text });
      return result;
    } catch (err) {
      if (!this.fallbackToSimulated) throw err;
      console.warn(`[gateway] proveedor ${route.provider} falló (${err.message}); degradando a simulado`);
      const result = this._simulated(req, route);
      result.fallback = true;
      result.error = err.message;
      this._emitUsage(req, route, result.usage, true, { latencyMs: this._now() - t0, fallback: true, output: result.text, error: err.message });
      return result;
    }
  }

  async _callProviderWithTools(provider, route, req) {
    const call = provider.messages.create({
      model: route.model,
      max_tokens: req.maxTokens || 1500,
      system: req.system,
      messages: req.messages,
      tools: req.tools && req.tools.length ? req.tools : undefined,
    });

    const resp = await this._withTimeout(call, this.timeoutMs);
    const content = resp.content || [];
    const text = content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const toolCalls = content
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input || {} }));
    const usage = { inputTokens: resp.usage?.input_tokens, outputTokens: resp.usage?.output_tokens };
    return { text, toolCalls, content, stopReason: resp.stop_reason || null, usage, model: route.model };
  }

  _simulated(req, route) {
    const first = req.messages?.[0]?.content;
    const preview = typeof first === 'string' ? first : JSON.stringify(first || '');
    return {
      text: `[SIMULADO · tier=${req.tier} · model=${route.model}] ${preview.slice(0, 80)}`,
      toolCalls: [],
      content: [],
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0 },
      model: route.model,
      simulated: true,
    };
  }

  // ── Internos ─────────────────────────────────────────────────────

  async _callProvider(provider, route, req) {
    // Ejemplo para el SDK de Anthropic. Adaptar por proveedor.
    const call = provider.messages.create({
      model: route.model,
      max_tokens: req.maxTokens || 1500,
      system: req.system,
      messages: req.messages,
    });

    const resp = await this._withTimeout(call, this.timeoutMs);
    const text = resp.content?.map((b) => (b.type === 'text' ? b.text : '')).join('') || '';
    const usage = { inputTokens: resp.usage?.input_tokens, outputTokens: resp.usage?.output_tokens };
    return { text, usage, model: route.model };
  }

  /** Reintenta fn ante errores transitorios con backoff exponencial + jitter. */
  async _withRetries(fn) {
    let lastErr;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!this._isRetryable(err) || attempt === this.maxRetries) break;
        const backoff = Math.min(this.baseDelayMs * 2 ** attempt, this.maxDelayMs);
        await this.sleep(backoff + this.random() * this.baseDelayMs);
      }
    }
    throw lastErr;
  }

  /** Corta una promesa que tarda más de ms (no cancela la subyacente). */
  async _withTimeout(promise, ms) {
    if (!ms) return promise;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const e = new Error(`ModelGateway: timeout tras ${ms}ms`);
        e.name = 'TimeoutError';
        reject(e);
      }, ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** ¿El error merece reintento? (mismo criterio que el SDK de Anthropic + red.) */
  _isRetryable(err) {
    if (err?.name === 'TimeoutError') return true;
    const status = err?.status ?? err?.statusCode;
    if (status === 408 || status === 409 || status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE', 'ENOTFOUND'].includes(err?.code);
  }

  _emitUsage(req, route, usage, simulated, extra = {}) {
    if (this.onUsage) {
      this.onUsage({
        tier: req.tier, model: route.model, usage, meta: req.meta || {}, simulated,
        system: req.system, input: req.messages,
        ...extra,
      });
    }
  }
}

module.exports = ModelGateway;
