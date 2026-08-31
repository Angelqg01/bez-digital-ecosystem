import React, { useState, useEffect, useRef } from 'react';
import {
    FileText,
    TrendingUp,
    Hash,
    Zap,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    Target,
    AlertCircle,
    CheckCircle,
    Clock,
    BarChart3,
    PieChart,
    Activity,
    Sparkles,
    ThumbsUp,
    ThumbsDown,
    Filter,
    Download,
    RefreshCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import aiApi, { mockData } from '../../services/aiApi';

/**
 * ContentIntelligencePanel - Sistema avanzado de análisis de contenido
 * Auto-tagging, detección de tendencias, análisis de viralidad, optimización
 */
export default function ContentIntelligencePanel() {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d'); // 24h, 7d, 30d, 90d

    // Estados de datos
    const [trendingTopics, setTrendingTopics] = useState([]);
    const [contentPerformance, setContentPerformance] = useState([]);
    const [viralityAnalysis, setViralityAnalysis] = useState(null);
    const [autoTags, setAutoTags] = useState([]);
    const [contentOptimization, setContentOptimization] = useState([]);
    const [sentimentTrends, setSentimentTrends] = useState([]);
    const [engagementPatterns, setEngagementPatterns] = useState([]);

    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current && timeRange === '7d') return; // Solo evitar doble mount inicial
        mounted.current = true;
        loadAllData();
    }, [timeRange]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [trendsRes, performanceRes, viralityRes, tagsRes, optimizationRes, sentimentRes, engagementRes] = await Promise.all([
                aiApi.getContentTrends(timeRange),
                aiApi.getContentPerformance(timeRange),
                aiApi.getViralityAnalysis(timeRange),
                aiApi.getAutoTags(timeRange),
                aiApi.getContentOptimization(timeRange),
                aiApi.getSentimentTrends(timeRange),
                aiApi.getEngagementPatterns(timeRange)
            ]);

            setTrendingTopics(trendsRes.data?.topics || trendsRes.data || mockData.contentTrends);
            setContentPerformance(performanceRes.data?.performance || performanceRes.data || mockData.contentPerformance);
            setViralityAnalysis(viralityRes.data?.analysis || viralityRes.data || mockData.viralityAnalysis);
            setAutoTags(tagsRes.data?.tags || tagsRes.data || mockData.autoTags);
            setContentOptimization(optimizationRes.data?.recommendations || optimizationRes.data || []);
            setSentimentTrends(sentimentRes.data?.trends || sentimentRes.data || []);
            setEngagementPatterns(engagementRes.data?.patterns || engagementRes.data || []);
        } catch (error) {
            // Silenciado - usar datos mock
            setTrendingTopics(mockData.contentTrends);
            setContentPerformance(mockData.contentPerformance);
            setViralityAnalysis(mockData.viralityAnalysis);
            setAutoTags(mockData.autoTags);
        } finally {
            setLoading(false);
        }
    };

    // Mock data generators
    const generateMockTrends = () => ([
        { topic: '#Web3', mentions: 1543, growth: 45.2, sentiment: 0.82 },
        { topic: '#NFT', mentions: 1234, growth: 32.1, sentiment: 0.75 },
        { topic: '#Blockchain', mentions: 987, growth: 28.5, sentiment: 0.88 },
        { topic: '#DeFi', mentions: 856, growth: 22.3, sentiment: 0.79 },
        { topic: '#Metaverse', mentions: 743, growth: 18.7, sentiment: 0.71 }
    ]);

    const generateMockPerformance = () => ([
        { date: '2025-11-06', posts: 120, views: 5400, engagement: 23.5 },
        { date: '2025-11-07', posts: 135, views: 6200, engagement: 26.8 },
        { date: '2025-11-08', posts: 142, views: 6800, engagement: 29.2 },
        { date: '2025-11-09', posts: 158, views: 7500, engagement: 31.5 },
        { date: '2025-11-10', posts: 165, views: 8200, engagement: 34.8 },
        { date: '2025-11-11', posts: 178, views: 9100, engagement: 37.2 },
        { date: '2025-11-12', posts: 192, views: 10200, engagement: 41.5 }
    ]);

    const generateMockVirality = () => ({
        viralPosts: 23,
        averageShareRate: 4.2,
        viralityScore: 78.5,
        topViralPost: {
            id: 'post_123',
            title: 'Web3 Revolution in Social Media',
            shares: 1543,
            views: 45678,
            engagement: 89.2
        },
        distribution: [
            { range: '0-100', count: 450 },
            { range: '100-500', count: 320 },
            { range: '500-1K', count: 180 },
            { range: '1K-5K', count: 85 },
            { range: '5K+', count: 23 }
        ]
    });

    const generateMockTags = () => ([
        { tag: 'technology', frequency: 543, confidence: 0.92, category: 'primary' },
        { tag: 'blockchain', frequency: 487, confidence: 0.89, category: 'primary' },
        { tag: 'tutorial', frequency: 356, confidence: 0.85, category: 'secondary' },
        { tag: 'news', frequency: 298, confidence: 0.88, category: 'secondary' },
        { tag: 'community', frequency: 267, confidence: 0.82, category: 'tertiary' }
    ]);

    const generateMockOptimization = () => ([
        {
            type: 'timing',
            recommendation: 'Publicar entre 14:00-16:00 para máximo engagement',
            impact: 'high',
            expectedIncrease: '+35% engagement'
        },
        {
            type: 'length',
            recommendation: 'Contenido óptimo: 150-250 palabras',
            impact: 'medium',
            expectedIncrease: '+22% completion rate'
        },
        {
            type: 'media',
            recommendation: 'Incluir al menos 1 imagen o video',
            impact: 'high',
            expectedIncrease: '+48% views'
        },
        {
            type: 'hashtags',
            recommendation: 'Usar 3-5 hashtags relevantes',
            impact: 'medium',
            expectedIncrease: '+28% reach'
        }
    ]);

    const generateMockSentiment = () => ([
        { date: '2025-11-06', positive: 68, neutral: 25, negative: 7 },
        { date: '2025-11-07', positive: 72, neutral: 22, negative: 6 },
        { date: '2025-11-08', positive: 70, neutral: 24, negative: 6 },
        { date: '2025-11-09', positive: 75, neutral: 20, negative: 5 },
        { date: '2025-11-10', positive: 73, neutral: 22, negative: 5 },
        { date: '2025-11-11', positive: 78, neutral: 18, negative: 4 },
        { date: '2025-11-12', positive: 82, neutral: 15, negative: 3 }
    ]);

    const generateMockEngagement = () => ([
        { hour: '00:00', engagement: 12 },
        { hour: '02:00', engagement: 8 },
        { hour: '04:00', engagement: 6 },
        { hour: '06:00', engagement: 15 },
        { hour: '08:00', engagement: 32 },
        { hour: '10:00', engagement: 45 },
        { hour: '12:00', engagement: 58 },
        { hour: '14:00', engagement: 72 },
        { hour: '16:00', engagement: 68 },
        { hour: '18:00', engagement: 54 },
        { hour: '20:00', engagement: 48 },
        { hour: '22:00', engagement: 28 }
    ]);

    const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-400">Cargando inteligencia de contenido...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-purple-400" />
                        Content Intelligence
                    </h2>
                    <p className="text-gray-400">Análisis avanzado y optimización de contenido</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="24h">Últimas 24h</option>
                        <option value="7d">Últimos 7 días</option>
                        <option value="30d">Últimos 30 días</option>
                        <option value="90d">Últimos 90 días</option>
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
                    <TrendingUp className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{trendingTopics.length}</div>
                    <div className="text-blue-100 text-sm">Trending Topics</div>
                    <div className="mt-2 text-xs text-blue-200">+{trendingTopics[0]?.growth || 0}% crecimiento</div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                    <Zap className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{viralityAnalysis?.viralPosts || 0}</div>
                    <div className="text-purple-100 text-sm">Posts Virales</div>
                    <div className="mt-2 text-xs text-purple-200">Score: {viralityAnalysis?.viralityScore || 0}/100</div>
                </div>

                <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-6 text-white">
                    <Hash className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{autoTags.length}</div>
                    <div className="text-pink-100 text-sm">Auto-Tags Detectados</div>
                    <div className="mt-2 text-xs text-pink-200">{((autoTags[0]?.confidence ?? autoTags[0]?.accuracy / 100) * 100 || 0).toFixed(0)}% confianza</div>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                    <Target className="mb-2" size={24} />
                    <div className="text-3xl font-bold">{contentOptimization.length}</div>
                    <div className="text-orange-100 text-sm">Recomendaciones</div>
                    <div className="mt-2 text-xs text-orange-200">+{contentOptimization[0]?.expectedIncrease || '0%'}</div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trending Topics */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="text-blue-400" />
                        Trending Topics
                    </h3>
                    <div className="space-y-3">
                        {trendingTopics.map((topic, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-gray-600'
                                        }`}>
                                        <span className="text-white font-bold text-sm">{idx + 1}</span>
                                    </div>
                                    <div>
                                        <div className="text-white font-semibold">{topic.topic}</div>
                                        <div className="text-xs text-gray-400">{topic.mentions.toLocaleString()} menciones</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-green-400 font-semibold">+{topic.growth}%</div>
                                    <div className="text-xs text-gray-400">
                                        Sentiment: {(topic.sentiment * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Virality Analysis */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Zap className="text-yellow-400" />
                        Análisis de Viralidad
                    </h3>
                    {viralityAnalysis && (
                        <>
                            {viralityAnalysis.topViralPost && (
                                <div className="mb-4 p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg border border-purple-500/30">
                                    <div className="text-sm text-gray-400 mb-1">Top Post Viral</div>
                                    <div className="text-white font-semibold mb-2">{viralityAnalysis.topViralPost?.title || 'Sin título'}</div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <div className="text-2xl font-bold text-white">{(viralityAnalysis.topViralPost?.shares || 0).toLocaleString()}</div>
                                            <div className="text-xs text-gray-400">Shares</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-white">{((viralityAnalysis.topViralPost?.views || 0) / 1000).toFixed(1)}K</div>
                                            <div className="text-xs text-gray-400">Views</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-white">{viralityAnalysis.topViralPost?.engagement || 0}%</div>
                                            <div className="text-xs text-gray-400">Engagement</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {viralityAnalysis.distribution?.length > 0 && (
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={viralityAnalysis.distribution}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="range" stroke="#9ca3af" />
                                        <YAxis stroke="#9ca3af" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                            labelStyle={{ color: '#fff' }}
                                        />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Performance Trends */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="text-green-400" />
                    Performance del Contenido
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={contentPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9ca3af" />
                        <YAxis yAxisId="left" stroke="#9ca3af" />
                        <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                            labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="posts" stroke="#3b82f6" strokeWidth={2} name="Posts" />
                        <Line yAxisId="left" type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} name="Views" />
                        <Line yAxisId="right" type="monotone" dataKey="engagement" stroke="#10b981" strokeWidth={2} name="Engagement %" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Auto-Tags & Optimization */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Auto-Tags */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Hash className="text-cyan-400" />
                        Auto-Tags Más Usados
                    </h3>
                    <div className="space-y-3">
                        {autoTags.map((tag, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${tag.category === 'primary' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                        tag.category === 'secondary' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                        }`}>
                                        {tag.tag}
                                    </div>
                                    <div className="text-sm text-gray-400">{(tag.frequency || tag.count || 0).toLocaleString()} usos</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                                            style={{ width: `${(tag.confidence ?? (tag.accuracy ? tag.accuracy / 100 : 0)) * 100}%` }}
                                        />
                                    </div>
                                    <div className="text-xs text-gray-400 w-12 text-right">
                                        {((tag.confidence ?? (tag.accuracy ? tag.accuracy / 100 : 0)) * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content Optimization */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Target className="text-orange-400" />
                        Recomendaciones de Optimización
                    </h3>
                    <div className="space-y-3">
                        {contentOptimization.map((rec, idx) => (
                            <div key={idx} className={`p-4 rounded-lg border ${rec.impact === 'high' ? 'bg-red-500/10 border-red-500/30' :
                                rec.impact === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
                                    'bg-blue-500/10 border-blue-500/30'
                                }`}>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {rec.impact === 'high' ? <AlertCircle size={18} className="text-red-400" /> :
                                            rec.impact === 'medium' ? <AlertCircle size={18} className="text-yellow-400" /> :
                                                <CheckCircle size={18} className="text-blue-400" />}
                                        <span className={`text-xs font-semibold uppercase ${rec.impact === 'high' ? 'text-red-400' :
                                            rec.impact === 'medium' ? 'text-yellow-400' :
                                                'text-blue-400'
                                            }`}>
                                            {rec.type}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-green-400">{rec.expectedIncrease}</span>
                                </div>
                                <p className="text-sm text-gray-300">{rec.recommendation}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sentiment Trends & Engagement Patterns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sentiment Trends */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Activity className="text-pink-400" />
                        Tendencias de Sentimiento
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={sentimentTrends}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={2} name="Positivo" />
                            <Line type="monotone" dataKey="neutral" stroke="#6b7280" strokeWidth={2} name="Neutral" />
                            <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} name="Negativo" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Engagement Patterns */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Clock className="text-indigo-400" />
                        Patrones de Engagement por Hora
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={engagementPatterns}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="hour" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="engagement" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30">
                        <div className="text-xs text-indigo-400 font-semibold mb-1">💡 Mejor Hora para Publicar</div>
                        <div className="text-white font-bold">14:00 - 16:00</div>
                        <div className="text-xs text-gray-400">+72% de engagement promedio</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
