/**
 * BeZhas Agent Runtime — Entry point.
 * Boots ToolRegistry, PermissionEngine, CommandRouter, SessionManager,
 * PluginLoader, ParityChecker, CircuitBreaker, RuntimeEventBus and
 * registers core tools + MCP proxy tools + slash commands + sector plugins.
 */
// Attach OIDC tokens to outbound calls to the private aegis / ai-gateway
// backends. No-op locally; see gcpServiceAuth.js.
require('./gcpServiceAuth').install();

const ToolRegistry = require('./core/ToolRegistry');
const PermissionEngine = require('./core/PermissionEngine');
const CommandRouter = require('./core/CommandRouter');
const SessionManager = require('./core/SessionManager');
const PluginLoader = require('./core/PluginLoader');
const ParityChecker = require('./core/ParityChecker');
const CircuitBreaker = require('./core/CircuitBreaker');
const eventBus = require('./core/RuntimeEventBus');
const SkillWriter = require('./core/SkillWriter');
const AgentManager = require('./AgentManager');
const OllamaGateway = require('./OllamaGateway');

// Agents & Connectors
const SecurityAgent = require('./agents/SecurityAgent');
const TradingAgent = require('./agents/TradingAgent');
const TokenomicsAgent = require('./agents/TokenomicsAgent');
const ComplianceAgent = require('./agents/ComplianceAgent');
const WorkflowAgent = require('./agents/WorkflowAgent');
const TokenomicsConnector = require('./connectors/TokenomicsConnector');

// Core tools (Sprint 1)
const bridgeHealthTool = require('./tools/bridge-health.tool');
const validatorStatusTool = require('./tools/validator-status.tool');
const gasAnalyticsTool = require('./tools/gas-analytics.tool');

// Sprint 2
const { registerMcpProxyTools } = require('./tools/mcp-proxy.tool');
const { registerObsidianProxyTools } = require('./tools/obsidian-proxy.tool');

// Sprint 3
const deployCheckTool = require('./tools/deploy-check.tool');

// Sprint 4
const incidentReportTool = require('./tools/incident-report.tool');
const sectorQueryTool = require('./tools/sector-query.tool');

// Slash commands (Sprint 2 + 3 + 4)
const bridgeHealthCmd = require('./commands/bridge-health.cmd');
const validatorStatusCmd = require('./commands/validator-status.cmd');
const parityAuditCmd = require('./commands/parity-audit.cmd');
const deployCheckCmd = require('./commands/deploy-check.cmd');
const incidentCmd = require('./commands/incident.cmd');

/**
 * Create and configure a runtime instance.
 * @param {{ redis?: import('redis').RedisClientType, loadPlugins?: boolean, circuitBreaker?: object }} [opts]
 * @returns {{ registry: ToolRegistry, permissions: PermissionEngine, router: CommandRouter, sessions: SessionManager, plugins: PluginLoader, parity: ParityChecker, breaker: CircuitBreaker, eventBus: typeof eventBus, manager: AgentManager }}
 */
