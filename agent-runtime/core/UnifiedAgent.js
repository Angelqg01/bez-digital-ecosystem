/**
 * UnifiedAgent.js — Single AI Agent orchestrator for BeZhas Platform.
 *
 * Merges capabilities from:
 *   - Agent Runtime (tools, commands, plugins, permissions, sessions, SSE)
 *   - OpenClaw skills (growth, sdr-outreach, solutions-engineer, deal-bridge)
 *   - Aegis AI (anomaly, sentiment, gas, UX, auto-healer)
 *   - AI-Engine MCP (12 tools)
 *   - MemoryManager (conversational history, Redis-backed)
 *
 * The agent accepts natural language or slash commands from any channel
 * (Telegram, Discord, WhatsApp, API) and routes to the appropriate capability.
 */
const axios = require('axios');
const eventBus = require('./RuntimeEventBus');
const MemoryManager = require('../MemoryManager');
const GeminiClient = require('./GeminiClient');
const SkillWriter  = require('./SkillWriter');

const AEGIS_URL = process.env.AEGIS_API_URL || 'http://localhost:8001';
const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
if (!INTERNAL_API_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('INTERNAL_API_KEY is required in production');
}
const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Tools that mutate on-chain state and REQUIRE user confirmation before execution.
 * Format: set of tool names (exact match or prefix match with *).
 *
 * Design principle: "Read Everything, Confirm Before Write"
 * — Any tool that signs a transaction or modifies contract state must pass through
 *   the human-in-the-loop gate before executing.
 */
const MUTATING_TOOLS = new Set([
    'mcp:execute_depin_reward',
    'mcp:register_validator',
    'mcp:slash_validator',
    'mcp:process_payment',
    'mcp:execute_swap',
    'mcp:deploy_contract',
    'mcp:update_contract',
    'mcp:transfer_tokens',
    'mcp:stake_tokens',
    'mcp:unstake_tokens',
    'mcp:bridge_tokens',
    'onchain:execute',
    'onchain:sign',
    'onchain:send',
    'treasury:withdraw',
    'treasury:transfer',
]);

/** Pattern for confirmation responses in any language */
const CONFIRM_PATTERN = /^(s[ií]|yes|ok|confirm|confirmar|adelante|ejecutar|send|approve)\b/i;
/** Pattern for cancellation responses */
const CANCEL_PATTERN = /^(no|cancel|cancelar|abort|abortar|forget|detener)\b/i;

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

/**
 * Agent configuration schema (persisted in DB / admin panel).
 * @typedef {Object} AgentConfig
 * @property {string}   name             - Display name
 * @property {boolean}  enabled          - Master on/off
 * @property {string}   personality      - System prompt / persona
 * @property {string}   language         - Default response language (es/en)
 * @property {Object}   channels         - Per-channel config
 * @property {boolean}  channels.telegram.enabled
 * @property {string}   channels.telegram.botToken
 * @property {string}   channels.telegram.allowedChatIds - CSV of allowed chat IDs
 * @property {boolean}  channels.discord.enabled
 * @property {string}   channels.discord.botToken
 * @property {string}   channels.discord.allowedGuildIds
 * @property {boolean}  channels.whatsapp.enabled
 * @property {string}   channels.whatsapp.phoneNumberId
 * @property {string}   channels.whatsapp.accessToken
 * @property {string}   channels.whatsapp.verifyToken
 * @property {string[]} allowedRoles     - Roles that can interact
 * @property {number}   rateLimitPerMin  - Max messages per user per minute
 * @property {boolean}  auditLog         - Log every interaction to DB
 */

const DEFAULT_CONFIG = {
    name: 'BeZhas AI Agent',
    enabled: true,
    personality: `Eres el Agente IA unificado de la plataforma BeZhas Blockchain.
Puedes consultar el estado de la plataforma, ejecutar herramientas de IA (Aegis),
invocar comandos del Runtime, analizar gas, detectar anomalías, consultar sectores,
verificar validadores, gestionar bridges y más.
Responde siempre en el idioma del usuario. Sé conciso y útil.`,
    language: 'es',
    channels: {
        telegram: {
            enabled: process.env.TELEGRAM_ENABLED === 'true' || !!process.env.TELEGRAM_BOT_TOKEN,
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            allowedChatIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS || process.env.TELEGRAM_SECURITY_CHAT_ID || '',
            role: process.env.TELEGRAM_AGENT_ROLE || 'admin',
        },
        discord: {
            enabled: !!process.env.DISCORD_BOT_TOKEN,
            botToken: process.env.DISCORD_BOT_TOKEN || '',
            allowedGuildIds: process.env.DISCORD_GUILD_IDS || '',
        },
        whatsapp: {
            enabled: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
            verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
        },
    },
    allowedRoles: ['admin', 'operator', 'viewer'],
    rateLimitPerMin: 30,
    auditLog: true,
};

