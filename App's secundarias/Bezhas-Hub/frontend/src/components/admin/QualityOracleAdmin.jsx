/**
 * ============================================================================
 * QUALITY ORACLE ADMIN PANEL
 * ============================================================================
 * 
 * Panel de administración completo para el Quality Oracle multi-sector.
 * Diseñado para Admin, CEO y Desarrolladores.
 * 
 * Funcionalidades:
 * - Dashboard de métricas globales y por sector
 * - Gestión de validadores (aprobar, suspender, slashear)
 * - Configuración de parámetros por sector
 * - Gestión de disputas y escalaciones
 * - Configuración de contratos y roles
 * - Herramientas de desarrollo y testing
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    Users,
    Activity,
    Settings,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Download,
    Upload,
    Search,
    Filter,
    Edit,
    Trash2,
    Eye,
    Play,
    Pause,
    Zap,
    Database,
    Lock,
    Unlock,
    DollarSign,
    BarChart3,
    PieChart,
    Globe,
    Layers,
    Code,
    Terminal,
    AlertCircle,
    Info,
    ExternalLink,
    Copy,
    ChevronDown,
    ChevronRight,
    Plus,
    Minus
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import toast from 'react-hot-toast';
import http from '../../services/http';
import * as oracleService from '../../services/oracle.service';

// Colores para gráficos
const COLORS = {
    primary: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    pink: '#ec4899',
    indigo: '#6366f1'
};

// Configuración de sectores con metadata
const SECTOR_CONFIG = {
    marketplace: { label: 'Marketplace', color: '#3b82f6', icon: '🛒' },
    logistics: { label: 'Logística', color: '#10b981', icon: '📦' },
    payments: { label: 'Pagos & Escrow', color: '#f59e0b', icon: '💳' },
    ai_moderation: { label: 'IA & Moderación', color: '#8b5cf6', icon: '🤖' },
    identity: { label: 'Identidad & KYC', color: '#06b6d4', icon: '🪪' },
    real_estate: { label: 'Inmobiliario', color: '#ec4899', icon: '🏠' },
    healthcare: { label: 'Salud', color: '#ef4444', icon: '🏥' },
    manufacturing: { label: 'Manufactura', color: '#84cc16', icon: '🏭' },
    automotive: { label: 'Automotriz', color: '#f97316', icon: '🚗' },
    energy: { label: 'Energía', color: '#eab308', icon: '⚡' },
    agriculture: { label: 'Agricultura', color: '#22c55e', icon: '🌾' },
    education: { label: 'Educación', color: '#0ea5e9', icon: '📚' },
    insurance: { label: 'Seguros', color: '#a855f7', icon: '🛡️' },
    entertainment: { label: 'Entretenimiento', color: '#f43f5e', icon: '🎬' },
    legal: { label: 'Legal', color: '#6366f1', icon: '⚖️' },
    supply_chain: { label: 'Cadena Suministro', color: '#14b8a6', icon: '🔗' },
    government: { label: 'Gobierno', color: '#64748b', icon: '🏛️' },
    carbon_credits: { label: 'Créditos Carbono', color: '#15803d', icon: '🌱' }
};

