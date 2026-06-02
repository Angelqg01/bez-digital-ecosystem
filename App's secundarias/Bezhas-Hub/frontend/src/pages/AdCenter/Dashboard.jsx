import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAccount, useConnect } from 'wagmi';
import {
    FaRocket,
    FaChartLine,
    FaUserCircle,
    FaPlay,
    FaPause,
    FaEye,
    FaMousePointer,
    FaWallet,
    FaPlus,
    FaClock,
    FaCheckCircle
} from 'react-icons/fa';
import { campaignsService, billingService } from '../../services/adCenter.service';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const navigate = useNavigate();
    const { isConnected } = useAccount();
    const { connect, connectors } = useConnect();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [balance, setBalance] = useState(null);
    const [recentCampaigns, setRecentCampaigns] = useState([]);

    // 🔥 Auto-conectar wallet al cargar la página (solo una vez)
    useEffect(() => {
        let connectAttempted = false;
        if (!isConnected && connectors.length > 0 && !connectAttempted) {
            connectAttempted = true;
            const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
            if (injectedConnector) {
                const connectPromise = connect({ connector: injectedConnector });
                if (connectPromise && typeof connectPromise.catch === 'function') {
                    connectPromise.catch(err => {
                        if (import.meta.env.DEV) console.log('Auto-connect skipped:', err);
                    });
                }
            }
        }
    }, []); // Solo ejecutar una vez al montar

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Timeout de 5 segundos para evitar carga infinita
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 5000)
            );

            // Cargar datos en paralelo con timeout
            const [summaryRes, balanceRes, campaignsRes] = await Promise.race([
                Promise.all([
                    campaignsService.getCampaignsSummary().catch(() => ({ success: false })),
                    billingService.getBalance().catch(() => ({ success: false })),
                    campaignsService.getCampaigns({ limit: 5, page: 1 }).catch(() => ({ success: false }))
                ]),
                timeout
            ]).catch(() => [{ success: false }, { success: false }, { success: false }]);

            if (summaryRes?.success) setSummary(summaryRes.data);
            if (balanceRes?.success) setBalance(balanceRes.data);
            if (campaignsRes?.success) setRecentCampaigns(campaignsRes.data);
        } catch (error) {
            console.error('Error loading dashboard:', error);
            // No mostrar error si es solo problema de backend
            if (error.message !== 'Timeout') {
                toast.error('Backend no disponible');
            }
        } finally {
            setLoading(false);
        }
    };

    const quickActions = [
        {
            title: 'Aumenta tu público',
            description: 'Crea una campaña publicitaria y llega a miles de usuarios',
            icon: FaRocket,
            color: 'from-purple-600 to-pink-600',
            action: () => navigate('/ad-center/create-campaign/1')
        },
        {
            title: 'Presenta tu marca',
            description: 'Edita tu perfil de anunciante y destaca tu proyecto',
            icon: FaUserCircle,
            color: 'from-blue-600 to-cyan-600',
            action: () => navigate('/ad-center/profile')
        },
        {
            title: 'Mide tu rendimiento',
            description: 'Analiza métricas y optimiza tus campañas',
            icon: FaChartLine,
            color: 'from-green-600 to-emerald-600',
            action: () => navigate('/ad-center/campaigns')
        }
    ];

    const getStatusColor = (status) => {
        const colors = {
            active: 'bg-green-500',
            paused: 'bg-yellow-500',
            pending: 'bg-blue-500',
            completed: 'bg-gray-500',
            rejected: 'bg-red-500'
        };
        return colors[status] || 'bg-gray-500';
    };

    const getStatusLabel = (status) => {
        const labels = {
            active: 'Activa',
            paused: 'Pausada',
            pending_approval: 'Pendiente',
            completed: 'Completada',
            rejected: 'Rechazada',
            approved: 'Aprobada',
            draft: 'Borrador'
        };
        return labels[status] || status;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4" />
                    <p className="text-gray-400">Cargando dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl font-bold text-white mb-2">
                        Ad Center
                    </h1>
                    <p className="text-gray-400">
                        Gestiona tus campañas publicitarias en BeZhas
                    </p>
                </motion.div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-purple-600 bg-opacity-20 rounded-lg">
                                <FaRocket className="text-2xl text-purple-400" />
                            </div>
                            <span className="text-sm text-gray-400">Campañas</span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1">
                            {summary?.byStatus?.active || 0}
                        </h3>
                        <p className="text-sm text-gray-400">Activas de {summary?.total || 0} totales</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-600 bg-opacity-20 rounded-lg">
                                <FaEye className="text-2xl text-blue-400" />
                            </div>
                            <span className="text-sm text-gray-400">Impresiones</span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1">
                            {(summary?.totalImpressions || 0).toLocaleString()}
                        </h3>
                        <p className="text-sm text-gray-400">CTR: {summary?.averageCTR || '0.00'}%</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-green-600 bg-opacity-20 rounded-lg">
                                <FaMousePointer className="text-2xl text-green-400" />
                            </div>
                            <span className="text-sm text-gray-400">Clics</span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1">
                            {(summary?.totalClicks || 0).toLocaleString()}
                        </h3>
                        <p className="text-sm text-gray-400">CPC: €{summary?.averageCPC || '0.00'}</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-gray-800 rounded-xl p-6 border border-gray-700"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-yellow-600 bg-opacity-20 rounded-lg">
                                <FaWallet className="text-2xl text-yellow-400" />
                            </div>
                            <span className="text-sm text-gray-400">Saldo</span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-1">
                            €{balance?.totalInEur || '0.00'}
                        </h3>
                        <p className="text-sm text-gray-400">
                            {balance?.bez?.amount || 0} BEZ disponibles
                        </p>
                    </motion.div>
                </div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-8"
                >
                    <h2 className="text-2xl font-bold text-white mb-6">
                        ¿Por dónde te gustaría empezar?
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {quickActions.map((action, index) => (
                            <motion.button
                                key={index}
                                onClick={action.action}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-left transition-all hover:border-purple-500 group"
                            >
                                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${action.color} bg-opacity-20 mb-4 group-hover:bg-opacity-30 transition-all`}>
                                    <action.icon className="text-3xl text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">
                                    {action.title}
                                </h3>
                                <p className="text-gray-400">
                                    {action.description}
                                </p>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Recent Campaigns */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">
                            Campañas Recientes
                        </h2>
                        <button
                            onClick={() => navigate('/ad-center/campaigns')}
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                        >
                            Ver todas →
                        </button>
                    </div>

                    {recentCampaigns.length === 0 ? (
                        <div className="bg-gray-800 rounded-xl p-12 border border-gray-700 text-center">
                            <FaRocket className="text-6xl text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">
                                No tienes campañas aún
                            </h3>
                            <p className="text-gray-400 mb-6">
                                Crea tu primera campaña y comienza a llegar a tu audiencia
                            </p>
                            <button
                                onClick={() => navigate('/ad-center/create-campaign/step-1')}
                                className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                            >
                                <FaPlus />
                                <span>Crear Campaña</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recentCampaigns.map((campaign) => (
                                <motion.div
                                    key={campaign._id}
                                    whileHover={{ scale: 1.01 }}
                                    className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all cursor-pointer"
                                    onClick={() => navigate(`/ad-center/campaigns/${campaign._id}`)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-3">
                                                <h3 className="text-lg font-bold text-white">
                                                    {campaign.name}
                                                </h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(campaign.status === 'pending_approval' ? 'pending' : campaign.status)}`}>
                                                    {getStatusLabel(campaign.status)}
                                                </span>
                                            </div>

                                            <div className="flex items-center space-x-6 text-sm text-gray-400">
                                                <div className="flex items-center space-x-2">
                                                    <FaEye />
                                                    <span>{campaign.metrics?.impressions?.toLocaleString() || 0} impresiones</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <FaMousePointer />
                                                    <span>{campaign.metrics?.clicks?.toLocaleString() || 0} clics</span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <FaWallet />
                                                    <span>€{campaign.metrics?.spent?.toFixed(2) || '0.00'} gastados</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            {campaign.status === 'active' && (
                                                <div className="flex items-center space-x-2 text-green-400">
                                                    <FaPlay className="text-sm" />
                                                    <span className="text-xs">En ejecución</span>
                                                </div>
                                            )}
                                            {campaign.status === 'paused' && (
                                                <div className="flex items-center space-x-2 text-yellow-400">
                                                    <FaPause className="text-sm" />
                                                    <span className="text-xs">Pausada</span>
                                                </div>
                                            )}
                                            {campaign.status === 'pending_approval' && (
                                                <div className="flex items-center space-x-2 text-blue-400">
                                                    <FaClock className="text-sm" />
                                                    <span className="text-xs">Pendiente</span>
                                                </div>
                                            )}
                                            {campaign.status === 'approved' && (
                                                <div className="flex items-center space-x-2 text-purple-400">
                                                    <FaCheckCircle className="text-sm" />
                                                    <span className="text-xs">Aprobada</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    {campaign.budget && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                                <span>Presupuesto utilizado</span>
                                                <span>
                                                    €{campaign.metrics?.spent?.toFixed(2) || '0.00'} / €{campaign.budget?.totalBudget?.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-700 rounded-full h-2">
                                                <div
                                                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                                                    style={{
                                                        width: `${Math.min(100, ((campaign.metrics?.spent || 0) / campaign.budget?.totalBudget) * 100)}%`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Low Balance Warning */}
                {balance && parseFloat(balance.totalInEur) < 50 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="mt-6 bg-yellow-900 bg-opacity-20 border border-yellow-600 rounded-xl p-6"
                    >
                        <div className="flex items-start space-x-4">
                            <FaWallet className="text-3xl text-yellow-400 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-2">
                                    Saldo bajo detectado
                                </h3>
                                <p className="text-gray-300 mb-4">
                                    Tu saldo actual es de €{balance.totalInEur}. Te recomendamos recargar fondos para asegurar que tus campañas continúen activas.
                                </p>
                                <button
                                    onClick={() => navigate('/ad-center/billing')}
                                    className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-all"
                                >
                                    <FaPlus />
                                    <span>Añadir Fondos</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