class UnifiedAgent {
    /** @type {import('./ToolRegistry')} */
    #registry = null;
    /** @type {import('./PermissionEngine')} */
    #permissions = null;
    /** @type {import('./CommandRouter')} */
    #router = null;
    /** @type {import('./SessionManager')} */
    #sessions = null;
    /** @type {import('./CircuitBreaker')} */
    #breaker = null;
    /** @type {MemoryManager} */
    #memory = null;
    /** @type {AgentConfig} */
    #config = { ...DEFAULT_CONFIG };
    /** @type {Map<string, number[]>} userId -> timestamps for rate limiting */
    #rateMap = new Map();
    /**
     * Pending human-in-the-loop confirmations.
     * Map<userId, { toolName: string, params: object, context: object, expiresAt: number }>
     */
    #pendingConfirmations = new Map();

    /**
     * @param {ReturnType<import('../index').createRuntime>} runtime
     * @param {AgentConfig} [config]
     * @param {MemoryManager} [memory]
     */
    constructor(runtime, config, memory) {
        this.#registry = runtime.registry;
        this.#permissions = runtime.permissions;
        this.#router = runtime.router;
        this.#sessions = runtime.sessions;
        this.#breaker = runtime.breaker;
        this.#memory = memory || new MemoryManager();
        if (config) this.#config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Attach a MemoryManager (e.g., with Redis) post-construction.
     * @param {MemoryManager} memoryManager
     */
    setMemory(memoryManager) {
        this.#memory = memoryManager;
    }

    /** Update configuration (from admin panel). */
    updateConfig(partial) {
        this.#config = {
            ...this.#config,
            ...partial,
            channels: {
                ...this.#config.channels,
                ...(partial.channels || {}),
            },
        };
        eventBus.publish('agent:config-updated', { name: this.#config.name });
        return this.#config;
    }

    /** Get current config (sanitized — no tokens). */
    getConfig() {
        const safe = JSON.parse(JSON.stringify(this.#config));
        for (const ch of Object.values(safe.channels)) {
            // Sanitize botToken — show partial for UI display (masked)
            if (ch.botToken) {
                // Expose as `token` field for the admin UI (UI uses `token`, internal uses `botToken`)
                ch.token = '••••••••' + ch.botToken.slice(-4);
                ch.botToken = ch.token;
            }
            if (ch.accessToken) ch.accessToken = '••••••••' + ch.accessToken.slice(-4);
        }
        return safe;
    }

    /** Get full config (internal — includes tokens). */
    getFullConfig() {
        return { ...this.#config };
    }

    /**
     * Process a message from any channel.
     * This is the single entry point for all interactions.
     *
     * @param {string}   message  - User message (slash command or natural language)
     * @param {{ userId: string, role: string, channel: string, address?: string, sectors?: string[] }} context
     * @param {Function} [onChunk] - Optional streaming callback (token: string) => void
     * @returns {Promise<{ text: string, data?: any, error?: string }>}
     */
    async processMessage(message, context, onChunk = null) {
        if (!this.#config.enabled) {
            return { text: 'El agente está desactivado. Contacta al administrador.' };
        }

        // Rate limit check
        if (!this._checkRateLimit(context.userId)) {
            return { text: `Has excedido el límite de ${this.#config.rateLimitPerMin} mensajes por minuto.` };
        }

        const input = (message || '').trim();
        if (!input) return { text: 'Envía un comando o pregunta. Usa /help para ver opciones.' };

        eventBus.publish('agent:message', {
            userId: context.userId,
            channel: context.channel,
            input: input.slice(0, 200),
        });

        // ── Human-in-the-loop: check for pending confirmation ──
        if (this.#pendingConfirmations.has(context.userId)) {
            const pending = this.#pendingConfirmations.get(context.userId);

            // Expired after 2 minutes
            if (Date.now() > pending.expiresAt) {
                this.#pendingConfirmations.delete(context.userId);
            } else if (CONFIRM_PATTERN.test(input)) {
                // User confirmed — execute the pending tool
                this.#pendingConfirmations.delete(context.userId);
                await this.#memory.append(context.userId, { role: 'user', content: input });
                const result = await this._executeConfirmedTool(pending.toolName, pending.params, pending.context);
                await this.#memory.append(context.userId, { role: 'assistant', content: result.text?.slice(0, 500) || '' });
                return result;
            } else if (CANCEL_PATTERN.test(input)) {
                // User cancelled
                this.#pendingConfirmations.delete(context.userId);
                const result = { text: '❌ Operación cancelada.' };
                await this.#memory.append(context.userId, { role: 'user', content: input });
                await this.#memory.append(context.userId, { role: 'assistant', content: result.text });
                return result;
            } else {
                // Remind the user they have a pending action
                return {
                    text: `⏳ Tienes una acción pendiente de confirmar: \`${pending.toolName}\`\n\n` +
                        `Responde *sí* para ejecutar o *no* para cancelar.\n` +
                        `_(Esta confirmación expira en ${Math.ceil((pending.expiresAt - Date.now()) / 1000)}s)_`,
                };
            }
        }

        // Append user message to memory
        await this.#memory.append(context.userId, { role: 'user', content: input });

        let result;
        try {
            // 1. Slash commands → Runtime CommandRouter
            if (input.startsWith('/')) {
                result = await this._handleCommand(input, context);
            } else {
                // 2. Natural language intent detection + LLM streaming
                result = await this._handleNaturalLanguage(input, context, onChunk);
            }
        } catch (err) {
            console.error('[UnifiedAgent] processMessage error:', err.message);
            result = { text: `Error interno: ${err.message}`, error: err.message };
        }

        // Append agent response to memory (skip if it's a memory command itself to avoid noise)
        if (result?.text && !input.startsWith('/memory')) {
            await this.#memory.append(context.userId, {
                role: 'assistant',
                content: result.text.slice(0, 500),
            });
        }

        // ── Save interaction as SKILL (non-blocking, non-critical) ──────────
        if (result?.text && !input.startsWith('/clear') && !input.startsWith('/history')) {
            setImmediate(() => {
                SkillWriter.saveInteraction({
                    userMsg:  input,
                    agentMsg: result.text,
                    context,
                    provider: result._provider || 'intent',
                });
            });
        }

        return result;
    }

    /**
     * Handle slash commands via Runtime CommandRouter.
     */
    async _handleCommand(input, context) {
        const user = {
            role: context.role || 'viewer',
            address: context.address || 'channel-user',
            sectors: context.sectors || [],
        };

        // Special built-in commands
        const cmd = input.slice(1).split(' ')[0].toLowerCase();

        if (cmd === 'help') return this._help();
        if (cmd === 'status') return this._platformStatus();
        if (cmd === 'tools') return this._listTools();
        if (cmd === 'health') return this._health();
        if (cmd === 'ceo') return this._ceoConsole(context);
        if (cmd === 'bot-permissions') return this._botPermissions(context);
        if (cmd === 'platform-health') return this._platformHealth();
        if (cmd === 'restart-channels') return this._restartChannels();
        if (cmd === 'bots') return this._listDepartmentBots();
        if (cmd === 'notify-bots') return this._notifyDepartmentBots(input, context);
        if (cmd === 'memory') return this._memoryStatus(context.userId);
        if (cmd === 'clear') return this._clearMemory(context.userId);
        if (cmd === 'history') return this._showHistory(context.userId);

        // Delegate to Runtime CommandRouter
        const result = await this.#router.dispatch(input, {
            registry: this.#registry,
            permissions: this.#permissions,
            user,
        });

        if (!result.success) {
            return { text: result.message || 'Comando no reconocido. Usa /help.' };
        }

        return {
            text: this._formatCommandResult(result),
            data: result.data,
        };
    }

    /**
     * Handle natural language by mapping to the best tool/command.
     * Intent matching runs first (fast, deterministic).
     * If no intent matches, falls back to an LLM call via the AI Gateway.
     */
    async _handleNaturalLanguage(input, context, onChunk = null) {
        const lower = input.toLowerCase();

        // ── Structured intent matching (priority 1) ──────────────────────
        const intents = [
            { match: /estado|status|salud|health/, action: () => this._platformStatus() },
            { match: /ceo|director|orquest|coordina|coordinar|bots departamentales/, action: () => this._ceoConsole(context) },
            { match: /gas|comisi[oó]n|fee/, action: () => this._invokeTool('mcp:analyze_gas_strategy', { hour_of_day: new Date().getHours(), pending_tx: 0, block_utilization: 0.5 }, context) },
            { match: /anomal[ií]a|fraude|fraud|seguridad/, action: () => this._invokeTool('mcp:assess_fraud_risk', { wallet_address: context.address || '0x0', amount_bez: 0, transaction_type: 'transfer' }, context) },
            { match: /sentimiento|sentiment/, action: () => this._invokeTool('mcp:analyze_sentiment', { text: input }, context) },
            { match: /validador|validator/, action: () => this._handleCommand('/validator-status', context) },
            { match: /bridge|puente/, action: () => this._handleCommand('/bridge-health', context) },
            { match: /paridad|parity/, action: () => this._handleCommand('/parity-audit', context) },
            { match: /sector|industria/, action: () => this._invokeTool('sector-query', { sector: this._extractSector(lower) }, context) },
            { match: /nodo|edge.?node/, action: () => this._invokeTool('mcp:monitor_edge_node', { node_id: 'default' }, context) },
            { match: /swap|intercambio/, action: () => this._invokeTool('mcp:calculate_smart_swap', { amount: 100, from_token: 'BEZ', to_token: 'ETH' }, context) },
            { match: /proveedor|supplier/, action: () => this._invokeTool('mcp:score_supplier', { supplier_id: 'query', on_time_delivery_pct: 95, dispute_rate_pct: 2, quality_incidents: 0 }, context) },
            { match: /demanda|demand/, action: () => this._invokeTool('mcp:predict_demand', { sector: 'logistics', historical_volume: 1000, growth_rate_pct: 5 }, context) },
            { match: /contrato|contract|audit/, action: () => this._invokeTool('mcp:audit_contract', { contract_address: '0x0', bytecode_hash: '', recent_tx_count: 0 }, context) },
            { match: /incidente|incident/, action: () => this._handleCommand('/incident ' + input, context) },
            { match: /deploy|despliegue/, action: () => this._handleCommand('/deploy-check', context) },
            { match: /herramienta|tool/, action: () => this._listTools() },
            { match: /ayuda|help|comando/, action: () => this._help() },
        ];

        for (const intent of intents) {
            if (intent.match.test(lower)) {
                return intent.action();
            }
        }

        // ── LLM fallback (priority 2) ─────────────────────────────────────
        return this._callLLM(input, context, onChunk);
    }

    /**
     * Call the AI Gateway (DeepSeek / Gemini) with conversational memory context.
     * Supports optional streaming via the onChunk callback.
     *
     * @param {string}    input     - User message
     * @param {object}    context   - { userId, role, channel, address }
     * @param {Function}  onChunk   - Optional (chunk: string) => void for SSE streaming
     * @returns {{ text: string, data: null }}
     */
    /**
     * Call LLM directly — Gemini first, then BeZhas local AI.
     * Bypasses the internal gateway proxy entirely to avoid dependency issues.
     *
     * Priority:
     *   1. Google Gemini 2.0 Flash (via GEMINI_API_KEY)
     *   2. BeZhas local AI-Engine (Aegis / port 3002)
     *   3. Structured fallback menu
     */
    async _callLLM(input, context, onChunk = null) {
        // ── Build conversational context ─────────────────────────────────────
        let history = [];
        try {
            const mem = await this.#memory.getHistory(context.userId);
            // Last 8 messages (4 turns) for context — avoid token overflow
            history = mem.slice(-8).flatMap(m => [
                ...(m.user    ? [{ role: 'user',      content: m.user }]      : []),
                ...(m.assistant ? [{ role: 'assistant', content: m.assistant }] : []),
            ]).filter(m => m.content);
        } catch { /* memory unavailable */ }

        // ── Detect if this needs local AI (blockchain-specific) ───────────────
        const needsLocalAI = /gas|anomal|fraud|contract|validador|bridge/i.test(input);

        const systemPrompt = [
            this.#config.personality || DEFAULT_CONFIG.personality,
            `\n\nCONTEXT: El usuario está en el canal ${context.channel || 'desconocido'}.`,
            `Su rol en la plataforma es: ${context.role || 'viewer'}.`,
            `Responde siempre en el mismo idioma en que el usuario escribe.`,
            `Si el usuario pregunta sobre blockchain BeZhas, usa los datos de la plataforma.`,
            `Sé conciso (máx 3 párrafos) salvo que el usuario pida detalle.`,
        ].join(' ');

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: input },
        ];

