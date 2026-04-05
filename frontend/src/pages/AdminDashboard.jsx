import React, { useState, useEffect, Suspense } from 'react';
import { usePageView, useTelemetry } from '../utils/telemetry';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
    Users,
    MessageCircle,
    Star,
    Activity,
    LayoutDashboard,
    TrendingUp,
    FileText,
    UserPlus,
    RefreshCw,
    AlertCircle,
    Shield,
    Database,
    Settings,
    BarChart3,
    PieChart as PieChartIcon,
    LineChart as LineChartIcon,
    Search,
    Filter,
    Download,
    Upload,
    CheckCircle,
    XCircle,
    Clock,
    Cpu,
    HardDrive,
    Wallet,
    Brain,
    ArrowUpRight,
    Scale,
    Crown,
    // Bridge, // Removed because it is not exported by lucide-react
    Eye,
    EyeOff,
    Link as LinkIcon,
    KeyRound,
    Webhook,
    Lock,
    Workflow
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Link } from 'react-router-dom';
import http from '../services/http';
import toast from 'react-hot-toast';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi';
import StatCard from '../components/admin/StatCard';
import UserCard from '../components/admin/UserCard';
import ActivityCard from '../components/admin/ActivityCard';
import TelemetryAnalyticsPanel from '../components/admin/TelemetryAnalyticsPanel';
import AdminAegisChatPanel from '../components/admin/AdminAegisChatPanel';
import AdminAegisActionsPanel from '../components/admin/AdminAegisActionsPanel';
import BeZhasAIChat from '../components/AI/BeZhasChat';

// Lazy load heavy components
const TreasuryManagement = React.lazy(() => import('../components/admin/TreasuryManagement'));
const ChatAISettings = React.lazy(() => import('../components/admin/ChatAISettings'));
const AIFeaturesPanel = React.lazy(() => import('../components/admin/AIFeaturesPanel'));
const BezCoinExchange = React.lazy(() => import('../components/admin/BezCoinExchange'));
const DAOAdmin = React.lazy(() => import('../components/admin/DAOAdmin'));
const UsersManagement = React.lazy(() => import('../components/admin/UsersManagement'));
const QualityEscrowManager = React.lazy(() => import('../components/admin/QualityEscrowManager'));
const QualityNotifications = React.lazy(() => import('../components/QualityNotifications'));
const QualityAnalytics = React.lazy(() => import('../components/admin/QualityAnalytics'));
const QualityOracleAdmin = React.lazy(() => import('../components/admin/QualityOracleAdmin'));
const BridgeApiKeysManager = React.lazy(() => import('../components/admin/BridgeApiKeysManager'));
const SystemUpdateManager = React.lazy(() => import('../components/admin/SystemUpdateManager'));
const SDKVIPManager = React.lazy(() => import('../components/admin/SDKVIPManager'));
const DiagnosticDashboard = React.lazy(() => import('../components/admin/DiagnosticDashboard'));
const HRDashboard = React.lazy(() => import('../components/admin/HRDashboard'));
const DevDashboard = React.lazy(() => import('../components/admin/DevDashboard'));
const AdminUserProfileEditor = React.lazy(() => import('../components/admin/AdminUserProfileEditor'));

// Base API is configured via services/http (VITE_API_URL or Vite proxy)
const USE_MOCK = (import.meta.env.VITE_USE_MOCK === '1' || String(import.meta.env.VITE_USE_MOCK).toLowerCase() === 'true');
const USE_SSE = (import.meta.env.VITE_ADMIN_SSE === '1' || String(import.meta.env.VITE_ADMIN_SSE).toLowerCase() === 'true');

