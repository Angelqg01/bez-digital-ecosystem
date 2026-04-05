import React, { useState } from 'react';
import {
    Bot, Brain, Settings, MessageSquare, BookOpen, Shield,
    Zap, Users, Globe, Code, RefreshCw, Save, X, Plus,
    AlertCircle, CheckCircle, Sparkles, Database, Network,
    FileText, MessageCircleMore, PlayCircle, Sliders
} from 'lucide-react';

/**
 * AgentCreatorAdvanced - Constructor avanzado de agentes IA especializados
 * Con pestañas de configuración completas siguiendo estándares de chatbot profesional
 */
export default function AgentCreatorAdvanced({ onSave, onCancel, editingAgent, availableModels }) {
    const [activeSection, setActiveSection] = useState('info'); // info, knowledge, behavior, moderation, advanced
    const [saving, setSaving] = useState(false);

    // Estado del agente
    const [agentData, setAgentData] = useState({
        // Información básica
        id: editingAgent?.id || '',
        name: editingAgent?.name || '',
        description: editingAgent?.description || '',
        avatar: editingAgent?.avatar || '🤖',
        scope: editingAgent?.scope || 'global', // global, group, private
        visibility: editingAgent?.visibility || 'public', // public, vip, admin
        enabled: editingAgent?.enabled !== undefined ? editingAgent.enabled : true,

        // Conocimiento y contexto
        systemPrompt: editingAgent?.systemPrompt || '',
        mainRole: editingAgent?.mainRole || '',
        groupContext: editingAgent?.groupContext || '',
        targetAudience: editingAgent?.targetAudience || '',
        specificFunctions: editingAgent?.specificFunctions || [],

        // Comportamiento
        personality: editingAgent?.personality || 'friendly',
        tone: editingAgent?.tone || 'Amigable y Cercano',
        language: editingAgent?.language || 'es',
        communicationStyle: editingAgent?.communicationStyle || '',

        // Modelo y parámetros técnicos
        model: editingAgent?.model || 'gpt-4o-mini',
        provider: editingAgent?.provider || 'openai', // openai, anthropic, google, deepseek
        temperature: editingAgent?.temperature || 0.7,
        maxTokens: editingAgent?.maxTokens || 2000,
        contextWindow: editingAgent?.contextWindow || 4096,
        messageThreshold: editingAgent?.messageThreshold || 15,

        // Moderación
        enableModeration: editingAgent?.enableModeration !== undefined ? editingAgent.enableModeration : true,
        moderationRules: editingAgent?.moderationRules || [],
        contentFilter: editingAgent?.contentFilter || 'standard', // none, standard, strict

        // Características avanzadas
        memoryEnabled: editingAgent?.memoryEnabled !== undefined ? editingAgent.memoryEnabled : true,
        functionsEnabled: editingAgent?.functionsEnabled !== undefined ? editingAgent.functionsEnabled : true,
        availableFunctions: editingAgent?.availableFunctions || [],
        shortcuts: editingAgent?.shortcuts || [],
        actions: editingAgent?.actions || [],

        // Sugerencias personalizadas
        canSuggestProducts: editingAgent?.canSuggestProducts !== undefined ? editingAgent.canSuggestProducts : true,
        canSuggestCourses: editingAgent?.canSuggestCourses !== undefined ? editingAgent.canSuggestCourses : true,
        canSuggestFriends: editingAgent?.canSuggestFriends !== undefined ? editingAgent.canSuggestFriends : true,
        canSuggestGroups: editingAgent?.canSuggestGroups !== undefined ? editingAgent.canSuggestGroups : true,
        canSuggestServices: editingAgent?.canSuggestServices !== undefined ? editingAgent.canSuggestServices : true,

        // Apariencia UI
        appearance: editingAgent?.appearance || 'timeless',
        uiBuilder: editingAgent?.uiBuilder || 'standard',

        // Restricciones y ética
        privacyProtection: editingAgent?.privacyProtection !== undefined ? editingAgent.privacyProtection : true,
        objectiveRecommendations: editingAgent?.objectiveRecommendations !== undefined ? editingAgent.objectiveRecommendations : true,
        transparentLimitations: editingAgent?.transparentLimitations !== undefined ? editingAgent.transparentLimitations : true,
        alwaysIdentifyAsAI: editingAgent?.alwaysIdentifyAsAI !== undefined ? editingAgent.alwaysIdentifyAsAI : true,
    });

    const sections = [
        { id: 'info', label: 'Información', icon: FileText, description: 'Datos básicos del agente' },
        { id: 'knowledge', label: 'Conocimiento', icon: BookOpen, description: 'Contexto y propósito' },
        { id: 'behavior', label: 'Comportamiento', icon: MessageCircleMore, description: 'Personalidad y estilo' },
        { id: 'model', label: 'Modelo IA', icon: Brain, description: 'Proveedor y parámetros' },
        { id: 'functions', label: 'Funcionalidades', icon: Zap, description: 'Capacidades y acciones' },
        { id: 'moderation', label: 'Moderación', icon: Shield, description: 'Filtros de contenido' },
        { id: 'advanced', label: 'Avanzado', icon: Settings, description: 'Configuración técnica' },
    ];

    const handleSave = async () => {
        // Validaciones básicas
        if (!agentData.name || !agentData.description) {
            alert('Por favor completa el nombre y la descripción del agente');
            return;
        }

        setSaving(true);
        try {
            await onSave(agentData);
        } catch (error) {
            console.error('Error saving agent:', error);
            alert('Error al guardar el agente');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full h-[98vh] sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <Bot className="w-8 h-8" />
                            <h2 className="text-2xl font-bold">
                                {editingAgent?.id ? 'Editar Agente IA' : 'Crear Agente IA Especializado'}
                            </h2>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-purple-100">
                        Configura un agente inteligente con personalidad y funciones especializadas
                    </p>
                </div>

                {/* Navigation Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
                    <div className="flex gap-1 p-2 min-w-max">
                        {sections.map(section => {
                            const Icon = section.icon;
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeSection === section.id
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <div className="text-left">
                                        <p className="font-medium text-sm">{section.label}</p>
                                        <p className="text-xs opacity-80 hidden lg:block">{section.description}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
                    {activeSection === 'info' && (
                        <InfoSection agentData={agentData} setAgentData={setAgentData} />
                    )}
                    {activeSection === 'knowledge' && (
                        <KnowledgeSection agentData={agentData} setAgentData={setAgentData} />
                    )}
                    {activeSection === 'behavior' && (
                        <BehaviorSection agentData={agentData} setAgentData={setAgentData} />
                    )}
                    {activeSection === 'model' && (
                        <ModelSection agentData={agentData} setAgentData={setAgentData} availableModels={availableModels} />
                    )}
                    {activeSection === 'functions' && (
                        <FunctionsSection agentData={agentData} setAgentData={setAgentData} />
                    )}
                    {activeSection === 'moderation' && (
                        <ModerationSection agentData={agentData} setAgentData={setAgentData} />
                    )}
                    {activeSection === 'advanced' && (
                        <AdvancedSection agentData={agentData} setAgentData={setAgentData} />
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {saving ? 'Guardando...' : 'Guardar Agente'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== SECCIONES ====================

function InfoSection({ agentData, setAgentData }) {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Información Básica
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nombre del Agente *
                    </label>
                    <input
                        type="text"
                        value={agentData.name}
                        onChange={(e) => setAgentData({ ...agentData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Ej: Be-MindFulness"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        ID del Agente
                    </label>
                    <input
                        type="text"
                        value={agentData.id}
                        onChange={(e) => setAgentData({ ...agentData, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        placeholder="be-mindfulness"
                    />
                    <p className="text-xs text-gray-500 mt-1">Se generará automáticamente si lo dejas vacío</p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descripción *
                </label>
                <textarea
                    value={agentData.description}
                    onChange={(e) => setAgentData({ ...agentData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    rows="3"
                    placeholder="Describe brevemente el propósito del agente..."
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Avatar (Emoji)
                    </label>
                    <input
                        type="text"
                        value={agentData.avatar}
                        onChange={(e) => setAgentData({ ...agentData, avatar: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white text-center text-3xl"
                        maxLength="2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Alcance
                    </label>
                    <select
                        value={agentData.scope}
                        onChange={(e) => setAgentData({ ...agentData, scope: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                        <option value="global">Global (BeZhas)</option>
                        <option value="group">Grupo específico</option>
                        <option value="private">Privado</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Visibilidad
                    </label>
                    <select
                        value={agentData.visibility}
                        onChange={(e) => setAgentData({ ...agentData, visibility: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                        <option value="public">Público</option>
                        <option value="vip">Solo VIP</option>
                        <option value="admin">Solo Admin</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={agentData.enabled}
                        onChange={(e) => setAgentData({ ...agentData, enabled: e.target.checked })}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">Agente Activo</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Los usuarios podrán interactuar con este agente
                        </p>
                    </div>
                </label>
            </div>
        </div>
    );
}

function KnowledgeSection({ agentData, setAgentData }) {
    const [newFunction, setNewFunction] = useState('');

    const addFunction = () => {
        if (newFunction.trim()) {
            setAgentData({
                ...agentData,
                specificFunctions: [...agentData.specificFunctions, newFunction.trim()]
            });
            setNewFunction('');
        }
    };

    const removeFunction = (index) => {
        const updated = agentData.specificFunctions.filter((_, i) => i !== index);
        setAgentData({ ...agentData, specificFunctions: updated });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Conocimiento y Contexto
            </h3>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rol Principal del Agente
                </label>
                <textarea
                    value={agentData.mainRole}
                    onChange={(e) => setAgentData({ ...agentData, mainRole: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    rows="3"
                    placeholder="Ej: Soy tu asistente de IA en el grupo [MindFulness para todos]. Mi propósito es ayudarte a navegar por el fascinante mundo del mindfulness..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contexto del Grupo/Tema/Foro
                </label>
                <textarea
                    value={agentData.groupContext}
                    onChange={(e) => setAgentData({ ...agentData, groupContext: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    rows="4"
                    placeholder="Nombre del Grupo: [MindFulness para todos]&#10;Descripción del Contenido: Este es un espacio comunitario para explorar..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Audiencia Principal
                </label>
                <textarea
                    value={agentData.targetAudience}
                    onChange={(e) => setAgentData({ ...agentData, targetAudience: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    rows="3"
                    placeholder="Personas de todas las edades y niveles de experiencia interesadas en el bienestar integral..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    System Prompt Completo
                </label>
                <textarea
                    value={agentData.systemPrompt}
                    onChange={(e) => setAgentData({ ...agentData, systemPrompt: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                    rows="8"
                    placeholder="Instrucciones completas del sistema para el modelo de IA..."
                />
                <p className="text-xs text-gray-500 mt-1">
                    Este es el prompt principal que guiará todas las respuestas del agente
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Funcionalidades Específicas
                </label>
                <div className="space-y-2">
                    {agentData.specificFunctions.map((func, index) => (
                        <div key={index} className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-purple-600" />
                            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{func}</span>
                            <button
                                onClick={() => removeFunction(index)}
                                className="text-red-600 hover:text-red-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-3">
                    <input
                        type="text"
                        value={newFunction}
                        onChange={(e) => setNewFunction(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addFunction()}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Ej: Información y Discusión sobre mindfulness"
                    />
                    <button
                        onClick={addFunction}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir
                    </button>
                </div>
            </div>
        </div>
    );
}

function BehaviorSection({ agentData, setAgentData }) {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Comportamiento y Personalidad
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Personalidad
                    </label>
                    <select
                        value={agentData.personality}
                        onChange={(e) => setAgentData({ ...agentData, personality: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                        <option value="friendly">Amigable</option>
                        <option value="professional">Profesional</option>
                        <option value="creative">Creativo</option>
                        <option value="technical">Técnico</option>
                        <option value="analytical">Analítico</option>
                        <option value="empathetic">Empático</option>
                        <option value="playful">Divertido</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Idioma Principal
                    </label>
                    <select
                        value={agentData.language}
                        onChange={(e) => setAgentData({ ...agentData, language: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                        <option value="es">Español</option>
                        <option value="en">English</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="pt">Português</option>
                        <option value="it">Italiano</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tono de Comunicación
                </label>
                <input
                    type="text"
                    value={agentData.tone}
                    onChange={(e) => setAgentData({ ...agentData, tone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Ej: Amigable y Cercano"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Estilo de Comunicación
                </label>
                <textarea
                    value={agentData.communicationStyle}
                    onChange={(e) => setAgentData({ ...agentData, communicationStyle: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    rows="4"
                    placeholder="Describe cómo debe comunicarse el agente: formal, casual, técnico, educativo..."
                />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                    <MessageCircleMore className="w-5 h-5" />
                    Ejemplo de Personalidad
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    "Soy como un guía sereno y alentador. Mi objetivo es acompañarte en tu camino de descubrimiento,
                    ofreciendo conocimiento de forma clara y accesible, y fomentando siempre un espacio de calma y respeto mutuo."
                </p>
            </div>
        </div>
    );
}

function ModelSection({ agentData, setAgentData, availableModels }) {
    const providers = [
        { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
        { id: 'anthropic', name: 'Anthropic (Claude)', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
        { id: 'google', name: 'Google (Gemini)', models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
        { id: 'xai', name: 'xAI (Grok)', models: ['grok-2', 'grok-1.5'] },
        { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
    ];

    const selectedProvider = providers.find(p => p.id === agentData.provider) || providers[0];

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Modelo de IA y Parámetros
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Proveedor de IA
                    </label>
                    <select
                        value={agentData.provider}
                        onChange={(e) => setAgentData({ ...agentData, provider: e.target.value, model: '' })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                        {providers.map(provider => (
                            <option key={provider.id} value={provider.id}>{provider.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Modelo
                    </label>
                    <select
                        value={agentData.model}
                        onChange={(e) => setAgentData({ ...agentData, model: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                        {selectedProvider.models.map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Temperature
                    </label>
                    <input
                        type="number"
                        value={agentData.temperature}
                        onChange={(e) => setAgentData({ ...agentData, temperature: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        min="0"
                        max="2"
                        step="0.1"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = Preciso, 2 = Creativo</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max Tokens
                    </label>
                    <input
                        type="number"
                        value={agentData.maxTokens}
                        onChange={(e) => setAgentData({ ...agentData, maxTokens: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        min="100"
                        max="32000"
                        step="100"
                    />
                    <p className="text-xs text-gray-500 mt-1">Longitud de respuesta</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Context Window
                    </label>
                    <input
                        type="number"
                        value={agentData.contextWindow}
                        onChange={(e) => setAgentData({ ...agentData, contextWindow: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        min="1024"
                        max="128000"
                        step="1024"
                    />
                    <p className="text-xs text-gray-500 mt-1">Memoria de contexto</p>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Umbral de Mensajes
                </label>
                <input
                    type="number"
                    value={agentData.messageThreshold}
                    onChange={(e) => setAgentData({ ...agentData, messageThreshold: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    min="1"
                    max="100"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Número máximo de mensajes que el agente recordará en la conversación
                </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Recomendaciones de Configuración
                </h4>
                <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1 ml-6 list-disc">
                    <li><strong>GPT-4o:</strong> Excelente para tareas complejas y razonamiento</li>
                    <li><strong>GPT-4o-mini:</strong> Rápido y económico para tareas simples</li>
                    <li><strong>Claude-3:</strong> Mejor para textos largos y análisis detallados</li>
                    <li><strong>Gemini-1.5:</strong> Gran ventana de contexto (hasta 1M tokens)</li>
                </ul>
            </div>
        </div>
    );
}

function FunctionsSection({ agentData, setAgentData }) {
    const suggestions = [
        { key: 'canSuggestProducts', label: 'Sugerir Productos', icon: '🛍️', description: 'Recomendar productos del marketplace' },
        { key: 'canSuggestCourses', label: 'Sugerir Cursos', icon: '📚', description: 'Recomendar formación y talleres' },
        { key: 'canSuggestFriends', label: 'Sugerir Amigos', icon: '👥', description: 'Conectar con usuarios afines' },
        { key: 'canSuggestGroups', label: 'Sugerir Grupos', icon: '👨‍👩‍👧‍👦', description: 'Recomendar comunidades' },
        { key: 'canSuggestServices', label: 'Sugerir Servicios', icon: '⚙️', description: 'Recomendar servicios de miembros' },
    ];

    const [newFunctionName, setNewFunctionName] = useState('');

    const addAvailableFunction = () => {
        if (newFunctionName.trim() && !agentData.availableFunctions.includes(newFunctionName.trim())) {
            setAgentData({
                ...agentData,
                availableFunctions: [...agentData.availableFunctions, newFunctionName.trim()]
            });
            setNewFunctionName('');
        }
    };

    const removeAvailableFunction = (funcName) => {
        setAgentData({
            ...agentData,
            availableFunctions: agentData.availableFunctions.filter(f => f !== funcName)
        });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Funcionalidades del Agente
            </h3>

            <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Sugerencias Personalizadas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suggestions.map(suggestion => (
                        <label key={suggestion.key} className="flex items-start gap-3 p-4 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={agentData[suggestion.key]}
                                onChange={(e) => setAgentData({ ...agentData, [suggestion.key]: e.target.checked })}
                                className="w-5 h-5 mt-0.5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{suggestion.icon}</span>
                                    <p className="font-medium text-gray-900 dark:text-white">{suggestion.label}</p>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {suggestion.description}
                                </p>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Capacidades Avanzadas</h4>
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agentData.memoryEnabled}
                            onChange={(e) => setAgentData({ ...agentData, memoryEnabled: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Memoria Local Habilitada</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                El agente recordará conversaciones anteriores
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agentData.functionsEnabled}
                            onChange={(e) => setAgentData({ ...agentData, functionsEnabled: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Function Calling Habilitado</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                El agente podrá usar herramientas y funciones externas
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Funciones Disponibles</h4>
                <div className="space-y-2">
                    {agentData.availableFunctions.map((func, index) => (
                        <div key={index} className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                            <Zap className="w-4 h-4 text-green-600" />
                            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 font-mono">{func}</span>
                            <button
                                onClick={() => removeAvailableFunction(func)}
                                className="text-red-600 hover:text-red-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-3">
                    <input
                        type="text"
                        value={newFunctionName}
                        onChange={(e) => setNewFunctionName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addAvailableFunction()}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Ej: getUserProfile, searchPosts, getTrendingTopics"
                    />
                    <button
                        onClick={addAvailableFunction}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Lista de funciones que este agente puede ejecutar (deben estar implementadas en el backend)
                </p>
            </div>
        </div>
    );
}

function ModerationSection({ agentData, setAgentData }) {
    const [newRule, setNewRule] = useState('');

    const addRule = () => {
        if (newRule.trim()) {
            setAgentData({
                ...agentData,
                moderationRules: [...agentData.moderationRules, newRule.trim()]
            });
            setNewRule('');
        }
    };

    const removeRule = (index) => {
        const updated = agentData.moderationRules.filter((_, i) => i !== index);
        setAgentData({ ...agentData, moderationRules: updated });
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Moderación y Filtros de Contenido
            </h3>

            <div>
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                    <input
                        type="checkbox"
                        checked={agentData.enableModeration}
                        onChange={(e) => setAgentData({ ...agentData, enableModeration: e.target.checked })}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">Habilitar Moderación de IA</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Filtra contenido inapropiado usando OpenAI Moderation API
                        </p>
                    </div>
                </label>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nivel de Filtro de Contenido
                </label>
                <select
                    value={agentData.contentFilter}
                    onChange={(e) => setAgentData({ ...agentData, contentFilter: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    disabled={!agentData.enableModeration}
                >
                    <option value="none">Sin Filtro</option>
                    <option value="standard">Estándar (Recomendado)</option>
                    <option value="strict">Estricto</option>
                </select>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reglas de Moderación Personalizadas
                </label>
                <div className="space-y-2">
                    {agentData.moderationRules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                            <Shield className="w-4 h-4 text-orange-600" />
                            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{rule}</span>
                            <button
                                onClick={() => removeRule(index)}
                                className="text-red-600 hover:text-red-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-3">
                    <input
                        type="text"
                        value={newRule}
                        onChange={(e) => setNewRule(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addRule()}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        placeholder="Ej: No permitir discusiones políticas"
                    />
                    <button
                        onClick={addRule}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Añadir
                    </button>
                </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Categorías de Moderación de OpenAI
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 ml-6 list-disc">
                    <li><strong>hate:</strong> Contenido de odio o discriminación</li>
                    <li><strong>sexual:</strong> Contenido sexual explícito</li>
                    <li><strong>violence:</strong> Violencia o contenido gráfico</li>
                    <li><strong>self-harm:</strong> Autolesión o suicidio</li>
                    <li><strong>harassment:</strong> Acoso o bullying</li>
                </ul>
            </div>
        </div>
    );
}

function AdvancedSection({ agentData, setAgentData }) {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Configuración Avanzada
            </h3>

            <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Restricciones y Ética</h4>
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agentData.privacyProtection}
                            onChange={(e) => setAgentData({ ...agentData, privacyProtection: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Protección de Privacidad</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Jamás compartir información personal de usuarios
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agentData.objectiveRecommendations}
                            onChange={(e) => setAgentData({ ...agentData, objectiveRecommendations: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Recomendaciones Objetivas</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Basadas en información verificada del grupo y la plataforma
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agentData.transparentLimitations}
                            onChange={(e) => setAgentData({ ...agentData, transparentLimitations: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Transparencia sobre Limitaciones</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Informar cuando no tiene suficiente información
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agentData.alwaysIdentifyAsAI}
                            onChange={(e) => setAgentData({ ...agentData, alwaysIdentifyAsAI: e.target.checked })}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                        />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Identificarse como IA</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Recordar siempre a los usuarios que es un agente de IA
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white">Apariencia de UI</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tema Visual
                        </label>
                        <select
                            value={agentData.appearance}
                            onChange={(e) => setAgentData({ ...agentData, appearance: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="timeless">Timeless (Clásico)</option>
                            <option value="modern">Modern (Moderno)</option>
                            <option value="minimal">Minimal (Minimalista)</option>
                            <option value="colorful">Colorful (Colorido)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Constructor UI
                        </label>
                        <select
                            value={agentData.uiBuilder}
                            onChange={(e) => setAgentData({ ...agentData, uiBuilder: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="standard">Standard</option>
                            <option value="advanced">Advanced</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Resumen del Agente
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-purple-600 dark:text-purple-400 font-medium">Proveedor</p>
                        <p className="text-gray-700 dark:text-gray-300">{agentData.provider || 'OpenAI'}</p>
                    </div>
                    <div>
                        <p className="text-purple-600 dark:text-purple-400 font-medium">Modelo</p>
                        <p className="text-gray-700 dark:text-gray-300">{agentData.model || 'gpt-4o-mini'}</p>
                    </div>
                    <div>
                        <p className="text-purple-600 dark:text-purple-400 font-medium">Temperatura</p>
                        <p className="text-gray-700 dark:text-gray-300">{agentData.temperature || 0.7}</p>
                    </div>
                    <div>
                        <p className="text-purple-600 dark:text-purple-400 font-medium">Max Tokens</p>
                        <p className="text-gray-700 dark:text-gray-300">{agentData.maxTokens || 2000}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
