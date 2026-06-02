/**
 * API Silenciosa para servicios de IA/ML/Analytics
 * NO HACE LLAMADAS REALES a endpoints que no existen.
 * Devuelve directamente datos mock para evitar errores 404 en consola.
 * 
 * Cuando los endpoints estén implementados en el backend,
 * se pueden habilitar removiendo el endpoint de MOCK_ONLY_ENDPOINTS.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Lista de endpoints que SOLO devuelven mock data (no hacen llamadas reales)
// Remover de esta lista cuando el backend implemente el endpoint
const MOCK_ONLY_ENDPOINTS = new Set([
    '/api/ai/chat/stats',
    '/api/local-ai/ml/stats',
    '/api/aegis/stats',
    '/api/content-intelligence/trends',
    '/api/content-intelligence/virality-predictions',
    '/api/content-intelligence/sentiment-analysis',
    '/api/content-intelligence/content-clusters',
    '/api/content-intelligence/topic-evolution',
    '/api/content-intelligence/engagement-heatmap',
    '/api/content-intelligence/content-lifecycle',
    '/api/user-behavior/active-sessions',
    '/api/user-behavior/conversion-funnels',
    '/api/user-behavior/retention-cohorts',
    '/api/user-behavior/segments',
    '/api/user-behavior/journey-maps',
    '/api/user-behavior/predictive-churn',
    '/api/user-behavior/engagement-patterns',
    '/api/user-behavior/ltv-analysis',
    '/api/ab-testing/experiments',
    '/api/ab-testing/feature-flags',
    '/api/data-pipeline/streams',
    '/api/data-pipeline/etl-jobs',
    '/api/data-pipeline/data-quality',
    '/api/data-pipeline/storage-metrics',
    '/api/data-pipeline/processing-metrics',
    '/api/ml-training/jobs',
    '/api/ml-training/models'
]);

// Cache para endpoints que fallaron en llamadas reales
const failedEndpoints = new Map();
const CACHE_DURATION = 300000; // 5 minutos

/**
 * Realiza una petición silenciosa - devuelve mock data para endpoints no implementados
 */
export const silentFetch = async (endpoint, fallbackData = null) => {
    // Si el endpoint está en la lista de mock-only, devolver mock directamente
    if (MOCK_ONLY_ENDPOINTS.has(endpoint)) {
        return { data: fallbackData, fromMock: true, isError: false };
    }

    const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

    // Verificar si este endpoint falló recientemente
    const cacheKey = endpoint;
    const cached = failedEndpoints.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return { data: fallbackData, fromCache: true, isError: true };
    }

    try {
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            // Cachear el fallo silenciosamente
            failedEndpoints.set(cacheKey, { timestamp: Date.now() });
            // Añadir a mock-only para futuras llamadas
            MOCK_ONLY_ENDPOINTS.add(endpoint);
            return { data: fallbackData, isError: true, status: response.status };
        }

        const data = await response.json();
        return { data, isError: false };
    } catch (error) {
        // Cachear el fallo silenciosamente
        failedEndpoints.set(cacheKey, { timestamp: Date.now() });
        // Añadir a mock-only para futuras llamadas
        MOCK_ONLY_ENDPOINTS.add(endpoint);
        return { data: fallbackData, isError: true, error: error.message };
    }
};

/**
 * Limpia el cache de endpoints fallidos
 */
export const clearFailedEndpointsCache = () => {
    failedEndpoints.clear();
};

// ============================================
// DATOS MOCK PARA SERVICIOS DE IA
// ============================================

