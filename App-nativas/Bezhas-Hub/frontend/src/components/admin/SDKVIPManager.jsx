import React, { useState, useEffect } from 'react';
import {
    Users,
    TrendingUp,
    DollarSign,
    Activity,
    ArrowUpCircle,
    MessageCircle,
    AlertCircle,
    RefreshCw,
    Crown,
    Star,
    Award,
    Zap
} from 'lucide-react';
import http from '../../services/http';
import toast from 'react-hot-toast';

/**
 * SDK & VIP Manager Component
 * Vista interna para el equipo de BeZhas para ver rentabilidad, COGS y métricas por cliente
 */
export default function SDKVIPManager() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        avgROI: 0
    });

    useEffect(() => {
        fetchSDKClients();
    }, []);

    const fetchSDKClients = async () => {
        setLoading(true);
        try {
            const response = await http.get('/api/admin/v1/sdk/clients');
            const clientsData = response.data.clients || [];
            setClients(clientsData);

            // Calculate global stats with safe defaults
            const totalRevenue = clientsData.reduce((sum, c) => sum + (c?.revenue || 0), 0);
            const totalCost = clientsData.reduce((sum, c) => sum + (calculateFinancials(c)?.cost || 0), 0);
            const totalProfit = totalRevenue - totalCost;
            const avgROI = clientsData.length > 0
                ? clientsData.reduce((sum, c) => sum + (calculateFinancials(c)?.roi || 0), 0) / clientsData.length
                : 0;

            setStats({
                totalRevenue,
                totalCost,
                totalProfit,
                avgROI
            });
        } catch (error) {
            console.error('Error fetching SDK clients:', error);
            toast.error('Error al cargar clientes SDK');

            // Fallback to mock data for development
            const mockClients = [
                {
                    id: 1,
                    name: "Empresa Alpha",
                    tier: "Bronze",
                    apiCalls: 25000,
                    txs: 100,
                    revenue: 200,
                    email: "admin@alpha.com",
                    walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                },
                {
                    id: 2,
                    name: "Tech Growth Ltd",
                    tier: "Silver",
                    apiCalls: 350000,
                    txs: 800,
                    revenue: 1000,
                    email: "dev@techgrowth.io",
                    walletAddress: "0x8ba1f109551bD432803012645Ac136ddd64DBA72"
                },
                {
                    id: 3,
                    name: "MegaCorp Inc",
                    tier: "Platinum",
                    apiCalls: 2100000,
                    txs: 12000,
                    revenue: 1500,
                    email: "api@megacorp.com",
                    walletAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
                },
                {
                    id: 4,
                    name: "StartupXYZ",
                    tier: "Gold",
                    apiCalls: 850000,
                    txs: 2500,
                    revenue: 750,
                    email: "tech@startupxyz.com",
                    walletAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
                }
            ];

            setClients(mockClients);

            // Calculate stats with mock data
            const totalRevenue = mockClients.reduce((sum, c) => sum + c.revenue, 0);
            const totalCost = mockClients.reduce((sum, c) => sum + calculateFinancials(c).cost, 0);
            const totalProfit = totalRevenue - totalCost;
            const avgROI = mockClients.reduce((sum, c) => sum + calculateFinancials(c).roi, 0) / mockClients.length;

            setStats({
                totalRevenue,
                totalCost,
                totalProfit,
                avgROI
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Calculate financials based on revenue and tier
     * Platinum (>2M calls): 70% cost, others: 80% cost
     */
    const calculateFinancials = (client) => {
        if (!client) return { cost: 0, profit: 0, roi: 0, costPercentage: 0 };

        const apiCalls = client.apiCalls || 0;
        const revenue = client.revenue || 0;
        const isOptimized = apiCalls > 2000000;
        const costPercentage = isOptimized ? 0.70 : 0.80;

        const cost = revenue * costPercentage;
        const profit = revenue - cost;
        const roi = cost > 0 ? (profit / cost) * 100 : 0;

        return { cost, profit, roi, costPercentage: costPercentage * 100 };
    };

    /**
     * Get tier color and icon
     */
    const getTierConfig = (tier) => {
        switch (tier) {
            case 'Platinum':
                return {
                    color: 'bg-slate-800 text-white border-slate-600',
                    icon: Crown,
                    iconColor: 'text-white'
                };
            case 'Gold':
                return {
                    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    icon: Award,
                    iconColor: 'text-yellow-600'
                };
            case 'Silver':
                return {
                    color: 'bg-gray-100 text-gray-800 border-gray-300',
                    icon: Star,
                    iconColor: 'text-gray-600'
                };
            case 'Bronze':
                return {
                    color: 'bg-orange-100 text-orange-800 border-orange-200',
                    icon: Zap,
                    iconColor: 'text-orange-600'
                };
            default:
                return {
                    color: 'bg-gray-100 text-gray-800 border-gray-300',
                    icon: Users,
                    iconColor: 'text-gray-600'
                };
        }
    };

    /**
     * Upgrade client tier manually
     */
    const handleUpgradeTier = async (clientId, currentTier) => {
        const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
        const currentIndex = tiers.indexOf(currentTier);

        if (currentIndex >= tiers.length - 1) {
            toast.error('El cliente ya está en el tier más alto');
            return;
        }

        const newTier = tiers[currentIndex + 1];

        try {
            await http.post(`/api/admin/v1/sdk/clients/${clientId}/upgrade-tier`, {
                newTier
            });
            toast.success(`Cliente ascendido a ${newTier}`);
            fetchSDKClients(); // Refresh data
        } catch (error) {
            console.error('Error upgrading tier:', error);
            toast.error('Error al ascender tier');
        }
    };

    /**
     * Send push notification to client
     */
    const handleSendPushNotification = async (clientId, clientName) => {
        try {
            await http.post(`/api/admin/v1/sdk/clients/${clientId}/send-message`, {
                message: `Hola ${clientName}, tenemos novedades importantes sobre tu cuenta SDK`,
                subject: 'Actualización de BeZhas SDK'
            });
            toast.success(`Notificación enviada a ${clientName}`);
        } catch (error) {
            console.error('Error sending notification:', error);
            toast.error('Error al enviar notificación');
        }
    };

    /**
     * View detailed metrics for a client
     */
    const handleViewMetrics = (client) => {
        // TODO: Open modal or navigate to detailed metrics page
        toast.info(`Métricas detalladas de ${client.name} (próximamente)`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        SDK & VIP - Administración de Clientes
                    </h2>
                    <p className="text-gray-400">
                        Rentabilidad, COGS y métricas por cliente
                    </p>
                </div>
                <button
                    onClick={fetchSDKClients}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw size={18} />
                    <span>Actualizar</span>
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 backdrop-blur-sm rounded-xl border border-green-700/50 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                            <DollarSign className="text-green-400" size={24} />
                        </div>
                        <div>
                            <p className="text-green-300 text-sm font-medium">Ingresos Totales</p>
                            <p className="text-2xl font-bold text-white">
                                ${(stats.totalRevenue || 0).toFixed(0)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 backdrop-blur-sm rounded-xl border border-red-700/50 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                            <TrendingUp className="text-red-400" size={24} />
                        </div>
                        <div>
                            <p className="text-red-300 text-sm font-medium">Costo Total (COGS)</p>
                            <p className="text-2xl font-bold text-white">
                                ${(stats.totalCost || 0).toFixed(0)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 backdrop-blur-sm rounded-xl border border-blue-700/50 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Activity className="text-blue-400" size={24} />
                        </div>
                        <div>
                            <p className="text-blue-300 text-sm font-medium">Ganancia Neta</p>
                            <p className="text-2xl font-bold text-white">
                                ${(stats.totalProfit || 0).toFixed(0)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 backdrop-blur-sm rounded-xl border border-purple-700/50 p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                            <TrendingUp className="text-purple-400" size={24} />
                        </div>
                        <div>
                            <p className="text-purple-300 text-sm font-medium">ROI Promedio</p>
                            <p className="text-2xl font-bold text-white">
                                {(stats.avgROI || 0).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Clients Table */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-900/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Cliente
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Nivel (Tier)
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    API Usage
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Transacciones
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Ingresos
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Costo (COGS)
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Profit (Neto)
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-gray-800/30 divide-y divide-gray-700">
                            {clients.map((client) => {
                                const { cost, profit, roi, costPercentage } = calculateFinancials(client);
                                const tierConfig = getTierConfig(client.tier);
                                const TierIcon = tierConfig.icon;

                                return (
                                    <tr key={client.id} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="font-medium text-white">{client.name}</div>
                                                {client.email && (
                                                    <div className="text-sm text-gray-400">{client.email}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${tierConfig.color}`}>
                                                <TierIcon size={14} className={tierConfig.iconColor} />
                                                {client.tier}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-300">
                                                {(client.apiCalls || 0).toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-500">calls</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-300">
                                                {(client.txs || 0).toLocaleString()}
                                            </div>
                                            <div className="text-xs text-gray-500">on-chain</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-green-400 font-bold">
                                                ${(client.revenue || 0).toFixed(0)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-red-400">
                                                -${(cost || 0).toFixed(0)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                ({(costPercentage || 0).toFixed(0)}%)
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-white font-medium">
                                                ${(profit || 0).toFixed(0)}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                ROI {(roi || 0).toFixed(1)}%
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleViewMetrics(client)}
                                                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                                                    title="Ver métricas detalladas"
                                                >
                                                    Ver Métricas
                                                </button>
                                                <button
                                                    onClick={() => handleUpgradeTier(client.id, client.tier)}
                                                    disabled={client.tier === 'Platinum'}
                                                    className={`p-2 rounded-lg transition-colors ${client.tier === 'Platinum'
                                                        ? 'text-gray-600 cursor-not-allowed'
                                                        : 'text-purple-400 hover:text-purple-300 hover:bg-purple-900/30'
                                                        }`}
                                                    title="Ascender tier"
                                                >
                                                    <ArrowUpCircle size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleSendPushNotification(client.id, client.name)}
                                                    className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/30 rounded-lg transition-colors"
                                                    title="Enviar notificación push"
                                                >
                                                    <MessageCircle size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {clients.length === 0 && (
                    <div className="p-12 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No hay clientes SDK registrados</p>
                    </div>
                )}
            </div>

            {/* Info Footer */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-blue-400 flex-shrink-0" size={20} />
                    <div className="text-sm text-gray-300">
                        <p className="font-medium text-white mb-1">Cálculo de Costos:</p>
                        <p>
                            • Clientes con <strong>&gt;2M llamadas/mes</strong> (Platinum): <strong>70% COGS</strong>
                        </p>
                        <p>
                            • Otros tiers: <strong>80% COGS</strong>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