        try {
            let result;
            if (onChunk) {
                // Real SSE streaming
                result = await GeminiClient.stream(messages, onChunk, {
                    useLocal: needsLocalAI,
                    temperature: 0.7,
                });
            } else {
                // Synchronous generation
                result = await GeminiClient.generate(messages, {
                    useLocal: needsLocalAI,
                    temperature: 0.7,
                });
            }

            const { text, provider } = result;
            console.log(`[UnifiedAgent] LLM response via ${provider} (${text.length} chars)`);
            return { text, _provider: provider };

        } catch (err) {
            console.warn(`[UnifiedAgent] All LLM providers failed: ${err.message}`);
            return {
                _provider: 'fallback',
                text: `Lo siento, no puedo conectar con el servicio de IA ahora mismo.\n\n` +
                    `Puedes usar estos comandos directos:\n` +
                    `• /status — Estado de la plataforma\n` +
                    `• /help — Todos los comandos disponibles\n` +
                    `• "analiza gas" — Análisis de costes\n` +
                    `• "estado validadores" — Salud del sistema\n` +
                    `• "detectar fraude" — Evaluación de riesgos`,
            };
        }
    }


    /**
     * Invoke a Runtime tool directly.
     * For mutating tools (on-chain state changes), this enforces human-in-the-loop:
     * instead of executing immediately, asks the user for confirmation first.
     */
    async _invokeTool(toolName, params, context) {
        // Check if this tool requires confirmation
        if (MUTATING_TOOLS.has(toolName)) {
            return this._requestConfirmation(toolName, params, context);
        }

        return this._executeConfirmedTool(toolName, params, context);
    }

    /**
     * Present a confirmation request to the user (human-in-the-loop gate).
     * Stores the pending action in memory for 2 minutes.
     */
    _requestConfirmation(toolName, params, context) {
        // Store pending confirmation with TTL of 2 minutes
        this.#pendingConfirmations.set(context.userId, {
            toolName,
            params,
            context,
            expiresAt: Date.now() + 120_000,
        });

        eventBus.publish('agent:confirmation_requested', {
            userId: context.userId,
            toolName,
            channel: context.channel,
        });

        // Build a human-readable summary of the operation
        const paramSummary = Object.entries(params)
            .map(([k, v]) => `  • ${k}: ${JSON.stringify(v)}`)
            .join('\n');

        return {
            text: `⚠️ **Confirmación requerida** \n\n` +
                `• Tool: \`${toolName}\`\n` +
                `• Parámetros:\n${paramSummary}\n\n` +
                `Esta operación **modifica estado en la blockchain**.\n` +
                `Responde *sí* para ejecutar o *no* para cancelar.\n` +
                `_(Tienes 2 minutos para confirmar)_`,
            requiresConfirmation: true,
        };
    }

    /**
     * Execute a tool that has already been confirmed (or doesn't require confirmation).
     */
    async _executeConfirmedTool(toolName, params, context) {
        const user = {
            role: context.role || 'viewer',
            address: context.address || 'channel-user',
            sectors: context.sectors || [],
        };

        const result = await this.#registry.invoke(toolName, params, { user });
        if (!result.success) {
            return { text: `Error al ejecutar ${toolName}: ${result.meta?.error || 'desconocido'}` };
        }
        return {
            text: this._formatToolResult(toolName, result.data),
            data: result.data,
        };
    }

    /**
     * Get pending confirmation info for a user (for API/status queries).
     * @param {string} userId
     */
    getPendingConfirmation(userId) {
        const pending = this.#pendingConfirmations.get(userId);
        if (!pending || Date.now() > pending.expiresAt) {
            this.#pendingConfirmations.delete(userId);
            return null;
        }
        return {
            toolName: pending.toolName,
            expiresAt: pending.expiresAt,
            ttlSeconds: Math.ceil((pending.expiresAt - Date.now()) / 1000),
        };
    }

    // ── Built-in actions ──

    async _platformStatus() {
        const parts = ['📊 **Estado de la Plataforma BeZhas**\n'];

        // Runtime health
        const tools = this.#registry.list();
        const commands = this.#router.list();
        parts.push(`🔧 Runtime: ${tools.length} herramientas, ${commands.length} comandos`);

        // Circuit breakers
        if (this.#breaker) {
            const circuits = this.#breaker.getAll();
            const openCount = Object.values(circuits).filter(c => c.state === 'OPEN').length;
            parts.push(`⚡ Circuit Breakers: ${openCount} abiertos de ${Object.keys(circuits).length}`);
        }

        // Aegis health
        try {
            const aegis = await axios.get(`${AEGIS_URL}/aegis/v1/health`, { timeout: 5000 });
            const d = aegis.data;
            parts.push(`🛡️ Aegis: ${d.status} — ${(d.models_loaded || []).length} modelos cargados`);
        } catch {
            parts.push('🛡️ Aegis: offline');
        }

        // AI-Engine health
        try {
            const mcp = await axios.get(`${AI_ENGINE_URL}/api/mcp/health`, { timeout: 5000 });
            parts.push(`🤖 AI-Engine: ${mcp.data.status} — v${mcp.data.version}`);
        } catch {
            parts.push('🤖 AI-Engine: offline');
        }

        // Channels
        const channels = this.#config.channels;
        const activeChannels = Object.entries(channels)
            .filter(([, v]) => v.enabled)
            .map(([k]) => k);
        parts.push(`📡 Canales activos: ${activeChannels.length > 0 ? activeChannels.join(', ') : 'ninguno'}`);

        return { text: parts.join('\n') };
    }

    _help() {
        return {
            text: `🤖 **BeZhas AI Agent — Comandos**\n\n` +
                `**Plataforma:**\n` +
                `/status — Estado completo de la plataforma\n` +
                `/ceo — Consola CEO / orquestación\n` +
                `/bot-permissions — Permisos efectivos del bot\n` +
                `/platform-health — Health de API, Hub y canales\n` +
                `/restart-channels — Reinicia Telegram/Discord/WhatsApp\n` +
                `/bots — Lista bots departamentales configurados\n` +
                `/notify-bots <mensaje> — Pide reporte a bots departamentales\n` +
                `/health — Salud del Runtime\n` +
                `/tools — Herramientas disponibles\n\n` +
                `**Blockchain:**\n` +
                `/bridge-health — Estado del puente L2↔Polygon\n` +
                `/validator-status — Estado de validadores\n` +
                `/deploy-check — Verificar despliegue\n` +
                `/parity-audit — Auditoría SDK/Contratos\n\n` +
                `**IA & Análisis:**\n` +
                `"analiza gas" — Predicción de costes de gas\n` +
                `"detectar fraude" — Evaluación de riesgo\n` +
                `"sentimiento [texto]" — Análisis de sentimiento\n` +
                `"estado validadores" — Monitoreo de validadores\n\n` +
                `**Sectores:**\n` +
                `/incident [desc] — Reportar incidente\n` +
                `"sector logística" — Consultar sector\n\n` +
                `**DeFi:**\n` +
                `"swap 100 BEZ a ETH" — Cálculo de swap\n` +
                `"demanda logística" — Predicción de demanda\n\n` +
                `**Memoria:**\n` +
                `/memory — Estado de tu memoria conversacional\n` +
                `/history — Ver últimos 10 mensajes\n` +
                `/clear — Borrar historial de conversación\n`,
        };
    }

    _listTools() {
        const tools = this.#registry.list();
        const grouped = {};
        for (const t of tools) {
            const cat = t.name.startsWith('mcp:') ? 'MCP/IA' : (t.sector || 'Core');
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(t.name);
        }

        let text = `🔧 **Herramientas Disponibles** (${tools.length})\n\n`;
        for (const [cat, names] of Object.entries(grouped)) {
            text += `**${cat}:**\n${names.map(n => `  • ${n}`).join('\n')}\n\n`;
        }
        return { text };
    }

    _health() {
        return {
            text: `✅ Runtime v0.5.0 — Operativo\n` +
                `🔧 ${this.#registry.size} herramientas\n` +
                `📋 ${this.#router.size} comandos\n` +
                `🧠 Memoria: ${this.#memory ? 'activa' : 'desactivada'}\n` +
                `📡 Agente: ${this.#config.enabled ? 'activo' : 'desactivado'}`,
        };
    }

    _ensureCeoAccess(context) {
        if ((context.role || '').toLowerCase() !== 'admin') {
            return {
                ok: false,
                response: { text: '⛔ Esta acción requiere rol admin/CEO.' },
            };
        }
        return { ok: true };
    }

    _ceoConsole(context) {
        const gate = this._ensureCeoAccess(context);
        if (!gate.ok) return gate.response;

        return {
            text: `👔 **BeZhasCEOBot — Consola CEO Activa**\n\n` +
                `Permisos efectivos: **admin total** sobre runtime, tools, skills, análisis, AEGIS, OpenClaw bridge y operaciones internas.\n\n` +
                `Capacidades directas:\n` +
                `• /platform-health — Verifica API, Hub, AEGIS, AI Engine y canales\n` +
                `• /tools — Lista herramientas disponibles\n` +
                `• /bots — Ver bots departamentales configurados\n` +
                `• /notify-bots <mensaje> — Coordina reportes CEO/CFO/CMO/DevOps/Legal\n` +
                `• /restart-channels — Reinicia canales del agente\n` +
                `• /parity-audit, /deploy-check, /bridge-health, /validator-status\n\n` +
                `Seguridad: las acciones que modifican blockchain, tesorería, staking, bridge o contratos siguen pasando por confirmación humana: responde "sí" o "no".`,
        };
    }

    _botPermissions(context) {
        const gate = this._ensureCeoAccess(context);
        if (!gate.ok) return gate.response;

        const mutating = Array.from(MUTATING_TOOLS).sort();
        return {
            text: `🔐 **Permisos BeZhasCEOBot**\n\n` +
                `Rol: **${context.role || 'unknown'}**\n` +
                `Canal: **${context.channel || 'unknown'}**\n` +
                `User ID: \`${context.userId || 'unknown'}\`\n\n` +
                `Puede ejecutar:\n` +
                `• Lectura y diagnóstico de plataforma\n` +
                `• Todas las herramientas MCP/AEGIS registradas\n` +
                `• Auditorías de paridad, deploy y validadores\n` +
                `• Orquestación de bots departamentales\n` +
                `• Creación de incidentes y reportes operativos\n\n` +
                `Requieren confirmación humana antes de ejecutar:\n${mutating.map(t => `• ${t}`).join('\n')}`,
        };
    }

    async _platformHealth() {
        const checks = [];

        async function probe(name, url, pick = d => d.status || d.success || 'ok') {
            try {
                const res = await axios.get(url, { timeout: 5000, headers: { 'x-internal-key': INTERNAL_API_KEY } });
                checks.push(`✅ ${name}: ${pick(res.data)}`);
            } catch (err) {
                checks.push(`⚠️ ${name}: ${err.response?.status || err.message}`);
            }
        }

        await probe('Blockchain API', `${API_URL.replace(/\/api$/, '')}/api/health`, d => d.status || 'ok');
        await probe('UnifiedAgent', `${API_URL}/agent/internal/status`, d => {
            const c = d.data?.channels || {};
            return `ok | telegram=${c.telegram || 'unknown'} | tools=${this.#registry.size}`;
        });
        await probe('AEGIS', `${AEGIS_URL}/aegis/v1/health`);
        await probe('AI Engine MCP', `${AI_ENGINE_URL}/api/mcp/health`);

        return {
            text: `🏥 **Health Ejecutivo BeZhas**\n\n${checks.join('\n')}\n\n` +
                `Runtime local: ${this.#registry.size} herramientas, ${this.#router.size} comandos.`,
        };
    }

    async _restartChannels() {
        try {
            const res = await axios.post(`${API_URL}/agent/internal/channels/restart`, {}, {
                timeout: 10000,
                headers: { 'x-internal-key': INTERNAL_API_KEY },
            });
            const channels = res.data?.data?.channels || {};
            return {
                text: `📡 Canales reiniciados.\n` +
                    `Telegram: ${channels.telegram || 'unknown'}\n` +
                    `Discord: ${channels.discord || 'unknown'}\n` +
                    `WhatsApp: ${channels.whatsapp || 'unknown'}`,
                data: res.data,
            };
        } catch (err) {
            return { text: `No pude reiniciar canales: ${err.response?.data?.error || err.message}` };
        }
    }

    _departmentBots() {
        return [
            { id: 'CEO', env: 'TELEGRAM_TOKEN_DIRECTOR', role: 'Dirección estratégica' },
            { id: 'CFO', env: 'TELEGRAM_TOKEN_FINANCE', role: 'Tesorería, staking, P&L' },
            { id: 'CMO', env: 'TELEGRAM_TOKEN_MARKETING', role: 'Growth, campañas, SDR' },
            { id: 'DevOps', env: 'TELEGRAM_TOKEN_DEVOPS', role: 'Infraestructura, seguridad, deploy' },
            { id: 'Legal', env: 'TELEGRAM_TOKEN_LEGAL', role: 'Cumplimiento, contratos, fiscalidad' },
        ].map(bot => ({ ...bot, token: process.env[bot.env] || '' }));
    }

    _listDepartmentBots() {
        const bots = this._departmentBots();
        return {
            text: `🤖 **Bots Departamentales BeZhas**\n\n` +
                bots.map(b => `${b.token ? '✅' : '⚠️'} ${b.id}: ${b.role}`).join('\n') +
                `\n\nNota: Telegram no permite que un bot hable como usuario con otros bots. BeZhasCEOBot coordina usando los tokens departamentales para enviarte reportes desde cada identidad al chat autorizado.`,
        };
    }

    async _notifyDepartmentBots(input, context) {
        const gate = this._ensureCeoAccess(context);
        if (!gate.ok) return gate.response;

        const msg = input.replace(/^\/notify-bots\s*/i, '').trim() || 'Solicito reporte ejecutivo de estado, riesgos y próximas acciones.';
        const chatId = process.env.TELEGRAM_ALLOWED_CHAT_IDS?.split(',').map(v => v.trim()).filter(Boolean)[0]
            || process.env.TELEGRAM_SECURITY_CHAT_ID;
        if (!chatId) return { text: 'No hay TELEGRAM_ALLOWED_CHAT_IDS o TELEGRAM_SECURITY_CHAT_ID configurado.' };

        const bots = this._departmentBots().filter(b => b.token);
        if (!bots.length) return { text: 'No hay tokens de bots departamentales configurados.' };

        const results = [];
        for (const bot of bots) {
            const text = `📌 **${bot.id} / ${bot.role}**\n\n` +
                `Orden CEO:\n${msg}\n\n` +
                `Estado: recibido por orquestación BeZhasCEOBot.\n` +
                `Acción requerida: preparar respuesta/briefing en el canal ejecutivo.`;
            try {
                const res = await axios.post(`${TELEGRAM_API}${bot.token}/sendMessage`, {
                    chat_id: chatId,
                    text,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                }, { timeout: 10000 });
                results.push(`✅ ${bot.id}: enviado #${res.data?.result?.message_id || 'ok'}`);
            } catch (err) {
                results.push(`⚠️ ${bot.id}: ${err.response?.data?.description || err.message}`);
            }
        }

        return {
            text: `📣 **Orquestación enviada a bots departamentales**\n\n${results.join('\n')}`,
        };
    }

    async _memoryStatus(userId) {
        const stats = await this.#memory.stats(userId);
        return {
            text: `🧠 **Memoria Conversacional**\n` +
                `📝 Mensajes guardados: ${stats.messageCount}/${stats.maxMessages}\n` +
                `🕐 Primer mensaje: ${stats.firstMessageAt ? new Date(stats.firstMessageAt).toLocaleString('es-ES') : 'ninguno'}\n` +
                `🕐 Último mensaje: ${stats.lastMessageAt ? new Date(stats.lastMessageAt).toLocaleString('es-ES') : 'ninguno'}\n` +
                `💡 Usa /history para ver el historial | /clear para borrarlo`,
        };
    }

    async _showHistory(userId) {
        const context = await this.#memory.buildContext(userId, 10);
        if (!context) {
            return { text: '📭 No hay historial de conversación guardado.' };
        }
        return {
            text: `📜 **Últimos mensajes:**\n\n${context}`,
        };
    }

    async _clearMemory(userId) {
        await this.#memory.clear(userId);
        return { text: '🗑️ Historial de conversación borrado correctamente.' };
    }

    /**
     * Public: clear memory from outside (e.g., API endpoint).
     * @param {string} userId
     */
    async clearMemory(userId) {
        await this.#memory.clear(userId);
    }

    /**
     * Public: get memory stats for a user.
     * @param {string} userId
     */
    async getMemoryStats(userId) {
        return this.#memory.stats(userId);
    }

    // ── Helpers ──

    _formatCommandResult(result) {
        if (typeof result.data === 'string') return result.data;
        if (result.message) return result.message;
        return JSON.stringify(result.data, null, 2).slice(0, 2000);
    }

    _formatToolResult(toolName, data) {
        if (!data) return `✅ ${toolName} ejecutado correctamente.`;
        if (typeof data === 'string') return data;

        // Smart formatting for known MCP tools
        const d = data.result || data;
        if (d.recommendation) return `⛽ Gas: ${d.recommendation} (confianza: ${d.confidence || '?'})`;
        if (d.sentiment != null) return `💬 Sentimiento: ${d.sentiment} (${d.label || ''})`;
        if (d.health_score != null) return `🏥 Salud: ${d.health_score}/100 — ${d.status || ''}`;
        if (d.risk_score != null) return `⚠️ Riesgo: ${d.risk_score} — ${d.recommendation || ''}`;
        if (d.fraud_risk != null) return `🔍 Riesgo de fraude: ${d.fraud_risk} — ${d.verdict || ''}`;

        const json = JSON.stringify(d, null, 2);
        return json.length > 1500 ? json.slice(0, 1500) + '\n…(truncado)' : json;
    }

    _extractSector(text) {
        const sectors = [
            'logistics', 'real-estate', 'health', 'energy', 'automotive',
            'manufacturing', 'agriculture', 'insurance', 'education',
            'entertainment', 'legal', 'supply-chain', 'government',
            'finance', 'services', 'other',
        ];
        for (const s of sectors) {
            if (text.includes(s)) return s;
        }
        // Spanish mappings
        const map = {
            'logística': 'logistics', 'inmobiliario': 'real-estate', 'salud': 'health',
            'energía': 'energy', 'automotriz': 'automotive', 'manufactura': 'manufacturing',
            'agricultura': 'agriculture', 'seguro': 'insurance', 'educación': 'education',
            'entretenimiento': 'entertainment', 'legal': 'legal', 'cadena': 'supply-chain',
            'gobierno': 'government', 'finanza': 'finance', 'servicio': 'services',
        };
        for (const [es, en] of Object.entries(map)) {
            if (text.includes(es)) return en;
        }
        return 'logistics'; // default
    }

    _checkRateLimit(userId) {
        const now = Date.now();
        const window = 60_000; // 1 minute
        const timestamps = (this.#rateMap.get(userId) || []).filter(t => now - t < window);
        if (timestamps.length >= this.#config.rateLimitPerMin) return false;
        timestamps.push(now);
        this.#rateMap.set(userId, timestamps);
        return true;
    }
}

module.exports = UnifiedAgent;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
