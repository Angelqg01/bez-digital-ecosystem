import { useState, useEffect, Suspense, lazy, useRef } from 'react';
import {
    Brain, Bot, MessageSquare, Activity, Settings, Sparkles,
    HelpCircle, X, ChevronRight, RefreshCw, Zap, Shield,
    TrendingUp, Target, Users, BarChart3, Cpu, Database,
    Info, CheckCircle, AlertTriangle, ExternalLink,
    Globe, GitBranch, Bug, Eye, Layers, Lock, Vote,
    Server, Truck, LineChart, Plug, Download
} from 'lucide-react';
import aiApi, { mockData } from '../../services/aiApi';
import http from '../../services/http';

// Lazy load heavy components
const DiagnosticDashboard = lazy(() => import('../../components/admin/DiagnosticDashboard'));
const ChatAISettings = lazy(() => import('../../components/admin/ChatAISettings'));
const AIFeaturesPanel = lazy(() => import('../../components/admin/AIFeaturesPanel'));

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * HelpTooltip - Componente de ayuda contextual
 */
const HelpTooltip = ({ title, content, isOpen, onClose, onOpen }) => {
    if (!isOpen) {
        return (
            <button
                onClick={onOpen}
                className="p-1.5 rounded-lg bg-gray-800/50 hover:bg-purple-600/30 text-gray-400 hover:text-purple-400 transition-all"
                title="Ayuda"
            >
                <HelpCircle size={18} />
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-lg w-full shadow-2xl shadow-purple-500/20 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600/20 rounded-lg">
                            <Info className="text-purple-400" size={20} />
                        </div>
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 text-gray-300 text-sm leading-relaxed">
                    {content}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <CheckCircle size={16} />
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * SectionCard - Tarjeta de sección con ayuda integrada
 */
const SectionCard = ({ icon: Icon, title, description, helpTitle, helpContent, children, className = '' }) => {
    const [showHelp, setShowHelp] = useState(false);

    return (
        <div className={`bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg">
                        <Icon className="text-purple-400" size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        {description && (
                            <p className="text-sm text-gray-400">{description}</p>
                        )}
                    </div>
                </div>
                {helpContent && (
                    <HelpTooltip
                        title={helpTitle || title}
                        content={helpContent}
                        isOpen={showHelp}
                        onOpen={() => setShowHelp(true)}
                        onClose={() => setShowHelp(false)}
                    />
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

/**
 * QuickStatCard - Tarjeta de estadística rápida
 */
const QuickStatCard = ({ icon: Icon, label, value, color = 'purple', trend }) => {
    const colorClasses = {
        purple: 'from-purple-600 to-purple-800 text-purple-400',
        blue: 'from-blue-600 to-blue-800 text-blue-400',
        green: 'from-green-600 to-green-800 text-green-400',
        yellow: 'from-yellow-600 to-yellow-800 text-yellow-400',
        red: 'from-red-600 to-red-800 text-red-400',
    };

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color]?.split(' ').slice(0, 2).join(' ')}/20`}>
                    <Icon className={colorClasses[color]?.split(' ').pop()} size={20} />
                </div>
                {trend && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            <div className="mt-3">
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-gray-400">{label}</p>
            </div>
        </div>
    );
};

/**
 * MCP Dashboard - Master list of all 13 MCP Intelligence Tools
 * Shows real-time status, health indicators, and tool descriptions.
 */
const MCP_TOOLS_MASTER = [
    {
        id: 'analyze_gas_strategy',
        name: 'Polygon Gas MCP',
        category: 'Blockchain',
        icon: Zap,
        color: 'purple',
        endpoint: '/api/mcp/analyze-gas',
        description: 'Análisis de gas en Polygon, rentabilidad y decisión Relayer vs User.',
        actions: ['iot_ingest', 'marketplace_buy', 'token_transfer', 'nft_mint', 'staking_deposit'],
    },
    {
        id: 'calculate_smart_swap',
        name: 'Balance Swap MCP',
        category: 'Blockchain',
        icon: TrendingUp,
        color: 'blue',
        endpoint: '/api/mcp/calculate-swap',
        description: 'Swap inteligente BEZ↔FIAT con cálculo de fees y fee burning.',
        actions: ['BEZ_TO_FIAT', 'FIAT_TO_BEZ'],
    },
    {
        id: 'verify_regulatory_compliance',
        name: 'Compliance MCP',
        category: 'Compliance',
        icon: Shield,
        color: 'green',
        endpoint: '/api/mcp/verify-compliance',
        description: 'Verificación AML/KYC, scoring de riesgo y bloqueo de regiones sancionadas.',
        actions: ['transfer', 'swap', 'marketplace', 'staking'],
    },
    {
        id: 'github_repo_manager',
        name: 'GitHub MCP',
        category: 'DevOps',
        icon: GitBranch,
        color: 'purple',
        endpoint: '/api/mcp/github',
        description: 'Gestión de repos GitHub, auto-documentación, PRs y análisis de salud.',
        actions: ['analyze_repo', 'generate_docs', 'create_pr', 'check_health', 'list_issues'],
    },
    {
        id: 'firecrawl_scraper',
        name: 'Firecrawl MCP',
        category: 'Intelligence',
        icon: Globe,
        color: 'yellow',
        endpoint: '/api/mcp/firecrawl',
        description: 'Web scraping, descubrimiento de productos y monitoreo de proyectos Web3.',
        actions: ['scrape_page', 'extract_products', 'monitor_competitors', 'discover_web3_projects'],
    },
    {
        id: 'playwright_automation',
        name: 'Playwright MCP',
        category: 'Testing',
        icon: Bug,
        color: 'red',
        endpoint: '/api/mcp/playwright',
        description: 'Automatización de browser, testing UI, auditorías de rendimiento y accesibilidad.',
        actions: ['test_page_load', 'test_wallet_flow', 'audit_performance', 'audit_accessibility'],
    },
    {
        id: 'blockscout_explorer',
        name: 'Blockscout MCP',
        category: 'Blockchain',
        icon: Eye,
        color: 'blue',
        endpoint: '/api/mcp/blockscout',
        description: 'Explorador on-chain del token $BEZ: holders, transacciones, supply metrics.',
        actions: ['token_info', 'holder_analysis', 'transaction_history', 'supply_metrics'],
    },
    {
        id: 'skill_creator_ai',
        name: 'Skill Creator AI',
        category: 'AI',
        icon: Layers,
        color: 'purple',
        endpoint: '/api/mcp/skill-creator',
        description: 'Generador de skills y pipelines multi-paso (Web3 + AI + IoT).',
        actions: ['create_skill', 'compose_pipeline', 'list_templates', 'validate_skill'],
    },
    {
        id: 'auditmos_security',
        name: 'Auditmos Security',
        category: 'Security',
        icon: Lock,
        color: 'red',
        endpoint: '/api/mcp/auditmos',
        description: 'Auditoría de seguridad de smart contracts y detección de vulnerabilidades.',
        actions: ['audit_contract', 'check_vulnerabilities', 'gas_optimization', 'best_practices'],
    },
    {
        id: 'tally_dao_governance',
        name: 'Tally DAO MCP',
        category: 'Governance',
        icon: Vote,
        color: 'green',
        endpoint: '/api/mcp/tally-dao',
        description: 'Gobernanza DAO: propuestas, votaciones, delegación y tesorería.',
        actions: ['list_proposals', 'analyze_voting_power', 'check_quorum', 'treasury_status'],
    },
    {
        id: 'obliq_ai_sre',
        name: 'Obliq AI SRE',
        category: 'SRE',
        icon: Server,
        color: 'yellow',
        endpoint: '/api/mcp/obliq-sre',
        description: 'SRE con IA: monitoreo de servicios, incidentes, métricas y análisis de logs.',
        actions: ['health_check', 'check_alerts', 'performance_metrics', 'analyze_logs'],
    },
    {
        id: 'kinaxis_supply_chain',
        name: 'Kinaxis IoT MCP',
        category: 'IoT',
        icon: Truck,
        color: 'blue',
        endpoint: '/api/mcp/kinaxis',
        description: 'Cadena de suministro y telemetría IoT para dispositivos ToolBEZ/Begaz.',
        actions: ['ingest_telemetry', 'fleet_overview', 'sensor_analysis', 'supply_forecast'],
    },
    {
        id: 'alpaca_markets',
        name: 'Alpaca Markets MCP',
        category: 'Trading',
        icon: LineChart,
        color: 'green',
        endpoint: '/api/mcp/alpaca-markets',
        description: 'Trading y tesorería: precio BEZ, portafolio, DCA y sentimiento de mercado.',
        actions: ['market_overview', 'price_analysis', 'treasury_portfolio', 'sentiment_analysis'],
    },
];

const McpDashboardTab = () => {
    const [toolStatuses, setToolStatuses] = useState({});
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    const checkAllTools = async () => {
        setIsChecking(true);
        const statuses = {};
        const MCP_BASE = import.meta.env.VITE_MCP_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080';

        await Promise.all(
            MCP_TOOLS_MASTER.map(async (tool) => {
                try {
                    const start = Date.now();
                    const res = await fetch(`${MCP_BASE}${tool.endpoint}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: tool.actions[0], check: true }),
                        signal: AbortSignal.timeout(8000),
                    });
                    statuses[tool.id] = {
                        status: res.ok ? 'online' : 'degraded',
                        latencyMs: Date.now() - start,
                        httpCode: res.status,
                    };
                } catch {
                    statuses[tool.id] = { status: 'offline', latencyMs: -1, httpCode: 0 };
                }
            })
        );

        setToolStatuses(statuses);
        setLastCheck(new Date().toISOString());
        setIsChecking(false);
    };

    const getStatusBadge = (toolId) => {
        const s = toolStatuses[toolId];
        if (!s) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-600/30 text-gray-400">Sin verificar</span>;
        if (s.status === 'online') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">● Online ({s.latencyMs}ms)</span>;
        if (s.status === 'degraded') return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">● Degraded ({s.httpCode})</span>;
        return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">● Offline</span>;
    };

    const colorClasses = {
        purple: 'from-purple-600/20 to-purple-800/10 border-purple-700/50 text-purple-400',
        blue: 'from-blue-600/20 to-blue-800/10 border-blue-700/50 text-blue-400',
        green: 'from-green-600/20 to-green-800/10 border-green-700/50 text-green-400',
        yellow: 'from-yellow-600/20 to-yellow-800/10 border-yellow-700/50 text-yellow-400',
        red: 'from-red-600/20 to-red-800/10 border-red-700/50 text-red-400',
    };

    const onlineCount = Object.values(toolStatuses).filter(s => s.status === 'online').length;
    const totalChecked = Object.keys(toolStatuses).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                            <Plug size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">BEZHAS-MCP Intelligence Suite</h2>
                            <p className="text-sm text-gray-400">
                                {MCP_TOOLS_MASTER.length} herramientas MCP registradas
                                {totalChecked > 0 && ` • ${onlineCount}/${totalChecked} online`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {lastCheck && (
                            <span className="text-xs text-gray-500">
                                Último check: {new Date(lastCheck).toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={checkAllTools}
                            disabled={isChecking}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                            {isChecking ? 'Verificando...' : 'Health Check'}
                        </button>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-purple-400">{MCP_TOOLS_MASTER.length}</p>
                        <p className="text-xs text-gray-400">Total Tools</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-green-400">{onlineCount}</p>
                        <p className="text-xs text-gray-400">Online</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-blue-400">{[...new Set(MCP_TOOLS_MASTER.map(t => t.category))].length}</p>
                        <p className="text-xs text-gray-400">Categorías</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-yellow-400">{MCP_TOOLS_MASTER.reduce((sum, t) => sum + t.actions.length, 0)}</p>
                        <p className="text-xs text-gray-400">Acciones</p>
                    </div>
                </div>
            </div>

            {/* Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {MCP_TOOLS_MASTER.map((tool) => {
                    const Icon = tool.icon;
                    const cls = colorClasses[tool.color] || colorClasses.purple;
                    return (
                        <div
                            key={tool.id}
                            className={`bg-gradient-to-br ${cls.split(' ').slice(0, 2).join(' ')} border ${cls.split(' ')[2]} rounded-xl p-5 hover:scale-[1.01] transition-all`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-gray-800/60`}>
                                        <Icon className={cls.split(' ').pop()} size={22} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white text-sm">{tool.name}</h3>
                                        <span className="text-xs text-gray-400 bg-gray-800/40 px-2 py-0.5 rounded-full">{tool.category}</span>
                                    </div>
                                </div>
                                {getStatusBadge(tool.id)}
                            </div>

                            <p className="text-sm text-gray-300 mb-3 line-clamp-2">{tool.description}</p>

                            <div className="border-t border-gray-700/50 pt-3">
                                <p className="text-xs text-gray-500 mb-1">Acciones disponibles:</p>
                                <div className="flex flex-wrap gap-1">
                                    {tool.actions.slice(0, 4).map((a) => (
                                        <span key={a} className="text-[10px] bg-gray-800/60 text-gray-400 px-1.5 py-0.5 rounded">
                                            {a}
                                        </span>
                                    ))}
                                    {tool.actions.length > 4 && (
                                        <span className="text-[10px] text-gray-500">+{tool.actions.length - 4} más</span>
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-gray-700/50">
                                <code className="text-[10px] text-gray-500 font-mono">POST {tool.endpoint}</code>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Integration Note */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Info className="text-purple-400 mt-0.5 flex-shrink-0" size={18} />
                    <div>
                        <p className="text-sm text-purple-300 font-medium">BEZHAS-MCP actúa a través del BeZhas SDK</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Los desarrolladores pueden acceder a todas las herramientas MCP a través del BeZhas SDK.
                            Descarga el SDK e instalador MCP desde la <strong>Developer Console</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function AdminAI() {
    const [activeTab, setActiveTab] = useState('overview');
    const [agents, setAgents] = useState([]);
    const [models, setModels] = useState([]);
    const [tools, setTools] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [aiStats, setAiStats] = useState({
        totalAgents: 0,
        activeModels: 0,
        toolsAvailable: 0,
        conversationsToday: 0,
        tokensUsed: 0,
        healthScore: 0
    });

    // Estados para formularios
    const [showAgentForm, setShowAgentForm] = useState(false);
    const [editingAgent, setEditingAgent] = useState(null);

    // Ref para evitar doble ejecucion en StrictMode
    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;
        loadInitialData();
    }, []);

    useEffect(() => {
        if (activeTab === 'agents') loadAgents();
        if (activeTab === 'models') loadModels();
        if (activeTab === 'tools') loadTools();
    }, [activeTab]);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const [agentsRes, modelsRes, toolsRes, statsRes] = await Promise.all([
                aiApi.getAgents(),
                aiApi.getModels(),
                aiApi.getTools(),
                aiApi.getChatStats()
            ]);

            const agentsData = agentsRes.data || [];
            const modelsData = modelsRes.data || [];
            const toolsData = toolsRes.data || { tools: [] };
            const statsData = statsRes.data || mockData.aiChatStats;

            setAgents(Array.isArray(agentsData) ? agentsData : []);
            setModels(Array.isArray(modelsData) ? modelsData : []);
            setTools(toolsData.tools || []);

            setAiStats({
                totalAgents: Array.isArray(agentsData) ? agentsData.length : 3,
                activeModels: Array.isArray(modelsData) ? modelsData.length : 5,
                toolsAvailable: toolsData.tools?.length || 8,
                conversationsToday: statsData?.conversationsToday || 127,
                tokensUsed: statsData?.tokensUsed || 45890,
                healthScore: statsData?.healthScore || 92
            });
        } catch (error) {
            // Silenciado - usar datos mock
            setAiStats({
                totalAgents: 3,
                activeModels: 5,
                toolsAvailable: 8,
                conversationsToday: 127,
                tokensUsed: 45890,
                healthScore: 92
            });
        } finally {
            setIsLoading(false);
        }
    };

    const loadAgents = async () => {
        try {
            const res = await aiApi.getAgents();
            setAgents(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            // Silenciado
        }
    };

    const loadModels = async () => {
        try {
            const res = await aiApi.getModels();
            setModels(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            // Silenciado
        }
    };

    const loadTools = async () => {
        try {
            const res = await aiApi.getTools();
            setTools(res.data?.tools || []);
        } catch (error) {
            // Silenciado
        }
    };

    const deleteAgent = async (id) => {
        if (!confirm('¿Eliminar este agente?')) return;
        try {
            await fetch(`${API_URL}/api/ai/agents/${id}`, { method: 'DELETE' });
            loadAgents();
        } catch (error) {
            console.error('Error deleting agent:', error);
        }
    };

    const tabs = [
        { id: 'overview', name: 'Vista General', icon: Brain, description: 'Resumen del sistema de IA' },
        { id: 'mcp-dashboard', name: 'MCP Dashboard', icon: Plug, description: 'Estado de todos los MCP Tools' },
        { id: 'diagnostic', name: 'Diagnóstico', icon: Activity, description: 'Estado del sistema' },
        { id: 'chat-config', name: 'Chat & Config', icon: MessageSquare, description: 'Configuración de chat' },
        { id: 'features', name: 'Funcionalidades', icon: Sparkles, description: 'Hub de IA' },
        { id: 'agents', name: 'Agentes', icon: Bot, description: 'Gestionar agentes' },
        { id: 'models', name: 'Modelos', icon: Cpu, description: 'Modelos disponibles' },
        { id: 'tools', name: 'Herramientas', icon: Settings, description: 'Tools de IA' },
        { id: 'analytics', name: 'Analytics', icon: BarChart3, description: 'Métricas de uso' }
    ];

    // Help content for each section
    const helpContent = {
        overview: (
            <div className="space-y-3">
                <p><strong>Vista General</strong> muestra el estado completo del sistema de Inteligencia Artificial de BeZhas.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Agentes:</strong> Número de asistentes IA configurados</li>
                    <li><strong>Modelos:</strong> Modelos de lenguaje disponibles (GPT-4, Claude, etc.)</li>
                    <li><strong>Herramientas:</strong> Funciones que pueden usar los agentes</li>
                    <li><strong>Conversaciones:</strong> Interacciones de usuarios con la IA</li>
                </ul>
                <p className="text-purple-400">💡 Tip: Revisa el diagnóstico regularmente para mantener el sistema optimizado.</p>
            </div>
        ),
        diagnostic: (
            <div className="space-y-3">
                <p><strong>Diagnóstico IA</strong> monitorea la salud del sistema en tiempo real.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Health Score:</strong> Puntuación general de salud (0-100)</li>
                    <li><strong>Logs:</strong> Registro de eventos y errores del sistema</li>
                    <li><strong>Mantenimiento:</strong> Reportes automáticos de optimización</li>
                </ul>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
                    <p className="flex items-center gap-2 text-yellow-400">
                        <AlertTriangle size={16} />
                        El mantenimiento automático se ejecuta a las 3:00 AM diariamente.
                    </p>
                </div>
            </div>
        ),
        chatConfig: (
            <div className="space-y-3">
                <p><strong>Chat & Configuración</strong> permite gestionar los agentes de chat y sus parámetros.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Agentes:</strong> Crear, editar y configurar asistentes virtuales</li>
                    <li><strong>Modelos:</strong> Asignar modelos de IA a cada agente</li>
                    <li><strong>Temperature:</strong> Controlar la creatividad de respuestas (0-1)</li>
                    <li><strong>Max Tokens:</strong> Límite de longitud de respuestas</li>
                </ul>
                <p className="text-purple-400">💡 Tip: Temperature alta = respuestas más creativas. Baja = más precisas.</p>
            </div>
        ),
        features: (
            <div className="space-y-3">
                <p><strong>Hub de Funcionalidades IA</strong> agrupa todas las capacidades avanzadas.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Análisis de Sentimiento:</strong> Detecta emociones en textos</li>
                    <li><strong>Clasificación:</strong> Categoriza contenido automáticamente</li>
                    <li><strong>Recomendaciones:</strong> Sistema de sugerencias personalizadas</li>
                    <li><strong>Content Intelligence:</strong> Análisis profundo de contenido</li>
                    <li><strong>A/B Testing:</strong> Experimentos con variantes de IA</li>
                </ul>
            </div>
        ),
        agents: (
            <div className="space-y-3">
                <p><strong>Gestión de Agentes</strong> permite configurar asistentes virtuales.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Nombre:</strong> Identificador del agente</li>
                    <li><strong>Visibilidad:</strong> public (todos), vip (premium), private (admin)</li>
                    <li><strong>Personalidad:</strong> Define el tono y estilo de respuestas</li>
                    <li><strong>Functions:</strong> Herramientas que puede usar el agente</li>
                </ul>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mt-3">
                    <p className="flex items-center gap-2 text-green-400">
                        <CheckCircle size={16} />
                        Los agentes VIP tienen acceso a modelos más potentes.
                    </p>
                </div>
            </div>
        ),
        models: (
            <div className="space-y-3">
                <p><strong>Modelos de IA</strong> son los motores de procesamiento de lenguaje.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>GPT-4:</strong> Modelo avanzado de OpenAI</li>
                    <li><strong>Claude:</strong> IA de Anthropic</li>
                    <li><strong>Gemini:</strong> Modelo de Google</li>
                    <li><strong>Context Window:</strong> Cantidad de texto que puede procesar</li>
                    <li><strong>Costo:</strong> Precio por cada 1000 tokens</li>
                </ul>
            </div>
        ),
        tools: (
            <div className="space-y-3">
                <p><strong>Herramientas (Tools)</strong> son funciones que los agentes pueden ejecutar.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Function Calling:</strong> Permite a la IA ejecutar código</li>
                    <li><strong>Web Search:</strong> Búsqueda en internet</li>
                    <li><strong>Database Query:</strong> Consultar datos del sistema</li>
                    <li><strong>Blockchain:</strong> Interacción con smart contracts</li>
                </ul>
                <p className="text-purple-400">💡 Tip: Asigna solo las herramientas necesarias a cada agente por seguridad.</p>
            </div>
        ),
        analytics: (
            <div className="space-y-3">
                <p><strong>Analytics</strong> muestra métricas de uso del sistema de IA.</p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong>Conversaciones:</strong> Total de chats iniciados</li>
                    <li><strong>Tokens:</strong> Consumo de recursos de IA</li>
                    <li><strong>Costos:</strong> Gastos en APIs de IA</li>
                    <li><strong>Rendimiento:</strong> Tiempo de respuesta promedio</li>
                </ul>
            </div>
        )
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
            {/* Header */}
            <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
                                <Brain size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Centro de IA</h1>
                                <p className="text-gray-400">Gestión completa del sistema de Inteligencia Artificial</p>
                            </div>
                        </div>
                        <button
                            onClick={loadInitialData}
                            disabled={isLoading}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="bg-gray-900/50 border-b border-gray-800 px-6 overflow-x-auto">
                <div className="max-w-7xl mx-auto">
                    <div className="flex gap-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-3 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap border-b-2 ${activeTab === tab.id
                                        ? 'text-purple-400 border-purple-500 bg-purple-500/10'
                                        : 'text-gray-400 hover:text-white border-transparent hover:bg-gray-800/50'
                                        }`}
                                    title={tab.description}
                                >
                                    <Icon size={18} />
                                    {tab.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 max-w-7xl mx-auto">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        <SectionCard
                            icon={Brain}
                            title="Resumen del Sistema de IA"
                            description="Estado general y métricas principales"
                            helpTitle="¿Cómo usar esta sección?"
                            helpContent={helpContent.overview}
                        >
                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <QuickStatCard
                                    icon={Bot}
                                    label="Agentes"
                                    value={aiStats.totalAgents}
                                    color="purple"
                                />
                                <QuickStatCard
                                    icon={Cpu}
                                    label="Modelos"
                                    value={aiStats.activeModels}
                                    color="blue"
                                />
                                <QuickStatCard
                                    icon={Settings}
                                    label="Herramientas"
                                    value={aiStats.toolsAvailable}
                                    color="green"
                                />
                                <QuickStatCard
                                    icon={MessageSquare}
                                    label="Conversaciones"
                                    value={aiStats.conversationsToday}
                                    color="yellow"
                                    trend={12}
                                />
                                <QuickStatCard
                                    icon={Zap}
                                    label="Tokens (K)"
                                    value={Math.round(aiStats.tokensUsed / 1000)}
                                    color="purple"
                                />
                                <QuickStatCard
                                    icon={Activity}
                                    label="Health Score"
                                    value={`${aiStats.healthScore}%`}
                                    color={aiStats.healthScore >= 80 ? 'green' : aiStats.healthScore >= 50 ? 'yellow' : 'red'}
                                />
                            </div>

                            {/* Quick Actions */}
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button
                                    onClick={() => setActiveTab('diagnostic')}
                                    className="p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl transition-all group flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <Activity className="text-blue-400" size={24} />
                                        <div className="text-left">
                                            <p className="font-medium">Ver Diagnóstico</p>
                                            <p className="text-sm text-gray-400">Estado del sistema</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" />
                                </button>

                                <button
                                    onClick={() => setActiveTab('agents')}
                                    className="p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl transition-all group flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <Bot className="text-purple-400" size={24} />
                                        <div className="text-left">
                                            <p className="font-medium">Gestionar Agentes</p>
                                            <p className="text-sm text-gray-400">{aiStats.totalAgents} configurados</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" />
                                </button>

                                <button
                                    onClick={() => setActiveTab('features')}
                                    className="p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl transition-all group flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-3">
                                        <Sparkles className="text-yellow-400" size={24} />
                                        <div className="text-left">
                                            <p className="font-medium">Hub de IA</p>
                                            <p className="text-sm text-gray-400">Funcionalidades avanzadas</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" />
                                </button>
                            </div>
                        </SectionCard>
                    </div>
                )}

                {/* MCP DASHBOARD TAB */}
                {activeTab === 'mcp-dashboard' && (
                    <McpDashboardTab />
                )}

                {/* DIAGNOSTIC TAB */}
                {activeTab === 'diagnostic' && (
                    <SectionCard
                        icon={Activity}
                        title="Sistema de Diagnóstico IA"
                        description="Monitoreo en tiempo real y análisis con IA"
                        helpTitle="¿Cómo usar el Diagnóstico?"
                        helpContent={helpContent.diagnostic}
                        className="overflow-hidden"
                    >
                        <Suspense fallback={
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                                <span className="ml-3 text-gray-400">Cargando sistema de diagnóstico...</span>
                            </div>
                        }>
                            <div className="bg-gray-950 rounded-xl overflow-hidden -m-4">
                                <DiagnosticDashboard />
                            </div>
                        </Suspense>
                    </SectionCard>
                )}

                {/* CHAT CONFIG TAB */}
                {activeTab === 'chat-config' && (
                    <SectionCard
                        icon={MessageSquare}
                        title="Configuración de Chat & IA"
                        description="Gestiona agentes, modelos y parámetros"
                        helpTitle="¿Cómo configurar el Chat?"
                        helpContent={helpContent.chatConfig}
                        className="overflow-hidden"
                    >
                        <Suspense fallback={
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                                <span className="ml-3 text-gray-400">Cargando configuración...</span>
                            </div>
                        }>
                            <div className="-m-4">
                                <ChatAISettings />
                            </div>
                        </Suspense>
                    </SectionCard>
                )}

                {/* FEATURES TAB */}
                {activeTab === 'features' && (
                    <SectionCard
                        icon={Sparkles}
                        title="Hub de Funcionalidades IA"
                        description="Plataforma unificada de IA, ML y Analytics"
                        helpTitle="¿Qué son las Funcionalidades IA?"
                        helpContent={helpContent.features}
                        className="overflow-hidden"
                    >
                        <Suspense fallback={
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
                                <span className="ml-3 text-gray-400">Cargando hub de IA...</span>
                            </div>
                        }>
                            <div className="-m-4">
                                <AIFeaturesPanel />
                            </div>
                        </Suspense>
                    </SectionCard>
                )}

                {/* AGENTS TAB */}
                {activeTab === 'agents' && (
                    <SectionCard
                        icon={Bot}
                        title="Agentes de IA"
                        description={`${agents.length} agentes configurados`}
                        helpTitle="¿Cómo gestionar Agentes?"
                        helpContent={helpContent.agents}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-sm text-gray-400">
                                Los agentes son asistentes virtuales con personalidades únicas
                            </div>
                            <button
                                onClick={() => setShowAgentForm(true)}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Bot size={18} />
                                Crear Agente
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {agents.map((agent) => (
                                <div
                                    key={agent.id}
                                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-purple-500/50 transition-all"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl flex-shrink-0">
                                            {agent.avatar || '🤖'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-semibold truncate">{agent.name}</h3>
                                                <span
                                                    className={`text-xs px-2 py-0.5 rounded-full ${agent.visibility === 'public'
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : agent.visibility === 'vip'
                                                            ? 'bg-yellow-500/20 text-yellow-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                        }`}
                                                >
                                                    {agent.visibility}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                                {agent.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-gray-700">
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p>Model: {agent.model}</p>
                                            <p>Temperature: {agent.temperature}</p>
                                            <p>Functions: {agent.functions?.length || 0}</p>
                                        </div>

                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => {
                                                    setEditingAgent(agent);
                                                    setShowAgentForm(true);
                                                }}
                                                className="flex-1 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => deleteAgent(agent.id)}
                                                className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {agents.length === 0 && (
                                <div className="col-span-full text-center py-12">
                                    <Bot className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400">No hay agentes configurados</p>
                                    <button
                                        onClick={() => setShowAgentForm(true)}
                                        className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                                    >
                                        Crear primer agente
                                    </button>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* MODELS TAB */}
                {activeTab === 'models' && (
                    <SectionCard
                        icon={Cpu}
                        title="Modelos de IA"
                        description={`${models.length} modelos disponibles`}
                        helpTitle="¿Qué son los Modelos?"
                        helpContent={helpContent.models}
                    >
                        <div className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-800">
                                    <tr>
                                        <th className="text-left p-4 font-medium text-gray-300">Modelo</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Proveedor</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Context</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Max Tokens</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Costo (1K)</th>
                                        <th className="text-left p-4 font-medium text-gray-300">Capacidades</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {models.map((model) => (
                                        <tr
                                            key={model.id}
                                            className="border-t border-gray-700 hover:bg-gray-800/50 transition-colors"
                                        >
                                            <td className="p-4">
                                                <div>
                                                    <div className="font-medium text-white">{model.name}</div>
                                                    <div className="text-xs text-gray-500">{model.id}</div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-300">{model.provider}</td>
                                            <td className="p-4 text-sm text-gray-300">
                                                {model.contextWindow?.toLocaleString() || 'N/A'}
                                            </td>
                                            <td className="p-4 text-sm text-gray-300">
                                                {model.maxTokens?.toLocaleString() || 'N/A'}
                                            </td>
                                            <td className="p-4 text-sm">
                                                <div className="text-xs space-y-1">
                                                    <div className="text-green-400">
                                                        In: ${model.costPer1kInput?.toFixed(4) || '0.00'}
                                                    </div>
                                                    <div className="text-yellow-400">
                                                        Out: ${model.costPer1kOutput?.toFixed(4) || '0.00'}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-1 flex-wrap">
                                                    {model.supportsFunctions && (
                                                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                                                            Functions
                                                        </span>
                                                    )}
                                                    {model.supportsStreaming && (
                                                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                                            Stream
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {models.length === 0 && (
                                <div className="text-center py-12">
                                    <Cpu className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400">No hay modelos configurados</p>
                                    <p className="text-sm text-gray-500 mt-2">Los modelos se cargan desde el backend</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* TOOLS TAB */}
                {activeTab === 'tools' && (
                    <SectionCard
                        icon={Settings}
                        title="Herramientas de IA"
                        description={`${tools.length} herramientas disponibles`}
                        helpTitle="¿Qué son las Herramientas?"
                        helpContent={helpContent.tools}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tools.map((tool) => (
                                <div
                                    key={tool}
                                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-purple-500/50 transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-600/20 rounded-lg">
                                            <Settings className="text-purple-400" size={20} />
                                        </div>
                                        <h3 className="font-semibold">{tool}</h3>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-3">
                                        Function calling tool disponible para los agentes
                                    </p>
                                </div>
                            ))}

                            {tools.length === 0 && (
                                <div className="col-span-full text-center py-12">
                                    <Settings className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400">No hay herramientas configuradas</p>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <SectionCard
                        icon={BarChart3}
                        title="Analytics de IA"
                        description="Métricas de uso y rendimiento"
                        helpTitle="¿Cómo leer Analytics?"
                        helpContent={helpContent.analytics}
                    >
                        <div className="text-center py-12">
                            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center">
                                <BarChart3 className="w-10 h-10 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Analytics Dashboard</h3>
                            <p className="text-gray-400 mb-4">
                                Métricas avanzadas de uso, costos y rendimiento del sistema de IA
                            </p>
                            <p className="text-sm text-gray-500">
                                🚧 En desarrollo - Próximamente disponible
                            </p>

                            {/* Preview Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                                <div className="bg-gray-800/50 rounded-xl p-4">
                                    <p className="text-3xl font-bold text-purple-400">{aiStats.conversationsToday}</p>
                                    <p className="text-sm text-gray-400">Conversaciones hoy</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-xl p-4">
                                    <p className="text-3xl font-bold text-blue-400">{Math.round(aiStats.tokensUsed / 1000)}K</p>
                                    <p className="text-sm text-gray-400">Tokens usados</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-xl p-4">
                                    <p className="text-3xl font-bold text-green-400">~$0.00</p>
                                    <p className="text-sm text-gray-400">Costo estimado</p>
                                </div>
                                <div className="bg-gray-800/50 rounded-xl p-4">
                                    <p className="text-3xl font-bold text-yellow-400">~250ms</p>
                                    <p className="text-sm text-gray-400">Latencia promedio</p>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                )}
            </div>
        </div>
    );
}