export default function AdminDashboard() {
    usePageView(); // Telemetría de vista de página

    // Admin authentication hook
    const { isAuthorized, isLoading: authLoading, userRole, roleLabel, permissions, roleColor, error: authError, hasPermission } = useAdminAuth();
    const { address: connectedAddress } = useAccount();

    // Helper: build config with wallet auth header for all admin API calls
    const adminConfig = (extra = {}) => ({
        ...extra,
        headers: {
            ...(extra.headers || {}),
            ...(connectedAddress ? { 'x-wallet-address': connectedAddress } : {}),
        },
    });

    // Tab navigation state
    const [activeTab, setActiveTab] = useState('dashboard');

    // Web3 states
    const [bezhasToken, setBezhasToken] = useState(null);
    const [userAddress, setUserAddress] = useState(null);
    const [provider, setProvider] = useState(null);

    // Dashboard data states
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalPosts: 0,
        totalGroups: 0,
        activeUsers24h: 0,
    });
    const [recentUsers, setRecentUsers] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);

    // Analytics data states
    const [analytics, setAnalytics] = useState(null);
    const [timeline, setTimeline] = useState([]);

    // Users data states
    const [allUsers, setAllUsers] = useState([]);
    const [userFilters, setUserFilters] = useState({
        search: '',
        role: '',
        verified: '',
        suspended: ''
    });
    const [usersPagination, setUsersPagination] = useState({
        page: 1,
        limit: 10,
        total: 0
    });
    const [selectedUsers, setSelectedUsers] = useState([]);

    // System data states
    const [systemHealth, setSystemHealth] = useState(null);
    const [logs, setLogs] = useState([]);
    const [logLevel, setLogLevel] = useState('all');

    // Common states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Telemetría: evento de acceso al panel admin (DEBE estar en el nivel superior)
    useTelemetry('admin', 'dashboard_access');

    // Track whether auth has failed to prevent retry storms
    const authFailedRef = React.useRef(false);
    const fetchControllerRef = React.useRef(null);

    // Fetch all data when connectedAddress is ready (prevents race condition)
    useEffect(() => {
        // Don't fetch until wallet is connected - prevents 401 storm
        if (!connectedAddress) return;
        // Reset auth failure flag when wallet changes
        authFailedRef.current = false;
        fetchAllData();
        initializeWeb3();
        // Cleanup: abort in-flight requests on unmount
        return () => {
            if (fetchControllerRef.current) fetchControllerRef.current.abort();
        };
    }, [connectedAddress]);

    // Initialize Web3 and contracts
    const initializeWeb3 = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const address = await signer.getAddress();

                setProvider(provider);
                setUserAddress(address);

                // Load config (addresses + ABIs) from backend
                const configRes = await http.get('/api/config');
                const appConfig = configRes.data;
                const addresses = appConfig.contractAddresses || {};
                const tokenABI = { abi: appConfig.abis?.BezhasTokenABI || [] };

                // Initialize BezhasToken contract
                const bezTokenAddr = addresses.BezhasTokenAddress || addresses.BezhasToken;
                if (bezTokenAddr) {
                    const tokenContract = new ethers.Contract(
                        bezTokenAddr,
                        tokenABI.abi,
                        signer
                    );
                    setBezhasToken(tokenContract);
                } else {
                    console.warn('BezhasToken address not found in configuration');
                }
            }
        } catch (error) {
            console.error('Error initializing Web3:', error);
        }
    };

    // Fetch users when filters change
    useEffect(() => {
        if (activeTab === 'users') {
            fetchAllUsers();
        }
    }, [userFilters, usersPagination.page, activeTab]);

    // Subscribe to SSE for system health when on System tab (optional)
    useEffect(() => {
        if (!USE_SSE) return;
        if (activeTab !== 'system') return;
        const es = new EventSource('/api/admin/v1/stream/health');
        es.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                setSystemHealth(data);
            } catch (_) { }
        };
        es.onerror = () => {
            // Auto close on error to avoid reconnection storms; UI already has manual refresh
            es.close();
        };
        return () => es.close();
    }, [activeTab]);

    // Subscribe to SSE for recent activity when on Activity tab (optional)
    useEffect(() => {
        if (!USE_SSE) return;
        if (activeTab !== 'activity') return;
        const es = new EventSource('/api/admin/v1/stream/activity');
        es.onmessage = (evt) => {
            try {
                const activity = JSON.parse(evt.data);
                setRecentActivity((prev) => [activity, ...prev].slice(0, 20));
            } catch (_) { }
        };
        es.onerror = () => {
            es.close();
        };
        return () => es.close();
    }, [activeTab]);

    // Avoid multiple mock toasts in StrictMode
    const mockToastShownRef = React.useRef(false);

    const fetchAllData = async () => {
        // Circuit breaker: don't re-fetch if auth already failed
        if (authFailedRef.current) return;

        try {
            setLoading(true);
            setError(null);

            const config = adminConfig();

            // If no wallet connected, skip API calls entirely
            if (!connectedAddress && !localStorage.getItem('adminWalletAddress')) {
                setError('Conecta tu wallet de admin para cargar el dashboard');
                setLoading(false);
                return;
            }

            try {
                const [statsRes, usersRes, activityRes, analyticsRes, timelineRes, healthRes, logsRes] = await Promise.all([
                    http.get(`/api/admin/v1/stats`, config),
                    http.get(`/api/admin/v1/users/recent`, config),
                    http.get(`/api/admin/v1/activity/recent`, config),
                    http.get(`/api/admin/v1/analytics/overview`, config),
                    http.get(`/api/admin/v1/analytics/timeline`, config),
                    http.get(`/api/admin/v1/system/health`, config),
                    http.get(`/api/admin/v1/system/logs`, config)
                ]);

                setStats(statsRes.data);
                setRecentUsers(usersRes.data || []);
                setRecentActivity(activityRes.data || []);
                setAnalytics(analyticsRes.data);
                setTimeline(timelineRes.data || []);
                setSystemHealth(healthRes.data);
                setLogs(logsRes.data?.logs || []);
            } catch (apiError) {
                // 401/403 = auth problem → stop retrying to prevent storm
                const status = apiError?.response?.status;
                if (status === 401 || status === 403) {
                    authFailedRef.current = true;
                    setError('No autorizado. Verifica que tu wallet esté conectada y tenga permisos de admin.');
                    return; // Don't fallback to mock on auth errors
                }

                // Fallback solo en modo mock
                if (USE_MOCK) {
                    console.warn('Backend no disponible, usando datos de demostración:', apiError.message);

                    // Datos de demostración
                    setStats({
                        totalUsers: 1247,
                        activeUsers: 856,
                        totalTransactions: 3421,
                        totalVolume: '1,234.56 BZH',
                        dailyActiveUsers: 342,
                        weeklyGrowth: '+12.5%'
                    });

                    setRecentUsers([
                        { id: 1, address: '0x1234...5678', joinedAt: new Date().toISOString(), verified: true },
                        { id: 2, address: '0xabcd...ef90', joinedAt: new Date(Date.now() - 86400000).toISOString(), verified: false },
                        { id: 3, address: '0x9876...5432', joinedAt: new Date(Date.now() - 172800000).toISOString(), verified: true }
                    ]);

                    setRecentActivity([
                        { id: 1, type: 'transaction', user: '0x1234...5678', action: 'Transfer', timestamp: new Date().toISOString() },
                        { id: 2, type: 'post', user: '0xabcd...ef90', action: 'New Post', timestamp: new Date(Date.now() - 3600000).toISOString() },
                        { id: 3, type: 'stake', user: '0x9876...5432', action: 'Staked 100 BZH', timestamp: new Date(Date.now() - 7200000).toISOString() }
                    ]);

                    setAnalytics({
                        totalRevenue: 45678.90,
                        totalUsers: 1247,
                        activeUsers: 856,
                        conversionRate: 68.5,
                        totalPosts: 2300,
                    });

                    setTimeline([
                        { date: '2025-10-15', users: 1100, posts: 220 },
                        { date: '2025-10-16', users: 1150, posts: 245 },
                        { date: '2025-10-17', users: 1180, posts: 260 },
                        { date: '2025-10-18', users: 1200, posts: 300 },
                        { date: '2025-10-19', users: 1220, posts: 310 },
                        { date: '2025-10-20', users: 1235, posts: 315 },
                        { date: '2025-10-21', users: 1247, posts: 325 }
                    ]);

                    setSystemHealth({
                        status: 'operational',
                        uptime: 99.98,
                        cpu: 45,
                        memory: 62,
                        disk: 38,
                        apiLatency: 120
                    });

                    setLogs([
                        { id: 1, level: 'info', message: 'Sistema iniciado correctamente', timestamp: new Date().toISOString() },
                        { id: 2, level: 'warning', message: 'Uso de CPU elevado detectado', timestamp: new Date(Date.now() - 3600000).toISOString() },
                        { id: 3, level: 'info', message: 'Backup completado exitosamente', timestamp: new Date(Date.now() - 7200000).toISOString() }
                    ]);

                    if (!mockToastShownRef.current) {
                        mockToastShownRef.current = true;
                        toast.success('Usando datos de demostración (backend no disponible)', { duration: 3000 });
                    }
                } else {
                    throw apiError;
                }
            }
        } catch (err) {
            console.error('Error crítico en fetchAllData:', err);
            setError('Error crítico al inicializar el dashboard');
            toast.error('Error crítico al cargar datos del dashboard');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllUsers = async () => {
        try {
            const config = adminConfig({
                params: {
                    page: usersPagination.page,
                    limit: usersPagination.limit,
                    ...userFilters
                }
            });

            const response = await http.get(`/api/admin/v1/users`, config);
            setAllUsers(response.data.users || []);
            setUsersPagination(prev => ({
                ...prev,
                total: response.data.total || 0
            }));
        } catch (err) {
            console.error('Error fetching users:', err);
            toast.error('Error al cargar usuarios');
        }
    };

    const handleUserAction = async (userId, action) => {
        try {
            await http.post(
                `/api/admin/v1/users/${userId}/${action}`,
                {},
                adminConfig()
            );

            // Telemetría: acción admin sobre usuario
            useTelemetry('admin', `user_${action}`, { userId });

            toast.success(`Usuario ${action === 'verify' ? 'verificado' : 'suspendido'} correctamente`);
            fetchAllData();
        } catch (err) {
            console.error(`Error ${action} user:`, err);
            toast.error(`Error al ${action === 'verify' ? 'verificar' : 'suspender'} usuario`);
        }
    };

    const handleBulkAction = async (action) => {
        if (selectedUsers.length === 0) {
            toast.error('No hay usuarios seleccionados');
            return;
        }

        try {
            await http.post(
                `/api/admin/v1/users/bulk`,
                { userIds: selectedUsers, action },
                adminConfig()
            );

            toast.success(`Acción ${action} aplicada a ${selectedUsers.length} usuarios`);
            setSelectedUsers([]);
            fetchAllUsers();
        } catch (err) {
            console.error('Error bulk action:', err);
            toast.error('Error al aplicar acción masiva');
        }
    };

    const handleUserFilterChange = (key, value) => {
        setUserFilters(prev => ({ ...prev, [key]: value }));
        setUsersPagination(prev => ({ ...prev, page: 1 }));
    };

    // Tab configuration - Chat & IA y Diagnóstico IA ahora están en /admin/ai
    const tabs = [
        { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
        { id: 'dao', label: 'DAO', icon: Scale },
        { id: 'treasury', label: 'Tesorería', icon: Wallet },
        { id: 'quality-oracle', label: 'Quality Oracle', icon: Shield },
        { id: 'bridge', label: 'Bridge API', icon: ArrowUpRight },
        { id: 'sdk-vip', label: 'SDK & VIP', icon: Crown },
        { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
        { id: 'users', label: 'Usuarios', icon: Users },
        { id: 'hr', label: 'Recursos Humanos', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'HUMAN_RESOURCES'] },
        { id: 'devs', label: 'Desarrolladores', icon: Database, roles: ['SUPER_ADMIN', 'DEVELOPER'] },
        { id: 'profile-config', label: 'Ajustes Perfiles', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN', 'HUMAN_RESOURCES'] },
        { id: 'updates', label: 'Actualizaciones', icon: Cpu },
        { id: 'modules', label: 'Módulos', icon: Database },
        { id: 'activity', label: 'Actividad', icon: Activity },
        { id: 'content', label: 'Contenido', icon: FileText },
        { id: 'system', label: 'Sistema', icon: Settings }
    ].filter(tab => !tab.roles || tab.roles.includes(userRole));

    // Colors for charts
    const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

    // Check authentication first
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-300">Verificando permisos de administrador...</p>
                </div>
            </div>
        );
    }

    // If not authorized, show access denied
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-8">
                    <Lock className="w-20 h-20 text-red-500 mx-auto mb-6" />
                    <h1 className="text-3xl font-bold text-white mb-4">Acceso Denegado</h1>
                    <p className="text-gray-300 mb-2">
                        {authError || 'No tienes permisos para acceder al Panel de Administración'}
                    </p>
                    <div className="bg-gray-800/50 rounded-lg p-4 mt-6 border border-gray-700">
                        <p className="text-sm text-gray-400 mb-3">
                            <strong className="text-white">Roles autorizados:</strong>
                        </p>
                        <ul className="text-sm text-gray-400 space-y-2 text-left">
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-yellow-500" />
                                <span>Super Admin (Equipo Fundador)</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-500" />
                                <span>Admin</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-purple-500" />
                                <span>Developer</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-500" />
                                <span>Treasury (Tesorería y Desarrollo DAO)</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-cyan-500" />
                                <span>DAO Manager</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-orange-500" />
                                <span>Community (Recompensas/Staking)</span>
                            </li>
                        </ul>
                    </div>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-300">Cargando dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-300 mb-4">{error}</p>
                    <button
                        onClick={fetchAllData}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
            <div className="max-w-none mx-0">
                {/* BEZ-Coin Exchange (Polygon) */}
                <Suspense fallback={null}>
                    <BezCoinExchange />
                </Suspense>

                {/* Quality Oracle Notifications removed - using TopNavbar Bell instead */}

                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Panel de Administración</h1>
                        <p className="text-gray-400">Gestión completa de la plataforma BeZhas</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Role Badge */}
                        <div className={`px-4 py-2 rounded-lg font-semibold text-sm shadow-lg ${roleColor === 'gold' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                            roleColor === 'blue' ? 'bg-blue-500 text-white' :
                                roleColor === 'purple' ? 'bg-purple-500 text-white' :
                                    roleColor === 'green' ? 'bg-green-500 text-white' :
                                        roleColor === 'cyan' ? 'bg-cyan-500 text-white' :
                                            roleColor === 'orange' ? 'bg-orange-500 text-white' :
                                                'bg-gray-600 text-white'
                            }`}>
                            <div className="flex items-center gap-2">
                                <Shield size={16} />
                                <span>{roleLabel || userRole}</span>
                            </div>
                        </div>
                        {userAddress && (
                            <div className="text-sm text-gray-400 font-mono">
                                {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-2 mb-6">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
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

                {/* Tab Content */}
                <div className="space-y-6">
                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && (
                        <>
                            {/* KPI Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard
                                    title="Total Usuarios"
                                    value={stats.totalUsers}
                                    icon={Users}
                                    trend={{ value: 12, isPositive: true }}
                                    bgGradient="from-blue-500 to-blue-600"
                                />
                                <StatCard
                                    title="Publicaciones"
                                    value={stats.totalPosts}
                                    icon={MessageCircle}
                                    trend={{ value: 8, isPositive: true }}
                                    bgGradient="from-purple-500 to-purple-600"
                                />
                                <StatCard
                                    title="Grupos Activos"
                                    value={stats.totalGroups}
                                    icon={Star}
                                    trend={{ value: 5, isPositive: true }}
                                    bgGradient="from-pink-500 to-pink-600"
                                />
                                <StatCard
                                    title="Usuarios Activos (24h)"
                                    value={stats.activeUsers24h}
                                    icon={Activity}
                                    trend={{ value: 3, isPositive: true }}
                                    bgGradient="from-green-500 to-green-600"
                                />
                            </div>

                            {/* Panel de Telemetría y ML */}
                            <div className="mt-8">
                                <TelemetryAnalyticsPanel />
                            </div>

                            {/* Intelligence & Automation Hub */}
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link
                                    to="/admin/ai"
                                    className="block bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl p-6 hover:border-purple-500/60 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg shadow-purple-500/30">
                                                <Brain size={28} className="text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white">Centro de IA</h3>
                                                <p className="text-gray-400 text-sm">Agentes, Diagnóstico y LLM</p>
                                            </div>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    to="/admin/automation"
                                    className="block bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/30 rounded-xl p-6 hover:border-blue-500/60 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl shadow-lg shadow-blue-500/30">
                                                <Workflow size={28} className="text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white">Automation Hub</h3>
                                                <p className="text-gray-400 text-sm">Vibe Builder y flujos dinámicos MCP</p>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </div>

                            {/* Chat Panel IA (Aegis y Central) */}
                            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <AdminAegisChatPanel />
                                <div>
                                   <div className="mb-4">
                                      <h3 className="text-xl font-bold text-white flex items-center gap-2"><Brain className="text-blue-400" /> BeZhas AI Interactive</h3>
                                      <p className="text-gray-400 text-sm">Agente central interactivo conectado vía MCP y Automation Engine.</p>
                                   </div>
                                   <BeZhasAIChat />
                                </div>
                            </div>

                            {/* Acciones de administración y auto-healing */}
                            <div className="mt-8">
                                <AdminAegisActionsPanel />
                            </div>
                        </>
                    )}

                    {/* RECURSOS HUMANOS TAB */}
                    {activeTab === 'hr' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando HR...</div>}>
                            <HRDashboard />
                        </Suspense>
                    )}

                    {/* DEVELOPERS TAB */}
                    {activeTab === 'devs' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando Devs...</div>}>
                            <DevDashboard />
                        </Suspense>
                    )}

                    {/* PROFILE CONFIG TAB */}
                    {activeTab === 'profile-config' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando Ajustes...</div>}>
                            <AdminUserProfileEditor />
                        </Suspense>
                    )}

                    {/* DAO TAB */}
                    {activeTab === 'dao' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando DAO...</div>}>
                            <DAOAdmin />
                        </Suspense>
                    )}

                    {/* TREASURY TAB */}
                    {activeTab === 'treasury' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando Tesorería...</div>}>
                            <TreasuryManagement
                                bezhasToken={bezhasToken}
                                userAddress={userAddress}
                            />
                        </Suspense>
                    )}

                    {/* QUALITY ORACLE TAB */}
                    {activeTab === 'quality-oracle' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando Quality Oracle Admin...</div>}>
                            <QualityOracleAdmin />
                        </Suspense>
                    )}

                    {/* BRIDGE API TAB */}
                    {activeTab === 'bridge' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando Bridge API...</div>}>
                            <BridgeApiKeysManager />
                        </Suspense>
                    )}

                    {/* SDK & VIP TAB */}
                    {activeTab === 'sdk-vip' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando SDK & VIP...</div>}>
                            <SDKVIPManager />
                        </Suspense>
                    )}

                    {/* SYSTEM UPDATES TAB */}
                    {activeTab === 'updates' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando gestor de actualizaciones...</div>}>
                            <SystemUpdateManager />
                        </Suspense>
                    )}

                    {/* MODULES TAB */}
                    {activeTab === 'modules' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Automation Engine Card */}
                            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 hover:border-blue-500 transition-colors group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-blue-900/30 rounded-lg group-hover:bg-blue-900/50 transition-colors">
                                        <Cpu className="text-blue-400 w-8 h-8" />
                                    </div>
                                    <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs rounded-full border border-green-900/50">
                                        Activo
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Automation Engine</h3>
                                <p className="text-gray-400 mb-6">
                                    Motor de automatización inteligente para gestión de contenido, moderación y respuestas automáticas.
                                </p>
                                <Link
                                    to="/admin/automation"
                                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium"
                                >
                                    Ir al Hub de Automatización <ArrowUpRight size={18} />
                                </Link>
                            </div>

                            {/* DAO Governance Card */}
                            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 hover:border-purple-500 transition-colors group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-purple-900/30 rounded-lg group-hover:bg-purple-900/50 transition-colors">
                                        <Wallet className="text-purple-400 w-8 h-8" />
                                    </div>
                                    <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs rounded-full border border-green-900/50">
                                        Activo
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">DAO Governance</h3>
                                <p className="text-gray-400 mb-6">
                                    Panel de control para la Organización Autónoma Descentralizada, tesorería y votaciones.
                                </p>
                                <Link
                                    to="/dao"
                                    className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 font-medium"
                                >
                                    Ir al Panel DAO <ArrowUpRight size={18} />
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* ANALYTICS TAB */}
                    {activeTab === 'analytics' && analytics && (
                        <>
                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <StatCard
                                    title="Total Usuarios"
                                    value={analytics.totalUsers}
                                    icon={Users}
                                    trend={{ value: 12, isPositive: true }}
                                    bgGradient="from-blue-500 to-blue-600"
                                />
                                <StatCard
                                    title="Total Posts"
                                    value={analytics.totalPosts}
                                    icon={MessageCircle}
                                    trend={{ value: 8, isPositive: true }}
                                    bgGradient="from-purple-500 to-purple-600"
                                />
                                <StatCard
                                    title="Total Tokens"
                                    value={`${analytics.totalTokens}K`}
                                    icon={Star}
                                    trend={{ value: 5, isPositive: true }}
                                    bgGradient="from-yellow-500 to-yellow-600"
                                />
                                <StatCard
                                    title="Total Grupos"
                                    value={analytics.totalGroups}
                                    icon={Users}
                                    trend={{ value: 3, isPositive: true }}
                                    bgGradient="from-green-500 to-green-600"
                                />
                            </div>

                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Activity Timeline */}
                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <LineChartIcon className="text-blue-400" size={22} />
                                        Actividad Últimos 7 Días
                                    </h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={timeline}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="date" stroke="#9ca3af" />
                                            <YAxis stroke="#9ca3af" />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1f2937',
                                                    border: '1px solid #374151',
                                                    borderRadius: '8px',
                                                    color: '#fff'
                                                }}
                                            />
                                            <Legend />
                                            <Line type="monotone" dataKey="users" stroke="#3b82f6" name="Usuarios" strokeWidth={2} />
                                            <Line type="monotone" dataKey="posts" stroke="#8b5cf6" name="Posts" strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Token Distribution */}
                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <PieChartIcon className="text-purple-400" size={22} />
                                        Distribución de Tokens
                                    </h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={analytics.tokenDistribution || []}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={80}
                                                dataKey="value"
                                            >
                                                {(analytics.tokenDistribution || []).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#1f2937',
                                                    border: '1px solid #374151',
                                                    borderRadius: '8px',
                                                    color: '#fff'
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </>
                    )}

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando Usuarios...</div>}>
                            <UsersManagement />
                        </Suspense>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === 'activity' && (
                        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Activity className="text-green-400" size={22} />
                                Actividad Reciente
                            </h2>
                            <div className="space-y-4">
                                {recentActivity.length > 0 ? (
                                    recentActivity.map((activity, index) => (
                                        <ActivityCard key={index} activity={activity} />
                                    ))
                                ) : (
                                    <p className="text-gray-400 text-center py-8">
                                        No hay actividad reciente
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONTENT TAB */}
                    {activeTab === 'content' && (
                        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <FileText className="text-purple-400" size={22} />
                                Gestión de Contenido
                            </h2>
                            <div className="text-center py-12">
                                <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400 mb-4">
                                    La gestión de contenido está en desarrollo
                                </p>
                                <Link
                                    to="/admin/content"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    Ir a Gestión de Contenido
                                    <TrendingUp size={18} />
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* SYSTEM TAB */}
                    {activeTab === 'system' && systemHealth && (
                        <>
                            {/* Stripe & Frontend Settings */}
                            <StripeAndFrontendSettings />

                            {/* System Health */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-white">Estado del Sistema</h3>
                                        <div className={`w-3 h-3 rounded-full ${systemHealth.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                                            }`} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Uptime</span>
                                            <span className="text-white">{systemHealth.uptime}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Version</span>
                                            <span className="text-white">{systemHealth.version}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-white">Memoria</h3>
                                        <HardDrive className="text-blue-400" size={22} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Usada</span>
                                            <span className="text-white">{systemHealth.memory?.used || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Total</span>
                                            <span className="text-white">{systemHealth.memory?.total || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-white">CPU</h3>
                                        <Cpu className="text-purple-400" size={22} />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Uso</span>
                                            <span className="text-white">{systemHealth.cpu?.usage || 'N/A'}%</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Núcleos</span>
                                            <span className="text-white">{systemHealth.cpu?.cores || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* System Logs */}
                            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        <Database className="text-yellow-400" size={22} />
                                        Logs del Sistema
                                    </h2>
                                    <select
                                        value={logLevel}
                                        onChange={(e) => setLogLevel(e.target.value)}
                                        className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="all">Todos los niveles</option>
                                        <option value="error">Errores</option>
                                        <option value="warn">Advertencias</option>
                                        <option value="info">Info</option>
                                    </select>
                                </div>
                                <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
                                    {logs
                                        .filter(log => logLevel === 'all' || log.level === logLevel)
                                        .map((log, index) => (
                                            <div key={index} className="flex gap-3 py-1 border-b border-gray-800 last:border-0">
                                                <span className="text-gray-500">{log.timestamp}</span>
                                                <span className={`font-semibold ${log.level === 'error' ? 'text-red-400' :
                                                    log.level === 'warn' ? 'text-yellow-400' :
                                                        'text-blue-400'
                                                    }`}>
                                                    [{log.level.toUpperCase()}]
                                                </span>
                                                <span className="text-gray-300">{log.message}</span>
                                            </div>
                                        ))}
                                    {logs.length === 0 && (
                                        <p className="text-gray-500 text-center py-4">No hay logs disponibles</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div >
        </div >
    );
}

function StripeAndFrontendSettings() {
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showSecret, setShowSecret] = useState(false);
    const [showWebhook, setShowWebhook] = useState(false);
    const [form, setForm] = useState({ secretKey: '', webhookSecret: '', frontendUrl: '' });
    const [health, setHealth] = useState(null);

    useEffect(() => {
        // Load current masked settings and health
        (async () => {
            try {
                const [settingsRes, healthRes] = await Promise.all([
                    http.get('/api/admin/settings/payments/stripe'),
                    http.get('/api/payment/health')
                ]);
                const s = settingsRes.data?.settings || {};
                setForm({
                    secretKey: s.stripe?.secretKey || '',
                    webhookSecret: s.stripe?.webhookSecret || '',
                    frontendUrl: s.frontendUrl || ''
                });
                setHealth(healthRes.data);
            } catch (err) {
                console.warn('Failed to load settings/health', err);
            }
        })();
    }, []);

    const save = async () => {
        try {
            setLoading(true);
            const payload = { stripe: {}, frontendUrl: undefined };
            // Only send if the admin typed a real value (not masked dots)
            if (form.secretKey && form.secretKey.startsWith('sk_')) payload.stripe.secretKey = form.secretKey;
            if (form.webhookSecret && form.webhookSecret.startsWith('whsec_')) payload.stripe.webhookSecret = form.webhookSecret;
            if (form.frontendUrl) payload.frontendUrl = form.frontendUrl;

            const res = await http.put('/api/admin/settings/payments/stripe', payload);
            toast.success('Configuración guardada');
            // Refresh health after save
            const healthRes = await http.get('/api/payment/health');
            setHealth(healthRes.data);
            // Replace masked from backend
            const s = res.data?.settings || {};
            setForm({
                secretKey: s.stripe?.secretKey || '',
                webhookSecret: s.stripe?.webhookSecret || '',
                frontendUrl: s.frontendUrl || ''
            });
        } catch (err) {
            console.error('Save failed', err);
            toast.error('Error al guardar configuración');
        } finally {
            setLoading(false);
        }
    };

    const testStripe = async () => {
        try {
            setTesting(true);
            const res = await http.post('/api/admin/settings/payments/stripe/test');
            toast.success(`Stripe OK (acct: ${res.data?.account?.id || 'ok'})`);
        } catch (err) {
            toast.error(`Stripe error: ${err.response?.data?.error || err.message}`);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Settings className="text-blue-400" size={22} />
                Configuración de Pasarela (Stripe) y Frontend
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stripe Secret */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <KeyRound size={16} className="text-blue-400" /> STRIPE_SECRET_KEY
                    </label>
                    <div className="relative">
                        <input
                            type={showSecret ? 'text' : 'password'}
                            value={form.secretKey}
                            onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
                            placeholder="sk_test_..."
                            className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                        >
                            {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Webhook Secret */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <Webhook size={16} className="text-purple-400" /> STRIPE_WEBHOOK_SECRET
                    </label>
                    <div className="relative">
                        <input
                            type={showWebhook ? 'text' : 'password'}
                            value={form.webhookSecret}
                            onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                            placeholder="whsec_..."
                            className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={() => setShowWebhook(!showWebhook)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                        >
                            {showWebhook ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                {/* Frontend URL */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        <LinkIcon size={16} className="text-green-400" /> FRONTEND_URL
                    </label>
                    <input
                        type="text"
                        value={form.frontendUrl}
                        onChange={(e) => setForm({ ...form, frontendUrl: e.target.value })}
                        placeholder="http://localhost:5173"
                        className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Actions and Health */}
            <div className="mt-6 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                <div className="flex gap-3">
                    <button
                        onClick={save}
                        disabled={loading}
                        className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Guardando…' : 'Guardar Cambios'}
                    </button>
                    <button
                        onClick={testStripe}
                        disabled={testing}
                        className="px-5 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                        {testing ? 'Probando…' : 'Probar Clave Stripe'}
                    </button>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 w-full lg:w-auto">
                    <div className="text-sm text-gray-300">Estado de Pagos</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        <span className={`px-2 py-1 rounded ${health?.stripeSecretConfigured ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                            Clave Stripe {health?.stripeSecretConfigured ? 'OK' : 'Falta'}
                        </span>
                        <span className={`px-2 py-1 rounded ${health?.webhookConfigured ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                            Webhook {health?.webhookConfigured ? 'OK' : 'Falta'}
                        </span>
                        <span className="px-2 py-1 rounded bg-blue-900/30 text-blue-300">
                            FRONTEND_URL: {health?.frontendUrl || 'N/A'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
