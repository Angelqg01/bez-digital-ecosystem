/**
 * BeZhas — OpenClawOrchestrator
 * ─────────────────────────────────────────────────────────────────────────────
 * Orquestador central que une todos los sistemas:
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  Telegram/WhatsApp/Discord                                       │
 *   │          ↓                                                       │
 *   │  OpenClawOrchestrator                                            │
 *   │    ├─ AgentToolRegistry  → ¿Qué agente? ¿Qué tools?             │
 *   │    ├─ RedisMemoryManager → Historial + working memory            │
 *   │    ├─ HumanInLoopManager → Bloquear acciones críticas            │
 *   │    ├─ LLM Cascade        → Claude → Gemini → Kimi → Ollama local │
 *   │    └─ MCP Client         → Ejecutar tools reales                 │
 *   └──────────────────────────────────────────────────────────────────┘
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { agentRegistry } from './AgentToolRegistry.js';
import GeminiClient from '../agent-lib/core/GeminiClient.js';

// ─── Cascade de modelos cloud ─────────────────────────────────────────────────
const CLOUD_MODELS = [
  { provider: 'gemini',  model: 'gemini-2.0-flash',            maxTokens: 8096  },
  { provider: 'deepseek',model: 'deepseek-chat',               maxTokens: 4096  },
  { provider: 'claude',  model: 'claude-sonnet-4-20250514',    maxTokens: 8096  },
  { provider: 'claude',  model: 'claude-haiku-4-5-20251001',   maxTokens: 4096  },
  { provider: 'kimi',    model: 'moonshot-v1-128k',            maxTokens: 8096  },
  { provider: 'openai',  model: 'gpt-4o-mini',                 maxTokens: 4096  },
];

export class OpenClawOrchestrator {
  /**
   * @param {object} deps
   * @param {object}  deps.memory    - RedisMemoryManager
   * @param {object}  deps.hil       - HumanInLoopManager
   * @param {object}  deps.ollama    - OllamaProvider
   * @param {object}  deps.telegram  - TelegramClient
   * @param {object}  [deps.logger]  - Logger
   */
  constructor(deps) {
    this.memory   = deps.memory;
    this.hil      = deps.hil;
    this.ollama   = deps.ollama;
    this.telegram = deps.telegram;
    this.logger   = deps.logger || console;
    this.registry = agentRegistry;

    // Clientes cloud (inicializados bajo demanda)
    this._claude = null;
    this._mcpClients = new Map();   // mcpId → cliente MCP activo
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUNTO DE ENTRADA PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Procesa un mensaje entrante y genera una respuesta.
   *
   * @param {object} params
   * @param {string}  params.sessionId  - ID único de sesión (chatId:userId)
   * @param {string}  params.text       - Texto del mensaje del usuario
   * @param {string}  [params.agentId]  - Forzar un agente específico (opcional)
   * @param {string}  [params.userId]   - ID del usuario
   * @param {boolean} [params.isAuthorized] - Si el usuario puede aprobar acciones
   * @returns {Promise<{text: string, agentId: string, toolsUsed: string[]}>}
   */
  async process(params) {
    const { sessionId, text, userId, isAuthorized = false, onChunk } = params;

    // 1. Detectar qué agente debe responder
    const agentId  = params.agentId || this.registry.routeIntent(text);
    const agentDef = this.registry.getAgent(agentId);

    this.logger.info(`[OpenClaw] → Agente: ${agentId} | sesión: ${sessionId}`);

    // 2. Guardar mensaje en memoria
    await this.memory.addMessage(sessionId, 'user', text, { agent: agentId, userId });

    // 3. Recuperar historial + contexto de trabajo
    const history  = await this.memory.getHistoryForLLM(sessionId, agentDef.maxHistoryMessages || 20);
    const workMem  = await this.memory.getAllWorkingMemory(agentId);
    const tasks    = await this.memory.getPendingTasks(agentId);

    // 4. Construir system prompt completo
    const systemPrompt = this._buildSystemPrompt(agentDef, workMem, tasks);

    // 5. Obtener tools disponibles para el agente
    const availableTools = this.registry.getAvailableTools(agentId);
    const toolSchemas    = this._buildToolSchemas(availableTools);

    // 6. Invocar LLM (híbrido cloud <-> local basado en complejidad)
    const priority = this._detectComplexity(text);
    const llmResult = await this._invokeWithCascade({
      systemPrompt,
      messages: history,
      tools: toolSchemas,
      agentDef,
      priority,
      onChunk
    });

    // 7. Procesar tool calls si el LLM los solicita
    const { finalText, toolsUsed } = await this._processToolCalls({
      agentId, agentDef, sessionId, userId, isAuthorized,
      llmResult, toolSchemas, systemPrompt, history
    });

    // 8. Guardar respuesta en memoria
    await this.memory.addMessage(sessionId, 'assistant', finalText, {
      agent: agentId,
      tools_used: toolsUsed
    });

    // 8.5 Guardar SKILL de la movida para fine-tuning (aprendizaje local)
    if (this.memory.redis) {
      await this.memory.redis.lpush('bezhas:dataset:skills', JSON.stringify({
        agent: agentId,
        input: text,
        output: finalText,
        tools: toolsUsed,
        provider: llmResult.provider,
        ts: Date.now()
      }));
    }

    // 9. Actualizar working memory con contexto del resultado
    if (toolsUsed.length > 0) {
      await this.memory.setWorkingMemory(agentId, 'last_tools_used', toolsUsed);
      await this.memory.setWorkingMemory(agentId, 'last_action_ts', Date.now());
    }

    return { text: finalText, agentId, toolsUsed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCCIÓN DEL SYSTEM PROMPT
  // ═══════════════════════════════════════════════════════════════════════════

  _buildSystemPrompt(agentDef, workMem, tasks) {
    const parts = [agentDef.systemPrompt];

    if (agentDef.skills?.length) {
      parts.push('\n## SKILLs BeZhas disponibles para este agente:');
      for (const skill of agentDef.skills) {
        parts.push(`- ${skill}`);
      }
      parts.push('Usa estos SKILLs como runbooks internos cuando la tarea coincida con su nombre o dominio.');
    }

    // Añadir working memory si tiene contenido relevante
    const memKeys = Object.keys(workMem);
    if (memKeys.length > 0) {
      parts.push('\n## Memoria de trabajo actual:');
      for (const [k, v] of Object.entries(workMem)) {
        parts.push(`- ${k}: ${JSON.stringify(v)}`);
      }
    }

    // Añadir tareas pendientes
    if (tasks.length > 0) {
      parts.push('\n## Tareas pendientes:');
      tasks.slice(0, 5).forEach((t, i) => {
        parts.push(`${i + 1}. [${t.type}] ${t.description}`);
      });
    }

    parts.push('\n## Reglas de comportamiento:');
    parts.push('- Responde siempre en el mismo idioma que el usuario (español por defecto).');
    parts.push('- Si vas a ejecutar una acción que requiere aprobación, explícalo claramente antes.');
    parts.push('- Sé conciso pero completo. Evita respuestas vacías o evasivas.');
    parts.push('- Si no tienes suficiente información, pregunta antes de actuar.');

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESQUEMAS DE TOOLS PARA EL LLM
  // ═══════════════════════════════════════════════════════════════════════════

  _buildToolSchemas(availableTools) {
    // Formato Anthropic tool_use
    return availableTools.map(({ tool, mcp, requiresApproval }) => ({
      name: `${mcp}__${tool}`,
      description: `[${mcp}] ${tool}${requiresApproval ? ' ⚠️ REQUIERE APROBACIÓN HUMANA' : ''}`,
      input_schema: {
        type: 'object',
        properties: {
          _mcp: { type: 'string', const: mcp, description: 'MCP servidor (auto)' },
          _tool: { type: 'string', const: tool, description: 'Tool name (auto)' }
        },
        additionalProperties: true
      }
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCADE DE LLM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Detecta la complejidad de la tarea basada en triggers definidos en el SKILL.
   */
  _detectComplexity(text) {
    const highComplexityTriggers = [
      'audit', 'deploy', 'bridge', 'fraud', 'compliance', 'security', 'critical',
      'multisig', 'sequencer', 'slashing', 'governance'
    ];
    const msg = text.toLowerCase();
    return highComplexityTriggers.some(trigger => msg.includes(trigger)) ? 'high' : 'low';
  }

  async _invokeWithCascade({ systemPrompt, messages, tools, agentDef, priority = 'cloud', onChunk }) {
    // Si la prioridad es baja (detectada en process), intentamos Ollama local primero
    if (priority === 'low' && this.ollama && await this.ollama.isAvailable()) {
      try {
        this.logger.info(`[OpenClaw] Tarea de baja complejidad: Intentando Ollama local primero...`);
        const localModel = await this.ollama.selectModelForAgent(agentDef.name);
        if (localModel) {
          const result = await this.ollama.generate(messages, {
            model: localModel, 
            system: systemPrompt + "\n(SKILL: Eres un ejecutor rápido para tareas de baja complejidad. Responde de forma concisa.)", 
            maxTokens: 2048,
            onChunk
          });
          return { ...result, model: localModel, provider: 'ollama' };
        }
      } catch (err) {
        this.logger.warn(`[OpenClaw] Ollama falló: ${err.message}. Saltando a cloud...`);
      }
    }

    // Determinar modelos cloud a intentar
    let modelsToTry = CLOUD_MODELS;
    
    // Si hay un modelo preferido, ponerlo al principio
    if (agentDef.preferredCloudModel) {
      const preferred = CLOUD_MODELS.find(m => m.model === agentDef.preferredCloudModel);
      if (preferred) {
        modelsToTry = [preferred, ...CLOUD_MODELS.filter(m => m.model !== agentDef.preferredCloudModel)];
      }
    }

    for (const { provider, model, maxTokens } of modelsToTry) {
      try {
        this.logger.info(`[OpenClaw] Probando ${provider}/${model}`);
        const result = await this._callCloudModel({ provider, model, maxTokens, systemPrompt, messages, tools, onChunk });
        return { ...result, model, provider };
      } catch (err) {
        const errorMsg = err.response?.data?.error?.message || err.message;
        this.logger.warn(`[OpenClaw] ${provider}/${model} falló: ${errorMsg}. Siguiente...`);
        continue;
      }
    }

    // Fallback final: Ollama local (si no se intentó antes o si cloud falló)
    if (priority !== 'low' && this.ollama && await this.ollama.isAvailable()) {
      this.logger.warn('[OpenClaw] Todos los modelos cloud fallaron. Usando Ollama local...');
      const localModel = await this.ollama.selectModelForAgent(agentDef.name);
      if (localModel) {
        const result = await this.ollama.generate(messages, {
          model: localModel, system: systemPrompt, maxTokens: 2048, onChunk
        });
        return { ...result, model: localModel, provider: 'ollama' };
      }
    }

    throw new Error('No hay modelos disponibles (cloud ni local). Verifica tu conexión y/o Ollama.');
  }

  async _callCloudModel({ provider, model, maxTokens, systemPrompt, messages, tools, onChunk }) {
    if (provider === 'claude') {
      if (!this._claude) {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        this._claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      }

      const anthropicMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })).filter(m => m.role !== 'system');

      const res = await this._claude.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: anthropicMessages,
        tools: tools.length > 0 ? tools : undefined
      });

      const textBlock = res.content.find(b => b.type === 'text');
      const toolUses  = res.content.filter(b => b.type === 'tool_use');
      return {
        content:    textBlock?.text || '',
        toolUses,
        stopReason: res.stop_reason,
        type:       'anthropic'
      };
    }

    if (provider === 'gemini') {
      const result = await GeminiClient.generate(messages, {
        model,
        system: systemPrompt,
        maxTokens,
        tools: tools.length > 0 ? tools : undefined
      });
      // Mock onChunk call if supported sync for fallback or just pass it to generator if available. 
      if (onChunk && result.text) onChunk(result.text);
      return {
        content:    result.text,
        toolUses:   result.toolUses || [],
        stopReason: result.stopReason,
        type:       'gemini'
      };
    }

    if (provider === 'kimi') {
      const { default: OpenAI } = await import('openai');
      const kimi = new OpenAI({
        apiKey: process.env.KIMI_API_KEY,
        baseURL: 'https://api.moonshot.cn/v1'
      });
      const res = await kimi.chat.completions.create({
        model, max_tokens: maxTokens,
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      });
      return { content: res.choices[0].message.content, toolUses: [], stopReason: 'end_turn', type: 'kimi' };
    }

    if (provider === 'openai') {
      const { default: OpenAI } = await import('openai');
      const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await oai.chat.completions.create({
        model, max_tokens: maxTokens,
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      });
      return { content: res.choices[0].message.content, toolUses: [], stopReason: 'end_turn', type: 'openai' };
    }

    if (provider === 'deepseek') {
      const { default: OpenAI } = await import('openai');
      const ds = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
      const res = await ds.chat.completions.create({
        model, max_tokens: maxTokens,
        messages: [{ role: 'system', content: systemPrompt }, ...messages]
      });
      return { content: res.choices[0].message.content, toolUses: [], stopReason: 'end_turn', type: 'deepseek' };
    }

    throw new Error(`Provider desconocido: ${provider}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESAMIENTO DE TOOL CALLS
  // ═══════════════════════════════════════════════════════════════════════════

  async _processToolCalls({ agentId, agentDef, sessionId, userId, isAuthorized, llmResult, toolSchemas, systemPrompt, history }) {
    const toolsUsed = [];

    if (!llmResult.toolUses || llmResult.toolUses.length === 0) {
      return { finalText: llmResult.content, toolsUsed };
    }

    let accumulatedText = llmResult.content || '';
    const toolResults   = [];

    for (const toolUse of llmResult.toolUses) {
      const [mcpId, ...toolParts] = toolUse.name.split('__');
      const toolName = toolParts.join('__');
      const input    = toolUse.input || {};

      // ── Verificar permiso ────────────────────────────────────────────────
      const { allowed, reason: permReason } = this.registry.canExecute(agentId, mcpId, toolName);
      if (!allowed) {
        this.logger.warn(`[OpenClaw] Tool bloqueada: ${toolName} (${permReason})`);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: ${permReason}`
        });
        continue;
      }

      // ── Verificar human-in-loop ──────────────────────────────────────────
      const { required: hilRequired } = this.hil.requiresConfirmation(toolName, input);
      const { required: regRequired } = this.registry.requiresHumanApproval(agentId, toolName);

      if (hilRequired || regRequired) {
        const guardResult = await this.hil.guard(toolName, agentId, input, async () => {
          return this._executeMCPTool(mcpId, toolName, input);
        });

        if (!guardResult.executed) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Acción rechazada por ${guardResult.rejected_by || 'el usuario'}. Motivo: ${guardResult.rejection}`
          });
          
          // Guardar feedback negativo (RLHF) para el dataset de entrenamiento
          if (this.memory.redis) {
            await this.memory.redis.lpush('bezhas:dataset:skills', JSON.stringify({
              agent: agentId,
              input: JSON.stringify(input),
              output: `RECHAZADO: ${guardResult.rejection}`,
              tools: [toolName],
              provider: 'human_feedback',
              reward: -1,
              ts: Date.now()
            }));
          }
          
          continue;
        }

        toolsUsed.push(toolName);
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(guardResult.result) });

        // Guardar episodio de acción aprobada
        await this.memory.saveEpisode(agentId, 'tool_execution', {
          tool: toolName, mcp: mcpId, input, result: guardResult.result,
          approved_by: guardResult.approved_by, ts: Date.now()
        }, [toolName, mcpId, 'approved']);

      } else {
        // ── Ejecutar directamente ────────────────────────────────────────
        try {
          const result = await this._executeMCPTool(mcpId, toolName, input);
          toolsUsed.push(toolName);
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });

          await this.memory.saveEpisode(agentId, 'tool_execution', {
            tool: toolName, mcp: mcpId, input, result, ts: Date.now()
          }, [toolName, mcpId]);

        } catch (err) {
          this.logger.error(`[OpenClaw] Error ejecutando ${toolName}:`, err.message);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${err.message}`
          });
        }
      }
    }

    // Si hubo tool calls, hacer una segunda llamada al LLM con los resultados
    if (toolResults.length > 0 && toolsUsed.length > 0) {
      const followUpMessages = [
        ...history,
        { role: 'assistant', content: llmResult.toolUses.map(tu => ({
          type: 'tool_use', id: tu.id, name: tu.name, input: tu.input
        })) },
        { role: 'user', content: toolResults }
      ];

      try {
        const followUp = await this._invokeWithCascade({
          systemPrompt, messages: followUpMessages,
          tools: toolSchemas, agentDef: this.registry.getAgent(agentId)
        });
        accumulatedText = followUp.content || accumulatedText;
      } catch (err) {
        this.logger.warn('[OpenClaw] Follow-up LLM falló:', err.message);
      }
    }

    return { finalText: accumulatedText, toolsUsed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EJECUCIÓN DE MCP TOOLS
  // ═══════════════════════════════════════════════════════════════════════════

  async _executeMCPTool(mcpId, toolName, input) {
    this.logger.info(`[OpenClaw] Ejecutando MCP tool: ${mcpId}::${toolName}`);

    const mcpDef = agentRegistry.mcps[mcpId];
    if (!mcpDef) throw new Error(`MCP desconocido: ${mcpId}`);

    // Para messaging (ya lo tenemos en proceso, usar directamente)
    if (mcpId === 'messaging' && this.telegram) {
      return this._executeMessagingTool(toolName, input);
    }

    // Determinar URL del servidor MCP
    // Si el mcpId es 'bezhas-core', usamos el AI_ENGINE_URL (3002) por defecto si la URL del registro falla
    let targetUrl = mcpDef.url;
    if (mcpId === 'bezhas-core' && process.env.AI_ENGINE_URL) {
      targetUrl = process.env.AI_ENGINE_URL;
    }

    try {
      // Llamada vía HTTP al servidor MCP (usando el endpoint unificado /api/mcp/invoke si es el ai-engine)
      const isAiEngine = targetUrl.includes('3002') || mcpId === 'bezhas-core';
      const endpoint = isAiEngine ? '/api/mcp/invoke' : '/invoke'; // Convención BeZhas
      
      const payload = isAiEngine 
        ? { tool: toolName, parameters: input } 
        : { tool: toolName, input };

      const response = await axios.post(`${targetUrl}${endpoint}`, payload, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`,
          'x-internal-key': process.env.INTERNAL_API_KEY || ''
        }
      });

      return response.data.result || response.data;

    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      this.logger.error(`[OpenClaw] Fallo en MCP ${mcpId}::${toolName}: ${msg}`);
      throw new Error(`Error en servidor MCP (${mcpId}): ${msg}`);
    }
  }

  async _executeMessagingTool(toolName, input) {
    switch (toolName) {
      case 'send_telegram_message':
        return this.telegram.sendMessage(
          input.chat_id || process.env.TELEGRAM_ALERT_CHAT_ID,
          input.text,
          input.parse_mode ? { parse_mode: input.parse_mode } : {}
        );
      case 'send_system_alert':
        const { MessageFormatter } = await import('../../messaging-mcp/src/telegram.js');
        const alertText = MessageFormatter.bezAlert(input);
        return this.telegram.sendMessage(
          input.chat_id || process.env.TELEGRAM_ALERT_CHAT_ID,
          alertText,
          { parse_mode: 'MarkdownV2' }
        );
      case 'get_chat_history':
        // Usa RedisMemoryManager que es la fuente de verdad (sesión asume agentId y chatId)
        return this.memory.getHistoryForLLM(`${process.env.TELEGRAM_AGENT_ID || 'director-agent'}:${input.chat_id}`, input.limit || 20);
      case 'get_telegram_status':
        return Promise.all([this.telegram.getMe(), this.telegram.getWebhookInfo()])
          .then(([me, wh]) => ({ bot: me, webhook: wh }));
      default:
        throw new Error(`Messaging tool no implementada directamente: ${toolName}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Estado completo del orquestador para debugging. */
  async getStatus() {
    const [memStats, ollamaInfo] = await Promise.all([
      this.memory.getMemoryStats(),
      this.ollama?.getSystemInfo() || { available: false }
    ]);

    return {
      orchestrator: 'OpenClawOrchestrator v2.0',
      agents: this.registry.listAgents(),
      memory: memStats,
      ollama: ollamaInfo,
      hil_thresholds: { trade_usd: 500, transfer_bez: 1000 },
      cloud_cascade: CLOUD_MODELS.map(m => `${m.provider}/${m.model}`)
    };
  }

  /** Inyectar una tarea pendiente para un agente desde fuera. */
  async scheduleTask(agentId, task) {
    return this.memory.addPendingTask(agentId, task);
  }
}
