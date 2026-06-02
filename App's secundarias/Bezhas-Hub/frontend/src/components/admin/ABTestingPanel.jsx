import React, { useState, useEffect, useRef } from 'react';
import {
    FlaskConical as Flask,
    TrendingUp,
    TrendingDown,
    CheckCircle,
    XCircle,
    Clock,
    Users,
    Target,
    BarChart3,
    Play,
    Pause,
    StopCircle,
    PlusCircle,
    Edit,
    Trash2,
    Download,
    RefreshCw,
    AlertCircle,
    Award,
    Zap
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import aiApi, { mockData } from '../../services/aiApi';

/**
 * ABTestingPanel - Framework completo de experimentos A/B
 * Gestión de experimentos, análisis estadístico, feature flags
 */
export default function ABTestingPanel() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('running'); // running, completed, draft

    // Estados
    const [experiments, setExperiments] = useState([]);
    const [selectedExperiment, setSelectedExperiment] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [featureFlags, setFeatureFlags] = useState([]);

    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [experimentsRes, flagsRes] = await Promise.all([
                aiApi.getExperiments(),
                aiApi.getFeatureFlags()
            ]);

            setExperiments(experimentsRes.data?.experiments || experimentsRes.data || mockData.experiments);
            setFeatureFlags(flagsRes.data?.flags || flagsRes.data || mockData.featureFlags);
        } catch (error) {
            // Silenciado - usar datos mock
            setExperiments(mockData.experiments);
            setFeatureFlags(mockData.featureFlags);
        } finally {
            setLoading(false);
        }
    };

    const generateMockExperiments = () => ([
        {
            id: 'exp_001',
            name: 'New Feed Algorithm',
            description: 'Test de nuevo algoritmo de ordenamiento de feed',
            status: 'running',
            startDate: '2025-11-01',
            variants: [
                {
                    name: 'Control',
                    traffic: 50,
                    users: 1543,
                    conversions: 892,
                    conversionRate: 57.8,
                    avgEngagement: 4.2,
                    revenue: 23456
                },
                {
                    name: 'Variant A',
                    traffic: 50,
                    users: 1556,
                    conversions: 1024,
                    conversionRate: 65.8,
                    avgEngagement: 5.1,
                    revenue: 28934
                }
            ],
            metric: 'conversion_rate',
            confidence: 95.2,
            winner: 'Variant A',
            significantDiff: true,
            timeline: [
                { date: '2025-11-01', control: 54.2, variant: 56.1 },
                { date: '2025-11-03', control: 55.8, variant: 59.3 },
                { date: '2025-11-05', control: 56.5, variant: 62.4 },
                { date: '2025-11-07', control: 57.2, variant: 64.1 },
                { date: '2025-11-09', control: 57.8, variant: 65.8 }
            ]
        },
        {
            id: 'exp_002',
            name: 'Post CTA Button Color',
            description: 'Test de color del botón CTA en posts',
            status: 'running',
            startDate: '2025-11-05',
            variants: [
                {
                    name: 'Blue (Control)',
                    traffic: 33.3,
                    users: 892,
                    conversions: 234,
                    conversionRate: 26.2,
                    avgEngagement: 3.1,
                    revenue: 12345
                },
                {
                    name: 'Green',
                    traffic: 33.3,
                    users: 905,
                    conversions: 278,
                    conversionRate: 30.7,
                    avgEngagement: 3.4,
                    revenue: 14567
                },
                {
                    name: 'Purple',
                    traffic: 33.3,
                    users: 898,
                    conversions: 256,
                    conversionRate: 28.5,
                    avgEngagement: 3.2,
                    revenue: 13456
                }
            ],
            metric: 'click_through_rate',
            confidence: 87.4,
            winner: 'Green',
            significantDiff: false,
            timeline: [
                { date: '2025-11-05', control: 24.5, green: 28.2, purple: 26.1 },
                { date: '2025-11-07', control: 25.3, green: 29.4, purple: 27.3 },
                { date: '2025-11-09', control: 26.2, green: 30.7, purple: 28.5 }
            ]
        },
        {
            id: 'exp_003',
            name: 'Onboarding Flow v2',
            description: 'Nuevo flujo de onboarding simplificado',
            status: 'completed',
            startDate: '2025-10-15',
            endDate: '2025-10-30',
            variants: [
                {
                    name: 'Current Flow',
                    traffic: 50,
                    users: 2345,
                    conversions: 1423,
                    conversionRate: 60.7,
                    avgEngagement: 4.5,
                    revenue: 34567
                },
                {
                    name: 'Simplified Flow',
                    traffic: 50,
                    users: 2378,
                    conversions: 1789,
                    conversionRate: 75.2,
                    avgEngagement: 5.8,
                    revenue: 45678
                }
            ],
            metric: 'completion_rate',
            confidence: 99.1,
            winner: 'Simplified Flow',
            significantDiff: true,
            implemented: true,
            timeline: []
        }
    ]);

    const generateMockFlags = () => ([
        {
            id: 'flag_001',
            name: 'new_feed_algorithm',
            description: 'Nuevo algoritmo de feed personalizado',
            enabled: true,
            rollout: 50,
            conditions: ['premium_users', 'beta_testers'],
            affectedUsers: 1543
        },
        {
            id: 'flag_002',
            name: 'dark_mode_v2',
            description: 'Nueva versión del modo oscuro',
            enabled: true,
            rollout: 100,
            conditions: ['all_users'],
            affectedUsers: 3578
        },
        {
            id: 'flag_003',
            name: 'ai_content_suggestions',
            description: 'Sugerencias de contenido con IA',
            enabled: false,
            rollout: 0,
            conditions: ['internal_testing'],
            affectedUsers: 0
        }
    ]);

    const getStatusBadge = (status) => {
        const badges = {
            running: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: Play, label: 'En Ejecución' },
            completed: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: CheckCircle, label: 'Completado' },
            draft: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock, label: 'Borrador' },
            paused: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Pause, label: 'Pausado' }
        };
        const badge = badges[status] || badges.draft;
        const Icon = badge.icon;
        return (
            <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
                <Icon size={14} />
                {badge.label}
            </span>
        );
    };

    const calculateLift = (control, variant) => {
        if (!control || control === 0) return '0.0';
        const lift = ((variant - control) / control) * 100;
        return lift.toFixed(1);
    };

    const ExperimentCard = ({ exp }) => {
        const control = exp.variants?.[0] || { conversionRate: 0, users: 0, traffic: 0, avgEngagement: 0, revenue: 0, name: 'Control' };
        const variant = exp.variants?.[1] || control;
        const lift = calculateLift(control.conversionRate || 0, variant.conversionRate || 0);

        return (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 hover:border-gray-600 transition-all">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">{exp.name}</h3>
                        <p className="text-sm text-gray-400">{exp.description}</p>
                    </div>
                    {getStatusBadge(exp.status)}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Confianza Estadística</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">{exp.confidence}%</span>
                            {exp.significantDiff && <CheckCircle className="text-green-400" size={16} />}
                        </div>
                    </div>
                    <div className="p-3 bg-gray-700/50 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Lift vs Control</div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-bold ${parseFloat(lift) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {lift > 0 ? '+' : ''}{lift}%
                            </span>
                            {parseFloat(lift) > 0 ? <TrendingUp size={16} className="text-green-400" /> : <TrendingDown size={16} className="text-red-400" />}
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {exp.variants.map((variant, idx) => (
                        <div key={idx} className={`p-3 rounded-lg ${exp.winner === variant.name ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-700/30'
                            }`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-semibold">{variant.name}</span>
                                    {exp.winner === variant.name && <Award className="text-yellow-400" size={16} />}
                                </div>
                                <span className="text-sm text-gray-400">{variant.traffic}% tráfico</span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div>
                                    <div className="text-xs text-gray-400">Usuarios</div>
                                    <div className="text-sm font-bold text-white">{(variant.users || 0).toLocaleString()}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400">Conv. Rate</div>
                                    <div className="text-sm font-bold text-white">{variant.conversionRate || 0}%</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400">Engagement</div>
                                    <div className="text-sm font-bold text-white">{variant.avgEngagement || 0}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-400">Revenue</div>
                                    <div className="text-sm font-bold text-white">${((variant.revenue || 0) / 1000).toFixed(1)}K</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-2 mt-4">
                    <button
                        onClick={() => setSelectedExperiment(exp)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <BarChart3 size={16} className="text-white" />
                        <span className="text-white font-semibold text-sm">Ver Detalles</span>
                    </button>
                    {exp.status === 'running' && (
                        <>
                            <button className="p-2 bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors">
                                <Pause size={16} className="text-white" />
                            </button>
                            <button className="p-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                                <StopCircle size={16} className="text-white" />
                            </button>
                        </>
                    )}
                    {exp.status === 'completed' && !exp.implemented && (
                        <button className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                            <span className="text-white font-semibold text-sm">Implementar</span>
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-400">Cargando experimentos...</span>
            </div>
        );
    }

    const filteredExperiments = experiments.filter(exp => {
        if (activeTab === 'running') return exp.status === 'running';
        if (activeTab === 'completed') return exp.status === 'completed';
        if (activeTab === 'draft') return exp.status === 'draft';
        return true;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Flask className="text-purple-400" />
                        A/B Testing Framework
                    </h2>
                    <p className="text-gray-400">Sistema completo de experimentación y feature flags</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadAllData}
                        className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <RefreshCw size={20} className="text-white" />
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <PlusCircle size={18} className="text-white" />
                        <span className="text-white font-semibold">Nuevo Experimento</span>
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                    <Play className="mb-2" size={24} />
                    <div className="text-3xl font-bold">
                        {experiments.filter(e => e.status === 'running').length}
                    </div>
                    <div className="text-green-100 text-sm">Experimentos Activos</div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                    <CheckCircle className="mb-2" size={24} />
                    <div className="text-3xl font-bold">
                        {experiments.filter(e => e.status === 'completed').length}
                    </div>
                    <div className="text-blue-100 text-sm">Completados</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                    <Target className="mb-2" size={24} />
                    <div className="text-3xl font-bold">
                        {experiments.filter(e => e.significantDiff).length}
                    </div>
                    <div className="text-purple-100 text-sm">Con Significancia</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                    <Zap className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{featureFlags.filter(f => f.enabled).length}</div>
                    <div className="text-orange-100 text-sm">Feature Flags Activos</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-2">
                <div className="flex gap-2">
                    {[
                        { id: 'running', label: 'En Ejecución', icon: Play },
                        { id: 'completed', label: 'Completados', icon: CheckCircle },
                        { id: 'draft', label: 'Borradores', icon: Clock }
                    ].map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                    }`}
                            >
                                <Icon size={18} />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Experiments Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredExperiments.map(exp => (
                    <ExperimentCard key={exp.id} exp={exp} />
                ))}
            </div>

            {/* Feature Flags Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="text-yellow-400" />
                    Feature Flags
                </h3>
                <div className="space-y-3">
                    {featureFlags.map(flag => (
                        <div key={flag.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-white font-semibold">{flag.name}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${flag.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {flag.enabled ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-400 mb-2">{flag.description}</p>
                                <div className="flex items-center gap-4 text-xs">
                                    <span className="text-gray-500">
                                        Rollout: <span className="text-white font-semibold">{flag.rollout}%</span>
                                    </span>
                                    <span className="text-gray-500">
                                        Usuarios: <span className="text-white font-semibold">{(flag.affectedUsers || 0).toLocaleString()}</span>
                                    </span>
                                    <div className="flex gap-1">
                                        {(flag.conditions || []).map((cond, idx) => (
                                            <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                                                {cond}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                                    <Edit size={16} className="text-white" />
                                </button>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={flag.enabled}
                                        onChange={() => {/* toggle logic */ }}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Experiment Detail Modal */}
            {selectedExperiment && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">{selectedExperiment.name}</h3>
                                <p className="text-gray-400">{selectedExperiment.description}</p>
                            </div>
                            <button
                                onClick={() => setSelectedExperiment(null)}
                                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <XCircle className="text-gray-400" size={24} />
                            </button>
                        </div>

                        {selectedExperiment.timeline?.length > 0 && (
                            <div className="mb-6">
                                <h4 className="text-lg font-semibold text-white mb-3">Evolución Temporal</h4>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={selectedExperiment.timeline}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="date" stroke="#9ca3af" />
                                        <YAxis stroke="#9ca3af" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                            labelStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="control" stroke="#6b7280" strokeWidth={2} name="Control" />
                                        <Line type="monotone" dataKey="variant" stroke="#10b981" strokeWidth={2} name="Variant A" />
                                        {selectedExperiment.timeline?.[0]?.green && (
                                            <Line type="monotone" dataKey="green" stroke="#3b82f6" strokeWidth={2} name="Green" />
                                        )}
                                        {selectedExperiment.timeline?.[0]?.purple && (
                                            <Line type="monotone" dataKey="purple" stroke="#8b5cf6" strokeWidth={2} name="Purple" />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedExperiment(null)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                Cerrar
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <Download size={16} />
                                Exportar Resultados
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
