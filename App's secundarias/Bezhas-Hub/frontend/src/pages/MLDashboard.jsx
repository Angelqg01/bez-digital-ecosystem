import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, MessageSquare, Activity, Sparkles, Target, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

/**
 * MLDashboard - Panel de control para Machine Learning
 * Permite probar y visualizar los servicios de ML local
 */
const MLDashboard = () => {
    const [mlStats, setMlStats] = useState(null);
    const [sentimentResult, setSentimentResult] = useState(null);
    const [classificationResult, setClassificationResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [testText, setTestText] = useState('');
    const [isDemoMode, setIsDemoMode] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || '/api';

    // Cargar estadísticas de ML al montar
    useEffect(() => {
        fetchMLStats();
    }, []);

    const fetchMLStats = async () => {
        try {
            const response = await fetch(`${API_URL}/local-ai/ml/stats`);
            if (!response.ok) throw new Error('API unreachable');
            const data = await response.json();
            if (data.success) {
                setMlStats(data.models);
                setIsDemoMode(false);
            }
        } catch (error) {
            console.warn('Error fetching ML stats, switching to Demo Mode:', error);
            setIsDemoMode(true);
            // Mock Stats
            setMlStats({
                sentiment: { totalAnalysis: 1245, active: true },
                classification: { totalClassifications: 892, active: true },
                recommendations: { totalGenerated: 3450, active: true }
            });
            toast.error("Backend ML no disponible. Modo Demo activado.", {
                icon: '⚠️',
                style: {
                    borderRadius: '10px',
                    background: '#333',
                    color: '#fff',
                },
            });
        }
    };

    const analyzeSentiment = async () => {
        if (!testText.trim()) return;

        setLoading(true);
        try {
            if (isDemoMode) {
                // Simulate API delay
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Simple mock logic based on keywords
                const text = testText.toLowerCase();
                let score = 0;
                let label = 'Neutral';

                if (text.match(/bien|buen|excelente|amor|feliz|gusta|increible/)) {
                    score = 0.8;
                    label = 'Positivo';
                } else if (text.match(/mal|odio|triste|feo|terrible|error/)) {
                    score = -0.8;
                    label = 'Negativo';
                }

                setSentimentResult({
                    score: score,
                    label: label,
                    confidence: 0.95
                });
                toast.success("Análisis completado (Demo)");
            } else {
                const response = await fetch(`${API_URL}/local-ai/ml/sentiment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: testText })
                });

                const data = await response.json();
                if (data.success) {
                    setSentimentResult(data.sentiment);
                    toast.success("Análisis completado");
                } else {
                    throw new Error(data.message || "Error en análisis");
                }
            }
        } catch (error) {
            console.error('Error analyzing sentiment:', error);
            toast.error("Error al analizar sentimiento");
        } finally {
            setLoading(false);
        }
    };

    const classifyContent = async () => {
        if (!testText.trim()) return;

        setLoading(true);
        try {
            if (isDemoMode) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Mock classification
                setClassificationResult({
                    primaryCategory: "Tecnología",
                    categories: [
                        { name: "Tecnología", score: 0.85 },
                        { name: "Educación", score: 0.45 },
                        { name: "Negocios", score: 0.20 }
                    ]
                });
                toast.success("Clasificación completada (Demo)");
            } else {
                const response = await fetch(`${API_URL}/local-ai/ml/classify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: testText })
                });

                const data = await response.json();
                if (data.success) {
                    setClassificationResult(data.classification);
                    toast.success("Clasificación completada");
                } else {
                    throw new Error(data.message || "Error en clasificación");
                }
            }
        } catch (error) {
            console.error('Error classifying content:', error);
            toast.error("Error al clasificar contenido");
        } finally {
            setLoading(false);
        }
    };

    const getSentimentColor = (score) => {
        if (score > 0.3) return 'text-green-600 bg-green-100';
        if (score < -0.3) return 'text-red-600 bg-red-100';
        return 'text-gray-600 bg-gray-100';
    };

    const getSentimentEmoji = (score) => {
        if (score > 0.5) return '😊';
        if (score > 0.2) return '🙂';
        if (score > -0.2) return '😐';
        if (score > -0.5) return '😕';
        return '😢';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-8">
            <Toaster position="top-right" />
            <div className="container mx-auto px-4 max-w-7xl">
                {/* Header */}
                <div className="mb-8 flex justify-between items-start">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl">
                            <Brain className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Machine Learning Dashboard
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                Sistema de IA Local - Análisis y Clasificación de Contenido
                            </p>
                        </div>
                    </div>
                    {isDemoMode && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full border border-yellow-200 dark:border-yellow-800">
                            <AlertTriangle size={18} />
                            <span className="text-sm font-medium">Modo Demo (Backend Offline)</span>
                        </div>
                    )}
                </div>

                {/* ML Stats Cards */}
                {mlStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <Activity className="w-8 h-8 text-blue-500" />
                                <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                    ACTIVO
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Análisis de Sentimiento
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Detecta emociones en texto usando NLP
                            </p>
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="text-2xl font-bold text-blue-600">
                                    {mlStats.sentiment?.totalAnalysis || 0}
                                </div>
                                <div className="text-xs text-gray-500">Análisis realizados</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <Target className="w-8 h-8 text-purple-500" />
                                <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                                    ACTIVO
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Clasificación
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Categoriza contenido automáticamente
                            </p>
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="text-2xl font-bold text-purple-600">
                                    {mlStats.classification?.totalClassifications || 0}
                                </div>
                                <div className="text-xs text-gray-500">Clasificaciones</div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <Sparkles className="w-8 h-8 text-green-500" />
                                <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
                                    ACTIVO
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Recomendaciones
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Personalización basada en preferencias
                            </p>
                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div className="text-2xl font-bold text-green-600">
                                    {mlStats.recommendations?.totalGenerated || 0}
                                </div>
                                <div className="text-xs text-gray-500">Recomendaciones</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Test Area */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Input Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-5 h-5 text-indigo-600" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Probar ML en Tiempo Real
                            </h2>
                        </div>

                        <textarea
                            value={testText}
                            onChange={(e) => setTestText(e.target.value)}
                            placeholder="Escribe un texto para analizar su sentimiento y clasificación..."
                            className="w-full h-40 p-4 border border-gray-200 dark:border-gray-700 rounded-xl 
                                     bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white
                                     focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                                     resize-none"
                        />

                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={analyzeSentiment}
                                disabled={!testText.trim() || loading}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 
                                         text-white font-semibold rounded-xl hover:shadow-lg
                                         disabled:opacity-50 disabled:cursor-not-allowed
                                         transition-all duration-200"
                            >
                                {loading ? 'Analizando...' : 'Analizar Sentimiento'}
                            </button>

                            <button
                                onClick={classifyContent}
                                disabled={!testText.trim() || loading}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 
                                         text-white font-semibold rounded-xl hover:shadow-lg
                                         disabled:opacity-50 disabled:cursor-not-allowed
                                         transition-all duration-200"
                            >
                                {loading ? 'Clasificando...' : 'Clasificar Contenido'}
                            </button>
                        </div>

                        {/* Quick Examples */}
                        <div className="mt-4 space-y-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                Ejemplos rápidos:
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    'Me encanta este producto, es increíble! 😊',
                                    'Esto es terrible, muy decepcionante 😞',
                                    'Tutorial de programación en JavaScript',
                                    'Receta deliciosa de pasta italiana'
                                ].map((example, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setTestText(example)}
                                        className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 
                                                 text-gray-700 dark:text-gray-300 rounded-lg
                                                 hover:bg-gray-200 dark:hover:bg-gray-600
                                                 transition-colors"
                                    >
                                        {example.substring(0, 30)}...
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Results Section */}
                    <div className="space-y-6">
                        {/* Sentiment Result */}
                        {sentimentResult && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <TrendingUp className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Análisis de Sentimiento
                                    </h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-6xl">
                                            {getSentimentEmoji(sentimentResult.score)}
                                        </span>
                                        <div className={`px-4 py-2 rounded-xl font-bold text-lg ${getSentimentColor(sentimentResult.score)}`}>
                                            {sentimentResult.label}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Puntuación</span>
                                            <span className="font-bold text-gray-900 dark:text-white">
                                                {(sentimentResult.score * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${sentimentResult.score > 0 ? 'bg-green-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${Math.abs(sentimentResult.score) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Confianza: {(sentimentResult.confidence * 100).toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Classification Result */}
                        {classificationResult && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-2 mb-4">
                                    <Target className="w-5 h-5 text-purple-600" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Clasificación de Contenido
                                    </h3>
                                </div>

                                <div className="space-y-3">
                                    {classificationResult.categories && classificationResult.categories.map((cat, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                    {cat.name}
                                                </span>
                                                <span className="text-purple-600 font-bold">
                                                    {(cat.score * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                                                    style={{ width: `${cat.score * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {classificationResult.primaryCategory && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            Categoría Principal:
                                        </div>
                                        <div className="text-lg font-bold text-purple-600 mt-1">
                                            {classificationResult.primaryCategory}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Help Message */}
                        {!sentimentResult && !classificationResult && (
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 
                                          rounded-2xl p-6 border border-indigo-100 dark:border-gray-600">
                                <Brain className="w-12 h-12 text-indigo-600 mb-3" />
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                    Prueba el Sistema de ML
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Escribe un texto en el área de entrada y usa los botones para analizar
                                    su sentimiento o clasificar su contenido. Los resultados aparecerán aquí.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Info Footer */}
                <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                        Acerca del Sistema de ML
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                🧠 Natural Language Processing
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Análisis de texto sin dependencias externas, procesamiento local y privado.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                ⚡ Tiempo Real
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Análisis instantáneo con modelos optimizados para baja latencia.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                                🔒 Privacidad
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Todo el procesamiento se realiza localmente, sin enviar datos a terceros.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MLDashboard;
