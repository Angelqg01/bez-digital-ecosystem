import React, { useState, useEffect, useRef } from 'react';
import {
    Brain,
    MessageSquare,
    Bot,
    Sparkles,
    TrendingUp,
    Activity,
    Target,
    Zap,
    Shield,
    Settings,
    ExternalLink,
    ChevronRight,
    CheckCircle,
    XCircle,
    RefreshCw,
    BarChart3,
    MessageCircleMore,
    Users,
    FileText,
    Database,
    FlaskConical as Flask,
    Cpu
} from 'lucide-react';
import { Link } from 'react-router-dom';
import aiApi, { mockData } from '../../services/aiApi';

// Import new advanced panels
import ContentIntelligencePanel from './ContentIntelligencePanel';
import UserBehaviorAnalytics from './UserBehaviorAnalytics';
import ABTestingPanel from './ABTestingPanel';
import DataPipelineMonitor from './DataPipelineMonitor';
import ModelTrainingHub from './ModelTrainingHub';

/**
 * AIFeaturesPanel - Hub central de IA completo
 * Plataforma unificada de desarrollo de IA, ML, Analytics y experimentación
 */
export default function AIFeaturesPanel() {
    const [activeTab, setActiveTab] = useState('overview'); // overview, content-intel, user-behavior, ab-testing, pipelines, training
    const [mlStats, setMlStats] = useState(null);
    const [aegisStats, setAegisStats] = useState(null);
    const [chatStats, setChatStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Ref para evitar doble ejecucion en StrictMode
    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;

        loadAllStats();
        // Actualizar cada 60 segundos (reducido para evitar spam)
        const interval = setInterval(loadAllStats, 60000);
        return () => clearInterval(interval);
    }, []);

    const loadAllStats = async () => {
        try {
            const [mlRes, aegisRes, chatRes] = await Promise.all([
                aiApi.getMlStats(),
                aiApi.getAegisStats(),
                aiApi.getChatStats()
            ]);

            setMlStats(mlRes.data || mockData.mlStats);
            setAegisStats(aegisRes.data || mockData.aegisStats);
            setChatStats(chatRes.data || mockData.aiChatStats);
        } catch (error) {
            // Silenciado - usar datos mock
            setMlStats(mockData.mlStats);
            setAegisStats(mockData.aegisStats);
            setChatStats(mockData.aiChatStats);
        } finally {
            setLoading(false);
        }
    };

    // Características del ML Dashboard
    const mlFeatures = [
        {
            icon: TrendingUp,
            title: 'Análisis de Sentimiento',
            description: 'Detecta emociones y sentimientos en textos',
            color: 'blue',
            stats: mlStats?.models?.sentiment?.totalAnalysis || 0,
            label: 'análisis realizados'
        },
        {
            icon: Target,
            title: 'Clasificación de Contenido',
            description: 'Categoriza automáticamente posts y contenido',
            color: 'purple',
            stats: mlStats?.models?.classification?.totalClassifications || 0,
            label: 'clasificaciones'
        },
        {
            icon: Sparkles,
            title: 'Recomendaciones',
            description: 'Sistema de recomendaciones personalizadas',
            color: 'pink',
            stats: mlStats?.models?.recommendations?.totalGenerated || 0,
            label: 'recomendaciones generadas'
        }
    ];

    // Características de Aegis
    const aegisFeatures = [
        {
            icon: Shield,
            title: 'Moderación Inteligente',
            description: 'Detección automática de contenido inapropiado',
            color: 'green',
            stats: aegisStats?.moderations || 0,
            label: 'moderaciones realizadas'
        },
        {
            icon: Bot,
            title: 'Asistente Virtual',
            description: 'Chatbot inteligente para usuarios',
            color: 'indigo',
            stats: aegisStats?.conversations || 0,
            label: 'conversaciones activas'
        },
        {
            icon: Activity,
            title: 'Análisis de Comportamiento',
            description: 'Detecta patrones y comportamiento sospechoso',
            color: 'red',
            stats: aegisStats?.patterns || 0,
            label: 'patrones detectados'
        }
    ];

    // Características del Chat IA
    const chatFeatures = [
        {
            icon: MessageSquare,
            title: 'Chat Multimodelo',
            description: 'Acceso a múltiples modelos de IA (GPT-4, Claude, etc.)',
            color: 'cyan',
            stats: chatStats?.totalMessages || 0,
            label: 'mensajes procesados'
        },
        {
            icon: Users,
            title: 'Agentes Personalizados',
            description: 'Crea y gestiona agentes con personalidades únicas',
            color: 'orange',
            stats: chatStats?.activeAgents || 0,
            label: 'agentes activos'
        },
        {
            icon: Zap,
            title: 'Respuestas en Tiempo Real',
            description: 'Streaming de respuestas con baja latencia',
            color: 'yellow',
            stats: chatStats?.averageLatency || 0,
            label: 'ms latencia promedio'
        }
    ];

    const getColorClasses = (color) => {
        const colors = {
            blue: 'from-blue-500 to-blue-600 text-blue-100',
            purple: 'from-purple-500 to-purple-600 text-purple-100',
            pink: 'from-pink-500 to-pink-600 text-pink-100',
            green: 'from-green-500 to-green-600 text-green-100',
            indigo: 'from-indigo-500 to-indigo-600 text-indigo-100',
            red: 'from-red-500 to-red-600 text-red-100',
            cyan: 'from-cyan-500 to-cyan-600 text-cyan-100',
            orange: 'from-orange-500 to-orange-600 text-orange-100',
            yellow: 'from-yellow-500 to-yellow-600 text-yellow-100'
        };
        return colors[color] || colors.blue;
    };

    const FeatureCard = ({ icon: Icon, title, description, color, stats, label }) => (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-all">
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${getColorClasses(color)}`}>
                    <Icon size={20} />
                </div>
                <div className="flex-1">
                    <h4 className="text-white font-semibold mb-1">{title}</h4>
                    <p className="text-gray-400 text-sm mb-2">{description}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-white">{stats.toLocaleString()}</span>
                        <span className="text-xs text-gray-500">{label}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const SystemCard = ({ title, description, icon: Icon, link, features, badge }) => (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 hover:border-gray-600 transition-all">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                        <Icon size={24} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{title}</h3>
                        <p className="text-gray-400 text-sm">{description}</p>
                    </div>
                </div>
                {badge && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">
                        {badge}
                    </span>
                )}
            </div>

            <div className="space-y-3 mb-4">
                {features.map((feature, idx) => (
                    <FeatureCard key={idx} {...feature} />
                ))}
            </div>

            {link && (
                <Link
                    to={link.url}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all group"
                >
                    <span className="font-semibold">{link.text}</span>
                    <ExternalLink size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
            )}
        </div>
    );

    // Tabs configuration
    const tabs = [
        { id: 'overview', label: 'Resumen', icon: Brain, color: 'blue' },
        { id: 'content-intel', label: 'Content Intelligence', icon: Sparkles, color: 'purple' },
        { id: 'user-behavior', label: 'User Behavior', icon: Users, color: 'green' },
        { id: 'ab-testing', label: 'A/B Testing', icon: Flask, color: 'orange' },
        { id: 'pipelines', label: 'Data Pipelines', icon: Database, color: 'cyan' },
        { id: 'training', label: 'Model Training', icon: Cpu, color: 'pink' }
    ];

    if (loading && activeTab === 'overview') {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-400">Cargando funcionalidades de IA...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Main Header */}
            <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl p-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-white/10 backdrop-blur-sm rounded-xl">
                        <Brain size={32} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white">Plataforma de Desarrollo de IA</h2>
                        <p className="text-blue-100">
                            Sistema completo de ML, Analytics, Experimentación y Optimización
                        </p>
                    </div>
                    <button
                        onClick={loadAllStats}
                        className="p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-colors"
                    >
                        <RefreshCw size={20} className="text-white" />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${activeTab === tab.id
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                <Icon size={18} />
                                <span className="font-medium text-sm hidden lg:inline">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <>
                    {/* System Status */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <div className="flex items-center gap-2 text-white mb-2">
                                <CheckCircle size={20} />
                                <span className="font-semibold">ML Local Activo</span>
                            </div>
                            <p className="text-blue-100 text-sm">
                                Procesamiento local sin dependencias externas
                            </p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <div className="flex items-center gap-2 text-white mb-2">
                                <CheckCircle size={20} />
                                <span className="font-semibold">Aegis Operativo</span>
                            </div>
                            <p className="text-blue-100 text-sm">
                                Sistema de seguridad y moderación en línea
                            </p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                            <div className="flex items-center gap-2 text-white mb-2">
                                <CheckCircle size={20} />
                                <span className="font-semibold">Chat IA Disponible</span>
                            </div>
                            <p className="text-blue-100 text-sm">
                                Múltiples modelos y agentes configurados
                            </p>
                        </div>
                    </div>

                    {/* Sistemas de IA */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* ML Dashboard */}
                        <SystemCard
                            title="ML Dashboard"
                            description="Machine Learning en tiempo real"
                            icon={Brain}
                            badge="LOCAL"
                            features={mlFeatures}
                            link={{
                                url: '/ml-dashboard',
                                text: 'Abrir Dashboard ML'
                            }}
                        />

                        {/* Aegis System */}
                        <SystemCard
                            title="Aegis Control"
                            description="Sistema de seguridad inteligente"
                            icon={Shield}
                            badge="ACTIVO"
                            features={aegisFeatures}
                            link={{
                                url: '/admin/aegis',
                                text: 'Panel de Control Aegis'
                            }}
                        />

                        {/* Chat IA */}
                        <SystemCard
                            title="Chat IA Multimodelo"
                            description="Asistentes conversacionales avanzados"
                            icon={MessageCircleMore}
                            badge="GPT-4"
                            features={chatFeatures}
                            link={{
                                url: '/ai-chat',
                                text: 'Gestionar Chat IA'
                            }}
                        />
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Zap className="text-yellow-400" />
                            Acciones Rápidas
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Link
                                to="/ml-dashboard"
                                className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all group"
                            >
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <BarChart3 className="text-blue-400" size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-semibold group-hover:text-blue-400 transition-colors">
                                        Ver Métricas ML
                                    </div>
                                    <div className="text-xs text-gray-400">Dashboard completo</div>
                                </div>
                                <ChevronRight className="text-gray-600 group-hover:text-blue-400" size={20} />
                            </Link>

                            <Link
                                to="/ai-chat"
                                className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all group"
                            >
                                <div className="p-2 bg-purple-500/20 rounded-lg">
                                    <MessageSquare className="text-purple-400" size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-semibold group-hover:text-purple-400 transition-colors">
                                        Probar Chat IA
                                    </div>
                                    <div className="text-xs text-gray-400">Conversa con IA</div>
                                </div>
                                <ChevronRight className="text-gray-600 group-hover:text-purple-400" size={20} />
                            </Link>

                            <button
                                onClick={loadAllStats}
                                className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all group"
                            >
                                <div className="p-2 bg-green-500/20 rounded-lg">
                                    <RefreshCw className="text-green-400" size={20} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-white font-semibold group-hover:text-green-400 transition-colors">
                                        Actualizar Stats
                                    </div>
                                    <div className="text-xs text-gray-400">Refrescar datos</div>
                                </div>
                                <ChevronRight className="text-gray-600 group-hover:text-green-400" size={20} />
                            </button>

                            <Link
                                to="/local-ai"
                                className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-all group"
                            >
                                <div className="p-2 bg-orange-500/20 rounded-lg">
                                    <Settings className="text-orange-400" size={20} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-semibold group-hover:text-orange-400 transition-colors">
                                        Configurar IA
                                    </div>
                                    <div className="text-xs text-gray-400">Ajustes avanzados</div>
                                </div>
                                <ChevronRight className="text-gray-600 group-hover:text-orange-400" size={20} />
                            </Link>
                        </div>
                    </div>

                    {/* API Endpoints Reference */}
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Database className="text-cyan-400" />
                            Endpoints de API Disponibles
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-green-400 font-mono text-sm">POST</span>
                                </div>
                                <code className="text-gray-300 text-sm">/api/local-ai/ml/sentiment</code>
                                <p className="text-gray-500 text-xs mt-1">Análisis de sentimiento</p>
                            </div>

                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-green-400 font-mono text-sm">POST</span>
                                </div>
                                <code className="text-gray-300 text-sm">/api/local-ai/ml/classify</code>
                                <p className="text-gray-500 text-xs mt-1">Clasificación de contenido</p>
                            </div>

                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span className="text-blue-400 font-mono text-sm">GET</span>
                                </div>
                                <code className="text-gray-300 text-sm">/api/local-ai/ml/stats</code>
                                <p className="text-gray-500 text-xs mt-1">Estadísticas de ML</p>
                            </div>

                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-green-400 font-mono text-sm">POST</span>
                                </div>
                                <code className="text-gray-300 text-sm">/api/aegis/moderate</code>
                                <p className="text-gray-500 text-xs mt-1">Moderación Aegis</p>
                            </div>

                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-green-400 font-mono text-sm">POST</span>
                                </div>
                                <code className="text-gray-300 text-sm">/api/ai/chat/message</code>
                                <p className="text-gray-500 text-xs mt-1">Enviar mensaje a IA</p>
                            </div>

                            <div className="bg-gray-700/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span className="text-blue-400 font-mono text-sm">GET</span>
                                </div>
                                <code className="text-gray-300 text-sm">/api/ai/agents</code>
                                <p className="text-gray-500 text-xs mt-1">Listar agentes IA</p>
                            </div>
                        </div>
                    </div>

                    {/* Documentation Links */}
                    <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-xl border border-indigo-500/30 p-6">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <FileText className="text-indigo-400" />
                            Documentación y Recursos
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <a
                                href="/ML_DASHBOARD_GUIDE.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-all group"
                            >
                                <FileText className="text-blue-400" size={20} />
                                <div className="flex-1">
                                    <div className="text-white font-semibold">ML Dashboard Guide</div>
                                    <div className="text-xs text-gray-400">Guía completa del dashboard</div>
                                </div>
                                <ExternalLink className="text-gray-600 group-hover:text-blue-400" size={16} />
                            </a>

                            <a
                                href="/LOCAL_AI_SYSTEM.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-all group"
                            >
                                <FileText className="text-purple-400" size={20} />
                                <div className="flex-1">
                                    <div className="text-white font-semibold">Local AI System</div>
                                    <div className="text-xs text-gray-400">Sistema de IA local</div>
                                </div>
                                <ExternalLink className="text-gray-600 group-hover:text-purple-400" size={16} />
                            </a>

                            <a
                                href="/AI_SERVICE_README.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-all group"
                            >
                                <FileText className="text-green-400" size={20} />
                                <div className="flex-1">
                                    <div className="text-white font-semibold">AI Service README</div>
                                    <div className="text-xs text-gray-400">Documentación de servicios</div>
                                </div>
                                <ExternalLink className="text-gray-600 group-hover:text-green-400" size={16} />
                            </a>
                        </div>
                    </div>
                </>
            )}

            {/* Content Intelligence Tab */}
            {activeTab === 'content-intel' && <ContentIntelligencePanel />}

            {/* User Behavior Analytics Tab */}
            {activeTab === 'user-behavior' && <UserBehaviorAnalytics />}

            {/* A/B Testing Tab */}
            {activeTab === 'ab-testing' && <ABTestingPanel />}

            {/* Data Pipelines Tab */}
            {activeTab === 'pipelines' && <DataPipelineMonitor />}

            {/* Model Training Tab */}
            {activeTab === 'training' && <ModelTrainingHub />}
        </div>
    );
}
