/**
 * BeZhas Agent Runtime — TelegramChannel
 * Bot Telegram completo con long-polling.
 * Conecta: usuario Telegram ↔ ChannelRouter ↔ AgentManager
 *
 * Comandos:
 *   /start     — Bienvenida + estado del runtime
 *   /status    — Estado de todos los agentes
 *   /agents    — Lista de agentes activos
 *   /tasks     — Tareas recientes
 *   /aegis     — Estado y alertas AEGIS
 *   /trade     — Solicitar análisis de trading
 *   /health    — Health check completo
 *   /help      — Ayuda
 *
 * HITL:
 *   Botones inline ✅ Aprobar / ❌ Rechazar para confirmaciones de trade/seguridad
 */

'use strict';

const EventEmitter = require('events');

const TG_API = 'https://api.telegram.org/bot';

class TelegramChannel extends EventEmitter {
  constructor(config = {}) {
    super();

    const token = config.token || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN no configurado');

    this.token       = token;
    this.baseUrl     = `${TG_API}${token}`;
    this.allowedUsers = (config.allowedUsers || process.env.TELEGRAM_ALLOWED_USERS || '')
                          .split(',').map(s => s.trim()).filter(Boolean);
    this.chatIds     = new Set(
      (config.chatIds || process.env.TELEGRAM_CHAT_IDS || '')
        .split(',').map(s => parseInt(s.trim())).filter(Boolean)
    );

    this._offset    = 0;
    this._running   = false;
    this._pollTimer = null;
    this._router    = null;   // ChannelRouter inyectado en start()

    // Mapa de confirmaciones HITL pendientes: taskId → { chatId, messageId }
    this._pendingHITL = new Map();
  }

  // ─────────────────────────────────────────────
  // CICLO DE VIDA
  // ─────────────────────────────────────────────

  async start(router) {
    this._router  = router;
    this._running = true;

    const me = await this._call('getMe');
    console.log(`[TelegramChannel] 🤖 Bot activo: @${me.username}`);

    // Notificar a todos los chats autorizados que el runtime está online
    const startMsg =
      `🟢 *BeZhas Agent Runtime Online*\n` +
      `Bot: @${me.username}\n` +
      `Agentes: ${router.manager ? router.manager.listAgents().length : '?'}\n` +
      `Usa /help para ver comandos disponibles.`;

    for (const chatId of this.chatIds) {
      await this.sendMessage(chatId, startMsg).catch(() => {});
    }

    this._poll();
    console.log('[TelegramChannel] 👂 Long-polling activo');
    this.emit('started');
  }

  async stop() {
    this._running = false;
    if (this._pollTimer) clearTimeout(this._pollTimer);
    console.log('[TelegramChannel] 🛑 Bot detenido');
    this.emit('stopped');
  }

  // ─────────────────────────────────────────────
  // LONG-POLLING
  // ─────────────────────────────────────────────

  async _poll() {
    if (!this._running) return;

    try {
      const updates = await this._call('getUpdates', {
        offset:  this._offset,
        timeout: 30,                  // long-poll 30s
        allowed_updates: ['message', 'callback_query'],
      });

      for (const update of updates) {
        this._offset = update.update_id + 1;
        await this._processUpdate(update).catch(err =>
          console.error('[TelegramChannel] ❌ Error procesando update:', err.message)
        );
      }
    } catch (err) {
      if (this._running) {
        console.error('[TelegramChannel] ❌ Error en polling:', err.message);
      }
    }

    if (this._running) {
      this._pollTimer = setTimeout(() => this._poll(), 100);
    }
  }

  // ─────────────────────────────────────────────
  // PROCESAMIENTO DE UPDATES
  // ─────────────────────────────────────────────

  async _processUpdate(update) {
    // Callback query (botones HITL inline)
    if (update.callback_query) {
      return this._processCallbackQuery(update.callback_query);
    }

    // Mensaje de texto
    if (update.message?.text) {
      return this._processMessage(update.message);
    }
  }

