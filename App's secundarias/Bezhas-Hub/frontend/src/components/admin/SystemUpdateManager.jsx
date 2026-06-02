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
    Terminal,
    TrendingUp,
    Activity
} from 'lucide-react';
import http from '../../services/http';
import toast from 'react-hot-toast';

export default function SystemUpdateManager() {
    // Active section state
    const [activeSection, setActiveSection] = useState('plugins');

    // Loading states
    const [loading, setLoading] = useState(false);
    const [updating, setUpdating] = useState({});
    const [expandedItem, setExpandedItem] = useState(null);

    // Plugins state
    const [plugins, setPlugins] = useState([]);
    const [aiAdvice, setAiAdvice] = useState({});
    const [loadingAdvice, setLoadingAdvice] = useState({});

    // Dependencies state
    const [dependencies, setDependencies] = useState({ frontend: [], backend: [] });

    // Contracts state
    const [contracts, setContracts] = useState([]);

    // Services state (AI APIs, Third-party integrations)
    const [services, setServices] = useState([]);

    // System components state
    const [systemComponents, setSystemComponents] = useState([]);

    useEffect(() => {
        loadActiveSection();
    }, [activeSection]);

    const loadActiveSection = async () => {
        switch (activeSection) {
            case 'plugins':
                await loadPlugins();
                break;
            case 'dependencies':
                await loadDependencies();
                break;
            case 'contracts':
                await loadContracts();
                break;
            case 'services':
                await loadServices();
                break;
            case 'system':
                await loadSystemComponents();
                break;
            default:
                break;
        }
    };

    // ==========================================
    // PLUGINS SECTION
    // ==========================================
    const loadPlugins = async () => {
        try {
            setLoading(true);
            const response = await http.get('/api/plugins').catch(() => ({ data: [] }));
            setPlugins(response.data);
        } catch (error) {
            // Silently use empty array - backend may not be running
            setPlugins([]);
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

    // ==========================================
    // DEPENDENCIES SECTION (Real Data from Backend)
    // ==========================================
    const loadDependencies = async () => {
        try {
            setLoading(true);
            // Usar el nuevo endpoint unificado
            const response = await http.get('/api/admin/dependencies').catch(() => null);

            if (response?.data?.success) {
                const { modules, security, summary } = response.data;

                // Transform data for the UI
                const allDeps = {
                    frontend: modules.frontend?.dependencies || [],
                    backend: modules.backend?.dependencies || [],
                    root: modules.root?.dependencies || [],
                    sdk: modules.sdk?.dependencies || [],
                    outdated: {
                        frontend: modules.frontend?.outdated || [],
                        backend: modules.backend?.outdated || [],
                        root: modules.root?.outdated || [],
                        sdk: modules.sdk?.outdated || []
                    },
                    security: security || { vulnerabilities: [], summary: {} },
                    summary: summary || {}
                };

                setDependencies(allDeps);
            } else {
                // Fallback to individual requests (legacy)
                const [frontendRes, backendRes] = await Promise.all([
                    http.get('/api/admin/dependencies/frontend').catch(() => ({ data: { dependencies: mockFrontendDeps } })),
                    http.get('/api/admin/dependencies/backend').catch(() => ({ data: { dependencies: mockBackendDeps } }))
                ]);
                setDependencies({
                    frontend: frontendRes.data.dependencies || frontendRes.data,
                    backend: backendRes.data.dependencies || backendRes.data,
                    root: [],
                    sdk: [],
                    outdated: { frontend: [], backend: [], root: [], sdk: [] },
                    security: { vulnerabilities: [], summary: {} },
                    summary: {}
                });
            }
        } catch (error) {
            console.error('Error loading dependencies:', error);
            setDependencies({
                frontend: mockFrontendDeps,
                backend: mockBackendDeps,
                root: [],
                sdk: [],
                outdated: { frontend: [], backend: [], root: [], sdk: [] },
                security: { vulnerabilities: [], summary: {} },
                summary: {}
            });
        } finally {
            setLoading(false);
        }
    };

    const updateDependency = async (workspace, packageName) => {
        try {
            setUpdating(prev => ({ ...prev, [packageName]: true }));
            const response = await http.post('/api/admin/dependencies/update', { workspace, package: packageName });
            toast.success(`${packageName} actualizado con éxito`);
            await loadDependencies();
        } catch (error) {
            if (error.response?.status === 404) {
                toast.error('Backend no disponible. Actualiza manualmente con: pnpm update ' + packageName, { duration: 5000 });
            } else {
                toast.error('Error actualizando dependencia: ' + (error.response?.data?.message || error.message));
            }
        } finally {
            setUpdating(prev => ({ ...prev, [packageName]: false }));
        }
    };

    // Reinstall all dependencies with PNPM
    const reinstallDependencies = async (workspace) => {
        try {
            setLoading(true);
            toast.loading(`Reinstalando dependencias de ${workspace}...`, { duration: 2000 });
            const response = await http.post('/api/admin/dependencies/reinstall', { workspace });
            toast.success(response.data?.message || `Dependencias de ${workspace} reinstaladas correctamente`);
            await loadDependencies();
        } catch (error) {
            if (error.response?.status === 404) {
                toast.error(`Backend no disponible. Ejecuta manualmente:\n\ncd ${workspace}\npnpm install --force`, { duration: 6000 });
            } else {
                toast.error('Error reinstalando dependencias: ' + (error.response?.data?.message || error.message));
            }
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // CONTRACTS SECTION
    // ==========================================
    const loadContracts = async () => {
        try {
            setLoading(true);
            const response = await http.get('/api/admin/contracts/status').catch(() => ({
                data: mockContracts
            }));
            setContracts(response.data);
        } catch (error) {
            console.error('Error loading contracts:', error);
            setContracts(mockContracts);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // SERVICES SECTION
    // ==========================================
    const loadServices = async () => {
        try {
            setLoading(true);
            const response = await http.get('/api/admin/services/status').catch(() => ({
                data: mockServices
            }));
            setServices(response.data);
        } catch (error) {
            console.error('Error loading services:', error);
            setServices(mockServices);
        } finally {
            setLoading(false);
        }
    };

    const updateServiceConfig = async (serviceId, config) => {
        try {
            setUpdating(prev => ({ ...prev, [serviceId]: true }));
            await http.patch(`/api/admin/services/${serviceId}/config`, config);
            toast.success('Configuración actualizada');
            await loadServices();
        } catch (error) {
            toast.error('Error actualizando servicio');
        } finally {
            setUpdating(prev => ({ ...prev, [serviceId]: false }));
        }
    };

    // ==========================================
    // SYSTEM COMPONENTS SECTION
    // ==========================================
    const loadSystemComponents = async () => {
        try {
            setLoading(true);
            const response = await http.get('/api/admin/system/components').catch(() => ({
                data: mockSystemComponents
            }));
            setSystemComponents(response.data);
        } catch (error) {
            console.error('Error loading system components:', error);
            setSystemComponents(mockSystemComponents);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================
    const getStatusBadge = (item) => {
        const hasUpdate = item.hasUpdate || item.updateAvailable;

        if (item.status === 'ERROR' || item.status === 'error') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Error
                </span>
            );
        }

        if (item.status === 'UPDATING' || item.status === 'updating') {
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

    // ==========================================
    // NAVIGATION SECTIONS
    // ==========================================
    const totalDeps = (dependencies.frontend?.length || 0) +
        (dependencies.backend?.length || 0) +
        (dependencies.root?.length || 0) +
        (dependencies.sdk?.length || 0);

    const totalOutdated = (dependencies.outdated?.frontend?.length || 0) +
        (dependencies.outdated?.backend?.length || 0) +
        (dependencies.outdated?.root?.length || 0) +
        (dependencies.outdated?.sdk?.length || 0);

    const sections = [
        { id: 'plugins', label: 'Plugins del Sistema', icon: Package, count: plugins.length },
        { id: 'dependencies', label: 'Dependencias PNPM', icon: Code, count: totalDeps, badge: totalOutdated > 0 ? `${totalOutdated} updates` : null },
        { id: 'contracts', label: 'Smart Contracts', icon: FileCode, count: contracts.length },
        { id: 'services', label: 'Servicios Externos', icon: Cloud, count: services.length },
        { id: 'system', label: 'Componentes del Sistema', icon: Server, count: systemComponents.length }
    ];

    // ==========================================
    // RENDER
    // ==========================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-7 h-7" />
                        Gestor de Actualizaciones del Sistema
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Gestión centralizada de todos los componentes actualizables de la plataforma
                    </p>
                </div>

                <button
                    onClick={loadActiveSection}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Recargar
                </button>
            </div>

            {/* Section Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
                <div className="flex">
                    {sections.map(section => {
                        const Icon = section.icon;
                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`flex-1 min-w-[200px] px-4 py-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${isActive
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium hidden sm:inline">{section.label}</span>
                                {section.count > 0 && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' : 'bg-gray-200 dark:bg-gray-700'
                                        }`}>
                                        {section.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <>
                        {activeSection === 'plugins' && <PluginsSection
                            plugins={plugins}
                            updating={updating}
                            expandedItem={expandedItem}
                            setExpandedItem={setExpandedItem}
                            aiAdvice={aiAdvice}
                            loadingAdvice={loadingAdvice}
                            getAIAdvice={getAIAdvice}
                            updatePlugin={updatePlugin}
                            rollbackPlugin={rollbackPlugin}
                            updateAllPlugins={updateAllPlugins}
                            getStatusBadge={getStatusBadge}
                            getRiskBadge={getRiskBadge}
                        />}

                        {activeSection === 'dependencies' && <DependenciesSection
                            dependencies={dependencies}
                            updating={updating}
                            expandedItem={expandedItem}
                            setExpandedItem={setExpandedItem}
                            updateDependency={updateDependency}
                            reinstallDependencies={reinstallDependencies}
                            loading={loading}
                            getStatusBadge={getStatusBadge}
                        />}

                        {activeSection === 'contracts' && <ContractsSection
                            contracts={contracts}
                            getStatusBadge={getStatusBadge}
                        />}

                        {activeSection === 'services' && <ServicesSection
                            services={services}
                            updating={updating}
                            updateServiceConfig={updateServiceConfig}
                            getStatusBadge={getStatusBadge}
                        />}

                        {activeSection === 'system' && <SystemComponentsSection
                            components={systemComponents}
                            getStatusBadge={getStatusBadge}
                        />}
                    </>
                )}
            </div>
        </div>
    );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function PluginsSection({ plugins, updating, expandedItem, setExpandedItem, aiAdvice, loadingAdvice, getAIAdvice, updatePlugin, rollbackPlugin, updateAllPlugins, getStatusBadge, getRiskBadge }) {
    return (
        <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    {plugins.filter(p => p.versions?.[0]?.id !== p.currentVersionId).length} actualizaciones disponibles
                </div>
                <button
                    onClick={updateAllPlugins}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors text-sm"
                >
                    <Zap className="w-4 h-4" />
                    Actualizar Todos
                </button>
            </div>

            {/* Plugins List */}
            {plugins.map(plugin => {
                const latestVersion = plugin.versions?.[0];
                const currentVersion = plugin.currentVersion;
                const hasUpdate = latestVersion?.id !== plugin.currentVersionId;
                const isExpanded = expandedItem === plugin.id;
                const advice = aiAdvice[plugin.id];

                return (
                    <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        hasUpdate={hasUpdate}
                        isExpanded={isExpanded}
                        advice={advice}
                        updating={updating}
                        loadingAdvice={loadingAdvice}
                        latestVersion={latestVersion}
                        currentVersion={currentVersion}
                        onToggle={() => setExpandedItem(isExpanded ? null : plugin.id)}
                        onGetAdvice={getAIAdvice}
                        onUpdate={updatePlugin}
                        onRollback={rollbackPlugin}
                        getStatusBadge={getStatusBadge}
                        getRiskBadge={getRiskBadge}
                    />
                );
            })}

            {plugins.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay plugins registrados en el sistema</p>
                </div>
            )}
        </div>
    );
}

function PluginCard({ plugin, hasUpdate, isExpanded, advice, updating, loadingAdvice, latestVersion, currentVersion, onToggle, onGetAdvice, onUpdate, onRollback, getStatusBadge, getRiskBadge }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {hasUpdate && (
                            <>
                                <button
                                    onClick={() => onGetAdvice(plugin.id)}
                                    disabled={loadingAdvice[plugin.id]}
                                    className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Info className={`w-4 h-4 ${loadingAdvice[plugin.id] ? 'animate-pulse' : ''}`} />
                                    Consejo IA
                                </button>

                                <button
                                    onClick={() => onUpdate(plugin.id, latestVersion.id)}
                                    disabled={updating[plugin.id]}
                                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Download className={`w-4 h-4 ${updating[plugin.id] ? 'animate-bounce' : ''}`} />
                                    Actualizar
                                </button>
                            </>
                        )}

                        <button
                            onClick={() => onRollback(plugin.id)}
                            disabled={updating[plugin.id]}
                            className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Rollback
                        </button>

                        <button
                            onClick={onToggle}
                            className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 rounded-lg"
                        >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

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
                                <p className="text-sm text-purple-800 dark:text-purple-200">
                                    {advice.summary || advice.response || 'Analizando...'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                        Historial de Versiones
                    </h4>
                    <div className="space-y-2">
                        {plugin.versions?.slice(0, 5).map(version => (
                            <div
                                key={version.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-medium">
                                            {version.versionTag}
                                        </span>
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
                                </div>

                                {version.id !== plugin.currentVersionId && (
                                    <button
                                        onClick={() => onUpdate(plugin.id, version.id)}
                                        disabled={updating[plugin.id]}
                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Instalar
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function DependenciesSection({ dependencies, updating, expandedItem, setExpandedItem, updateDependency, reinstallDependencies, loading, getStatusBadge }) {
    const [activeTab, setActiveTab] = React.useState('overview');
    const [expandedWorkspace, setExpandedWorkspace] = React.useState(null);

    // Calculate statistics
    const stats = {
        total: (dependencies.frontend?.length || 0) + (dependencies.backend?.length || 0) +
            (dependencies.root?.length || 0) + (dependencies.sdk?.length || 0),
        outdated: (dependencies.outdated?.frontend?.length || 0) + (dependencies.outdated?.backend?.length || 0) +
            (dependencies.outdated?.root?.length || 0) + (dependencies.outdated?.sdk?.length || 0),
        vulnerabilities: dependencies.security?.vulnerabilities?.length || 0,
        critical: dependencies.security?.summary?.critical || 0,
        high: dependencies.security?.summary?.high || 0
    };

    const workspaces = [
        { id: 'frontend', name: 'Frontend (React/Vite)', icon: Code, color: 'purple', deps: dependencies.frontend || [], outdated: dependencies.outdated?.frontend || [] },
        { id: 'backend', name: 'Backend (Node/Express)', icon: Server, color: 'green', deps: dependencies.backend || [], outdated: dependencies.outdated?.backend || [] },
        { id: 'root', name: 'Root (Hardhat/Solidity)', icon: Database, color: 'orange', deps: dependencies.root || [], outdated: dependencies.outdated?.root || [] },
        { id: 'sdk', name: 'SDK', icon: Boxes, color: 'blue', deps: dependencies.sdk || [], outdated: dependencies.outdated?.sdk || [] }
    ];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Paquetes</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.outdated}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Desactualizados</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${stats.critical > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                            <Shield className={`w-5 h-5 ${stats.critical > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${stats.critical > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {stats.vulnerabilities}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Vulnerabilidades</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${(stats.critical + stats.high) > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                            <AlertTriangle className={`w-5 h-5 ${(stats.critical + stats.high) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${(stats.critical + stats.high) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {stats.critical + stats.high}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Críticas/Altas</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    📦 Resumen por Módulo
                </button>
                <button
                    onClick={() => setActiveTab('outdated')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'outdated'
                        ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    ⏰ Actualizaciones ({stats.outdated})
                </button>
                <button
                    onClick={() => setActiveTab('security')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'security'
                        ? 'border-red-500 text-red-600 dark:text-red-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🔒 Seguridad ({stats.vulnerabilities})
                </button>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {workspaces.map(ws => (
                        <div key={ws.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                onClick={() => setExpandedWorkspace(expandedWorkspace === ws.id ? null : ws.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <ws.icon className={`w-5 h-5 text-${ws.color}-500`} />
                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white">{ws.name}</h4>
                                        <p className="text-sm text-gray-500">
                                            {ws.deps.length} dependencias • {ws.outdated.length} actualizaciones disponibles
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); reinstallDependencies(ws.id); }}
                                        disabled={loading}
                                        className={`px-3 py-1.5 text-xs bg-${ws.color}-600 text-white rounded-lg hover:bg-${ws.color}-700 disabled:opacity-50`}
                                    >
                                        <RotateCcw className={`w-3 h-3 inline mr-1 ${loading ? 'animate-spin' : ''}`} />
                                        Reinstalar
                                    </button>
                                    {expandedWorkspace === ws.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                            </div>

                            {expandedWorkspace === ws.id && ws.deps.length > 0 && (
                                <div className="border-t border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto">
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {ws.deps.slice(0, 20).map(dep => (
                                            <div key={dep.name} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <div className="flex-1">
                                                    <span className="font-mono text-sm text-gray-900 dark:text-white">{dep.name}</span>
                                                    <span className="ml-2 text-xs text-gray-500">{dep.current}</span>
                                                    {dep.hasUpdate && dep.latest && (
                                                        <span className="ml-2 text-xs text-blue-500">→ {dep.latest}</span>
                                                    )}
                                                </div>
                                                {dep.hasUpdate && (
                                                    <button
                                                        onClick={() => updateDependency(ws.id, dep.name)}
                                                        disabled={updating[dep.name]}
                                                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                        {updating[dep.name] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {ws.deps.length > 20 && (
                                            <p className="px-4 py-2 text-sm text-gray-500 text-center">
                                                + {ws.deps.length - 20} más dependencias
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Outdated Tab */}
            {activeTab === 'outdated' && (
                <div className="space-y-4">
                    {workspaces.map(ws => ws.outdated.length > 0 && (
                        <div key={ws.id}>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <ws.icon className={`w-5 h-5 text-${ws.color}-500`} />
                                {ws.name}
                            </h3>
                            <div className="space-y-2">
                                {ws.outdated.map(dep => (
                                    <div key={dep.name} className="bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-mono font-medium text-gray-900 dark:text-white">{dep.name}</h4>
                                                    <span className={`px-2 py-0.5 text-xs rounded ${dep.updateType === 'major' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                        dep.updateType === 'minor' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        }`}>
                                                        {dep.updateType?.toUpperCase() || 'UPDATE'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                                    <span className="font-mono">{dep.current}</span>
                                                    <span>→</span>
                                                    <span className="font-mono text-blue-600 dark:text-blue-400">{dep.latest}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => updateDependency(ws.id, dep.name)}
                                                disabled={updating[dep.name]}
                                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                {updating[dep.name] ? (
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Download className="w-4 h-4" />
                                                        Actualizar
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {stats.outdated === 0 && (
                        <div className="text-center py-12">
                            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">¡Todo actualizado!</h3>
                            <p className="text-gray-500 dark:text-gray-400">Todas las dependencias están en su última versión</p>
                        </div>
                    )}
                </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
                <div className="space-y-4">
                    {/* Security Summary */}
                    {dependencies.security?.summary && (
                        <div className="grid grid-cols-4 gap-4">
                            {['critical', 'high', 'moderate', 'low'].map(severity => {
                                const count = dependencies.security.summary[severity] || 0;
                                const colors = {
                                    critical: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
                                    high: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
                                    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
                                    low: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                                };

                                return (
                                    <div key={severity} className={`rounded-lg border p-4 ${colors[severity]}`}>
                                        <p className="text-2xl font-bold">{count}</p>
                                        <p className="text-sm capitalize">{severity}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Vulnerability List */}
                    {dependencies.security?.vulnerabilities?.length > 0 ? (
                        <div className="space-y-3">
                            {dependencies.security.vulnerabilities.map((vuln, idx) => (
                                <div key={vuln.id || idx} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${vuln.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                    vuln.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                                                        vuln.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                    {vuln.severity?.toUpperCase()}
                                                </span>
                                                <h4 className="font-semibold text-gray-900 dark:text-white">{vuln.title}</h4>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                Módulo: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{vuln.module}</code>
                                            </p>
                                            {vuln.recommendation && (
                                                <p className="text-sm text-gray-500">{vuln.recommendation}</p>
                                            )}
                                        </div>
                                        {vuln.url && (
                                            <a
                                                href={vuln.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                                            >
                                                Ver detalles
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Shield className="w-16 h-16 mx-auto text-green-500 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">¡Sin vulnerabilidades!</h3>
                            <p className="text-gray-500 dark:text-gray-400">No se encontraron vulnerabilidades de seguridad conocidas</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function DependencyCard({ dependency, workspace, updating, onUpdate, getStatusBadge }) {
    const hasUpdate = dependency.current !== dependency.latest;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-mono font-medium text-gray-900 dark:text-white">
                            {dependency.name}
                        </h4>
                        {getStatusBadge({ hasUpdate, status: dependency.status })}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>Actual: {dependency.current}</span>
                        {hasUpdate && <span className="text-blue-600 dark:text-blue-400">→ {dependency.latest}</span>}
                    </div>
                </div>

                {hasUpdate && (
                    <button
                        onClick={() => onUpdate(workspace, dependency.name)}
                        disabled={updating[dependency.name]}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

function ContractsSection({ contracts, getStatusBadge }) {
    return (
        <div className="space-y-4">
            {contracts.map(contract => (
                <div
                    key={contract.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                    {contract.name}
                                </h4>
                                {getStatusBadge(contract)}
                            </div>
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                <p>Network: <span className="font-mono">{contract.network}</span></p>
                                <p>Address: <span className="font-mono text-xs">{contract.address}</span></p>
                                <p>Version: <span className="font-mono">{contract.version}</span></p>
                            </div>
                        </div>

                        <a
                            href={contract.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            Ver en Explorer
                        </a>
                    </div>
                </div>
            ))}

            {contracts.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FileCode className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay contratos desplegados</p>
                </div>
            )}
        </div>
    );
}

function ServicesSection({ services, updating, updateServiceConfig, getStatusBadge }) {
    return (
        <div className="space-y-4">
            {services.map(service => (
                <div
                    key={service.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                    {service.name}
                                </h4>
                                {getStatusBadge(service)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                {service.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                                <span className={`px-2 py-1 rounded ${service.healthy
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {service.healthy ? 'Online' : 'Offline'}
                                </span>
                                {service.version && (
                                    <span className="text-gray-500">Version: {service.version}</span>
                                )}
                            </div>
                        </div>

                        <button
                            disabled={updating[service.id]}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Configurar
                        </button>
                    </div>
                </div>
            ))}

            {services.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Cloud className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay servicios configurados</p>
                </div>
            )}
        </div>
    );
}

function SystemComponentsSection({ components, getStatusBadge }) {
    return (
        <div className="space-y-4">
            {components.map(component => (
                <div
                    key={component.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-semibold text-gray-900 dark:text-white">
                                    {component.name}
                                </h4>
                                {getStatusBadge(component)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                {component.description}
                            </p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-gray-500">Uptime:</span>
                                    <span className="ml-2 font-medium">{component.uptime || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Last Check:</span>
                                    <span className="ml-2 font-medium">{component.lastCheck || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            {components.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Server className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay componentes del sistema</p>
                </div>
            )}
        </div>
    );
}

// ==========================================
// MOCK DATA (temporary until backend endpoints are ready)
// ==========================================
const mockFrontendDeps = [
    { name: 'react', current: '18.2.0', latest: '18.3.1', status: 'ok', hasUpdate: true },
    { name: 'vite', current: '5.0.0', latest: '5.0.12', status: 'ok', hasUpdate: true },
    { name: 'tailwindcss', current: '3.4.0', latest: '3.4.1', status: 'ok', hasUpdate: true },
    { name: 'ethers', current: '6.10.0', latest: '6.10.0', status: 'ok', hasUpdate: false }
];

const mockBackendDeps = [
    { name: 'express', current: '4.18.2', latest: '4.18.3', status: 'ok', hasUpdate: true },
    { name: 'mongoose', current: '8.0.0', latest: '8.1.0', status: 'ok', hasUpdate: true },
    { name: 'helmet', current: '7.1.0', latest: '7.1.0', status: 'ok', hasUpdate: false }
];

const mockContracts = [
    {
        id: '1',
        name: 'BeZhas Token',
        network: 'Polygon',
        address: '0x1234...5678',
        version: 'v1.0.0',
        status: 'ACTIVE',
        explorerUrl: 'https://polygonscan.com/address/0x1234'
    },
    {
        id: '2',
        name: 'DAO Governance',
        network: 'Polygon',
        address: '0xabcd...ef90',
        version: 'v2.1.0',
        status: 'ACTIVE',
        explorerUrl: 'https://polygonscan.com/address/0xabcd'
    }
];

const mockServices = [
    {
        id: '1',
        name: 'OpenAI API',
        description: 'Servicio de IA para chat y análisis',
        healthy: true,
        version: 'gpt-4-turbo',
        status: 'ACTIVE'
    },
    {
        id: '2',
        name: 'Google Gemini',
        description: 'IA alternativa para procesamiento',
        healthy: true,
        version: 'gemini-pro',
        status: 'ACTIVE'
    },
    {
        id: '3',
        name: 'Stripe',
        description: 'Procesamiento de pagos',
        healthy: true,
        version: 'v2023',
        status: 'ACTIVE'
    },
    {
        id: '4',
        name: 'MoonPay',
        description: 'Compra de criptomonedas',
        healthy: false,
        version: 'v3',
        status: 'ERROR'
    }
];

const mockSystemComponents = [
    {
        id: '1',
        name: 'MongoDB',
        description: 'Base de datos principal',
        uptime: '99.9%',
        lastCheck: '2 min ago',
        status: 'ACTIVE'
    },
    {
        id: '2',
        name: 'Redis Cache',
        description: 'Sistema de caché',
        uptime: '99.5%',
        lastCheck: '1 min ago',
        status: 'ACTIVE'
    },
    {
        id: '3',
        name: 'WebSocket Server',
        description: 'Comunicación en tiempo real',
        uptime: '98.7%',
        lastCheck: '5 min ago',
        status: 'ACTIVE'
    }
];
