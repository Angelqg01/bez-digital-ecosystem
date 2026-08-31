import React, { useState, useEffect } from 'react';
import { Brain, MessageSquare, Tag, Award, TrendingUp, Sparkles, Loader2, CheckCircle2, AlertCircle, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LocalAIPage = () => {
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState('sentiment');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // State for inputs
    const [sentimentText, setSentimentText] = useState('');
    const [contentText, setContentText] = useState('');
    const [targetAddress, setTargetAddress] = useState('');

    // Update address when wallet connects
    useEffect(() => {
        if (isConnected && address) {
            setTargetAddress(address);
        }
    }, [address, isConnected]);

    // Helper function for API calls
    const callAIEndpoint = async (endpoint, body) => {
        setLoading(true);
        setResult(null);
        try {
            const response = await fetch(`${API_URL}/api/local-ai/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            setResult({ type: endpoint, data });
            toast.success('Análisis completado con éxito');
        } catch (error) {
            console.error("AI Error:", error);
            setResult({ error: error.message });
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const analyzeSentiment = () => callAIEndpoint('analyze-sentiment', { text: sentimentText });

    const classifyContent = () => callAIEndpoint('classify-content', { text: contentText });

    const getRecommendations = () => callAIEndpoint('recommend', {
        userAddress: targetAddress,
        context: { preferences: ['blockchain', 'web3', 'defi', 'nft'] }
    });

    const learnFromBehavior = () => callAIEndpoint('learn', {
        userAddress: targetAddress,
        behaviorData: {
            likes: ['post_123', 'post_456', 'nft_789'],
            views: ['article_blockchain', 'tutorial_defi'],
            interactions: ['user_vitalik', 'user_satoshi']
        }
    });

    // Render result based on type
    const renderResult = () => {
        if (!result) return null;
        if (result.error) {
            return (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-800 dark:text-red-300">Error en el análisis</h4>
                        <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
                    </div>
                </div>
            );
        }

        const { type, data } = result;

        return (
            <div className="mt-8 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Resultados del Análisis</h3>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    {/* Header del resultado */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-xs font-mono uppercase text-gray-500 dark:text-gray-400">
                            Endpoint: /api/local-ai/{type}
                        </span>
                    </div>

                    {/* Contenido del resultado formateado */}
                    <div className="p-6">
                        {type === 'analyze-sentiment' && (
                            <div className="flex items-center gap-4">
                                <div className={`text-4xl font-bold ${data.score > 0 ? 'text-green-500' : data.score < 0 ? 'text-red-500' : 'text-gray-500'
                                    }`}>
                                    {data.sentiment || 'Neutral'}
                                </div>
                                <div className="text-sm text-gray-500">
                                    Score: <span className="font-mono font-bold">{data.score}</span>
                                </div>
                            </div>
                        )}

                        {type === 'classify-content' && (
                            <div className="flex flex-wrap gap-2">
                                {data.categories?.map((cat, i) => (
                                    <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                                        {cat}
                                    </span>
                                )) || <span className="text-gray-500">Sin categorías detectadas</span>}
                            </div>
                        )}

                        {/* Fallback para otros tipos o vista raw detallada */}
                        <div className="mt-4 bg-gray-50 dark:bg-black/30 rounded-lg p-4 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                            {JSON.stringify(data, null, 2)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/20">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                        IA Local de BeZhas
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        Inteligencia artificial soberana que aprende de tu comportamiento sin comprometer tu privacidad.
                    </p>
                </div>

                {/* Tabs */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-2 mb-8 border border-gray-100 dark:border-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { id: 'sentiment', icon: MessageSquare, label: 'Sentimientos' },
                            { id: 'classify', icon: Tag, label: 'Clasificar' },
                            { id: 'recommend', icon: Award, label: 'Recomendar' },
                            { id: 'learn', icon: TrendingUp, label: 'Aprender' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setResult(null); }}
                                className={`flex items-center justify-center gap-2 p-4 rounded-xl transition-all duration-200 ${activeTab === tab.id
                                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg transform scale-[1.02]'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 min-h-[400px]">

                    {/* Sentiment Analysis */}
                    {activeTab === 'sentiment' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Análisis de Sentimientos
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Detecta el tono emocional de cualquier texto (positivo, negativo, neutral) para moderación o análisis de mercado.
                                </p>
                            </div>
                            <textarea
                                value={sentimentText}
                                onChange={(e) => setSentimentText(e.target.value)}
                                placeholder="Ej: ¡Me encanta cómo funciona la nueva feature de staking! Es increíble."
                                className="w-full h-40 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none transition-all"
                            />
                            <button
                                onClick={analyzeSentiment}
                                disabled={loading || !sentimentText.trim()}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-medium hover:shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                {loading ? 'Analizando...' : 'Analizar Sentimiento'}
                            </button>
                        </div>
                    )}

                    {/* Content Classification */}
                    {activeTab === 'classify' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Clasificación de Contenido
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Categoriza automáticamente textos para organizar feeds, detectar spam o etiquetar contenido.
                                </p>
                            </div>
                            <textarea
                                value={contentText}
                                onChange={(e) => setContentText(e.target.value)}
                                placeholder="Ej: El precio de Bitcoin ha subido un 5% hoy debido a las nuevas regulaciones..."
                                className="w-full h-40 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none transition-all"
                            />
                            <button
                                onClick={classifyContent}
                                disabled={loading || !contentText.trim()}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-medium hover:shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Tag className="w-5 h-5" />}
                                {loading ? 'Clasificando...' : 'Clasificar Contenido'}
                            </button>
                        </div>
                    )}

                    {/* Recommendations */}
                    {activeTab === 'recommend' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Recomendaciones Personalizadas
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Genera sugerencias de contenido basadas en el perfil on-chain y preferencias del usuario.
                                </p>
                            </div>

                            <div className="relative">
                                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    value={targetAddress}
                                    onChange={(e) => setTargetAddress(e.target.value)}
                                    placeholder="Dirección de wallet (0x...)"
                                    className="w-full pl-12 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono"
                                />
                            </div>

                            {!isConnected && (
                                <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Conecta tu wallet para autocompletar tu dirección.
                                </div>
                            )}

                            <button
                                onClick={getRecommendations}
                                disabled={loading || !targetAddress}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-medium hover:shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Award className="w-5 h-5" />}
                                {loading ? 'Generando...' : 'Obtener Recomendaciones'}
                            </button>
                        </div>
                    )}

                    {/* Learning System */}
                    {activeTab === 'learn' && (
                        <div className="space-y-6 animate-fade-in">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Entrenamiento de Modelo
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Simula el proceso de aprendizaje federado donde el modelo mejora con tus interacciones locales.
                                </p>
                            </div>

                            <div className="relative">
                                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    value={targetAddress}
                                    onChange={(e) => setTargetAddress(e.target.value)}
                                    placeholder="Dirección de wallet (0x...)"
                                    className="w-full pl-12 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono"
                                />
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-6">
                                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Datos de comportamiento simulados
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                                        <span className="block text-gray-500 text-xs uppercase">Interacciones</span>
                                        <span className="font-bold text-lg text-gray-900 dark:text-white">15 Likes</span>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                                        <span className="block text-gray-500 text-xs uppercase">Consumo</span>
                                        <span className="font-bold text-lg text-gray-900 dark:text-white">47 Vistas</span>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                                        <span className="block text-gray-500 text-xs uppercase">Intereses</span>
                                        <span className="font-bold text-lg text-gray-900 dark:text-white">DeFi, NFTs</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={learnFromBehavior}
                                disabled={loading || !targetAddress}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-medium hover:shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                                {loading ? 'Entrenando...' : 'Ejecutar Aprendizaje Local'}
                            </button>
                        </div>
                    )}

                    {/* Results Section */}
                    {renderResult()}
                </div>

                {/* Info Cards */}
                <div className="grid md:grid-cols-2 gap-6 mt-8">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            Privacidad Preservada
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            Tus datos personales nunca abandonan tu dispositivo. El modelo se entrena localmente y solo comparte los pesos actualizados (gradientes) de forma encriptada.
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            Latencia Cero
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            Al ejecutarse en el borde (Edge AI), obtienes respuestas instantáneas sin depender de la congestión de la red o servidores centrales lentos.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LocalAIPage;
