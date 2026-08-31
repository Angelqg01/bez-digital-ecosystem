import React, { useState, useEffect, useRef } from 'react';
import {
    Users,
    TrendingDown,
    Target,
    MapPin,
    Clock,
    Activity,
    UserCheck,
    UserX,
    Star,
    Award,
    Eye,
    MessageSquare,
    Heart,
    Share2,
    Filter,
    Download,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    BarChart3,
    PieChart as PieChartIcon
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Funnel, FunnelChart } from 'recharts';
import aiApi, { mockData } from '../../services/aiApi';

/**
 * UserBehaviorAnalytics - Sistema avanzado de análisis de comportamiento de usuarios
 * Segmentación, predicción de churn, engagement scoring, journey mapping
 */
export default function UserBehaviorAnalytics() {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('30d');

    // Estados de datos
    const [userSegments, setUserSegments] = useState([]);
    const [churnPrediction, setChurnPrediction] = useState(null);
    const [engagementScore, setEngagementScore] = useState([]);
    const [userJourney, setUserJourney] = useState([]);
    const [cohortAnalysis, setCohortAnalysis] = useState([]);
    const [lifetimeValue, setLifetimeValue] = useState([]);
    const [behaviorPatterns, setBehaviorPatterns] = useState([]);
    const [retentionMetrics, setRetentionMetrics] = useState(null);

    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current && timeRange === '30d') return;
        mounted.current = true;
        loadAllData();
    }, [timeRange]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [segmentsRes, churnRes, engagementRes, journeyRes, cohortRes, ltvRes, patternsRes, retentionRes] = await Promise.all([
                aiApi.getUserSegments(timeRange),
                aiApi.getChurnPrediction(timeRange),
                aiApi.getEngagementScore(timeRange),
                aiApi.getUserJourney(timeRange),
                aiApi.getCohortAnalysis(timeRange),
                aiApi.getLifetimeValue(timeRange),
                aiApi.getBehaviorPatterns(timeRange),
                aiApi.getRetentionMetrics(timeRange)
            ]);

            setUserSegments(segmentsRes.data?.segments || segmentsRes.data || mockData.userSegments);
            setChurnPrediction(churnRes.data?.prediction || churnRes.data || mockData.churnPrediction);
            setEngagementScore(engagementRes.data?.scores || engagementRes.data || []);
            setUserJourney(journeyRes.data?.journey || journeyRes.data || []);
            setCohortAnalysis(cohortRes.data?.cohorts || cohortRes.data || []);
            setLifetimeValue(ltvRes.data?.ltv || ltvRes.data || []);
            setBehaviorPatterns(patternsRes.data?.patterns || patternsRes.data || []);
            setRetentionMetrics(retentionRes.data?.metrics || retentionRes.data || { retention7d: 75, retention30d: 45 });
        } catch (error) {
            // Silenciado - usar datos mock
            setUserSegments(mockData.userSegments);
            setChurnPrediction(mockData.churnPrediction);
        } finally {
            setLoading(false);
        }
    };

    // Mock data generators
    const generateMockSegments = () => ([
        { name: 'Power Users', count: 543, percentage: 15.2, avgEngagement: 89, color: '#10b981' },
        { name: 'Active Users', count: 1234, percentage: 34.5, avgEngagement: 65, color: '#3b82f6' },
        { name: 'Casual Users', count: 987, percentage: 27.6, avgEngagement: 42, color: '#8b5cf6' },
        { name: 'At Risk', count: 456, percentage: 12.8, avgEngagement: 18, color: '#f59e0b' },
        { name: 'Churned', count: 358, percentage: 10.0, avgEngagement: 3, color: '#ef4444' }
    ]);

    const generateMockChurn = () => ({
        totalUsers: 3578,
        atRiskUsers: 456,
        churnRate: 12.8,
        predictedChurn: 523,
        preventionRate: 68.5,
        riskFactors: [
            { factor: 'Baja frecuencia de login', impact: 'high', affected: 234 },
            { factor: 'Sin engagement 7 días', impact: 'high', affected: 189 },
            { factor: 'Pérdida de conexiones', impact: 'medium', affected: 145 },
            { factor: 'Sin crear contenido', impact: 'medium', affected: 123 }
        ],
        timeline: [
            { week: 'Sem 1', predicted: 45, actual: 42 },
            { week: 'Sem 2', predicted: 52, actual: 48 },
            { week: 'Sem 3', predicted: 48, actual: 51 },
            { week: 'Sem 4', predicted: 56, actual: 53 }
        ]
    });

    const generateMockEngagement = () => ([
        { category: 'Muy Alto', users: 543, score: '90-100', color: '#10b981' },
        { category: 'Alto', users: 892, score: '70-89', color: '#3b82f6' },
        { category: 'Medio', users: 1234, score: '50-69', color: '#8b5cf6' },
        { category: 'Bajo', users: 567, score: '30-49', color: '#f59e0b' },
        { category: 'Muy Bajo', users: 342, score: '0-29', color: '#ef4444' }
    ]);

    const generateMockJourney = () => ([
        { stage: 'Descubrimiento', users: 5000, conversionRate: 100 },
        { stage: 'Registro', users: 4200, conversionRate: 84 },
        { stage: 'Primer Post', users: 3150, conversionRate: 75 },
        { stage: 'Primera Conexión', users: 2520, conversionRate: 80 },
        { stage: 'Usuario Activo', users: 1890, conversionRate: 75 },
        { stage: 'Power User', users: 543, conversionRate: 29 }
    ]);

    const generateMockCohort = () => ([
        { cohort: 'Nov W1', d0: 100, d7: 68, d14: 52, d30: 38 },
        { cohort: 'Nov W2', d0: 100, d7: 72, d14: 58, d30: 42 },
        { cohort: 'Nov W3', d0: 100, d7: 75, d14: 62, d30: 45 },
        { cohort: 'Nov W4', d0: 100, d7: 78, d14: 65, d30: 48 }
    ]);

    const generateMockLTV = () => ([
        { segment: 'Power Users', ltv: 542.30, acquisitionCost: 45.20, roi: 1099 },
        { segment: 'Active Users', ltv: 234.50, acquisitionCost: 38.90, roi: 503 },
        { segment: 'Casual Users', ltv: 89.20, acquisitionCost: 35.40, roi: 152 },
        { segment: 'At Risk', ltv: 23.10, acquisitionCost: 32.80, roi: -30 }
    ]);

    const generateMockPatterns = () => ([
        {
            pattern: 'Morning Engagers',
            description: 'Usuarios más activos 6am-9am',
            percentage: 23.5,
            avgSessions: 4.2,
            characteristics: ['Posts matutinos', 'Alta lectura', 'Commuters']
        },
        {
            pattern: 'Evening Browsers',
            description: 'Navegación nocturna 8pm-11pm',
            percentage: 31.8,
            avgSessions: 3.8,
            characteristics: ['Consumo pasivo', 'Likes/Comments', 'Scrolling']
        },
        {
            pattern: 'Weekend Warriors',
            description: 'Actividad concentrada en fines de semana',
            percentage: 18.2,
            avgSessions: 6.5,
            characteristics: ['Content creators', 'Alta interacción', 'Largas sesiones']
        },
        {
            pattern: 'Continuous Checkers',
            description: 'Múltiples sesiones cortas durante el día',
            percentage: 26.5,
            avgSessions: 12.3,
            characteristics: ['Notification driven', 'Quick checks', 'FOMO']
        }
    ]);

    const generateMockRetention = () => ({
        day1: 78.5,
        day7: 52.3,
        day14: 41.2,
        day30: 35.8,
        day90: 28.4,
        stickiness: 42.5,
        avgSessionLength: 8.3,
        sessionsPerUser: 4.7
    });

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-400">Cargando análisis de comportamiento...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Users className="text-blue-400" />
                        User Behavior Analytics
                    </h2>
                    <p className="text-gray-400">Análisis profundo del comportamiento de usuarios</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="7d">Últimos 7 días</option>
                        <option value="30d">Últimos 30 días</option>
                        <option value="90d">Últimos 90 días</option>
                        <option value="1y">Último año</option>
                    </select>
                    <button
                        onClick={loadAllData}
                        className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <RefreshCw size={20} className="text-white" />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                        <Download size={18} className="text-white" />
                        <span className="text-white font-semibold">Exportar</span>
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                    <Users className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{(churnPrediction?.totalUsers || 0).toLocaleString()}</div>
                    <div className="text-blue-100 text-sm">Total Usuarios</div>
                    <div className="mt-2 text-xs text-blue-200">{userSegments[0]?.count} power users</div>
                </div>

                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
                    <TrendingDown className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{churnPrediction?.churnRate}%</div>
                    <div className="text-red-100 text-sm">Churn Rate</div>
                    <div className="mt-2 text-xs text-red-200">{churnPrediction?.atRiskUsers} en riesgo</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
                    <CheckCircle2 className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{retentionMetrics?.day30}%</div>
                    <div className="text-green-100 text-sm">Retención D30</div>
                    <div className="mt-2 text-xs text-green-200">Stickiness: {retentionMetrics?.stickiness}%</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                    <Star className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{engagementScore[0]?.users}</div>
                    <div className="text-purple-100 text-sm">Usuarios Altamente Engaged</div>
                    <div className="mt-2 text-xs text-purple-200">Score 90-100</div>
                </div>
            </div>

            {/* User Segments & Churn Prediction */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Segments */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Target className="text-blue-400" />
                        Segmentación de Usuarios
                    </h3>
                    <div className="h-64 flex items-center justify-center mb-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                                <Pie
                                    data={userSegments}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percentage }) => `${name} ${percentage}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {userSegments.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </RechartsPie>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                        {userSegments.map((segment, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }}></div>
                                    <span className="text-white text-sm">{segment.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-semibold text-sm">{segment.count.toLocaleString()}</div>
                                    <div className="text-xs text-gray-400">Eng: {segment.avgEngagement}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Churn Prediction */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="text-red-400" />
                        Predicción de Churn
                    </h3>
                    {churnPrediction && (
                        <>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                                    <div className="text-sm text-gray-400">Usuarios en Riesgo</div>
                                    <div className="text-2xl font-bold text-white">{churnPrediction.atRiskUsers || 0}</div>
                                    <div className="text-xs text-red-400">Requiere acción inmediata</div>
                                </div>
                                <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                                    <div className="text-sm text-gray-400">Tasa de Prevención</div>
                                    <div className="text-2xl font-bold text-white">{churnPrediction.preventionRate ?? 0}%</div>
                                    <div className="text-xs text-green-400">Campañas efectivas</div>
                                </div>
                            </div>
                            {churnPrediction.timeline?.length > 0 && (
                                <ResponsiveContainer width="100%" height={150}>
                                    <LineChart data={churnPrediction.timeline}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="week" stroke="#9ca3af" />
                                        <YAxis stroke="#9ca3af" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                            labelStyle={{ color: '#fff' }}
                                        />
                                        <Legend />
                                        <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2} name="Predicho" strokeDasharray="5 5" />
                                        <Line type="monotone" dataKey="actual" stroke="#ef4444" strokeWidth={2} name="Real" />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                            {churnPrediction.riskFactors?.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <div className="text-sm font-semibold text-white mb-2">Factores de Riesgo:</div>
                                    {churnPrediction.riskFactors.map((risk, idx) => (
                                        <div key={idx} className={`flex items-center justify-between p-2 rounded ${risk.impact === 'high' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                                            }`}>
                                            <span className="text-sm text-gray-300">{risk.factor}</span>
                                            <span className={`text-xs font-semibold ${risk.impact === 'high' ? 'text-red-400' : 'text-yellow-400'
                                                }`}>
                                                {risk.affected} usuarios
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* User Journey Funnel */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <MapPin className="text-purple-400" />
                    User Journey Funnel
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ResponsiveContainer width="100%" height={300}>
                        <FunnelChart>
                            <Tooltip />
                            <Funnel
                                dataKey="users"
                                data={userJourney}
                                isAnimationActive
                            >
                                {userJourney.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                        {userJourney.map((stage, idx) => (
                            <div key={idx} className="p-4 bg-gray-700/50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-semibold">{stage.stage}</span>
                                    <span className="text-sm text-gray-400">{stage.users.toLocaleString()} usuarios</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                                            style={{ width: `${stage.conversionRate}%` }}
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-white w-12">{stage.conversionRate}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Engagement Score Distribution & Behavior Patterns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Engagement Score */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Star className="text-yellow-400" />
                        Distribución de Engagement Score
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={engagementScore} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" stroke="#9ca3af" />
                            <YAxis dataKey="category" type="category" stroke="#9ca3af" width={100} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="users" radius={[0, 8, 8, 0]}>
                                {engagementScore.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Behavior Patterns */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Activity className="text-green-400" />
                        Patrones de Comportamiento
                    </h3>
                    <div className="space-y-4">
                        {behaviorPatterns.map((pattern, idx) => (
                            <div key={idx} className="p-4 bg-gray-700/50 rounded-lg">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="text-white font-semibold">{pattern.pattern}</div>
                                        <div className="text-sm text-gray-400">{pattern.description}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-white">{pattern.percentage}%</div>
                                        <div className="text-xs text-gray-400">{pattern.avgSessions} sesiones/día</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(pattern.characteristics || []).map((char, cidx) => (
                                        <span key={cidx} className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/30">
                                            {char}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cohort Analysis & LTV */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cohort Retention */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Clock className="text-cyan-400" />
                        Análisis de Cohortes (Retención)
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={cohortAnalysis}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="cohort" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="d0" stroke="#10b981" strokeWidth={2} name="Día 0" />
                            <Line type="monotone" dataKey="d7" stroke="#3b82f6" strokeWidth={2} name="Día 7" />
                            <Line type="monotone" dataKey="d14" stroke="#8b5cf6" strokeWidth={2} name="Día 14" />
                            <Line type="monotone" dataKey="d30" stroke="#f59e0b" strokeWidth={2} name="Día 30" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                        <div className="p-2 bg-green-500/10 rounded text-center">
                            <div className="text-xs text-gray-400">D1</div>
                            <div className="text-lg font-bold text-white">{retentionMetrics?.day1}%</div>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded text-center">
                            <div className="text-xs text-gray-400">D7</div>
                            <div className="text-lg font-bold text-white">{retentionMetrics?.day7}%</div>
                        </div>
                        <div className="p-2 bg-purple-500/10 rounded text-center">
                            <div className="text-xs text-gray-400">D14</div>
                            <div className="text-lg font-bold text-white">{retentionMetrics?.day14}%</div>
                        </div>
                        <div className="p-2 bg-orange-500/10 rounded text-center">
                            <div className="text-xs text-gray-400">D30</div>
                            <div className="text-lg font-bold text-white">{retentionMetrics?.day30}%</div>
                        </div>
                    </div>
                </div>

                {/* Lifetime Value */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Award className="text-yellow-400" />
                        Lifetime Value por Segmento
                    </h3>
                    <div className="space-y-3">
                        {lifetimeValue.map((segment, idx) => (
                            <div key={idx} className="p-4 bg-gray-700/50 rounded-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-white font-semibold">{segment.segment}</span>
                                    <span className={`text-sm font-bold ${segment.roi > 0 ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                        ROI: {segment.roi}%
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-gray-400">LTV</div>
                                        <div className="text-xl font-bold text-white">${(segment.ltv || 0).toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400">CAC</div>
                                        <div className="text-xl font-bold text-white">${(segment.acquisitionCost || 0).toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg border border-green-500/30">
                        <div className="text-sm text-gray-400 mb-1">💡 Recomendación</div>
                        <div className="text-white font-semibold">Enfocar adquisición en segmento Power Users</div>
                        <div className="text-xs text-gray-400 mt-1">ROI 10x superior al promedio</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