  async _processMessage(msg) {
    const chatId   = msg.chat.id;
    const username = msg.from?.username || String(msg.from?.id);
    const text     = msg.text.trim();

    // Registrar chat autorizado
    this.chatIds.add(chatId);

    // Verificar usuario autorizado
    if (this.allowedUsers.length > 0 && !this.allowedUsers.includes(username)) {
      await this.sendMessage(chatId, `⛔ Usuario no autorizado: @${username}`);
      console.warn(`[TelegramChannel] ⛔ Acceso denegado a @${username}`);
      return;
    }

    console.log(`[TelegramChannel] 💬 @${username}: ${text.slice(0, 80)}`);

    // Mostrar "escribiendo..."
    await this._call('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});

    // Comandos
    if (text.startsWith('/')) {
      return this._handleCommand(chatId, text, username);
    }

    // Mensaje libre → router → agente
    if (this._router) {
      const response = await this._router.route({
        type:    'free_text',
        chatId,
        username,
        text,
        sessionId: `tg:${chatId}`,
      });
      if (response) await this.sendMessage(chatId, response);
    }
  }

  // ─────────────────────────────────────────────
  // COMANDOS
  // ─────────────────────────────────────────────

  async _handleCommand(chatId, text, username) {
    const [cmd, ...args] = text.split(' ');

    switch (cmd.toLowerCase()) {
      case '/start':
        return this._cmdStart(chatId);
      case '/help':
        return this._cmdHelp(chatId);
      case '/status':
        return this._cmdStatus(chatId);
      case '/agents':
        return this._cmdAgents(chatId);
      case '/tasks':
        return this._cmdTasks(chatId);
      case '/aegis':
        return this._cmdAegis(chatId);
      case '/trade':
        return this._cmdTrade(chatId, args.join(' '));
      case '/health':
        return this._cmdHealth(chatId);
      default:
        await this.sendMessage(chatId, `❓ Comando desconocido: ${cmd}\nUsa /help`);
    }
  }

  async _cmdStart(chatId) {
    const mgr = this._router?.manager;
    const agentCount = mgr?.listAgents().length || 0;
    await this.sendMessage(chatId,
      `🔷 *BeZhas Agent Runtime*\n\n` +
      `✅ ${agentCount} agente(s) activos\n` +
      `🛡️ AEGIS monitoring activo\n` +
      `👤 HITL: activado\n\n` +
      `Usa /help para ver todos los comandos.`
    );
  }

  async _cmdHelp(chatId) {
    await this.sendMessage(chatId,
      `📋 *Comandos BeZhas*\n\n` +
      `*/status*    — Estado del runtime\n` +
      `*/agents*    — Lista de agentes\n` +
      `*/tasks*     — Tareas recientes\n` +
      `*/aegis*     — Alertas de seguridad\n` +
      `*/trade* [par] — Análisis de trading\n` +
      `*/health*    — Health check completo\n\n` +
      `O simplemente escribe tu pregunta en lenguaje natural.`
    );
  }

  async _cmdStatus(chatId) {
    if (!this._router?.manager) {
      return this.sendMessage(chatId, '⚠️ Runtime no conectado');
    }
    const agents = this._router.manager.listAgents();
    const queue  = this._router.manager.taskQueue?.getStatus() || {};
    const lines  = agents.map(a =>
      `${a.status === 'idle' ? '🟢' : a.status === 'running' ? '🟡' : '🔴'} *${a.name}* — ${a.status}`
    );
    await this.sendMessage(chatId,
      `📊 *Estado del Runtime*\n\n` +
      lines.join('\n') +
      `\n\n📬 Cola: ${queue.queued || 0} pendientes, ${queue.running || 0} ejecutando`
    );
  }

  async _cmdAgents(chatId) {
    if (!this._router?.manager) return;
    const agents = this._router.manager.listAgents();
    const lines  = agents.map(a =>
      `• *${a.name}* (\`${a.id}\`)\n  Capabilities: ${a.capabilities.join(', ')}`
    );
    await this.sendMessage(chatId, `🤖 *Agentes Activos*\n\n${lines.join('\n\n')}`);
  }

  async _cmdTasks(chatId) {
    if (!this._router?.manager?.memory) return;
    const tasks = await this._router.manager.memory.listRecentTasks(10);
    if (!tasks.length) return this.sendMessage(chatId, '📬 Sin tareas recientes');

    const lines = tasks.slice(0, 5).map(t => {
      const icon = t.status === 'completed' ? '✅' : t.status === 'running' ? '⚙️' : t.status === 'failed' ? '❌' : '📬';
      return `${icon} \`${t.id.slice(-8)}\` — ${t.type} (${t.status})`;
    });
    await this.sendMessage(chatId, `📋 *Tareas Recientes*\n\n${lines.join('\n')}`);
  }

  async _cmdAegis(chatId) {
    const aegis = this._router?.manager?.aegis;
    if (!aegis) return this.sendMessage(chatId, '⚠️ AEGIS no conectado');

    const health  = await aegis.healthCheck();
    const history = aegis.getAlertHistory(5);

    const lines = history.length
      ? history.map(a => `🚨 [${a.severityLabel}] ${a.threatType} — score: ${(a.mlScore*100).toFixed(0)}%`)
      : ['✅ Sin alertas recientes'];

    await this.sendMessage(chatId,
      `🛡️ *AEGIS Security Monitor*\n` +
      `Estado: ${health.status}\n` +
      `Último bloque: ${health.lastBlock}\n` +
      `Alertas totales: ${health.alerts?.total || 0}\n\n` +
      `*Recientes:*\n${lines.join('\n')}`
    );
  }

  async _cmdTrade(chatId, args) {
    const pair = args || 'BEZ/USDT';
    if (!this._router?.manager) return;

    await this.sendMessage(chatId, `📊 Analizando ${pair}...`);

    const taskId = await this._router.manager.dispatch({
      type:     'trade:analyze',
      priority: 'normal',
      source:   'telegram',
      payload:  { pair, timeframe: '1h' },
    });

    await this.sendMessage(chatId, `✅ Análisis encolado (\`${taskId.slice(-8)}\`)\nResultado llegará en breve.`);
  }

  async _cmdHealth(chatId) {
    const mgr = this._router?.manager;
    if (!mgr) return this.sendMessage(chatId, '⚠️ Manager no disponible');

    const [bcHealth, memHealth, ocHealth] = await Promise.allSettled([
      mgr.blockchain?.healthCheck(),
      mgr.memory?.healthCheck(),
      mgr.openclaw?.healthCheck(),
    ]);

    const fmt = (label, r) => {
      if (r.status === 'rejected') return `❌ ${label}: error`;
      const v = r.value;
      return v?.status === 'ok' || v?.engine?.available
        ? `✅ ${label}: OK`
        : `⚠️ ${label}: degraded`;
    };

    await this.sendMessage(chatId,
      `🔍 *Health Check*\n\n` +
      `${fmt('Blockchain', bcHealth)}\n` +
      `${fmt('Redis Memory', memHealth)}\n` +
      `${fmt('OpenClaw Engine', ocHealth)}\n` +
      `🦙 Ollama: ${(await mgr.openclaw?.checkOllama())?.available ? '✅ disponible' : '⚠️ no disponible'}`
    );
  }

  // ─────────────────────────────────────────────
  // HITL — CALLBACK QUERIES (botones inline)
  // ─────────────────────────────────────────────

  async _processCallbackQuery(cbq) {
    const { id, from, message, data } = cbq;

    // Responder al callback inmediatamente (Telegram requiere esto)
    await this._call('answerCallbackQuery', { callback_query_id: id });

    const [action, taskId] = data.split(':');
    const approved = action === 'approve';
    const username = from?.username || String(from?.id);

    console.log(`[TelegramChannel] 👤 HITL @${username}: ${approved ? 'APROBADO' : 'RECHAZADO'} → ${taskId}`);

    // Resolver en AgentManager
    const manager = this._router?.manager;
    if (manager) {
      const resolved = await manager.resolveHITL(taskId, approved, `@${username} via Telegram`);
      if (!resolved) {
        await this._editMessage(message.chat.id, message.message_id,
          `⏱️ Confirmación expirada para \`${taskId.slice(-8)}\``
        );
        return;
      }
    }

    // Actualizar el mensaje con el resultado
    await this._editMessage(
      message.chat.id,
      message.message_id,
      `${approved ? '✅ *APROBADO*' : '❌ *RECHAZADO*'} por @${username}\n` +
      `Tarea: \`${taskId.slice(-8)}\`\n` +
      `${new Date().toLocaleTimeString('es-ES')}`
    );

    this._pendingHITL.delete(taskId);
  }

  // ─────────────────────────────────────────────
  // API PÚBLICA — envío de mensajes
  // ─────────────────────────────────────────────

  async sendMessage(chatId, text, opts = {}) {
    return this._call('sendMessage', {
      chat_id:    chatId,
      text,
      parse_mode: 'Markdown',
      ...opts,
    });
  }

  /** Envía mensaje con botones HITL inline */
  async sendHITLMessage(chatId, text, taskId) {
    const msg = await this._call('sendMessage', {
      chat_id:    chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Aprobar', callback_data: `approve:${taskId}` },
          { text: '❌ Rechazar', callback_data: `reject:${taskId}` },
        ]],
      },
    });

    this._pendingHITL.set(taskId, { chatId, messageId: msg.message_id });
    return msg;
  }

  /** Broadcast a todos los chats autorizados */
  async broadcast(text, opts = {}) {
    const results = [];
    for (const chatId of this.chatIds) {
      results.push(await this.sendMessage(chatId, text, opts).catch(e => ({ error: e.message })));
    }
    return results;
  }

  // ─────────────────────────────────────────────
  // INTERNALS
  // ─────────────────────────────────────────────

  async _editMessage(chatId, messageId, text) {
    return this._call('editMessageText', {
      chat_id:    chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    }).catch(() => {});
  }

  async _call(method, params = {}) {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params),
      signal:  AbortSignal.timeout(35_000),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram API error [${method}]: ${data.description}`);
    return data.result;
  }
}

module.exports = TelegramChannel;