export default function QualityOracleAdmin() {
    // Estado de tabs internos
    const [activeSubTab, setActiveSubTab] = useState('overview');

    // Estados de datos
    const [globalStats, setGlobalStats] = useState(null);
    const [sectorStats, setSectorStats] = useState({});
    const [validators, setValidators] = useState([]);
    const [disputes, setDisputes] = useState([]);
    const [pendingValidations, setPendingValidations] = useState([]);
    const [contractConfig, setContractConfig] = useState(null);

    // Estados de UI
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSector, setSelectedSector] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedValidator, setExpandedValidator] = useState(null);

    // Estados de modales
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showAddValidatorModal, setShowAddValidatorModal] = useState(false);
    const [selectedValidatorAction, setSelectedValidatorAction] = useState(null);

    // Tabs del panel
    const subTabs = [
        { id: 'overview', label: 'Resumen', icon: BarChart3 },
        { id: 'validators', label: 'Validadores', icon: Users },
        { id: 'disputes', label: 'Disputas', icon: AlertTriangle },
        { id: 'sectors', label: 'Sectores', icon: Layers },
        { id: 'config', label: 'Configuración', icon: Settings },
        { id: 'developer', label: 'Developer', icon: Code }
    ];

    /**
     * Cargar todos los datos
     */
    const loadAllData = useCallback(async () => {
        try {
            setRefreshing(true);

            // Cargar estadísticas globales
            const statsResponse = await fetchGlobalStats();
            setGlobalStats(statsResponse);

            // Cargar validadores
            const validatorsResponse = await fetchValidators();
            setValidators(validatorsResponse);

            // Cargar disputas
            const disputesResponse = await fetchDisputes();
            setDisputes(disputesResponse);

            // Cargar configuración
            const configResponse = await fetchContractConfig();
            setContractConfig(configResponse);

        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Error al cargar datos del Oracle');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);

    /**
     * Fetch funciones con fallback a mock data
     */
    const fetchGlobalStats = async () => {
        try {
            const response = await oracleService.getOracleGlobalStats();
            return response;
        } catch (error) {
            // Mock data para desarrollo
            return generateMockGlobalStats();
        }
    };

    const fetchValidators = async () => {
        try {
            const response = await http.get('/api/oracle/admin/validators');
            return response.data?.validators || [];
        } catch (error) {
            return generateMockValidators();
        }
    };

    const fetchDisputes = async () => {
        try {
            const response = await http.get('/api/oracle/admin/disputes');
            return response.data?.disputes || [];
        } catch (error) {
            return generateMockDisputes();
        }
    };

    const fetchContractConfig = async () => {
        try {
            const response = await http.get('/api/oracle/admin/config');
            return response.data;
        } catch (error) {
            return generateMockConfig();
        }
    };

    /**
     * Mock data generators
     */
    const generateMockGlobalStats = () => ({
        overview: {
            totalValidations: 15689,
            pendingValidations: 234,
            approvedToday: 156,
            rejectedToday: 23,
            averageQuality: 87.5,
            totalValidators: 89,
            activeValidators: 67,
            totalStaked: 2456000,
            totalRewardsDistributed: 123456,
            disputesOpen: 12,
            disputesResolved: 345
        },
        trends: {
            validationsChange: 12.5,
            qualityChange: 2.3,
            stakingChange: 8.7,
            disputeChange: -15.2
        },
        timeline: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            validations: Math.floor(Math.random() * 100) + 50,
            approved: Math.floor(Math.random() * 80) + 40,
            rejected: Math.floor(Math.random() * 20) + 5,
            quality: 80 + Math.random() * 15
        })),
        sectorBreakdown: Object.keys(SECTOR_CONFIG).map(sector => ({
            sector,
            validations: Math.floor(Math.random() * 1000) + 100,
            quality: 80 + Math.random() * 15,
            validators: Math.floor(Math.random() * 20) + 5
        }))
    });

    const generateMockValidators = () => [
        { address: '0x1234...5678', name: 'Validator Alpha', stake: 50000, validations: 456, accuracy: 98.5, sectors: ['marketplace', 'logistics'], status: 'active', since: '2025-06-15' },
        { address: '0x2345...6789', name: 'Validator Beta', stake: 35000, validations: 312, accuracy: 96.2, sectors: ['payments', 'ai_moderation'], status: 'active', since: '2025-08-20' },
        { address: '0x3456...7890', name: 'Validator Gamma', stake: 75000, validations: 678, accuracy: 99.1, sectors: ['real_estate', 'healthcare'], status: 'active', since: '2025-05-10' },
        { address: '0x4567...8901', name: 'Validator Delta', stake: 25000, validations: 189, accuracy: 94.8, sectors: ['marketplace'], status: 'suspended', since: '2025-09-01' },
        { address: '0x5678...9012', name: 'Validator Epsilon', stake: 100000, validations: 890, accuracy: 97.7, sectors: ['all'], status: 'active', since: '2025-03-25' }
    ];

    const generateMockDisputes = () => [
        { id: 'D-001', validationId: 'V-12345', sector: 'marketplace', status: 'open', raisedBy: '0x1111...2222', validator: '0x3333...4444', reason: 'Calidad incorrecta', createdAt: '2026-01-28', stake: 500 },
        { id: 'D-002', validationId: 'V-12346', sector: 'logistics', status: 'under_review', raisedBy: '0x5555...6666', validator: '0x7777...8888', reason: 'Validación injusta', createdAt: '2026-01-27', stake: 750 },
        { id: 'D-003', validationId: 'V-12347', sector: 'payments', status: 'resolved', raisedBy: '0x9999...0000', validator: '0xAAAA...BBBB', reason: 'Score manipulado', createdAt: '2026-01-25', resolution: 'validator_slashed', stake: 1000 }
    ];

    const generateMockConfig = () => ({
        contract: {
            address: '0x742d35Cc6634C0532925a3b844Bc9e7595f5e4E2',
            network: 'Polygon Mainnet',
            version: '2.1.0',
            paused: false
        },
        parameters: {
            minStake: 1000,
            minQualityThreshold: 60,
            disputeTimeout: 7,
            validatorMinStake: 1000,
            penaltyMultiplier: 150,
            rewardMultiplier: 120
        },
        roles: {
            admin: ['0xAdmin1...', '0xAdmin2...'],
            dao: ['0xDAO1...'],
            arbitrator: ['0xArb1...', '0xArb2...']
        },
        entityTypes: [
            { type: 'PRODUCT', threshold: 60, collateral: 100, fee: 5, active: true },
            { type: 'SERVICE', threshold: 70, collateral: 200, fee: 10, active: true },
            { type: 'NFT', threshold: 50, collateral: 50, fee: 2, active: true },
            { type: 'RWA', threshold: 80, collateral: 1000, fee: 50, active: true },
            { type: 'LOGISTICS', threshold: 75, collateral: 150, fee: 8, active: true },
            { type: 'POST', threshold: 30, collateral: 5, fee: 0.5, active: true }
        ]
    });

    /**
     * Acciones de administrador
     */
    const handlePauseContract = async () => {
        try {
            await http.post('/api/oracle/admin/pause');
            toast.success('Contrato pausado');
            loadAllData();
        } catch (error) {
            toast.error('Error al pausar contrato');
        }
    };

    const handleUnpauseContract = async () => {
        try {
            await http.post('/api/oracle/admin/unpause');
            toast.success('Contrato reanudado');
            loadAllData();
        } catch (error) {
            toast.error('Error al reanudar contrato');
        }
    };

    const handleSuspendValidator = async (address) => {
        try {
            await http.post(`/api/oracle/admin/validator/${address}/suspend`);
            toast.success('Validador suspendido');
            loadAllData();
        } catch (error) {
            toast.error('Error al suspender validador');
        }
    };

    const handleReactivateValidator = async (address) => {
        try {
            await http.post(`/api/oracle/admin/validator/${address}/reactivate`);
            toast.success('Validador reactivado');
            loadAllData();
        } catch (error) {
            toast.error('Error al reactivar validador');
        }
    };

    const handleSlashValidator = async (address, amount, reason) => {
        try {
            await http.post(`/api/oracle/admin/validator/${address}/slash`, { amount, reason });
            toast.success(`Validador slashed: ${amount} BEZ`);
            loadAllData();
        } catch (error) {
            toast.error('Error al slashear validador');
        }
    };

    const handleResolveDispute = async (disputeId, inFavorOfOwner) => {
        try {
            await http.post(`/api/oracle/admin/dispute/${disputeId}/resolve`, { inFavorOfOwner });
            toast.success('Disputa resuelta');
            loadAllData();
        } catch (error) {
            toast.error('Error al resolver disputa');
        }
    };

    const handleUpdateConfig = async (key, value) => {
        try {
            await http.put('/api/oracle/admin/config', { [key]: value });
            toast.success('Configuración actualizada');
            loadAllData();
        } catch (error) {
            toast.error('Error al actualizar configuración');
        }
    };

    /**
     * Copiar al portapapeles
     */
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copiado al portapapeles');
    };

    /**
     * Exportar datos
     */
    const handleExportData = (type) => {
        const data = type === 'validators' ? validators :
            type === 'disputes' ? disputes :
                globalStats;

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `oracle_${type}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        toast.success('Datos exportados');
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-gray-400">Cargando Quality Oracle Admin...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-500" />
                        Quality Oracle - Panel Admin
                    </h2>
                    <p className="text-gray-400 mt-1">
                        Gestión completa del Oracle multi-sector para Admin, CEO y Developers
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Estado del contrato */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${contractConfig?.contract?.paused
                            ? 'bg-red-900/30 text-red-400 border border-red-800'
                            : 'bg-green-900/30 text-green-400 border border-green-800'
                        }`}>
                        {contractConfig?.contract?.paused ? (
                            <>
                                <Pause className="w-4 h-4" />
                                <span className="text-sm font-medium">Pausado</span>
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4" />
                                <span className="text-sm font-medium">Activo</span>
                            </>
                        )}
                    </div>

                    <button
                        onClick={loadAllData}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Sub-navigation */}
            <div className="flex gap-2 border-b border-gray-700 pb-4 overflow-x-auto">
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${activeSubTab === tab.id
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content based on active tab */}
            {activeSubTab === 'overview' && (
                <OverviewTab
                    stats={globalStats}
                    sectors={SECTOR_CONFIG}
                    onExport={() => handleExportData('stats')}
                />
            )}

            {activeSubTab === 'validators' && (
                <ValidatorsTab
                    validators={validators}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    selectedSector={selectedSector}
                    setSelectedSector={setSelectedSector}
                    expandedValidator={expandedValidator}
                    setExpandedValidator={setExpandedValidator}
                    onSuspend={handleSuspendValidator}
                    onReactivate={handleReactivateValidator}
                    onSlash={handleSlashValidator}
                    onExport={() => handleExportData('validators')}
                    sectors={SECTOR_CONFIG}
                />
            )}

            {activeSubTab === 'disputes' && (
                <DisputesTab
                    disputes={disputes}
                    onResolve={handleResolveDispute}
                    onExport={() => handleExportData('disputes')}
                    sectors={SECTOR_CONFIG}
                />
            )}

            {activeSubTab === 'sectors' && (
                <SectorsTab
                    stats={globalStats?.sectorBreakdown || []}
                    sectors={SECTOR_CONFIG}
                />
            )}

            {activeSubTab === 'config' && (
                <ConfigTab
                    config={contractConfig}
                    onPause={handlePauseContract}
                    onUnpause={handleUnpauseContract}
                    onUpdateConfig={handleUpdateConfig}
                    copyToClipboard={copyToClipboard}
                />
            )}

            {activeSubTab === 'developer' && (
                <DeveloperTab
                    config={contractConfig}
                    copyToClipboard={copyToClipboard}
                />
            )}
        </div>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Overview Tab - Dashboard principal con métricas
 */
