/**
 * BeZhas — OllamaProvider v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Proveedor local actualizado con los modelos instalados en el setup:
 *   • gemma4:27b       — Razonamiento general, agentes departamentales
 *   • qwen3.6:35b-a3b  — Coding, Solidity, trading algorithms (MoE eficiente)
 *   • qwen3.6:27b      — Dense, fallback de qwen3.6 si no cabe el MoE
 *   • kimi-k2          — Agéntico multi-paso, contexto 128k
 *   • nomic-embed-text — Embeddings RAG para Obsidian
 *   • qwen3.6:8b       — Ultra-rápido para DevOps y monitoreo
 *
 * Integración nativa con:
 *   • ollama launch opencode  → IDE con contexto BeZhas
 *   • ollama launch openclaw  → Canales messaging
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const OLLAMA_MODELS = {
  // ── Modelos principales ─────────────────────────────────────────────────
  'gemma4': {
    contextLength:    128_000,
    parametersBn:     27,
    architecture:     'dense',
    strengths:        ['razonamiento general', 'español', 'análisis', 'multimodal', 'agentic'],
    bestFor:          ['marketing-agent', 'legal-agent', 'finance-agent', 'director-agent'],
    vramGB:           18,
    speedTokensPerSec: 40,
    flashAttention:   true,
    tier:             'primary'
  },
  'qwen3.6': {
    contextLength:    32_768,
    parametersBn:     35,
    activeParams:     3.5,
    architecture:     'MoE',
    strengths:        ['código', 'Solidity', 'Python', 'TypeScript', 'trading algorithms', 'razonamiento técnico'],
    bestFor:          ['trading-agent', 'blockchain-agent', 'devops-agent'],
    vramGB:           22,
    speedTokensPerSec: 55,
    isMoE:            true,
    tier:             'coding'
  },
  'deepseek-v4-pro': {
    contextLength:    65_536,
    parametersBn:     67,
    architecture:     'MoE',
    strengths:        ['deep logic', 'código avanzado', 'matemáticas', 'optimización de gas'],
    bestFor:          ['blockchain-agent', 'trading-agent'],
    vramGB:           32,
    speedTokensPerSec: 30,
    isMoE:            true,
    tier:             'pro_coding'
  },
  'kimi-k2.6': {
    contextLength:    131_072,   // 128k nativo
    parametersBn:     'MoE ~1T',
    architecture:     'MoE',
    strengths:        ['agentic multi-step', 'tool use', 'long context', 'coding', 'planning'],
    bestFor:          ['director-agent', 'complex_orchestration', 'long_research'],
    vramGB:           40,        // necesita RAM overflow con 4090
    speedTokensPerSec: 15,
    isMoE:            true,
    requiresRamOverflow: true,
    tier:             'flagship_local'
  },
  'nomic-embed-text': {
    contextLength:    8_192,
    parametersBn:     0.137,
    architecture:     'encoder',
    strengths:        ['embeddings', 'RAG', 'búsqueda semántica'],
    bestFor:          ['obsidian-rag', 'lead-scoring', 'semantic-search'],
    vramGB:           0.5,
    speedTokensPerSec: 5000,
    isEmbeddingModel: true,
    tier:             'embed'
  }
};

// ── Preferencias por agente (modelos ordenados por prioridad) ─────────────────
const AGENT_MODEL_PREFERENCES = {
  'trading-agent':    ['deepseek-v4-pro', 'qwen3.6', 'gemma4'],
  'blockchain-agent': ['deepseek-v4-pro', 'qwen3.6', 'gemma4'],
  'devops-agent':     ['qwen3.6', 'gemma4'],
  'marketing-agent':  ['gemma4', 'kimi-k2.6'],
  'legal-agent':      ['gemma4', 'kimi-k2.6', 'deepseek-v4-pro'],
  'finance-agent':    ['gemma4', 'deepseek-v4-pro', 'qwen3.6'],
  'director-agent':   ['kimi-k2.6', 'deepseek-v4-pro', 'gemma4'],
};

// ── Modelo a usar para cada tipo de tarea ────────────────────────────────────
const TASK_MODEL_MAP = {
  'code_generation':   'deepseek-v4-pro',
  'solidity_review':   'deepseek-v4-pro',
  'trading_analysis':  'qwen3.6',
  'lead_generation':   'gemma4',
  'legal_review':      'gemma4',
  'financial_report':  'gemma4',
  'orchestration':     'kimi-k2.6',
  'long_context':      'kimi-k2.6',
  'monitoring_alert':  'qwen3.6',
  'quick_classify':    'qwen3.6',
  'rag_embed':         'nomic-embed-text',
};

export class OllamaProvider {
  constructor(opts = {}) {
    this.host    = opts.host    || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.timeout = opts.timeout || 180_000;  // 3min para modelos grandes
    this.logger  = opts.logger  || console;
    this.name    = 'ollama-local';
    this.priority = 8;
    this.isLocal  = true;
    this.costPerToken = 0;
    this._availableCache  = null;
    this._installedModels = null;   // cache de modelos instalados
    this._lastModelCheck  = 0;
  }

  // ── Verificar disponibilidad ──────────────────────────────────────────────
  async isAvailable() {
    if (this._availableCache !== null) return this._availableCache;
    try {
      const res = await this._fetch('/api/version', { method: 'GET' });
      this._availableCache = res.ok;
      setTimeout(() => { this._availableCache = null; }, 300_000);
      return res.ok;
    } catch {
      this._availableCache = false;
      setTimeout(() => { this._availableCache = null; }, 60_000);
      return false;
    }
  }

  // ── Listar modelos instalados (con cache 5 min) ───────────────────────────
  async listInstalledModels() {
    const now = Date.now();
    if (this._installedModels && (now - this._lastModelCheck) < 300_000) {
      return this._installedModels;
    }
    const res  = await this._fetch('/api/tags', { method: 'GET' });
    const data = await res.json();
    this._installedModels = (data.models || []).map(m => m.name);
    this._lastModelCheck  = now;
    return this._installedModels;
  }

  async hasModel(name) {
    const installed = await this.listInstalledModels();
    const baseName  = name.split(':')[0];
    return installed.some(m => m === name || m.startsWith(baseName + ':'));
  }

  // ── Completar (API principal) ─────────────────────────────────────────────
  async generate(messages, opts = {}) {
    return this.complete(messages, opts);
  }

  /**
   * @param {Array<{role,content}>} messages
   * @param {object} opts
   * @param {string}  opts.model        - Nombre del modelo
   * @param {string}  opts.system       - System prompt
   * @param {number}  opts.temperature  - Default 0.7
   * @param {number}  opts.maxTokens    - Default 4096
   * @param {boolean} opts.think        - Activar modo thinking (qwen3.6)
   * @param {Function} [opts.onChunk]   - Callback para SSE streaming
   * @returns {Promise<{content, model, provider, usage, latency_ms}>}
   */
  async complete(messages, opts = {}) {
    const model       = opts.model       || 'gemma4';
    const temperature = opts.temperature ?? 0.7;
    const maxTokens   = opts.maxTokens   || 4096;
    const modelDef    = OLLAMA_MODELS[model] || {};

    // Preparar mensajes finales
    let finalMessages = [...messages];
    if (opts.system && !finalMessages.find(m => m.role === 'system')) {
      finalMessages = [{ role: 'system', content: opts.system }, ...finalMessages];
    }

    // Qwen3.6 soporta think mode (razonamiento interno)
    const options = {
      temperature,
      num_predict: maxTokens,
      num_ctx:     modelDef.contextLength || 32_768,
      ...(modelDef.flashAttention ? { flash_attn: true } : {})
    };

    const body = {
      model,
      messages:      finalMessages,
      stream:        !!opts.onChunk,
      think:         opts.think || false,  // Qwen3.6 thinking mode
      options
    };

    const t0  = Date.now();
    this.logger.info(`[Ollama] ▶ ${model} | ${finalMessages.length} msgs | think:${opts.think || false} | stream:${!!opts.onChunk}`);

    const res = await this._fetch('/api/chat', { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama ${model} → HTTP ${res.status}: ${err}`);
    }

    const elapsed = Date.now() - t0;
    
    if (opts.onChunk) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullContent = '';
      let usage = {};
      
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message && data.message.content) {
                fullContent += data.message.content;
                opts.onChunk(data.message.content);
              }
              if (data.done) {
                usage = {
                  prompt_tokens: data.prompt_eval_count || 0,
                  completion_tokens: data.eval_count || 0,
                  total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                  tokens_per_sec: data.eval_duration ? Math.round(data.eval_count / (data.eval_duration / 1e9)) : 0
                };
              }
            } catch (e) { /* ignore partial json */ }
          }
        }
      }
      
      const { thinking, answer } = this._parseThinking(fullContent);
      this.logger.info(`[Ollama] ✓ ${model} (stream) | ${elapsed}ms`);
      return {
        content: answer,
        thinking,
        model,
        provider: 'ollama-local',
        usage,
        latency_ms: elapsed
      };
    }

    const data    = await res.json();
    const content = data.message?.content || '';
    // Qwen3.6 thinking: separar <think>...</think> del contenido final
    const { thinking, answer } = this._parseThinking(content);

    this.logger.info(`[Ollama] ✓ ${model} | ${elapsed}ms | ${data.eval_count || '?'}t | speed:${data.eval_duration ? Math.round(data.eval_count / (data.eval_duration / 1e9)) : '?'}t/s`);

    return {
      content: answer,
      thinking,
      model,
      provider:  'ollama-local',
      usage: {
        prompt_tokens:     data.prompt_eval_count || 0,
        completion_tokens: data.eval_count        || 0,
        total_tokens:      (data.prompt_eval_count || 0) + (data.eval_count || 0),
        tokens_per_sec:    data.eval_duration ? Math.round(data.eval_count / (data.eval_duration / 1e9)) : 0
      },
      latency_ms: elapsed
    };
  }

  // Separar bloque <think> de la respuesta final (Qwen3.6 thinking mode)
  _parseThinking(content) {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      return {
        thinking: thinkMatch[1].trim(),
        answer:   content.replace(/<think>[\s\S]*?<\/think>/, '').trim()
      };
    }
    return { thinking: null, answer: content };
  }

  // ── Embeddings para RAG ───────────────────────────────────────────────────
  async embed(input, model = 'nomic-embed-text') {
    const inputs  = Array.isArray(input) ? input : [input];
    const results = [];
    for (const text of inputs) {
      const res  = await this._fetch('/api/embeddings', {
        method: 'POST',
        body: JSON.stringify({ model, prompt: text })
      });
      if (!res.ok) throw new Error(`Ollama embed error ${res.status}`);
      const data = await res.json();
      results.push(data.embedding);
    }
    return Array.isArray(input) ? results : results[0];
  }

  // ── Selección automática de modelo ───────────────────────────────────────
  /**
   * Elige el mejor modelo instalado para un agente o tarea específica.
   * @param {string} agentIdOrTask - ID de agente o tipo de tarea
   * @param {'agent'|'task'} mode
   */
  async selectBestModel(agentIdOrTask, mode = 'agent') {
    const installed = await this.listInstalledModels();

    const preference = mode === 'agent'
      ? (AGENT_MODEL_PREFERENCES[agentIdOrTask] || ['gemma4', 'qwen3.6'])
      : [TASK_MODEL_MAP[agentIdOrTask] || 'gemma4'];

    for (const model of preference) {
      const base = model.split(':')[0];
      const found = installed.find(m => m === model || m.startsWith(base + ':'));
      if (found) return found;
    }

    // Fallback: primer modelo disponible que no sea embeddings
    return installed.find(m => !m.includes('embed') && !m.includes('nomic')) || null;
  }

  // ── Pull de modelo con progreso ───────────────────────────────────────────
  async pullModel(modelName, onProgress) {
    this.logger.info(`[Ollama] Pulling: ${modelName}`);
    const res     = await this._fetch('/api/pull', { method: 'POST', body: JSON.stringify({ name: modelName, stream: true }) });
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) {
        for (const line of decoder.decode(value).split('\n').filter(Boolean)) {
          try {
            const p = JSON.parse(line);
            if (onProgress) onProgress(p);
            if (p.status === 'success') this.logger.info(`[Ollama] ✓ ${modelName} instalado`);
          } catch { /* ignorar */ }
        }
      }
    }
    this._installedModels = null;  // invalidar cache
  }

  // ── Configuración de ollama launch (opencode + openclaw) ─────────────────
  async launchOpenCode(projectPath, model = 'qwen3.6') {
    this.logger.info(`[Ollama] Configurando ollama launch opencode para ${projectPath}`);
    // Esto genera el comando que el usuario debe ejecutar en su terminal
    return {
      command: `ollama launch opencode --model ${model}`,
      env: { OPENCODE_WORKSPACE: projectPath },
      note: `Ejecutar en: ${projectPath}`,
      configPath: `${process.env.USERPROFILE || '~'}/.opencode/config.json`
    };
  }

  async launchOpenClaw() {
    return {
      command: 'ollama launch openclaw --yes',
      note: 'Conecta automáticamente Telegram, WhatsApp y Discord a Ollama',
      requires: ['TELEGRAM_BOT_TOKEN', 'WHATSAPP_ACCESS_TOKEN']
    };
  }

  // ── Estado completo del sistema ───────────────────────────────────────────
  async getSystemInfo() {
    try {
      const [versionRes, modelsRes] = await Promise.all([
        this._fetch('/api/version', { method: 'GET' }),
        this._fetch('/api/tags',    { method: 'GET' })
      ]);
      const version = await versionRes.json();
      const data    = await modelsRes.json();
      const models  = (data.models || []).map(m => ({
        name:    m.name,
        sizeGB:  +(m.size / 1e9).toFixed(1),
        known:   !!OLLAMA_MODELS[m.name],
        tier:    OLLAMA_MODELS[m.name]?.tier || 'unknown'
      }));

      // Verificar modelos BeZhas requeridos
      const required = ['gemma4', 'qwen3.6', 'deepseek-v4-pro', 'nomic-embed-text'];
      const missing  = required.filter(r => !models.find(m => m.name === r || m.name.startsWith(r.split(':')[0])));

      return {
        available:       true,
        host:            this.host,
        version:         version.version,
        models_count:    models.length,
        models,
        missing_recommended: missing,
        kimi_available:  models.some(m => m.name.startsWith('kimi')),
        gemma4_available: models.some(m => m.name.startsWith('gemma4')),
        qwen36_available: models.some(m => m.name.startsWith('qwen3.6')),
        gpu_note:        'RTX 4090 (24GB) — kimi-k2 requiere RAM overflow'
      };
    } catch (err) {
      return { available: false, error: err.message, host: this.host };
    }
  }

  // ── HTTP helper ───────────────────────────────────────────────────────────
  async _fetch(path, opts = {}) {
    const { default: fetch } = await import('node-fetch');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(`${this.host}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        ...opts
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