export const mockData = {
    // AI Chat Stats
    aiChatStats: {
        conversationsToday: 127,
        tokensUsed: 45890,
        healthScore: 92,
        avgResponseTime: 1.2,
        satisfaction: 4.6
    },

    // ML Stats
    mlStats: {
        modelsActive: 5,
        predictionsToday: 3456,
        accuracy: 94.5,
        models: {
            sentiment: { totalAnalysis: 12453, accuracy: 89.2 },
            classification: { totalClassifications: 8976, accuracy: 91.5 },
            recommendations: { totalGenerated: 23456, relevanceScore: 0.87 }
        }
    },

    // Aegis Stats
    aegisStats: {
        activeDefenses: 8,
        threatsBlocked: 234,
        securityScore: 96,
        lastScan: new Date().toISOString()
    },

    // Content Intelligence
    contentTrends: [
        { topic: '#Web3', mentions: 1543, growth: 45.2, sentiment: 0.82 },
        { topic: '#NFT', mentions: 1234, growth: 32.1, sentiment: 0.75 },
        { topic: '#Blockchain', mentions: 987, growth: 28.5, sentiment: 0.88 },
        { topic: '#DeFi', mentions: 856, growth: 22.3, sentiment: 0.79 },
        { topic: '#Metaverse', mentions: 743, growth: 18.7, sentiment: 0.71 }
    ],

    contentPerformance: [
        { date: '2026-01-20', posts: 120, views: 5400, engagement: 23.5 },
        { date: '2026-01-21', posts: 135, views: 6200, engagement: 26.8 },
        { date: '2026-01-22', posts: 142, views: 6800, engagement: 29.2 },
        { date: '2026-01-23', posts: 158, views: 7500, engagement: 31.5 },
        { date: '2026-01-24', posts: 165, views: 8200, engagement: 34.8 },
        { date: '2026-01-25', posts: 178, views: 8900, engagement: 37.2 },
        { date: '2026-01-26', posts: 185, views: 9500, engagement: 39.5 }
    ],

    viralityAnalysis: {
        viralPosts: 23,
        avgViralityScore: 7.8,
        viralityScore: 78.5,
        averageShareRate: 4.2,
        peakHours: [9, 12, 18, 21],
        topFormats: ['video', 'carousel', 'image'],
        viralFactors: {
            timing: 0.35,
            content: 0.40,
            engagement: 0.25
        },
        topViralPost: {
            id: 'post_mock_001',
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
    },

    autoTags: [
        { tag: 'crypto', count: 2456, frequency: 2456, accuracy: 94.5, confidence: 0.945, category: 'primary' },
        { tag: 'tutorial', count: 1876, frequency: 1876, accuracy: 91.2, confidence: 0.912, category: 'primary' },
        { tag: 'news', count: 1654, frequency: 1654, accuracy: 89.8, confidence: 0.898, category: 'secondary' },
        { tag: 'meme', count: 1234, frequency: 1234, accuracy: 87.5, confidence: 0.875, category: 'secondary' },
        { tag: 'analysis', count: 987, frequency: 987, accuracy: 92.1, confidence: 0.921, category: 'tertiary' }
    ],

    // User Behavior
    userSegments: [
        { name: 'Power Users', count: 543, percentage: 15.2, avgEngagement: 89, color: '#10b981' },
        { name: 'Active Users', count: 1234, percentage: 34.5, avgEngagement: 65, color: '#3b82f6' },
        { name: 'Casual Users', count: 987, percentage: 27.6, avgEngagement: 42, color: '#8b5cf6' },
        { name: 'At Risk', count: 456, percentage: 12.8, avgEngagement: 18, color: '#f59e0b' },
        { name: 'Churned', count: 358, percentage: 10.0, avgEngagement: 3, color: '#ef4444' }
    ],

    churnPrediction: {
        totalUsers: 3578,
        atRiskUsers: 456,
        churnProbability: 12.8,
        churnRate: 12.8,
        predictedChurn: 523,
        predictedChurn30d: 89,
        preventionRate: 68.5,
        retentionActions: ['Email Campaign', 'Push Notifications', 'Incentives'],
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
    },

    // AB Testing
    experiments: [
        {
            id: 'exp_001',
            name: 'New Feed Algorithm',
            description: 'Test de nuevo algoritmo de ordenamiento de feed',
            status: 'running',
            startDate: '2026-01-01',
            variants: [
                { name: 'Control', traffic: 50, users: 1543, conversions: 892, conversionRate: 57.8 },
                { name: 'Variant A', traffic: 50, users: 1521, conversions: 945, conversionRate: 62.1 }
            ]
        }
    ],

    featureFlags: [
        { id: 'ff_001', name: 'new_onboarding', enabled: true, rollout: 100 },
        { id: 'ff_002', name: 'dark_mode_v2', enabled: true, rollout: 50 },
        { id: 'ff_003', name: 'ai_recommendations', enabled: false, rollout: 0 }
    ],

    // Data Pipeline
    pipelines: [
        {
            id: 'pipeline_001',
            name: 'User Activity ETL',
            status: 'running',
            lastRun: new Date().toISOString(),
            duration: 245,
            recordsProcessed: 543829,
            successRate: 99.8,
            schedule: '*/15 * * * *'
        },
        {
            id: 'pipeline_002',
            name: 'Content Analysis Pipeline',
            status: 'running',
            lastRun: new Date().toISOString(),
            duration: 180,
            recordsProcessed: 234567,
            successRate: 99.5,
            schedule: '*/30 * * * *'
        }
    ],

    dataQuality: {
        overallScore: 94.5,
        completeness: 96.2,
        accuracy: 93.8,
        consistency: 95.1,
        timeliness: 92.9,
        dimensions: [
            { name: 'Completeness', score: 96.2, issues: 234 },
            { name: 'Accuracy', score: 93.8, issues: 456 },
            { name: 'Consistency', score: 95.1, issues: 189 },
            { name: 'Timeliness', score: 92.9, issues: 123 },
            { name: 'Validity', score: 94.1, issues: 345 }
        ],
        trend: [
            { date: '2026-01-20', score: 92.1 },
            { date: '2026-01-21', score: 93.4 },
            { date: '2026-01-22', score: 93.8 },
            { date: '2026-01-23', score: 94.2 },
            { date: '2026-01-24', score: 94.7 },
            { date: '2026-01-25', score: 94.3 },
            { date: '2026-01-26', score: 94.5 }
        ]
    },

    // ML Training
    trainingJobs: [
        {
            id: 'job_001',
            name: 'Sentiment Model v2.3',
            status: 'completed',
            progress: 100,
            accuracy: 94.5,
            duration: 3600
        }
    ],

    trainedModels: [
        { id: 'model_001', name: 'SentimentAnalyzer', version: '2.3', accuracy: 94.5, status: 'active' },
        { id: 'model_002', name: 'ContentClassifier', version: '1.8', accuracy: 91.2, status: 'active' }
    ]
};

// ============================================
// FUNCIONES DE API CON FALLBACK AUTOMÁTICO
// ============================================

export const aiApi = {
    // Chat Stats
    getChatStats: () => silentFetch('/api/ai/chat/stats', mockData.aiChatStats),

    // ML Stats
    getMlStats: () => silentFetch('/api/local-ai/ml/stats', mockData.mlStats),

    // Aegis Stats
    getAegisStats: () => silentFetch('/api/aegis/stats', mockData.aegisStats),

    // Agents
    getAgents: () => silentFetch('/api/ai/agents', []),

    // Models
    getModels: () => silentFetch('/api/ai/models', []),

    // Tools
    getTools: () => silentFetch('/api/ai/tools', { tools: [] }),

    // Content Intelligence
    getContentTrends: (range = '7d') =>
        silentFetch(`/api/content-intelligence/trending?range=${range}`, mockData.contentTrends),

    getContentPerformance: (range = '7d') =>
        silentFetch(`/api/content-intelligence/performance?range=${range}`, mockData.contentPerformance),

    getViralityAnalysis: (range = '7d') =>
        silentFetch(`/api/content-intelligence/virality?range=${range}`, mockData.viralityAnalysis),

    getAutoTags: (range = '7d') =>
        silentFetch(`/api/content-intelligence/auto-tags?range=${range}`, mockData.autoTags),

    getContentOptimization: (range = '7d') =>
        silentFetch(`/api/content-intelligence/optimization?range=${range}`, []),

    getSentimentTrends: (range = '7d') =>
        silentFetch(`/api/content-intelligence/sentiment-trends?range=${range}`, []),

    getEngagementPatterns: (range = '7d') =>
        silentFetch(`/api/content-intelligence/engagement-patterns?range=${range}`, []),

    // User Behavior
    getUserSegments: (range = '30d') =>
        silentFetch(`/api/user-behavior/segments?range=${range}`, mockData.userSegments),

    getChurnPrediction: (range = '30d') =>
        silentFetch(`/api/user-behavior/churn-prediction?range=${range}`, mockData.churnPrediction),

    getEngagementScore: (range = '30d') =>
        silentFetch(`/api/user-behavior/engagement-score?range=${range}`, []),

    getUserJourney: (range = '30d') =>
        silentFetch(`/api/user-behavior/journey?range=${range}`, []),

    getCohortAnalysis: (range = '30d') =>
        silentFetch(`/api/user-behavior/cohort?range=${range}`, []),

    getLifetimeValue: (range = '30d') =>
        silentFetch(`/api/user-behavior/ltv?range=${range}`, []),

    getBehaviorPatterns: (range = '30d') =>
        silentFetch(`/api/user-behavior/patterns?range=${range}`, []),

    getRetentionMetrics: (range = '30d') =>
        silentFetch(`/api/user-behavior/retention?range=${range}`, { retention7d: 75, retention30d: 45 }),

    // AB Testing
    getExperiments: () =>
        silentFetch('/api/ab-testing/experiments', mockData.experiments),

    getFeatureFlags: () =>
        silentFetch('/api/ab-testing/feature-flags', mockData.featureFlags),

    // Data Pipeline
    getPipelines: () =>
        silentFetch('/api/data-pipeline/pipelines', mockData.pipelines),

    getDataQuality: () =>
        silentFetch('/api/data-pipeline/quality', mockData.dataQuality),

    getModelPerformance: () =>
        silentFetch('/api/data-pipeline/model-performance', []),

    getAlerts: () =>
        silentFetch('/api/data-pipeline/alerts', []),

    getSystemMetrics: () =>
        silentFetch('/api/data-pipeline/system-metrics', { cpu: 45, memory: 62, disk: 38 }),

    // ML Training
    getTrainingJobs: () =>
        silentFetch('/api/ml-training/jobs', mockData.trainingJobs),

    getTrainedModels: () =>
        silentFetch('/api/ml-training/models', mockData.trainedModels)
};

export default aiApi;