function OverviewTab({ stats, sectors, onExport }) {
    if (!stats) return null;

    const { overview, trends, timeline, sectorBreakdown } = stats;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <KPICard
                    title="Total Validaciones"
                    value={overview?.totalValidations?.toLocaleString() || '0'}
                    trend={trends?.validationsChange}
                    icon={Activity}
                    color="blue"
                />
                <KPICard
                    title="Pendientes"
                    value={overview?.pendingValidations || '0'}
                    icon={Clock}
                    color="yellow"
                />
                <KPICard
                    title="Aprobadas Hoy"
                    value={overview?.approvedToday || '0'}
                    icon={CheckCircle}
                    color="green"
                />
                <KPICard
                    title="Rechazadas Hoy"
                    value={overview?.rejectedToday || '0'}
                    icon={XCircle}
                    color="red"
                />
                <KPICard
                    title="Calidad Promedio"
                    value={`${overview?.averageQuality?.toFixed(1) || '0'}%`}
                    trend={trends?.qualityChange}
                    icon={TrendingUp}
                    color="purple"
                />
                <KPICard
                    title="Validadores Activos"
                    value={`${overview?.activeValidators || '0'}/${overview?.totalValidators || '0'}`}
                    icon={Users}
                    color="cyan"
                />
            </div>

            {/* Staking & Rewards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-900/30 rounded-lg">
                            <DollarSign className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Total Staked</p>
                            <p className="text-2xl font-bold text-white">
                                {(overview?.totalStaked || 0).toLocaleString()} BEZ
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">+{trends?.stakingChange || 0}%</span>
                        <span className="text-gray-500">vs semana pasada</span>
                    </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-green-900/30 rounded-lg">
                            <Zap className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Rewards Distribuidos</p>
                            <p className="text-2xl font-bold text-white">
                                {(overview?.totalRewardsDistributed || 0).toLocaleString()} BEZ
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-red-900/30 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Disputas Abiertas</p>
                            <p className="text-2xl font-bold text-white">
                                {overview?.disputesOpen || 0}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-400">{overview?.disputesResolved || 0} resueltas total</span>
                    </div>
                </div>
            </div>

            {/* Timeline Chart */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-white">Validaciones (últimos 30 días)</h3>
                    <button
                        onClick={onExport}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
                    >
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                            labelStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="approved" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Aprobadas" />
                        <Area type="monotone" dataKey="rejected" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} name="Rechazadas" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Sector Breakdown */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-6">Distribución por Sector</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {sectorBreakdown?.slice(0, 12).map((sector) => (
                        <div
                            key={sector.sector}
                            className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{sectors[sector.sector]?.icon}</span>
                                <span className="text-sm text-gray-400">{sectors[sector.sector]?.label}</span>
                            </div>
                            <p className="text-xl font-bold text-white">{sector.validations}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <div
                                    className="h-1.5 rounded-full bg-gradient-to-r from-green-500 to-green-400"
                                    style={{ width: `${sector.quality}%` }}
                                />
                                <span className="text-xs text-gray-500">{sector.quality?.toFixed(0)}%</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Validators Tab - Gestión de validadores
 */
function ValidatorsTab({
    validators,
    searchTerm,
    setSearchTerm,
    selectedSector,
    setSelectedSector,
    expandedValidator,
    setExpandedValidator,
    onSuspend,
    onReactivate,
    onSlash,
    onExport,
    sectors
}) {
    const filteredValidators = validators.filter(v => {
        const matchesSearch = v.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSector = selectedSector === 'all' || v.sectors.includes(selectedSector);
        return matchesSearch && matchesSector;
    });

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar validador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                    <option value="all">Todos los sectores</option>
                    {Object.entries(sectors).map(([key, config]) => (
                        <option key={key} value={key}>{config.icon} {config.label}</option>
                    ))}
                </select>

                <button
                    onClick={onExport}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
                >
                    <Download className="w-4 h-4" />
                    Exportar
                </button>
            </div>

            {/* Validators Table */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-900/50">
                        <tr>
                            <th className="text-left p-4 text-gray-400 font-medium">Validador</th>
                            <th className="text-left p-4 text-gray-400 font-medium">Stake</th>
                            <th className="text-left p-4 text-gray-400 font-medium">Validaciones</th>
                            <th className="text-left p-4 text-gray-400 font-medium">Precisión</th>
                            <th className="text-left p-4 text-gray-400 font-medium">Sectores</th>
                            <th className="text-left p-4 text-gray-400 font-medium">Estado</th>
                            <th className="text-right p-4 text-gray-400 font-medium">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredValidators.map((validator) => (
                            <React.Fragment key={validator.address}>
                                <tr className="border-t border-gray-700 hover:bg-gray-700/30">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                                {validator.name?.[0] || 'V'}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{validator.name || 'Anónimo'}</p>
                                                <p className="text-gray-500 text-sm font-mono">{validator.address}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-white font-medium">{validator.stake.toLocaleString()} BEZ</span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-white">{validator.validations}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`font-medium ${validator.accuracy >= 95 ? 'text-green-400' :
                                                validator.accuracy >= 90 ? 'text-yellow-400' : 'text-red-400'
                                            }`}>
                                            {validator.accuracy}%
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            {validator.sectors.slice(0, 3).map(s => (
                                                <span key={s} className="text-lg" title={sectors[s]?.label}>
                                                    {sectors[s]?.icon || '📋'}
                                                </span>
                                            ))}
                                            {validator.sectors.length > 3 && (
                                                <span className="text-gray-500 text-sm">+{validator.sectors.length - 3}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${validator.status === 'active'
                                                ? 'bg-green-900/30 text-green-400'
                                                : 'bg-red-900/30 text-red-400'
                                            }`}>
                                            {validator.status === 'active' ? 'Activo' : 'Suspendido'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setExpandedValidator(
                                                    expandedValidator === validator.address ? null : validator.address
                                                )}
                                                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                                title="Ver detalles"
                                            >
                                                <Eye className="w-4 h-4 text-gray-400" />
                                            </button>
                                            {validator.status === 'active' ? (
                                                <button
                                                    onClick={() => onSuspend(validator.address)}
                                                    className="p-2 hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title="Suspender"
                                                >
                                                    <Pause className="w-4 h-4 text-red-400" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onReactivate(validator.address)}
                                                    className="p-2 hover:bg-green-900/30 rounded-lg transition-colors"
                                                    title="Reactivar"
                                                >
                                                    <Play className="w-4 h-4 text-green-400" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onSlash(validator.address, 100, 'Manual slash')}
                                                className="p-2 hover:bg-yellow-900/30 rounded-lg transition-colors"
                                                title="Slashear"
                                            >
                                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Expanded Details */}
                                {expandedValidator === validator.address && (
                                    <tr className="bg-gray-900/50">
                                        <td colSpan={7} className="p-4">
                                            <div className="grid grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-gray-500 text-sm">Desde</p>
                                                    <p className="text-white">{validator.since}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-sm">Todos los sectores</p>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {validator.sectors.map(s => (
                                                            <span key={s} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                                                                {sectors[s]?.label || s}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-sm">Historial</p>
                                                    <button className="text-blue-400 hover:underline text-sm">
                                                        Ver validaciones →
                                                    </button>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500 text-sm">Acciones</p>
                                                    <div className="flex gap-2 mt-1">
                                                        <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
                                                            Editar
                                                        </button>
                                                        <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Disputes Tab - Gestión de disputas
 */
function DisputesTab({ disputes, onResolve, onExport, sectors }) {
    const getStatusBadge = (status) => {
        const config = {
            open: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: 'Abierta' },
            under_review: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'En Revisión' },
            resolved: { bg: 'bg-green-900/30', text: 'text-green-400', label: 'Resuelta' }
        };
        const c = config[status] || config.open;
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
                {c.label}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-yellow-900/20 rounded-xl p-4 border border-yellow-800/50">
                    <p className="text-yellow-400 text-sm">Abiertas</p>
                    <p className="text-2xl font-bold text-white">
                        {disputes.filter(d => d.status === 'open').length}
                    </p>
                </div>
                <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-800/50">
                    <p className="text-blue-400 text-sm">En Revisión</p>
                    <p className="text-2xl font-bold text-white">
                        {disputes.filter(d => d.status === 'under_review').length}
                    </p>
                </div>
                <div className="bg-green-900/20 rounded-xl p-4 border border-green-800/50">
                    <p className="text-green-400 text-sm">Resueltas</p>
                    <p className="text-2xl font-bold text-white">
                        {disputes.filter(d => d.status === 'resolved').length}
                    </p>
                </div>
            </div>

            {/* Disputes List */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 divide-y divide-gray-700">
                {disputes.map((dispute) => (
                    <div key={dispute.id} className="p-4 hover:bg-gray-700/30">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-white font-medium">{dispute.id}</span>
                                    {getStatusBadge(dispute.status)}
                                    <span className="text-2xl">{sectors[dispute.sector]?.icon}</span>
                                </div>
                                <p className="text-gray-400 text-sm mb-2">{dispute.reason}</p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span>Validación: {dispute.validationId}</span>
                                    <span>Stake: {dispute.stake} BEZ</span>
                                    <span>Fecha: {dispute.createdAt}</span>
                                </div>
                            </div>
                            {dispute.status !== 'resolved' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onResolve(dispute.id, true)}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                                    >
                                        A favor del Usuario
                                    </button>
                                    <button
                                        onClick={() => onResolve(dispute.id, false)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                                    >
                                        A favor del Validador
                                    </button>
                                </div>
                            )}
                            {dispute.resolution && (
                                <span className={`px-3 py-1 rounded text-sm ${dispute.resolution === 'validator_slashed'
                                        ? 'bg-red-900/30 text-red-400'
                                        : 'bg-green-900/30 text-green-400'
                                    }`}>
                                    {dispute.resolution === 'validator_slashed' ? 'Validador Slashed' : 'Usuario Penalizado'}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Sectors Tab - Vista de sectores
 */
function SectorsTab({ stats, sectors }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(sectors).map(([key, config]) => {
                const sectorData = stats.find(s => s.sector === key) || {};
                return (
                    <div
                        key={key}
                        className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-4xl">{config.icon}</span>
                            <div>
                                <h3 className="text-lg font-semibold text-white">{config.label}</h3>
                                <p className="text-gray-500 text-sm">{key}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-white">{sectorData.validations || 0}</p>
                                <p className="text-gray-500 text-xs">Validaciones</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-400">{sectorData.quality?.toFixed(0) || 0}%</p>
                                <p className="text-gray-500 text-xs">Calidad</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-blue-400">{sectorData.validators || 0}</p>
                                <p className="text-gray-500 text-xs">Validadores</p>
                            </div>
                        </div>
                        <div
                            className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden"
                        >
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${sectorData.quality || 0}%`,
                                    backgroundColor: config.color
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Config Tab - Configuración del contrato
 */
function ConfigTab({ config, onPause, onUnpause, onUpdateConfig, copyToClipboard }) {
    if (!config) return null;

    return (
        <div className="space-y-6">
            {/* Contract Info */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-400" />
                    Información del Contrato
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-gray-500 text-sm">Dirección</p>
                        <div className="flex items-center gap-2">
                            <code className="text-white font-mono text-sm">{config.contract?.address?.slice(0, 10)}...</code>
                            <button onClick={() => copyToClipboard(config.contract?.address)} className="text-gray-400 hover:text-white">
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Red</p>
                        <p className="text-white">{config.contract?.network}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Versión</p>
                        <p className="text-white">v{config.contract?.version}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Control</p>
                        <button
                            onClick={config.contract?.paused ? onUnpause : onPause}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${config.contract?.paused
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                        >
                            {config.contract?.paused ? 'Reanudar Contrato' : 'Pausar Contrato'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Parameters */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-purple-400" />
                    Parámetros del Oracle
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {Object.entries(config.parameters || {}).map(([key, value]) => (
                        <div key={key} className="bg-gray-700/50 rounded-lg p-4">
                            <p className="text-gray-400 text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    type="number"
                                    defaultValue={value}
                                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                                    onBlur={(e) => onUpdateConfig(key, e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Entity Types */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-cyan-400" />
                    Configuración de Tipos de Entidad
                </h3>
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-gray-500 text-sm">
                            <th className="p-3">Tipo</th>
                            <th className="p-3">Umbral</th>
                            <th className="p-3">Colateral</th>
                            <th className="p-3">Fee</th>
                            <th className="p-3">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {config.entityTypes?.map((entity) => (
                            <tr key={entity.type} className="border-t border-gray-700">
                                <td className="p-3 text-white font-medium">{entity.type}</td>
                                <td className="p-3 text-gray-300">{entity.threshold}%</td>
                                <td className="p-3 text-gray-300">{entity.collateral} BEZ</td>
                                <td className="p-3 text-gray-300">{entity.fee} BEZ</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${entity.active ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'
                                        }`}>
                                        {entity.active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Roles */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-yellow-400" />
                    Roles y Permisos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(config.roles || {}).map(([role, addresses]) => (
                        <div key={role} className="bg-gray-700/50 rounded-lg p-4">
                            <p className="text-gray-400 text-sm uppercase mb-2">{role}</p>
                            <div className="space-y-1">
                                {addresses.map((addr, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <code className="text-white text-sm font-mono">{addr}</code>
                                        <button onClick={() => copyToClipboard(addr)} className="text-gray-500 hover:text-white">
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Developer Tab - Herramientas de desarrollo
 */
function DeveloperTab({ config, copyToClipboard }) {
    const [testResult, setTestResult] = useState(null);

    const runTest = async (testName) => {
        setTestResult({ loading: true, name: testName });
        await new Promise(r => setTimeout(r, 1500));
        setTestResult({
            loading: false,
            name: testName,
            success: Math.random() > 0.2,
            message: 'Test completed successfully'
        });
    };

    return (
        <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-green-400" />
                    Herramientas de Desarrollo
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => runTest('Contract Health')}
                        className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                    >
                        <Activity className="w-6 h-6 text-green-400 mb-2" />
                        <p className="text-white font-medium">Health Check</p>
                        <p className="text-gray-500 text-sm">Verificar estado del contrato</p>
                    </button>
                    <button
                        onClick={() => runTest('Sync State')}
                        className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                    >
                        <RefreshCw className="w-6 h-6 text-blue-400 mb-2" />
                        <p className="text-white font-medium">Sync State</p>
                        <p className="text-gray-500 text-sm">Sincronizar con blockchain</p>
                    </button>
                    <button
                        onClick={() => runTest('Run Tests')}
                        className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                    >
                        <Play className="w-6 h-6 text-purple-400 mb-2" />
                        <p className="text-white font-medium">Run Tests</p>
                        <p className="text-gray-500 text-sm">Ejecutar tests unitarios</p>
                    </button>
                    <button
                        onClick={() => runTest('Clear Cache')}
                        className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                    >
                        <Trash2 className="w-6 h-6 text-red-400 mb-2" />
                        <p className="text-white font-medium">Clear Cache</p>
                        <p className="text-gray-500 text-sm">Limpiar caché local</p>
                    </button>
                </div>

                {/* Test Result */}
                {testResult && (
                    <div className={`mt-4 p-4 rounded-lg ${testResult.loading ? 'bg-blue-900/30 border border-blue-800' :
                            testResult.success ? 'bg-green-900/30 border border-green-800' :
                                'bg-red-900/30 border border-red-800'
                        }`}>
                        <div className="flex items-center gap-3">
                            {testResult.loading ? (
                                <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                            ) : testResult.success ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-400" />
                            )}
                            <span className="text-white">{testResult.name}</span>
                            {!testResult.loading && (
                                <span className="text-gray-400 text-sm ml-auto">{testResult.message}</span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* API Endpoints */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-cyan-400" />
                    API Endpoints
                </h3>
                <div className="space-y-3">
                    {[
                        { method: 'GET', path: '/api/oracle/stats/global', desc: 'Estadísticas globales' },
                        { method: 'GET', path: '/api/oracle/queue/:sector', desc: 'Cola de validación por sector' },
                        { method: 'POST', path: '/api/oracle/vote', desc: 'Enviar voto de validación' },
                        { method: 'POST', path: '/api/oracle/validator/register', desc: 'Registrar como validador' },
                        { method: 'GET', path: '/api/oracle/validator/:address/stats', desc: 'Stats del validador' },
                        { method: 'POST', path: '/api/oracle/admin/pause', desc: 'Pausar contrato (Admin)' },
                        { method: 'POST', path: '/api/oracle/admin/validator/:addr/slash', desc: 'Slashear validador (Admin)' }
                    ].map((endpoint, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
                            <span className={`px-2 py-1 rounded text-xs font-mono ${endpoint.method === 'GET' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'
                                }`}>
                                {endpoint.method}
                            </span>
                            <code className="text-white font-mono text-sm flex-1">{endpoint.path}</code>
                            <span className="text-gray-500 text-sm">{endpoint.desc}</span>
                            <button
                                onClick={() => copyToClipboard(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${endpoint.path}`)}
                                className="text-gray-500 hover:text-white"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Contract ABI */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Code className="w-5 h-5 text-yellow-400" />
                    Contract ABI
                </h3>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                        <Download className="w-4 h-4" />
                        Descargar ABI
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
                        <ExternalLink className="w-4 h-4" />
                        Ver en Polygonscan
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * KPI Card Component
 */
function KPICard({ title, value, trend, icon: Icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-900/30 text-blue-400',
        green: 'bg-green-900/30 text-green-400',
        yellow: 'bg-yellow-900/30 text-yellow-400',
        red: 'bg-red-900/30 text-red-400',
        purple: 'bg-purple-900/30 text-purple-400',
        cyan: 'bg-cyan-900/30 text-cyan-400'
    };

    return (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-gray-500 text-sm">{title}</p>
        </div>
    );
}
