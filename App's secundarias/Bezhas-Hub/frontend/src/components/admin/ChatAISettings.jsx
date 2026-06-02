import React, { useState, useEffect } from 'react';
import {
    MessageSquare, Bot, Settings, Save, RefreshCw,
    Eye, EyeOff, CheckCircle, XCircle, AlertCircle,
    Zap, Shield, Sparkles, Brain, MessageCircleMore
} from 'lucide-react';
import axios from 'axios';
import http from '../../services/http';
import AgentCreatorAdvanced from './AgentCreatorAdvanced';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * ChatAISettings - Configuración unificada de Chat y ChatIA
 * Panel de administración para configurar agentes, modelos y parámetros de IA
 */
export default function ChatAISettings() {
    const [activeTab, setActiveTab] = useState('agents'); // agents, models, general
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Estado para agentes
    const [agents, setAgents] = useState([]);
    const [editingAgent, setEditingAgent] = useState(null);

    // Estado para modelos disponibles
    const [availableModels, setAvailableModels] = useState([]);

    // Estado para configuración general
    const [generalConfig, setGeneralConfig] = useState({
        defaultModel: 'gpt-4-turbo-preview',
        maxTokens: 2000,
        temperature: 0.7,
        streamEnabled: true,
        vipAccessOnly: false,
        rateLimitPerUser: 50,
        enableFunctionCalling: true,
    });

    // Estado para nueva API key
    const [apiKeyConfig, setApiKeyConfig] = useState({
        provider: 'openai',
        apiKey: '',
        showKey: false
    });

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadAgents(),
                loadModels(),
                loadGeneralConfig()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            showMessage('error', 'Error al cargar la configuración');
        } finally {
            setLoading(false);
        }
    };

    const loadAgents = async () => {
        try {
            const response = await http.get('/api/ai/agents');
            setAgents(response.data.agents || []);
        } catch (error) {
            console.error('Error loading agents:', error);
            // Datos de respaldo para modo DEMO
            setAgents([
                {
                    id: 'bezhas-assistant',
                    name: 'BeZhas Assistant',
                    description: 'Asistente general de BeZhas',
                    personality: 'Amigable y profesional',
                    model: 'gpt-4-turbo-preview',
                    maxTokens: 2000,
                    temperature: 0.7,
                    avatar: '🤖',
                    visibility: 'public',
                    systemPrompt: 'Eres un asistente de BeZhas, una red social Web3.',
                    enabled: true
                },
                {
                    id: 'web3-expert',
                    name: 'Web3 Expert',
                    description: 'Experto en blockchain y Web3',
                    personality: 'Técnico y detallado',
                    model: 'gpt-4-turbo-preview',
                    maxTokens: 3000,
                    temperature: 0.5,
                    avatar: '⛓️',
                    visibility: 'vip',
                    systemPrompt: 'Eres un experto en Web3, blockchain y criptomonedas.',
                    enabled: true
                }
            ]);
        }
    };

    const loadModels = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/ai/models`);
            setAvailableModels(response.data.models || []);
        } catch (error) {
            console.error('Error loading models:', error);
            // Modelos de respaldo
            setAvailableModels([
                { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', provider: 'openai', maxTokens: 128000 },
                { id: 'gpt-4', name: 'GPT-4', provider: 'openai', maxTokens: 8192 },
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', maxTokens: 16385 },
            ]);
        }
    };

    const loadGeneralConfig = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/ai/config`);
            setGeneralConfig(prev => ({ ...prev, ...response.data.config }));
        } catch (error) {
            console.error('Error loading config:', error);
        }
    };

    const handleSaveAgent = async (agent) => {
        setSaving(true);
        try {
            const endpoint = agent.id && agents.find(a => a.id === agent.id)
                ? `${API_URL}/api/ai/agents/${agent.id}`
                : `${API_URL}/api/ai/agents`;

            const method = agent.id && agents.find(a => a.id === agent.id) ? 'put' : 'post';

            await axios[method](endpoint, agent);

            showMessage('success', 'Agente guardado correctamente');
            setEditingAgent(null);
            await loadAgents();
        } catch (error) {
            console.error('Error saving agent:', error);
            showMessage('error', 'Error al guardar el agente');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAgent = async (agentId) => {
        if (!confirm('¿Estás seguro de eliminar este agente?')) return;

        try {
            await axios.delete(`${API_URL}/api/ai/agents/${agentId}`);
            showMessage('success', 'Agente eliminado correctamente');
            await loadAgents();
        } catch (error) {
            console.error('Error deleting agent:', error);
            showMessage('error', 'Error al eliminar el agente');
        }
    };

    const handleToggleAgent = async (agentId, enabled) => {
        try {
            await axios.patch(`${API_URL}/api/ai/agents/${agentId}`, { enabled });
            showMessage('success', `Agente ${enabled ? 'activado' : 'desactivado'}`);
            await loadAgents();
        } catch (error) {
            console.error('Error toggling agent:', error);
            showMessage('error', 'Error al cambiar el estado del agente');
        }
    };

    const handleSaveGeneralConfig = async () => {
        setSaving(true);
        try {
            await axios.put(`${API_URL}/api/ai/config`, generalConfig);
            showMessage('success', 'Configuración general guardada');
        } catch (error) {
            console.error('Error saving config:', error);
            showMessage('error', 'Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveApiKey = async () => {
        if (!apiKeyConfig.apiKey) {
            showMessage('error', 'Por favor ingresa una API key');
            return;
        }

        setSaving(true);
        try {
            await axios.post(`${API_URL}/api/ai/api-keys`, apiKeyConfig);
            showMessage('success', 'API Key guardada correctamente');
            setApiKeyConfig({ ...apiKeyConfig, apiKey: '', showKey: false });
        } catch (error) {
            console.error('Error saving API key:', error);
            showMessage('error', 'Error al guardar la API key');
        } finally {
            setSaving(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    return (
        <div className="space-y-6">
            {/* Modal de creación/edición avanzada */}
            {editingAgent !== null && (
                <AgentCreatorAdvanced
                    onSave={handleSaveAgent}
                    onCancel={() => setEditingAgent(null)}
                    editingAgent={editingAgent}
                    availableModels={availableModels}
                />
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <Brain className="w-8 h-8" />
                    <h2 className="text-2xl font-bold">Configuración Chat & IA</h2>
                </div>
                <p className="text-purple-100">
                    Gestiona agentes de IA, modelos y parámetros del sistema de chat inteligente
                </p>
            </div>

            {/* Mensaje de estado */}
            {message.text && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                    message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                        'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                        message.type === 'error' ? <XCircle className="w-5 h-5" /> :
                            <AlertCircle className="w-5 h-5" />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('agents')}
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'agents'
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <Bot className="w-4 h-4" />
                    Agentes IA
                </button>
                <button
                    onClick={() => setActiveTab('models')}
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'models'
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <Sparkles className="w-4 h-4" />
                    Modelos
                </button>
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${activeTab === 'general'
                        ? 'text-purple-600 border-b-2 border-purple-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    <Settings className="w-4 h-4" />
                    General
                </button>
            </div>

            {/* Contenido de tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                ) : (
                    <>
                        {/* Tab: Agentes */}
                        {activeTab === 'agents' && (
                            <AgentsTab
                                agents={agents}
                                setEditingAgent={setEditingAgent}
                                onDelete={handleDeleteAgent}
                                onToggle={handleToggleAgent}
                            />
                        )}

                        {/* Tab: Modelos */}
                        {activeTab === 'models' && (
                            <ModelsTab
                                availableModels={availableModels}
                                apiKeyConfig={apiKeyConfig}
                                setApiKeyConfig={setApiKeyConfig}
                                onSaveApiKey={handleSaveApiKey}
                                saving={saving}
                            />
                        )}

                        {/* Tab: General */}
                        {activeTab === 'general' && (
                            <GeneralTab
                                config={generalConfig}
                                setConfig={setGeneralConfig}
                                onSave={handleSaveGeneralConfig}
                                saving={saving}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ==================== SUB-COMPONENTES ====================

function AgentsTab({ agents, setEditingAgent, onDelete, onToggle }) {
    return (
        <div className="space-y-6">
            {/* Lista de agentes */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Agentes Disponibles ({agents.length})
                    </h3>
                    <button
                        onClick={() => setEditingAgent({})}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                        <Bot className="w-4 h-4" />
                        Crear Agente Especializado
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-purple-400 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">{agent.avatar}</span>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                            {agent.name}
                                            {agent.visibility === 'vip' && (
                                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                                                    VIP
                                                </span>
                                            )}
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            {agent.description}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onToggle(agent.id, !agent.enabled)}
                                    className={`p-2 rounded-lg transition-colors ${agent.enabled
                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                        }`}
                                >
                                    {agent.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="text-xs text-gray-500 space-y-1 mb-3">
                                <p>Modelo: {agent.model}</p>
                                <p>Temperatura: {agent.temperature} | Tokens: {agent.maxTokens}</p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingAgent(agent)}
                                    className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm"
                                >
                                    Configurar
                                </button>
                                <button
                                    onClick={() => onDelete(agent.id)}
                                    className="flex-1 px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ModelsTab({ availableModels, apiKeyConfig, setApiKeyConfig, onSaveApiKey, saving }) {
    return (
        <div className="space-y-6">
            {/* Modelos disponibles */}
            <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Modelos Disponibles
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableModels.map(model => (
                        <div
                            key={model.id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                    {model.name}
                                </h4>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                Proveedor: {model.provider}
                            </p>
                            <p className="text-xs text-gray-500">
                                Max Tokens: {model.maxTokens.toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Configuración de API Keys */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Configurar API Key
                </h3>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                    <div className="flex gap-3">
                        <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Seguridad de API Keys
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                Las API keys se almacenan de forma segura en el backend. Nunca las compartas públicamente.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Proveedor
                        </label>
                        <select
                            value={apiKeyConfig.provider}
                            onChange={(e) => setApiKeyConfig({ ...apiKeyConfig, provider: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="openai">OpenAI</option>
                            <option value="anthropic">Anthropic (Claude)</option>
                            <option value="google">Google (Gemini)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            API Key
                        </label>
                        <div className="relative">
                            <input
                                type={apiKeyConfig.showKey ? 'text' : 'password'}
                                value={apiKeyConfig.apiKey}
                                onChange={(e) => setApiKeyConfig({ ...apiKeyConfig, apiKey: e.target.value })}
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                placeholder="sk-..."
                            />
                            <button
                                type="button"
                                onClick={() => setApiKeyConfig({ ...apiKeyConfig, showKey: !apiKeyConfig.showKey })}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {apiKeyConfig.showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={onSaveApiKey}
                        disabled={saving || !apiKeyConfig.apiKey}
                        className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Guardando...' : 'Guardar API Key'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function GeneralTab({ config, setConfig, onSave, saving }) {
    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Configuración General del Sistema
            </h3>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Modelo por Defecto
                    </label>
                    <select
                        value={config.defaultModel}
                        onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Max Tokens por Defecto
                        </label>
                        <input
                            type="number"
                            value={config.maxTokens}
                            onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            min="100"
                            max="32000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Temperature por Defecto
                        </label>
                        <input
                            type="number"
                            value={config.temperature}
                            onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                            min="0"
                            max="2"
                            step="0.1"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Límite de Mensajes por Usuario (por hora)
                    </label>
                    <input
                        type="number"
                        value={config.rateLimitPerUser}
                        onChange={(e) => setConfig({ ...config, rateLimitPerUser: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        min="1"
                        max="1000"
                    />
                </div>

                {/* Opciones booleanas */}
                <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.streamEnabled}
                            onChange={(e) => setConfig({ ...config, streamEnabled: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                Habilitar Streaming
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Mostrar respuestas en tiempo real mientras se generan
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enableFunctionCalling}
                            onChange={(e) => setConfig({ ...config, enableFunctionCalling: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                Habilitar Function Calling
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Permitir que los agentes usen herramientas y funciones
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.vipAccessOnly}
                            onChange={(e) => setConfig({ ...config, vipAccessOnly: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                                Acceso Solo VIP
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Restringir el chat IA solo para usuarios VIP
                            </p>
                        </div>
                    </label>
                </div>

                <button
                    onClick={onSave}
                    disabled={saving}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Guardando...' : 'Guardar Configuración General'}
                </button>
            </div>
        </div>
    );
}
