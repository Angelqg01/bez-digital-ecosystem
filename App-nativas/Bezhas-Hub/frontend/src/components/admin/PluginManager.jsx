import React, { useState, useEffect } from 'react';
import {
    Package,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Clock,
    Download,
    RotateCcw,
    Zap,
    Info,
    ChevronDown,
    ChevronUp,
    Boxes,
    Code,
    FileCode,
    Layers,
    Server,
    Database,
    Cloud,
    Shield,
    Terminal
} from 'lucide-react';
import http from '../../services/http';
import toast from 'react-hot-toast';

export default function PluginManager() {
    // Active section state
    const [activeSection, setActiveSection] = useState('plugins');

    // Plugins state
    const [plugins, setPlugins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState({});
    const [expandedPlugin, setExpandedPlugin] = useState(null);
    const [aiAdvice, setAiAdvice] = useState({});
    const [loadingAdvice, setLoadingAdvice] = useState({});

    // Dependencies state
    const [dependencies, setDependencies] = useState({ frontend: [], backend: [] });
    const [loadingDeps, setLoadingDeps] = useState(false);

    // Contracts state
    const [contracts, setContracts] = useState([]);
    const [loadingContracts, setLoadingContracts] = useState(false);

    // Services state
    const [services, setServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);

    useEffect(() => {
        loadPlugins();
    }, []);

    const loadPlugins = async () => {
        try {
            setLoading(true);
            const response = await http.get('/api/plugins');
            setPlugins(response.data);
        } catch (error) {
            toast.error('Error cargando plugins');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getAIAdvice = async (pluginId) => {
        try {
            setLoadingAdvice(prev => ({ ...prev, [pluginId]: true }));
            const response = await http.get(`/api/plugins/${pluginId}/advice`);
            setAiAdvice(prev => ({ ...prev, [pluginId]: response.data.advice }));
        } catch (error) {
            toast.error('Error obteniendo recomendación de IA');
        } finally {
            setLoadingAdvice(prev => ({ ...prev, [pluginId]: false }));
        }
    };

    const updatePlugin = async (pluginId, versionId) => {
        try {
            setUpdating(prev => ({ ...prev, [pluginId]: true }));
            await http.patch(`/api/plugins/${pluginId}/update`, { versionId });
            toast.success('Plugin actualizado correctamente');
            await loadPlugins();
        } catch (error) {
            toast.error('Error actualizando plugin');
        } finally {
            setUpdating(prev => ({ ...prev, [pluginId]: false }));
        }
    };

    const rollbackPlugin = async (pluginId) => {
        try {
            setUpdating(prev => ({ ...prev, [pluginId]: true }));
            await http.patch(`/api/plugins/${pluginId}/rollback`);
            toast.success('Rollback exitoso');
            await loadPlugins();
        } catch (error) {
            toast.error('Error en rollback: ' + error.response?.data?.error || error.message);
        } finally {
            setUpdating(prev => ({ ...prev, [pluginId]: false }));
        }
    };

    const updateAllPlugins = async () => {
        try {
            setLoading(true);
            const response = await http.post('/api/plugins/update-all');
            toast.success(response.data.message);
            await loadPlugins();
        } catch (error) {
            toast.error('Error actualizando todos los plugins');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (plugin) => {
        const hasUpdate = plugin.versions?.[0]?.id !== plugin.currentVersionId;

        if (plugin.status === 'ERROR') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Error
                </span>
            );
        }

        if (plugin.status === 'UPDATING') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Actualizando
                </span>
            );
        }

        if (hasUpdate) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <Clock className="w-3 h-3 mr-1" />
                    Actualización disponible
                </span>
            );
        }

        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="w-3 h-3 mr-1" />
                Actualizado
            </span>
        );
    };

    const getRiskBadge = (riskLevel) => {
        const colors = {
            low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        };

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[riskLevel] || colors.medium}`}>
                Riesgo: {riskLevel?.toUpperCase() || 'UNKNOWN'}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Package className="w-7 h-7" />
                        Gestión de Plugins
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Administra las versiones de plugins del sistema
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={loadPlugins}
                        disabled={loading}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Recargar
                    </button>

                    <button
                        onClick={updateAllPlugins}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        <Zap className="w-4 h-4" />
                        Actualizar Todos
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Plugins</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{plugins.length}</p>
                        </div>
                        <Package className="w-8 h-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Actualizados</p>
                            <p className="text-2xl font-bold text-green-600">
                                {plugins.filter(p => p.versions?.[0]?.id === p.currentVersionId).length}
                            </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pendientes</p>
                            <p className="text-2xl font-bold text-yellow-600">
                                {plugins.filter(p => p.versions?.[0]?.id !== p.currentVersionId).length}
                            </p>
                        </div>
                        <Clock className="w-8 h-8 text-yellow-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Con Errores</p>
                            <p className="text-2xl font-bold text-red-600">
                                {plugins.filter(p => p.status === 'ERROR').length}
                            </p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                </div>
            </div>

            {/* Plugins List */}
            <div className="space-y-4">
                {plugins.map(plugin => {
                    const latestVersion = plugin.versions?.[0];
                    const currentVersion = plugin.currentVersion;
                    const hasUpdate = latestVersion?.id !== plugin.currentVersionId;
                    const isExpanded = expandedPlugin === plugin.id;
                    const advice = aiAdvice[plugin.id];

                    return (
                        <div
                            key={plugin.id}
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                            {/* Plugin Header */}
                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {plugin.name}
                                            </h3>
                                            {getStatusBadge(plugin)}
                                        </div>

                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                            {plugin.description || 'Sin descripción'}
                                        </p>

                                        <div className="flex items-center gap-6 text-sm">
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Versión actual: </span>
                                                <span className="font-mono font-medium text-gray-900 dark:text-white">
                                                    {currentVersion?.versionTag || 'N/A'}
                                                </span>
                                            </div>

                                            {hasUpdate && (
                                                <div>
                                                    <span className="text-gray-500 dark:text-gray-400">Nueva versión: </span>
                                                    <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                                                        {latestVersion?.versionTag}
                                                    </span>
                                                </div>
                                            )}

                                            {currentVersion?.isStable && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                                    Estable
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {hasUpdate && (
                                            <>
                                                <button
                                                    onClick={() => getAIAdvice(plugin.id)}
                                                    disabled={loadingAdvice[plugin.id]}
                                                    className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                                                >
                                                    <Info className={`w-4 h-4 ${loadingAdvice[plugin.id] ? 'animate-pulse' : ''}`} />
                                                    Consejo IA
                                                </button>

                                                <button
                                                    onClick={() => updatePlugin(plugin.id, latestVersion.id)}
                                                    disabled={updating[plugin.id]}
                                                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                                                >
                                                    <Download className={`w-4 h-4 ${updating[plugin.id] ? 'animate-bounce' : ''}`} />
                                                    Actualizar
                                                </button>
                                            </>
                                        )}

                                        <button
                                            onClick={() => rollbackPlugin(plugin.id)}
                                            disabled={updating[plugin.id]}
                                            className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                                        >
                                            <RotateCcw className={`w-4 h-4 ${updating[plugin.id] ? 'animate-spin' : ''}`} />
                                            Rollback
                                        </button>

                                        <button
                                            onClick={() => setExpandedPlugin(isExpanded ? null : plugin.id)}
                                            className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* AI Advice Panel */}
                                {advice && (
                                    <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                        <div className="flex items-start gap-3">
                                            <Info className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h4 className="font-semibold text-purple-900 dark:text-purple-100">
                                                        Recomendación de IA
                                                    </h4>
                                                    {advice.riskLevel && getRiskBadge(advice.riskLevel)}
                                                </div>
                                                <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                                                    {advice.summary || advice.response || 'Analizando...'}
                                                </p>
                                                {advice.recommendation && (
                                                    <p className="text-sm text-purple-700 dark:text-purple-300">
                                                        <strong>Recomendación:</strong> {advice.recommendation}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                        Historial de Versiones
                                    </h4>
                                    <div className="space-y-2">
                                        {plugin.versions?.slice(0, 5).map((version, idx) => (
                                            <div
                                                key={version.id}
                                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                                                            {version.versionTag}
                                                        </span>
                                                        {version.isStable && (
                                                            <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                                Estable
                                                            </span>
                                                        )}
                                                        {version.id === plugin.currentVersionId && (
                                                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                                Actual
                                                            </span>
                                                        )}
                                                    </div>
                                                    {version.changelog && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                            {version.changelog}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                                        {new Date(version.createdAt).toLocaleDateString('es-ES', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>

                                                {version.id !== plugin.currentVersionId && (
                                                    <button
                                                        onClick={() => updatePlugin(plugin.id, version.id)}
                                                        disabled={updating[plugin.id]}
                                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                                    >
                                                        Instalar
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {plugin.repoUrl && (
                                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <a
                                                href={plugin.repoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                Ver en GitHub →
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {plugins.length === 0 && (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>No hay plugins registrados en el sistema</p>
                    </div>
                )}
            </div>
        </div>
    );
}
