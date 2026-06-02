/**
 * BeZhas — ModelRouter
 * ─────────────────────────────────────────────────────────────────────────────
 * Decide qué modelo usar para cada solicitud. Prioriza:
 *   1. Modelo cloud preferido del agente (si API key disponible)
 *   2. Modelo local Ollama según el agente/tarea
 *   3. Fallback entre modelos disponibles
 *
 * Integra la lógica de los 3 nuevos modelos:
 *   • Kimi K2.6  → tareas agénticas largas, director-agent
 *   • Gemma 4    → general, español, agentes departamentales
 *   • Qwen3.6    → código, Solidity, trading algorithms
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Cascade de modelos cloud (en orden de preferencia) ───────────────────────
export const CLOUD_CASCADE = [
  {
    provider:    'claude',
    model:       'claude-sonnet-4-20250514',
    maxTokens:   8_096,
    envKey:      'ANTHROPIC_API_KEY',
    contextLen:  200_000,
    strengths:   ['razonamiento', 'código', 'análisis', 'herramientas'],
    tier:        'primary'
  },
  {
    provider:    'claude',
    model:       'claude-haiku-4-5-20251001',
    maxTokens:   4_096,
    envKey:      'ANTHROPIC_API_KEY',
    contextLen:  200_000,
    strengths:   ['velocidad', 'clasificación', 'respuestas cortas'],
    tier:        'fast'
  },
  {
    provider:    'gemini',
    model:       'gemini-2.0-flash',
    maxTokens:   8_096,
    envKey:      'GEMINI_API_KEY',
    contextLen:  1_000_000,
    strengths:   ['multimodal', 'contexto largo', 'velocidad'],
    tier:        'fallback_1'
  },
  {
    provider:    'kimi_cloud',
    model:       'moonshot-v1-128k',
    maxTokens:   8_096,
    envKey:      'KIMI_API_KEY',
    contextLen:  128_000,
    strengths:   ['contexto largo', 'coding', 'chino/inglés/español'],
    tier:        'fallback_2'
  },
  {
    provider:    'openai',
    model:       'gpt-4o-mini',
    maxTokens:   4_096,
    envKey:      'OPENAI_API_KEY',
    contextLen:  128_000,
    strengths:   ['general', 'tools'],
    tier:        'fallback_3'
  },
  {
    provider:    'deepseek',
    model:       'deepseek-chat',
    maxTokens:   4_096,
    envKey:      'DEEPSEEK_API_KEY',
    contextLen:  64_000,
    strengths:   ['código', 'bajo coste'],
    tier:        'fallback_4'
  }
];

// ── Modelos locales por agente ────────────────────────────────────────────────
const LOCAL_BY_AGENT = {
  'trading-agent':    [
    { model: 'qwen3.6:35b-a3b', reason: 'MoE eficiente para análisis técnico y algoritmos' },
    { model: 'qwen3.6:27b',     reason: 'Dense fallback para trading' },
    { model: 'gemma4:27b',      reason: 'General fallback' }
  ],
  'blockchain-agent': [
    { model: 'qwen3.6:35b-a3b', reason: 'Especialista en Solidity y código' },
    { model: 'qwen3.6:27b',     reason: 'Fallback Solidity' },
    { model: 'gemma4:27b',      reason: 'General fallback' }
  ],
  'devops-agent': [
    { model: 'qwen3.6:8b',      reason: 'Ultra-rápido para alertas y monitoring' },
    { model: 'qwen3.6:35b-a3b', reason: 'Para análisis complejos de infraestructura' },
    { model: 'gemma4:12b',      reason: 'Fast fallback' }
  ],
  'marketing-agent': [
    { model: 'gemma4:27b',      reason: 'Excelente en español y escritura persuasiva' },
    { model: 'kimi-k2',         reason: 'Para outreach largo y estrategia compleja' },
    { model: 'gemma4:12b',      reason: 'Fast para respuestas cortas' }
  ],
  'legal-agent': [
    { model: 'gemma4:27b',      reason: 'Razonamiento preciso y español legal' },
    { model: 'kimi-k2',         reason: 'Para análisis de documentos largos (MiCA, DAC8)' },
    { model: 'qwen3.6:27b',     reason: 'Fallback con razonamiento' }
  ],
  'finance-agent': [
    { model: 'gemma4:27b',      reason: 'Análisis financiero y cálculos impositivos' },
    { model: 'qwen3.6:35b-a3b', reason: 'Para análisis cuantitativo' },
    { model: 'gemma4:12b',      reason: 'Fast fallback' }
  ],
  'director-agent': [
    { model: 'kimi-k2',         reason: 'Agéntico multi-paso, orquestación compleja' },
    { model: 'gemma4:27b',      reason: 'Fallback para reportes ejecutivos' },
    { model: 'qwen3.6:27b',     reason: 'Fallback general' }
  ]
};

// ── Modelos locales por tipo de tarea ─────────────────────────────────────────
const LOCAL_BY_TASK = {
  'code_generation':    'qwen3.6:35b-a3b',
  'solidity_review':    'qwen3.6:35b-a3b',
  'trading_algo':       'qwen3.6:35b-a3b',
  'lead_copy':          'gemma4:27b',
  'legal_analysis':     'gemma4:27b',
  'financial_calc':     'gemma4:27b',
  'long_orchestration': 'kimi-k2',
  'document_analysis':  'kimi-k2',
  'monitoring_fast':    'qwen3.6:8b',
  'quick_classify':     'qwen3.6:8b',
  'rag_embed':          'nomic-embed-text'
};

export class ModelRouter {
  /**
   * @param {object} deps
   * @param {object} deps.ollama  - OllamaProvider
   * @param {object} [deps.logger]
   */
  constructor(deps) {
    this.ollama = deps.ollama;
    this.logger = deps.logger || console;
  }

  /**
   * Decide la estrategia de modelo para una solicitud.
   * @param {object} params
   * @param {string}  params.agentId     - ID del agente
   * @param {string}  [params.taskType]  - Tipo de tarea específico
   * @param {boolean} [params.forceLocal]- Forzar modelo local
   * @param {boolean} [params.forceCloud]- Forzar modelo cloud
   * @param {string}  [params.preferredCloud] - Modelo cloud preferido del agente
   * @returns {Promise<{strategy: 'cloud'|'local', model, provider, cloudEntry?, localModel?}>}
   */
  async resolveStrategy(params) {
    const { agentId, taskType, forceLocal, forceCloud, preferredCloud } = params;

    // 1. Si fuerza local y Ollama disponible
    if (forceLocal && this.ollama) {
      const localModel = await this._resolveLocal(agentId, taskType);
      if (localModel) return { strategy: 'local', model: localModel, provider: 'ollama-local' };
    }

    // 2. Construir cascade: preferido del agente primero
    const cascade = [...CLOUD_CASCADE];
    if (preferredCloud) {
      const idx = cascade.findIndex(m => m.model === preferredCloud);
      if (idx > 0) {
        const [entry] = cascade.splice(idx, 1);
        cascade.unshift(entry);
      }
    }

    // 3. Intentar cloud cascade (verificar API keys)
    if (!forceLocal) {
      for (const entry of cascade) {
        if (process.env[entry.envKey]) {
          this.logger.info(`[Router] Cloud: ${entry.provider}/${entry.model}`);
          return { strategy: 'cloud', model: entry.model, provider: entry.provider, cloudEntry: entry };
        }
      }
    }

    // 4. Fallback a local
    if (this.ollama) {
      const localModel = await this._resolveLocal(agentId, taskType);
      if (localModel) {
        this.logger.warn(`[Router] Todos los cloud sin API key → Local: ${localModel}`);
        return { strategy: 'local', model: localModel, provider: 'ollama-local' };
      }
    }

    throw new Error('No hay modelos disponibles (cloud sin API keys ni Ollama accesible)');
  }

  async _resolveLocal(agentId, taskType) {
    if (!this.ollama) return null;

    // Por tipo de tarea
    if (taskType && LOCAL_BY_TASK[taskType]) {
      const target = LOCAL_BY_TASK[taskType];
      if (await this.ollama.hasModel(target)) return target;
    }

    // Por agente
    if (agentId && LOCAL_BY_AGENT[agentId]) {
      for (const { model } of LOCAL_BY_AGENT[agentId]) {
        if (await this.ollama.hasModel(model)) return model;
      }
    }

    // Último recurso: cualquier modelo disponible
    return this.ollama.selectBestModel(agentId || 'director-agent', 'agent');
  }

  /**
   * Retorna el router completo de todos los modelos para logging/debugging.
   */
  getRoutingTable() {
    return {
      cloud_cascade:  CLOUD_CASCADE.map(m => ({ model: m.model, provider: m.provider, hasKey: !!process.env[m.envKey] })),
      local_by_agent: Object.fromEntries(Object.entries(LOCAL_BY_AGENT).map(([k, v]) => [k, v.map(m => m.model)])),
      local_by_task:  LOCAL_BY_TASK
    };
  }
}
