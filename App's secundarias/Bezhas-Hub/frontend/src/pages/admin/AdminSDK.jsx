import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import http from '../../services/http';
import {
    Blocks,
    Brain,
    Settings,
    Shield,
    Webhook,
    ToggleLeft,
    ToggleRight,
    Plus,
    Trash2,
    Edit3,
    RefreshCw,
    CheckCircle,
    XCircle,
    Activity,
    Zap,
    Code,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Server,
    Layers,
    Crown,
    Globe
} from 'lucide-react';

const TABS = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'modules', label: 'Módulos', icon: Blocks },
    { id: 'ai-models', label: 'AI Models', icon: Brain },
    { id: 'tiers', label: 'Access Tiers', icon: Crown },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'settings', label: 'Settings', icon: Settings },
];

const AdminSDK = () => {
    const { address } = useAccount();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    // Data states
    const [overview, setOverview] = useState(null);
    const [modules, setModules] = useState([]);
    const [aiModels, setAIModels] = useState([]);
    const [tiers, setTiers] = useState([]);
    const [webhooks, setWebhooks] = useState([]);
    const [fullConfig, setFullConfig] = useState(null);

    // MCP health
    const [mcpHealth, setMCPHealth] = useState(null);
    const [checkingMCP, setCheckingMCP] = useState(false);

    const adminHeaders = useCallback(() => ({
        headers: address ? { 'x-wallet-address': address } : {}
    }), [address]);

    // ── Data Fetching ──

    const fetchOverview = useCallback(async () => {
        try {
            const res = await http.get('/api/admin/sdk/overview', adminHeaders());
            setOverview(res.data?.data);
        } catch (err) {
            console.error('Error fetching SDK overview:', err);
        }
    }, [adminHeaders]);

    const fetchModules = useCallback(async () => {
        try {
            const res = await http.get('/api/admin/sdk/modules', adminHeaders());
            setModules(res.data?.data || []);
        } catch (err) {
            console.error('Error fetching modules:', err);
        }
    }, [adminHeaders]);

    const fetchAIModels = useCallback(async () => {
        try {
            const res = await http.get('/api/admin/sdk/ai-models', adminHeaders());
            setAIModels(res.data?.data || []);
        } catch (err) {
            console.error('Error fetching AI models:', err);
        }
    }, [adminHeaders]);

    const fetchTiers = useCallback(async () => {
        try {
            const res = await http.get('/api/admin/sdk/tiers', adminHeaders());
            setTiers(res.data?.data || []);
        } catch (err) {
            console.error('Error fetching tiers:', err);
        }
    }, [adminHeaders]);

    const fetchWebhooks = useCallback(async () => {
        try {
            const res = await http.get('/api/admin/sdk/webhooks', adminHeaders());
            setWebhooks(res.data?.data || []);
        } catch (err) {
            console.error('Error fetching webhooks:', err);
        }
    }, [adminHeaders]);

    const fetchFullConfig = useCallback(async () => {
        try {
            const res = await http.get('/api/admin/sdk/config', adminHeaders());
            setFullConfig(res.data?.data);
        } catch (err) {
            console.error('Error fetching full config:', err);
        }
    }, [adminHeaders]);

    // Initial load
    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            await Promise.all([fetchOverview(), fetchModules(), fetchAIModels(), fetchTiers(), fetchWebhooks()]);
            setLoading(false);
        };
        loadAll();
    }, [fetchOverview, fetchModules, fetchAIModels, fetchTiers, fetchWebhooks]);

    // ── Actions ──

    const toggleModule = async (moduleId, enabled) => {
        setSaving(true);
        try {
            await http.patch(`/api/admin/sdk/modules/${moduleId}/toggle`, { enabled }, adminHeaders());
            await fetchModules();
            await fetchOverview();
        } catch (err) {
            setError(`Error toggling module: ${err.message}`);
        }
        setSaving(false);
    };

    const toggleAIModel = async (modelId, active) => {
        setSaving(true);
        try {
            await http.patch(`/api/admin/sdk/ai-models/${modelId}/toggle`, { active }, adminHeaders());
            await fetchAIModels();
            await fetchOverview();
        } catch (err) {
            setError(`Error toggling AI model: ${err.message}`);
        }
        setSaving(false);
    };

    const deleteAIModel = async (modelId) => {
        if (!window.confirm('¿Eliminar este modelo AI?')) return;
        setSaving(true);
        try {
            await http.delete(`/api/admin/sdk/ai-models/${modelId}`, adminHeaders());
            await fetchAIModels();
            await fetchOverview();
        } catch (err) {
            setError(`Error deleting AI model: ${err.message}`);
        }
        setSaving(false);
    };

    const deleteWebhook = async (webhookId) => {
        if (!window.confirm('¿Eliminar este webhook?')) return;
        setSaving(true);
        try {
            await http.delete(`/api/admin/sdk/webhooks/${webhookId}`, adminHeaders());
            await fetchWebhooks();
        } catch (err) {
            setError(`Error deleting webhook: ${err.message}`);
        }
        setSaving(false);
    };

    const testWebhook = async (webhookId) => {
        setSaving(true);
        try {
            const res = await http.post(`/api/admin/sdk/webhooks/${webhookId}/test`, {}, adminHeaders());
            const result = res.data?.data;
            alert(result?.success ? `✅ Webhook OK (${result.status})` : `❌ Webhook failed: ${result.error || result.statusText}`);
        } catch (err) {
            alert(`❌ Error: ${err.message}`);
        }
        setSaving(false);
    };

    const checkMCP = async () => {
        setCheckingMCP(true);
        try {
            const res = await http.get('/api/admin/sdk/mcp/health', adminHeaders());
            setMCPHealth(res.data?.data);
        } catch (err) {
            setMCPHealth({ connected: false, error: err.message });
        }
        setCheckingMCP(false);
    };

    const updateGlobalSettings = async (updates) => {
        setSaving(true);
        try {
            await http.patch('/api/admin/sdk/config', updates, adminHeaders());
            await fetchOverview();
            await fetchFullConfig();
        } catch (err) {
            setError(`Error updating settings: ${err.message}`);
        }
        setSaving(false);
    };

    // ── Renders ──

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
                <span className="ml-3 text-gray-400">Cargando SDK Admin...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Blocks className="w-7 h-7 text-purple-400" />
                        SDK & AI Management
                    </h1>
                    <p className="text-gray-400 mt-1">
                        Control centralizado de módulos SDK, modelos AI, tiers de acceso y webhooks
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {overview && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${overview.isGloballyEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {overview.isGloballyEnabled ? '● Activo' : '● Inactivo'}
                        </span>
                    )}
                    <span className="text-xs text-gray-500">v{overview?.sdkVersion || '1.0.0'}</span>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="text-red-300 text-sm">{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">&times;</button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'overview' && <OverviewTab overview={overview} mcpHealth={mcpHealth} checkingMCP={checkingMCP} checkMCP={checkMCP} />}
                {activeTab === 'modules' && <ModulesTab modules={modules} toggleModule={toggleModule} saving={saving} />}
                {activeTab === 'ai-models' && <AIModelsTab models={aiModels} toggleModel={toggleAIModel} deleteModel={deleteAIModel} saving={saving} />}
                {activeTab === 'tiers' && <TiersTab tiers={tiers} />}
                {activeTab === 'webhooks' && <WebhooksTab webhooks={webhooks} deleteWebhook={deleteWebhook} testWebhook={testWebhook} saving={saving} />}
                {activeTab === 'settings' && <SettingsTab overview={overview} fullConfig={fullConfig} fetchFullConfig={fetchFullConfig} updateSettings={updateGlobalSettings} saving={saving} />}
            </div>
        </div>
    );
};

