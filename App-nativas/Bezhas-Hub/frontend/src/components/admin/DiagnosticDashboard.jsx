import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Activity, AlertTriangle, CheckCircle, Clock,
    Database, TrendingUp, Zap, RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DiagnosticDashboard = () => {
    // Estado inicial con estructura completa para evitar errores de undefined
    const [systemHealth, setSystemHealth] = useState({
        score: 0,
        status: 'loading',
        metrics: {
            totalUsers: 0,
            recentErrors: 0,
            pendingTransactions: 0,
            systemUptime: '0h 0m'
        }
    });
    const [diagnosticLogs, setDiagnosticLogs] = useState([]);
    const [maintenanceReports, setMaintenanceReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('health');

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [healthRes, logsRes, reportsRes] = await Promise.all([
                axios.get(`${API_URL}/api/diagnostic/health`),
                axios.get(`${API_URL}/api/diagnostic/logs?limit=20`),
                axios.get(`${API_URL}/api/diagnostic/reports?limit=5`)
            ]);

            setSystemHealth(healthRes.data.health);
            setDiagnosticLogs(logsRes.data.logs);
            setMaintenanceReports(reportsRes.data.reports);
        } catch (error) {
            // Silently fail - backend may not be running, provide complete fallback structure
            setSystemHealth({
                score: 0,
                status: 'offline',
                metrics: {
                    totalUsers: 0,
                    recentErrors: 0,
                    pendingTransactions: 0,
                    systemUptime: 'Backend desconectado'
                }
            });
            setDiagnosticLogs([]);
            setMaintenanceReports([]);
        } finally {
            setLoading(false);
        }
    };

    const runManualMaintenance = async () => {
        try {
            setLoading(true);
            await axios.post(`${API_URL}/api/diagnostic/manual-maintenance`);
            alert('Mantenimiento iniciado. Verifica los reportes en unos minutos.');
            setTimeout(loadDashboardData, 5000);
        } catch (error) {
            // Silently fail - show user-friendly message
            alert('Backend no disponible. Verifica que el servidor esté corriendo.');
        } finally {
            setLoading(false);
        }
    };

    const getHealthColor = (score) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 50) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getStatusBadge = (status) => {
        const colors = {
            healthy: 'bg-green-500',
            warning: 'bg-yellow-500',
            critical: 'bg-red-500',
            offline: 'bg-gray-600',
            loading: 'bg-blue-500'
        };
        return colors[status] || 'bg-gray-500';
    };

    const getSeverityColor = (severity) => {
        const colors = {
            info: 'bg-blue-100 text-blue-800',
            warning: 'bg-yellow-100 text-yellow-800',
            error: 'bg-orange-100 text-orange-800',
            critical: 'bg-red-100 text-red-800'
        };
        return colors[severity] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                            <Activity className="text-blue-600" />
                            Sistema de Diagnóstico Automático
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Monitoreo en tiempo real y análisis con IA
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={loadDashboardData}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                        <button
                            onClick={runManualMaintenance}
                            disabled={loading}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Zap className="w-4 h-4" />
                            Mantenimiento Manual
                        </button>
                    </div>
                </div>

                {/* Health Score Card */}
                {systemHealth && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {/* Main Health Score */}
                            <div className="col-span-1 text-center">
                                <div className="relative inline-flex">
                                    <svg className="w-32 h-32 transform -rotate-90">
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke="#e5e7eb"
                                            strokeWidth="8"
                                            fill="none"
                                        />
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r="56"
                                            stroke={systemHealth.score >= 80 ? '#10b981' : systemHealth.score >= 50 ? '#f59e0b' : '#ef4444'}
                                            strokeWidth="8"
                                            fill="none"
                                            strokeDasharray={`${(systemHealth.score / 100) * 351.68} 351.68`}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className={`text-3xl font-bold ${getHealthColor(systemHealth.score)}`}>
                                            {systemHealth.score}
                                        </span>
                                        <span className="text-sm text-gray-500">/ 100</span>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(systemHealth.status)} text-white`}>
                                        {systemHealth.status === 'healthy' ? '✓ Saludable' :
                                            systemHealth.status === 'warning' ? '⚠ Advertencia' :
                                                systemHealth.status === 'offline' ? '⊗ Desconectado' :
                                                    systemHealth.status === 'loading' ? '⟳ Cargando...' : '✗ Crítico'}
                                    </span>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="col-span-3 grid grid-cols-2 gap-4">
                                <MetricCard
                                    icon={<Database className="text-blue-600" />}
                                    label="Total Usuarios"
                                    value={systemHealth.metrics.totalUsers}
                                    color="blue"
                                />
                                <MetricCard
                                    icon={<AlertTriangle className="text-red-600" />}
                                    label="Errores (24h)"
                                    value={systemHealth.metrics.recentErrors}
                                    color="red"
                                />
                                <MetricCard
                                    icon={<Clock className="text-yellow-600" />}
                                    label="Transacciones Pendientes"
                                    value={systemHealth.metrics.pendingTransactions}
                                    color="yellow"
                                />
                                <MetricCard
                                    icon={<TrendingUp className="text-green-600" />}
                                    label="Contenido Activo (7d)"
                                    value={systemHealth.metrics.activeContent}
                                    color="green"
                                />
                            </div>
                        </div>

                        {/* AI Analysis */}
                        {systemHealth.aiAnalysis && (
                            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                                    <Zap className="w-5 h-5" />
                                    Análisis de IA
                                </h3>
                                <p className="text-sm text-purple-800 whitespace-pre-wrap">
                                    {systemHealth.aiAnalysis}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="border-b border-gray-200">
                        <div className="flex">
                            <TabButton
                                active={activeTab === 'health'}
                                onClick={() => setActiveTab('health')}
                                icon={<Activity className="w-5 h-5" />}
                                label="Estado de Salud"
                            />
                            <TabButton
                                active={activeTab === 'logs'}
                                onClick={() => setActiveTab('logs')}
                                icon={<AlertTriangle className="w-5 h-5" />}
                                label="Logs de Diagnóstico"
                                badge={diagnosticLogs.length}
                            />
                            <TabButton
                                active={activeTab === 'reports'}
                                onClick={() => setActiveTab('reports')}
                                icon={<CheckCircle className="w-5 h-5" />}
                                label="Reportes de Mantenimiento"
                            />
                        </div>
                    </div>

                    <div className="p-6">
                        {activeTab === 'health' && systemHealth && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold mb-4">Patrones de Error</h3>
                                {systemHealth.errorPatterns && Object.keys(systemHealth.errorPatterns.errorsByCategory).length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        {Object.entries(systemHealth.errorPatterns.errorsByCategory).map(([category, count]) => (
                                            <div key={category} className="bg-gray-50 p-4 rounded-lg text-center">
                                                <div className="text-2xl font-bold text-gray-900">{count}</div>
                                                <div className="text-sm text-gray-600 capitalize">{category}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <CheckCircle className="w-16 h-16 mx-auto mb-2 text-green-500" />
                                        <p>No se detectaron errores en las últimas 24 horas</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'logs' && (
                            <div className="space-y-3">
                                {diagnosticLogs.length > 0 ? (
                                    diagnosticLogs.map((log, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(log.severity)}`}>
                                                            {log.severity}
                                                        </span>
                                                        <span className="text-xs text-gray-500 capitalize">{log.category}</span>
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(log.createdAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-900 font-medium">{log.issue}</p>
                                                    {log.aiAnalysis && (
                                                        <p className="text-sm text-gray-600 mt-2">{log.aiAnalysis}</p>
                                                    )}
                                                    {log.autoResolvedStatus?.attempted && (
                                                        <div className="mt-2 text-xs">
                                                            <span className={`font-medium ${log.autoResolvedStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                                                                {log.autoResolvedStatus.success ? '✓ Auto-resuelto' : '✗ Intento fallido'}
                                                            </span>
                                                            {log.autoResolvedStatus.resolution && (
                                                                <span className="text-gray-600 ml-2">- {log.autoResolvedStatus.resolution}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <CheckCircle className="w-16 h-16 mx-auto mb-2 text-green-500" />
                                        <p>No hay logs de diagnóstico recientes</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'reports' && (
                            <div className="space-y-4">
                                {maintenanceReports.length > 0 ? (
                                    maintenanceReports.map((report, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        Reporte de Mantenimiento
                                                    </h3>
                                                    <p className="text-sm text-gray-500">
                                                        {new Date(report.createdAt).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-3xl font-bold ${getHealthColor(report.healthScore)}`}>
                                                        {report.healthScore}
                                                    </div>
                                                    <div className="text-xs text-gray-500">Health Score</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-4 mb-4">
                                                <div className="text-center p-3 bg-blue-50 rounded">
                                                    <div className="text-lg font-bold text-blue-600">{report.checksPerformed?.blockchain || 0}</div>
                                                    <div className="text-xs text-gray-600">Blockchain Checks</div>
                                                </div>
                                                <div className="text-center p-3 bg-orange-50 rounded">
                                                    <div className="text-lg font-bold text-orange-600">{report.issuesDetected}</div>
                                                    <div className="text-xs text-gray-600">Issues Detected</div>
                                                </div>
                                                <div className="text-center p-3 bg-green-50 rounded">
                                                    <div className="text-lg font-bold text-green-600">{report.issuesResolved}</div>
                                                    <div className="text-xs text-gray-600">Auto-Resolved</div>
                                                </div>
                                                <div className="text-center p-3 bg-purple-50 rounded">
                                                    <div className="text-lg font-bold text-purple-600">{report.recommendations?.length || 0}</div>
                                                    <div className="text-xs text-gray-600">Recomendaciones</div>
                                                </div>
                                            </div>

                                            {report.summary && (
                                                <div className="bg-gray-50 p-4 rounded-lg">
                                                    <h4 className="font-semibold text-gray-900 mb-2">Resumen IA:</h4>
                                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.summary}</p>
                                                </div>
                                            )}

                                            {report.recommendations && report.recommendations.length > 0 && (
                                                <div className="mt-4">
                                                    <h4 className="font-semibold text-gray-900 mb-2">Recomendaciones:</h4>
                                                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                                        {report.recommendations.map((rec, i) => (
                                                            <li key={i}>{rec}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <Clock className="w-16 h-16 mx-auto mb-2" />
                                        <p>No hay reportes de mantenimiento disponibles</p>
                                        <p className="text-sm mt-2">El primer reporte se generará automáticamente a las 3:00 AM</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const MetricCard = ({ icon, label, value, color }) => (
    <div className={`bg-${color}-50 p-4 rounded-lg border border-${color}-200`}>
        <div className="flex items-center gap-3">
            {icon}
            <div>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-sm text-gray-600">{label}</div>
            </div>
        </div>
    </div>
);

const TabButton = ({ active, onClick, icon, label, badge }) => (
    <button
        onClick={onClick}
        className={`flex-1 px-6 py-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${active
            ? 'border-blue-600 text-blue-600 bg-blue-50'
            : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
    >
        {icon}
        <span className="font-medium">{label}</span>
        {badge !== undefined && badge > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {badge}
            </span>
        )}
    </button>
);

export default DiagnosticDashboard;
