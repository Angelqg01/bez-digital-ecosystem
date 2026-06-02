/**
 * BeZhas Agent Runtime — ChannelRouter
 * Enruta mensajes de Telegram al agente correcto según intención detectada.
 * Usa OpenClaw (LLM) para clasificar intención cuando no es obvia.
 *
 * Intenciones reconocidas:
 *   trade      → TradingAgent
 *   security   → SecurityAgent
 *   workflow   → WorkflowAgent
 *   general    → LLM via OpenClaw (respuesta directa)
 */

'use strict';

class ChannelRouter {
  /**
   * @param {AgentManager} manager
   * @param {TelegramChannel} telegram
   */
  constructor(manager, telegram) {
    this.manager  = manager;
    this.telegram = telegram;

    // Patrones de intención por palabras clave
    this._patterns = [
      {
        intent:   'trade',
        agentId:  'trading-agent',
        taskType: 'trade:analyze',
        keywords: ['trade', 'trading', 'comprar', 'vender', 'buy', 'sell', 'swap',
                   'precio', 'price', 'par', 'pair', 'bez', 'usdt', 'portfolio'],
      },
      {
        intent:   'security',
        agentId:  'security-agent',
        taskType: 'security:check',
        keywords: ['amenaza', 'threat', 'seguridad', 'security', 'aegis',
                   'hack', 'ataque', 'attack', 'alerta', 'alert', 'sospechoso'],
      },
      {
        intent:   'workflow',
        agentId:  'workflow-agent',
        taskType: 'workflow:execute',
        keywords: ['workflow', 'flujo', 'proceso', 'proceso', 'ejecutar', 'run',
                   'deploy', 'desplegar', 'automatizar', 'automate'],
      },
    ];
  }

  // ─────────────────────────────────────────────
  // ROUTING PRINCIPAL
  // ─────────────────────────────────────────────

  async route({ type, chatId, username, text, sessionId }) {
    // Guardar mensaje en sesión (memoria conversacional)
    await this._saveToSession(sessionId, { role: 'user', content: text });

    let response;

    // 1. Detectar intención por keywords primero (rápido, sin LLM)
    const matched = this._matchByKeywords(text);

    if (matched) {
      response = await this._routeToAgent(matched, { chatId, username, text, sessionId });
    } else {
      // 2. Respuesta general via OpenClaw LLM
      response = await this._generalLLMResponse(text, sessionId, chatId);
    }

    // Guardar respuesta en sesión
    if (response) {
      await this._saveToSession(sessionId, { role: 'assistant', content: response });
    }

    return response;
  }

  // ─────────────────────────────────────────────
  // KEYWORD MATCHING
  // ─────────────────────────────────────────────

