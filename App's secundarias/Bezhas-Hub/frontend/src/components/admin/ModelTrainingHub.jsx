import React, { useState, useEffect, useRef } from 'react';
import {
    Brain,
    Play,
    Pause,
    StopCircle,
    TrendingUp,
    Settings,
    Download,
    Upload,
    RefreshCw,
    CheckCircle,
    Clock,
    BarChart3,
    Zap,
    Award,
    GitBranch,
    Archive
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import aiApi, { mockData } from '../../services/aiApi';

/**
 * ModelTrainingHub - Hub de entrenamiento de modelos ML
 * Training interface, hyperparameter tuning, versioning, comparison
 */
export default function ModelTrainingHub() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('training'); // training, models, comparison

    const [trainingJobs, setTrainingJobs] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedModels, setSelectedModels] = useState([]);
    const [comparisonData, setComparisonData] = useState(null);

    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) return;
        mounted.current = true;
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [jobsRes, modelsRes] = await Promise.all([
                aiApi.getTrainingJobs(),
                aiApi.getTrainedModels()
            ]);

            setTrainingJobs(jobsRes.data?.jobs || jobsRes.data || mockData.trainingJobs);
            setModels(modelsRes.data?.models || modelsRes.data || mockData.trainedModels);
        } catch (error) {
            // Silenciado - usar datos mock
            setTrainingJobs(mockData.trainingJobs);
            setModels(mockData.trainedModels);
        } finally {
            setLoading(false);
        }
    };

    const generateMockJobs = () => ([
        {
            id: 'job_001',
            modelName: 'Sentiment Analyzer v2.1',
            status: 'running',
            progress: 67,
            startTime: '2025-11-12T10:00:00Z',
            estimatedCompletion: '2025-11-12T16:00:00Z',
            currentEpoch: 134,
            totalEpochs: 200,
            metrics: {
                accuracy: 89.5,
                loss: 0.245,
                valAccuracy: 87.2,
                valLoss: 0.312
            },
            hyperparameters: {
                learningRate: 0.001,
                batchSize: 32,
                optimizer: 'Adam',
                layers: 5
            }
        },
        {
            id: 'job_002',
            modelName: 'Content Classifier v3.0',
            status: 'queued',
            progress: 0,
            queuePosition: 2,
            hyperparameters: {
                learningRate: 0.0005,
                batchSize: 64,
                optimizer: 'SGD',
                layers: 8
            }
        },
        {
            id: 'job_003',
            modelName: 'Recommendation Engine v1.5',
            status: 'completed',
            progress: 100,
            startTime: '2025-11-11T14:00:00Z',
            completionTime: '2025-11-12T02:00:00Z',
            metrics: {
                accuracy: 92.3,
                loss: 0.187,
                valAccuracy: 90.1,
                valLoss: 0.223
            },
            hyperparameters: {
                learningRate: 0.002,
                batchSize: 128,
                optimizer: 'Adam',
                layers: 12
            }
        }
    ]);

    const generateMockModels = () => ([
        {
            id: 'model_001',
            name: 'Sentiment Analyzer',
            version: '2.0',
            type: 'Classification',
            status: 'production',
            accuracy: 89.2,
            precision: 87.5,
            recall: 91.3,
            f1Score: 89.3,
            deployedDate: '2025-11-01',
            size: '145MB',
            inferenceTime: 45,
            trainingData: '500K samples'
        },
        {
            id: 'model_002',
            name: 'Content Classifier',
            version: '2.5',
            type: 'Multi-class',
            status: 'production',
            accuracy: 92.7,
            precision: 91.2,
            recall: 93.8,
            f1Score: 92.5,
            deployedDate: '2025-10-28',
            size: '234MB',
            inferenceTime: 38,
            trainingData: '1M samples'
        },
        {
            id: 'model_003',
            name: 'Recommendation Engine',
            version: '1.4',
            type: 'Collaborative Filtering',
            status: 'staging',
            accuracy: 85.4,
            precision: 83.7,
            recall: 87.9,
            f1Score: 85.7,
            deployedDate: '2025-11-10',
            size: '567MB',
            inferenceTime: 125,
            trainingData: '2.5M samples'
        },
        {
            id: 'model_004',
            name: 'Churn Predictor',
            version: '1.1',
            type: 'Binary Classification',
            status: 'archived',
            accuracy: 87.9,
            precision: 86.2,
            recall: 89.1,
            f1Score: 87.6,
            deployedDate: '2025-10-15',
            size: '98MB',
            inferenceTime: 67,
            trainingData: '300K samples'
        }
    ]);

    const getStatusColor = (status) => {
        const colors = {
            running: 'bg-green-500/20 text-green-400 border-green-500/30',
            queued: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            failed: 'bg-red-500/20 text-red-400 border-red-500/30',
            production: 'bg-green-500/20 text-green-400 border-green-500/30',
            staging: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };
        return colors[status] || colors.queued;
    };

    const toggleModelSelection = (modelId) => {
        setSelectedModels(prev =>
            prev.includes(modelId)
                ? prev.filter(id => id !== modelId)
                : [...prev, modelId]
        );
    };

    const compareModels = () => {
        if (selectedModels.length < 2) return;

        const selectedModelData = models.filter(m => selectedModels.includes(m.id));
        setComparisonData({
            models: selectedModelData,
            radarData: [
                {
                    metric: 'Accuracy',
                    ...Object.fromEntries(selectedModelData.map((m, idx) => [`model${idx + 1}`, m.accuracy]))
                },
                {
                    metric: 'Precision',
                    ...Object.fromEntries(selectedModelData.map((m, idx) => [`model${idx + 1}`, m.precision]))
                },
                {
                    metric: 'Recall',
                    ...Object.fromEntries(selectedModelData.map((m, idx) => [`model${idx + 1}`, m.recall]))
                },
                {
                    metric: 'F1-Score',
                    ...Object.fromEntries(selectedModelData.map((m, idx) => [`model${idx + 1}`, m.f1Score]))
                }
            ]
        });
        setActiveTab('comparison');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-400">Cargando training hub...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Brain className="text-purple-400" />
                        Model Training Hub
                    </h2>
                    <p className="text-gray-400">Entrenamiento, versionado y comparación de modelos ML</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={loadAllData}
                        className="p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <RefreshCw size={20} className="text-white" />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                        <Play size={18} className="text-white" />
                        <span className="text-white font-semibold">Nuevo Training Job</span>
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-2">
                <div className="flex gap-2">
                    {[
                        { id: 'training', label: 'Training Jobs', icon: Play },
                        { id: 'models', label: 'Modelo Registry', icon: Archive },
                        { id: 'comparison', label: 'Comparación', icon: BarChart3 }
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

            {/* Training Jobs Tab */}
            {activeTab === 'training' && (
                <div className="space-y-6">
                    {trainingJobs.map(job => (
                        <div key={job.id} className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{job.modelName}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(job.status)}`}>
                                            {(job.status || 'unknown').toUpperCase()}
                                        </span>
                                        {job.status === 'running' && (
                                            <span className="text-sm text-gray-400">
                                                Época {job.currentEpoch}/{job.totalEpochs}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {job.status === 'running' && (
                                        <>
                                            <button className="p-2 bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors">
                                                <Pause size={16} className="text-white" />
                                            </button>
                                            <button className="p-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                                                <StopCircle size={16} className="text-white" />
                                            </button>
                                        </>
                                    )}
                                    {job.status === 'queued' && (
                                        <span className="text-sm text-gray-400">
                                            Posición en cola: {job.queuePosition}
                                        </span>
                                    )}
                                    {job.status === 'completed' && (
                                        <button className="flex items-center gap-2 px-3 py-1.5 bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                                            <Download size={14} className="text-white" />
                                            <span className="text-white text-sm">Descargar Modelo</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {job.status === 'running' && (
                                <>
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-gray-400">Progreso</span>
                                            <span className="text-sm font-semibold text-white">{job.progress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2">
                                            <div
                                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                                                style={{ width: `${job.progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                        <div className="p-3 bg-gray-700/50 rounded-lg">
                                            <div className="text-xs text-gray-400 mb-1">Accuracy</div>
                                            <div className="text-xl font-bold text-white">{job.metrics?.accuracy ?? '-'}%</div>
                                        </div>
                                        <div className="p-3 bg-gray-700/50 rounded-lg">
                                            <div className="text-xs text-gray-400 mb-1">Loss</div>
                                            <div className="text-xl font-bold text-white">{job.metrics?.loss ?? '-'}</div>
                                        </div>
                                        <div className="p-3 bg-gray-700/50 rounded-lg">
                                            <div className="text-xs text-gray-400 mb-1">Val Accuracy</div>
                                            <div className="text-xl font-bold text-white">{job.metrics?.valAccuracy ?? '-'}%</div>
                                        </div>
                                        <div className="p-3 bg-gray-700/50 rounded-lg">
                                            <div className="text-xs text-gray-400 mb-1">Val Loss</div>
                                            <div className="text-xl font-bold text-white">{job.metrics?.valLoss ?? '-'}</div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="bg-gray-700/30 rounded-lg p-4">
                                <div className="text-sm font-semibold text-white mb-2">Hyperparameters</div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    {Object.entries(job.hyperparameters || {}).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between">
                                            <span className="text-xs text-gray-400">{key}:</span>
                                            <span className="text-xs font-mono text-white">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Models Registry Tab */}
            {activeTab === 'models' && (
                <div className="space-y-4">
                    {selectedModels.length >= 2 && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-center justify-between">
                            <div>
                                <div className="text-white font-semibold">{selectedModels.length} modelos seleccionados</div>
                                <div className="text-sm text-gray-400">Haz clic en "Comparar" para ver diferencias</div>
                            </div>
                            <button
                                onClick={compareModels}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <BarChart3 size={18} className="text-white" />
                                <span className="text-white font-semibold">Comparar</span>
                            </button>
                        </div>
                    )}

                    {models.map(model => (
                        <div
                            key={model.id}
                            className={`bg-gray-800/50 backdrop-blur-sm rounded-xl border p-6 hover:border-gray-600 transition-all cursor-pointer ${selectedModels.includes(model.id) ? 'border-blue-500' : 'border-gray-700'
                                }`}
                            onClick={() => toggleModelSelection(model.id)}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">
                                        {model.name} <span className="text-sm text-gray-400">v{model.version}</span>
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(model.status)}`}>
                                            {(model.status || 'unknown').toUpperCase()}
                                        </span>
                                        <span className="text-xs text-gray-400">{model.type}</span>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={selectedModels.includes(model.id)}
                                    onChange={() => toggleModelSelection(model.id)}
                                    className="w-5 h-5 text-blue-600 rounded"
                                />
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div className="p-3 bg-gray-700/50 rounded-lg">
                                    <div className="text-xs text-gray-400 mb-1">Accuracy</div>
                                    <div className="text-xl font-bold text-white">{model.accuracy}%</div>
                                </div>
                                <div className="p-3 bg-gray-700/50 rounded-lg">
                                    <div className="text-xs text-gray-400 mb-1">Precision</div>
                                    <div className="text-xl font-bold text-white">{model.precision}%</div>
                                </div>
                                <div className="p-3 bg-gray-700/50 rounded-lg">
                                    <div className="text-xs text-gray-400 mb-1">Recall</div>
                                    <div className="text-xl font-bold text-white">{model.recall}%</div>
                                </div>
                                <div className="p-3 bg-gray-700/50 rounded-lg">
                                    <div className="text-xs text-gray-400 mb-1">F1-Score</div>
                                    <div className="text-xl font-bold text-white">{model.f1Score}%</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-3 text-center text-xs">
                                <div>
                                    <div className="text-gray-400">Deployed</div>
                                    <div className="text-white font-semibold">{model.deployedDate}</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Size</div>
                                    <div className="text-white font-semibold">{model.size}</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Inference</div>
                                    <div className="text-white font-semibold">{model.inferenceTime}ms</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">Training Data</div>
                                    <div className="text-white font-semibold">{model.trainingData}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Comparison Tab */}
            {activeTab === 'comparison' && comparisonData && (
                <div className="space-y-6">
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                        <h3 className="text-xl font-bold text-white mb-6">Model Comparison</h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-4">Performance Metrics</h4>
                                <ResponsiveContainer width="100%" height={300}>
                                    <RadarChart data={comparisonData.radarData}>
                                        <PolarGrid stroke="#374151" />
                                        <PolarAngleAxis dataKey="metric" stroke="#9ca3af" />
                                        <PolarRadiusAxis stroke="#9ca3af" />
                                        {comparisonData.models.map((model, idx) => (
                                            <Radar
                                                key={model.id}
                                                name={model.name}
                                                dataKey={`model${idx + 1}`}
                                                stroke={['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'][idx]}
                                                fill={['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'][idx]}
                                                fillOpacity={0.3}
                                            />
                                        ))}
                                        <Legend />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-gray-400 mb-4">Detailed Comparison</h4>
                                <div className="space-y-3">
                                    {comparisonData.models.map(model => (
                                        <div key={model.id} className="p-4 bg-gray-700/50 rounded-lg">
                                            <div className="text-white font-semibold mb-2">{model.name}</div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>Size: <span className="text-white font-semibold">{model.size}</span></div>
                                                <div>Inference: <span className="text-white font-semibold">{model.inferenceTime}ms</span></div>
                                                <div>Status: <span className="text-white font-semibold">{model.status}</span></div>
                                                <div>F1: <span className="text-white font-semibold">{model.f1Score}%</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <div className="text-sm text-blue-400 font-semibold mb-1">💡 Recomendación</div>
                            <div className="text-white">
                                Basado en la comparación, <span className="font-bold">{[...comparisonData.models].sort((a, b) => (b.f1Score || 0) - (a.f1Score || 0))[0]?.name || 'N/A'}</span> muestra el mejor balance entre precisión y recall.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
