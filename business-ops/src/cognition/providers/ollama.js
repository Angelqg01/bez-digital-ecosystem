'use strict';

/**
 * Adaptador de Ollama (LLM + embeddings locales, sin coste por token).
 *
 * Expone la MISMA forma que el SDK de Anthropic (`provider.messages.create`)
 * para que `ModelGateway` lo use sin un solo cambio: basta registrarlo en
 * `providers.ollama` y apuntar un tier a `{ provider: 'ollama', model: 'qwen2.5:14b' }`.
 *
 * Soberanía: corre contra el contenedor `ollama` de infra/docker-compose.full.yml.
 * Sin servidor levantado, `complete()` cae a modo simulado igual que sin claves.
 */
class OllamaProvider {
  /**
   * @param {object} opts
   * @param {string} opts.baseUrl   - p.ej. http://localhost:11434
   * @param {string} opts.embedModel - modelo de embeddings (def. nomic-embed-text)
   * @param {function} opts.fetch   - inyectable para tests (def. global fetch)
   */
  constructor({ baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434', embedModel = 'nomic-embed-text', fetch, embedCacheMax = 500 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.embedModel = embedModel;
    this._fetch = fetch || globalThis.fetch;
    // Interfaz compatible con Anthropic SDK: provider.messages.create(...)
    this.messages = { create: (args) => this._chat(args) };

    // Caché de embeddings: `embed()` es una función determinista (mismo texto →
    // mismo vector) y se llama en CADA think() de CADA agente para recuperar
    // memoria. Cachearla ahorra una ida y vuelta HTTP por llamada sin ningún
    // riesgo de "respuesta rancia" — al contrario que cachear generaciones del
    // LLM, que devolvería el mismo borrador de email a clientes distintos.
    this.embedCacheMax = embedCacheMax;
    this._embedCache = new Map();   // `${model}\u0000${text}` -> number[]
    this.embedHits = 0;
    this.embedMisses = 0;
  }

  /** Traduce el formato Anthropic (system + messages + tools) → /api/chat de Ollama. */
  async _chat({ model, system, messages = [], max_tokens, tools }) {
    const msgs = system ? [{ role: 'system', content: system }, ...messages] : messages;
    const resp = await this._fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: msgs.flatMap((m) => this._toOllamaMessages(m)),
        stream: false,
        tools: tools?.length ? tools.map(OllamaProvider._toOllamaTool) : undefined,
        options: max_tokens ? { num_predict: max_tokens } : undefined,
      }),
    });
    if (!resp.ok) {
      const err = new Error(`ollama: HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    // Devuelve la forma que ModelGateway espera del SDK de Anthropic,
    // incluyendo bloques tool_use si el modelo local pidió herramientas.
    const content = [];
    if (data.message?.content) content.push({ type: 'text', text: data.message.content });
    for (const [i, tc] of (data.message?.tool_calls || []).entries()) {
      content.push({
        type: 'tool_use',
        id: tc.id || `ollama_tool_${Date.now()}_${i}`,
        name: tc.function?.name,
        input: typeof tc.function?.arguments === 'string'
          ? JSON.parse(tc.function.arguments || '{}')
          : (tc.function?.arguments || {}),
      });
    }
    return {
      content,
      stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: data.prompt_eval_count || 0,
        output_tokens: data.eval_count || 0,
      },
    };
  }

  /** Herramienta Anthropic {name, description, input_schema} → formato function de Ollama. */
  static _toOllamaTool(t) {
    return {
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    };
  }

  /**
   * Mensaje Anthropic → mensajes de Ollama. El contenido puede ser string o
   * bloques (text / tool_use / tool_result); Ollama usa role 'tool' para los
   * resultados y tool_calls en el mensaje del asistente.
   */
  _toOllamaMessages(m) {
    if (typeof m.content === 'string') return [{ role: m.role, content: m.content }];

    if (m.role === 'assistant') {
      const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const toolCalls = m.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({ function: { name: b.name, arguments: b.input || {} } }));
      return [{ role: 'assistant', content: text, tool_calls: toolCalls.length ? toolCalls : undefined }];
    }

    // role user: separa tool_result (→ role 'tool') del texto normal.
    const out = [];
    for (const b of m.content) {
      if (b.type === 'tool_result') {
        out.push({ role: 'tool', content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
      } else if (b.type === 'text') {
        out.push({ role: 'user', content: b.text });
      }
    }
    return out.length ? out : [{ role: m.role, content: '' }];
  }

  /** Embeddings locales para el RAG (pgvector/Qdrant). Devuelve number[]. */
  async embed(text, model = this.embedModel) {
    const key = `${model}\u0000${text}`;
    const cached = this._embedCache.get(key);
    if (cached) {
      this.embedHits++;
      // LRU simple: al usarlo, vuelve al final (Map conserva orden de inserción).
      this._embedCache.delete(key);
      this._embedCache.set(key, cached);
      return cached;
    }
    this.embedMisses++;

    const resp = await this._fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!resp.ok) {
      const err = new Error(`ollama embed: HTTP ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    const embedding = data.embedding || [];

    if (embedding.length) {
      this._embedCache.set(key, embedding);
      if (this._embedCache.size > this.embedCacheMax) {
        this._embedCache.delete(this._embedCache.keys().next().value); // desaloja el más antiguo
      }
    }
    return embedding;
  }
}

module.exports = OllamaProvider;