  _matchByKeywords(text) {
    const lower = text.toLowerCase();
    for (const pattern of this._patterns) {
      if (pattern.keywords.some(kw => lower.includes(kw))) {
        return pattern;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────
  // ROUTING A AGENTE ESPECÍFICO
  // ─────────────────────────────────────────────

  async _routeToAgent(pattern, { chatId, username, text, sessionId }) {
    const { intent, agentId, taskType } = pattern;
    console.log(`[ChannelRouter] 🎯 Intención detectada: ${intent} → ${agentId}`);

    // Notificar que estamos procesando
    await this.telegram.sendMessage(chatId, `⚙️ _Procesando con ${agentId}..._`).catch(() => {});

    try {
      // Extraer parámetros específicos según intención
      const payload = this._extractPayload(intent, text);

      const taskId = await this.manager.dispatch({
        type:     taskType,
        priority: 'normal',
        source:   'telegram',
        payload:  { ...payload, rawText: text, username, sessionId },
      });

      // Para análisis instantáneo, esperar resultado (con timeout)
      if (intent === 'trade' && taskType === 'trade:analyze') {
        return await this._waitForResult(taskId, 15_000)
          .then(r => r?.analysis || `✅ Análisis completado (ID: \`${taskId.slice(-8)}\`)`)
          .catch(() => `📬 Análisis encolado (\`${taskId.slice(-8)}\`)\nResultado llegará en breve.`);
      }

      return `✅ Tarea enviada al ${agentId}\nID: \`${taskId.slice(-8)}\``;

    } catch (err) {
      console.error(`[ChannelRouter] ❌ Error en agente ${agentId}:`, err.message);
      return `❌ Error procesando con ${agentId}: ${err.message}`;
    }
  }

  // ─────────────────────────────────────────────
  // RESPUESTA GENERAL VÍA LLM
  // ─────────────────────────────────────────────

  async _generalLLMResponse(text, sessionId, chatId) {
    console.log('[ChannelRouter] 💬 Respuesta general LLM');

    try {
      // Recuperar historial de sesión para contexto
      const session = await this.manager.memory.getSession(sessionId);
      const history = session.messages.slice(-6); // últimos 6 mensajes

      const contextPrompt = history.length > 1
        ? `Historial reciente:\n${history.slice(0, -1).map(m => `${m.role}: ${m.content}`).join('\n')}\n\nPregunta actual: ${text}`
        : text;

      const response = await this.manager.openclaw.complete({
        prompt: contextPrompt,
        systemPrompt: `Eres el asistente inteligente de BeZhas Blockchain, respondiendo via Telegram.
Ayudas con preguntas sobre: trading BEZ-Coin, staking, DeFi, seguridad blockchain, workflows.
Eres conciso (máx 3-4 párrafos), técnico cuando es necesario, y siempre en español.
Usa formato Markdown de Telegram (*bold*, _italic_, \`code\`).
Si el usuario necesita ejecutar una acción, sugiérele el comando apropiado (/trade, /aegis, etc.).`,
        maxTokens: 600,
        agentId: 'channel-router',
      });

      return response.text;

    } catch (err) {
      console.error('[ChannelRouter] ❌ Error LLM:', err.message);
      return `⚠️ No pude procesar tu mensaje. ¿Puedes reformularlo?\n\nUsa /help para ver los comandos disponibles.`;
    }
  }

  // ─────────────────────────────────────────────
  // HITL REQUEST — llamado desde HITLHandler
  // ─────────────────────────────────────────────

  async sendHITLToTelegram(taskId, context) {
    const text =
      `👤 *Confirmación Requerida*\n\n` +
      `*Agente:* ${context.agent}\n` +
      `*Acción:* ${context.title}\n\n` +
      `${context.description}\n\n` +
      `⏱️ Expira en 60 segundos`;

    // Enviar a todos los chats autorizados
    for (const chatId of this.telegram.chatIds) {
      await this.telegram.sendHITLMessage(chatId, text, taskId).catch(e =>
        console.error('[ChannelRouter] ❌ Error enviando HITL:', e.message)
      );
    }
  }

  // ─────────────────────────────────────────────
  // BROADCAST (notificaciones de agentes)
  // ─────────────────────────────────────────────

  async broadcast(message, level = 'info') {
    const prefix = level === 'critical' ? '🔴' : level === 'warning' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    await this.telegram.broadcast(`${prefix} ${message}`);
  }

  // ─────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────

  _extractPayload(intent, text) {
    switch (intent) {
      case 'trade': {
        // Detectar par de trading en el texto
        const pairMatch = text.match(/\b(BEZ|BNB|ETH|MATIC|USDT|USDC)\s*\/?\s*(USDT|BNB|ETH|MATIC|USDC|BEZ)\b/i);
        return { pair: pairMatch ? pairMatch[0].toUpperCase().replace(/\s/g, '') : 'BEZ/USDT', timeframe: '1h' };
      }
      case 'security': {
        const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
        return { address: addrMatch?.[0] || null, checkType: 'manual-request' };
      }
      case 'workflow':
        return { workflowId: 'manual', params: { rawText: text } };
      default:
        return {};
    }
  }

  async _saveToSession(sessionId, message) {
    try {
      await this.manager.memory.appendToSession(sessionId, message);
    } catch { /* no critical */ }
  }

  async _waitForResult(taskId, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const task = await this.manager.memory.getTask(taskId).catch(() => null);
      if (task?.status === 'completed') return task.result;
      if (task?.status === 'failed') throw new Error(task.error);
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error('timeout');
  }
}

module.exports = ChannelRouter;