// ── Overview Tab ──
const OverviewTab = ({ overview, mcpHealth, checkingMCP, checkMCP }) => {
    if (!overview) return <p className="text-gray-500">No data</p>;

    const stats = [
        { label: 'Módulos', value: `${overview.enabledModules}/${overview.totalModules}`, icon: Blocks, color: 'text-blue-400' },
        { label: 'AI Models', value: `${overview.activeAIModels}/${overview.totalAIModels}`, icon: Brain, color: 'text-purple-400' },
        { label: 'Tiers', value: overview.totalTiers, icon: Crown, color: 'text-yellow-400' },
        { label: 'Webhooks', value: `${overview.activeWebhooks}/${overview.totalWebhooks}`, icon: Webhook, color: 'text-green-400' },
    ];

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map(stat => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon className={`w-5 h-5 ${stat.color}`} />
                                <span className="text-gray-400 text-sm">{stat.label}</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                        </div>
                    );
                })}
            </div>

            {/* MCP Server Status */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Server className="w-5 h-5 text-cyan-400" />
                        MCP Intelligence Server
                    </h3>
                    <button
                        onClick={checkMCP}
                        disabled={checkingMCP}
                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-colors text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${checkingMCP ? 'animate-spin' : ''}`} />
                        Check Health
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                        <span className="text-gray-500">URL:</span>
                        <p className="text-gray-300 truncate">{overview.mcpServer?.url || 'Not configured'}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Status:</span>
                        <p className={mcpHealth?.connected ? 'text-green-400' : 'text-yellow-400'}>
                            {mcpHealth ? (mcpHealth.connected ? '● Connected' : '● Disconnected') : '○ Unknown'}
                        </p>
                    </div>
                    <div>
                        <span className="text-gray-500">Version:</span>
                        <p className="text-gray-300">{mcpHealth?.version || overview.mcpServer?.version || '-'}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Last Check:</span>
                        <p className="text-gray-300">
                            {overview.mcpServer?.lastHealthCheck
                                ? new Date(overview.mcpServer.lastHealthCheck).toLocaleString()
                                : 'Never'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                        <Shield className="w-5 h-5 text-orange-400" />
                        Security
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">API Key Required</span>
                            <span className={overview.security?.requireApiKey ? 'text-green-400' : 'text-red-400'}>
                                {overview.security?.requireApiKey ? 'Yes' : 'No'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Allowed Origins</span>
                            <span className="text-gray-300">{overview.security?.originsCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Max Keys/User</span>
                            <span className="text-gray-300">{overview.security?.maxApiKeysPerUser || 5}</span>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
                        <Activity className="w-5 h-5 text-pink-400" />
                        Rate Limits (Global)
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Requests/min</span>
                            <span className="text-gray-300">{overview.globalRateLimit?.requestsPerMinute?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Requests/day</span>
                            <span className="text-gray-300">{overview.globalRateLimit?.requestsPerDay?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Burst Limit</span>
                            <span className="text-gray-300">{overview.globalRateLimit?.burstLimit}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Modules Tab ──
const ModulesTab = ({ modules, toggleModule, saving }) => (
    <div className="space-y-3">
        {modules.map(mod => (
            <div key={mod.moduleId} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-3 h-3 rounded-full ${mod.isEnabled ? 'bg-green-400' : 'bg-gray-600'}`} />
                    <div className="min-w-0">
                        <h4 className="text-white font-medium">{mod.displayName}</h4>
                        <p className="text-gray-500 text-sm truncate">{mod.description}</p>
                        <div className="flex gap-3 mt-1 text-xs">
                            <span className="text-gray-500">Endpoint: <code className="text-cyan-400">{mod.endpoint}</code></span>
                            <span className="text-gray-500">Tier: <span className="text-yellow-400">{mod.requiredTier}</span></span>
                            <span className="text-gray-500">v{mod.version || '1.0.0'}</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => toggleModule(mod.moduleId, !mod.isEnabled)}
                    disabled={saving}
                    className="ml-4 flex-shrink-0"
                    title={mod.isEnabled ? 'Desactivar módulo' : 'Activar módulo'}
                >
                    {mod.isEnabled
                        ? <ToggleRight className="w-8 h-8 text-green-400 hover:text-green-300" />
                        : <ToggleLeft className="w-8 h-8 text-gray-600 hover:text-gray-400" />
                    }
                </button>
            </div>
        ))}
        {modules.length === 0 && (
            <div className="text-center text-gray-500 py-12">No hay módulos configurados</div>
        )}
    </div>
);