function createRuntime(opts = {}) {
    const registry = new ToolRegistry();
    const permissions = new PermissionEngine();
    const router = new CommandRouter();
    const sessions = new SessionManager({ redis: opts.redis || null });
    const plugins = new PluginLoader();
    const parity = new ParityChecker();
    const breaker = new CircuitBreaker(opts.circuitBreaker || {});

    // New Architecture: AgentManager
    const manager = opts.startAgents === false
        ? null
        : new AgentManager({
            redisUrl: opts.redisUrl,
            memory: sessions
        });

    // Ollama Local LLM Gateway
    const ollama = new OllamaGateway({
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        defaultModel: process.env.OLLAMA_DEFAULT_MODEL || null,
        anthropicLimit: parseInt(process.env.ANTHROPIC_TOKEN_LIMIT || '100000'),
        geminiLimit: parseInt(process.env.GEMINI_TOKEN_LIMIT || '500000'),
    });

    // Wire Ollama events to runtime event bus
    ollama.on('health:ok', (d) => eventBus.emit('ollama:health', { status: 'ok', ...d }));
    ollama.on('health:fail', (d) => eventBus.emit('ollama:health', { status: 'fail', ...d }));
    ollama.on('quota:exhausted', (d) => {
        eventBus.emit('ollama:fallback', d);
        console.log(`[Ollama] Quota exhausted for ${d.provider} — switching to local models`);
    });
    ollama.on('chat:complete', (d) => eventBus.emit('ollama:chat', d));

    // Auto health check + warm-up
    if (opts.startOllama !== false) {
        ollama.checkHealth().then(h => {
            if (h.healthy) {
                console.log(`[Ollama] ✅ Connected — ${h.models.length} models available`);
                ollama.warmUp().catch(() => {});
            } else {
                console.log('[Ollama] ⚠️ Not available — cloud-only mode');
            }
        }).catch(() => console.log('[Ollama] ⚠️ Not reachable'));
    }

    // Tokenomics & Monitoring (Sprint 3)
    let tokenomicsConnector = null;

    // Register specialized agents using AgentManager's idiomatic way
    if (manager) {
        manager.registerAgent(SecurityAgent);
        manager.registerAgent(TradingAgent);
        manager.registerAgent(ComplianceAgent);
        manager.registerAgent(WorkflowAgent);
    }

    if (opts.startTokenomics !== false) {
        tokenomicsConnector = new TokenomicsConnector({
            wsUrl: process.env.WS_URL || 'ws://localhost:8545',
            bezAddress: process.env.BEZ_TOKEN_ADDRESS,
            stakingAddress: process.env.STAKING_POOL_ADDRESS,
        });

        if (manager) {
            // El TokenomicsAgent necesita el conector inyectado
            const tokenomicsAgent = manager.registerAgent(TokenomicsAgent, { connector: tokenomicsConnector });

            // Vincular conector con agente para anomalías directas
            tokenomicsConnector.on('anomaly:detected', (a) => tokenomicsAgent.handleAnomaly(a));
            tokenomicsConnector.connect().catch(err => console.error('[Runtime] Error conectando TokenomicsConnector:', err.message));
        }
    } else if (manager) {
        manager.registerAgent(TokenomicsAgent, { connector: null });
    }

    // Start background processing if requested
    if (manager && opts.startManager !== false) {
        manager.start();
    }

    // Register core tools (Sprint 1)
    registry.register(bridgeHealthTool);
    registry.register(validatorStatusTool);
    registry.register(gasAnalyticsTool);

    // Register MCP proxy tools (Sprint 2) — wraps all 12 AI-Engine tools
    registerMcpProxyTools(registry);
    registerObsidianProxyTools(registry);

    // Register deploy-check tool (Sprint 3)
    registry.register(deployCheckTool);

    // Register Sprint 4 tools
    registry.register(incidentReportTool);
    registry.register(sectorQueryTool);

    // Register slash commands (Sprint 2 + 3 + 4)
    router.register(bridgeHealthCmd);
    router.register(validatorStatusCmd);
    router.register(parityAuditCmd);
    router.register(deployCheckCmd);
    router.register(incidentCmd);

    // Load sector plugins (Sprint 3) — adds plugin tools + commands
    if (opts.loadPlugins !== false) {
        plugins.loadAll(registry, router);
    }

    // Register Maintenance Skill: Daily Dependency Update Reminder
    setImmediate(() => {
        SkillWriter.saveInteraction({
            userMsg: "Sistema: Verificar tareas de mantenimiento programadas.",
            agentMsg: "Recordatorio: Es necesario actualizar todas las dependencias del proyecto diariamente para garantizar la seguridad y estabilidad de la red BeZhas. Ejecutar 'npm update' y revisar vulnerabilidades con 'npm audit'.",
            context: {
                userId: 'system-scheduler',
                role: 'admin',
                channel: 'internal'
            },
            provider: 'system-routine'
        });
    });

    return { registry, permissions, router, sessions, plugins, parity, breaker, eventBus, manager, ollama };
}

/**
 * Invoke a tool with full permission check + audit context.
 * This is the main entry point used by the API route.
 *
 * @param {ToolRegistry} registry
 * @param {PermissionEngine} permissions
 * @param {string} toolName
 * @param {object} params
 * @param {{ role: string, address: string, sectors?: string[] }} user
 * @returns {Promise<object>}
 */
async function invokeWithPermissions(registry, permissions, toolName, params, user) {
    const tool = registry.get(toolName);
    if (!tool) {
        return { success: false, error: `Tool "${toolName}" not found` };
    }

    // Permission check
    const check = permissions.check(user.role, tool.permissions, tool.sector);
    if (!check.allowed) {
        return {
            success: false,
            error: 'Permission denied',
            denied: check.denied,
            role: user.role,
        };
    }

    // Execute
    const result = await registry.invoke(toolName, params, { user });
    return result;
}

const MemoryManager = require('./MemoryManager');
const OrchestrationManifest = require('./core/OrchestrationManifest');
const OrchestrationEventPublisher = require('./core/OrchestrationEventPublisher');

module.exports = { 
    createRuntime, 
    invokeWithPermissions, 
    ToolRegistry, 
    PermissionEngine, 
    CommandRouter, 
    SessionManager, 
    PluginLoader, 
    ParityChecker, 
    CircuitBreaker, 
    eventBus, 
    MemoryManager,
    OrchestrationManifest,
    OrchestrationEventPublisher,
    AgentManager,
    SecurityAgent,
    TradingAgent,
    TokenomicsAgent,
    ComplianceAgent,
    WorkflowAgent,
    OllamaGateway
};