// ── AI Models Tab ──
const AIModelsTab = ({ models, toggleModel, deleteModel, saving }) => {
    const providerColors = {
        openai: 'text-green-400 bg-green-500/10',
        gemini: 'text-blue-400 bg-blue-500/10',
        deepseek: 'text-cyan-400 bg-cyan-500/10',
        anthropic: 'text-orange-400 bg-orange-500/10',
        local: 'text-gray-400 bg-gray-500/10',
        aegis: 'text-purple-400 bg-purple-500/10'
    };

    return (
        <div className="space-y-3">
            {models.map(model => (
                <div key={model._id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${providerColors[model.provider] || 'text-gray-400 bg-gray-500/10'}`}>
                                {model.provider?.toUpperCase()}
                            </span>
                            <div>
                                <h4 className="text-white font-medium">{model.model}</h4>
                                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                    <span>Temp: {model.temperature}</span>
                                    <span>Max Tokens: {model.maxTokens?.toLocaleString()}</span>
                                    <span>Rate: {model.rateLimitPerMinute}/min</span>
                                    {model.costPerTokenInput > 0 && (
                                        <span>Cost: ${model.costPerTokenInput}/1K in</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => toggleModel(model._id, !model.isActive)}
                                disabled={saving}
                                title={model.isActive ? 'Desactivar' : 'Activar'}
                            >
                                {model.isActive
                                    ? <ToggleRight className="w-7 h-7 text-green-400 hover:text-green-300" />
                                    : <ToggleLeft className="w-7 h-7 text-gray-600 hover:text-gray-400" />
                                }
                            </button>
                            <button
                                onClick={() => deleteModel(model._id)}
                                disabled={saving}
                                className="p-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Eliminar modelo"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
            {models.length === 0 && (
                <div className="text-center text-gray-500 py-12">No hay modelos AI configurados</div>
            )}
        </div>
    );
};

// ── Tiers Tab ──
const TiersTab = ({ tiers }) => {
    const tierColors = {
        free: 'border-gray-600',
        basic: 'border-blue-600',
        pro: 'border-purple-600',
        enterprise: 'border-yellow-600',
        internal: 'border-pink-600'
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiers.map(tier => (
                <div key={tier.name} className={`bg-gray-800/60 border-2 ${tierColors[tier.name] || 'border-gray-700'} rounded-xl p-5`}>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-semibold text-lg">{tier.displayName}</h4>
                        <div className="text-right">
                            {tier.priceMonthlyUSD > 0 ? (
                                <>
                                    <p className="text-white font-bold">${tier.priceMonthlyUSD}/mo</p>
                                    <p className="text-xs text-yellow-400">{tier.priceBEZ} BEZ</p>
                                </>
                            ) : (
                                <p className="text-green-400 font-bold">Gratis</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Requests/day</span>
                            <span className="text-white">{tier.requestsPerDay?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Requests/min</span>
                            <span className="text-white">{tier.requestsPerMinute}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Max Tokens/req</span>
                            <span className="text-white">{tier.maxTokensPerRequest?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Modules</span>
                            <span className="text-white">{tier.allowedModules?.length || 0}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-700 flex flex-wrap gap-2">
                            {Object.entries(tier.features || {}).map(([feat, enabled]) => (
                                <span key={feat} className={`px-2 py-0.5 rounded text-xs ${enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                                    {feat}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Webhooks Tab ──
const WebhooksTab = ({ webhooks, deleteWebhook, testWebhook, saving }) => (
    <div className="space-y-3">
        {webhooks.map(wh => (
            <div key={wh._id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${wh.isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                            <h4 className="text-white font-medium">{wh.name}</h4>
                        </div>
                        <p className="text-gray-500 text-sm truncate mt-1">{wh.url}</p>
                        <div className="flex gap-2 mt-2">
                            {(wh.events || []).map(ev => (
                                <span key={ev} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">{ev}</span>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <button
                            onClick={() => testWebhook(wh._id)}
                            disabled={saving}
                            className="px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 text-sm"
                        >
                            <Zap className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => deleteWebhook(wh._id)}
                            disabled={saving}
                            className="p-1.5 text-red-400/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        ))}
        {webhooks.length === 0 && (
            <div className="text-center text-gray-500 py-12">
                <Webhook className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay webhooks configurados</p>
                <p className="text-xs mt-1">Los webhooks se pueden agregar desde la API</p>
            </div>
        )}
    </div>
);

// ── Settings Tab ──
const SettingsTab = ({ overview, fullConfig, fetchFullConfig, updateSettings, saving }) => {
    useEffect(() => {
        if (!fullConfig) fetchFullConfig();
    }, [fullConfig, fetchFullConfig]);

    return (
        <div className="space-y-6">
            {/* Global Toggle */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Control Global</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">SDK Habilitado</p>
                            <p className="text-gray-500 text-sm">Activar/desactivar todo el SDK globalmente</p>
                        </div>
                        <button
                            onClick={() => updateSettings({ isGloballyEnabled: !overview?.isGloballyEnabled })}
                            disabled={saving}
                        >
                            {overview?.isGloballyEnabled
                                ? <ToggleRight className="w-10 h-10 text-green-400" />
                                : <ToggleLeft className="w-10 h-10 text-gray-600" />
                            }
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">Modo Mantenimiento</p>
                            <p className="text-gray-500 text-sm">Mostrar mensaje de mantenimiento a los developers</p>
                        </div>
                        <button
                            onClick={() => updateSettings({ maintenanceMode: !overview?.maintenanceMode })}
                            disabled={saving}
                        >
                            {overview?.maintenanceMode
                                ? <ToggleRight className="w-10 h-10 text-yellow-400" />
                                : <ToggleLeft className="w-10 h-10 text-gray-600" />
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Logging */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Logging</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500">Level</span>
                        <p className="text-white capitalize">{fullConfig?.logging?.level || overview?.logging?.level || 'info'}</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Retention</span>
                        <p className="text-white">{fullConfig?.logging?.retentionDays || 30} days</p>
                    </div>
                    <div>
                        <span className="text-gray-500">Request Logs</span>
                        <p className={fullConfig?.logging?.enableRequestLogs ? 'text-green-400' : 'text-red-400'}>
                            {fullConfig?.logging?.enableRequestLogs ? 'Enabled' : 'Disabled'}
                        </p>
                    </div>
                    <div>
                        <span className="text-gray-500">AI Logs</span>
                        <p className={fullConfig?.logging?.enableAILogs ? 'text-green-400' : 'text-red-400'}>
                            {fullConfig?.logging?.enableAILogs ? 'Enabled' : 'Disabled'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Developer Console Link */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
                <h3 className="text-lg font-semibold text-white mb-2">Developer Console</h3>
                <p className="text-gray-400 text-sm mb-4">
                    Los developers gestionan sus API keys, uso y documentación desde la Developer Console.
                </p>
                <a
                    href="/developer-console"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
                >
                    <Code className="w-4 h-4" />
                    Ir a Developer Console
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
};

export default AdminSDK;
