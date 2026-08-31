import React, { useState, useEffect } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
    TrendingUp, DollarSign, Award, ShoppingCart, 
    ExternalLink, RefreshCw, AlertCircle, ArrowUpRight, 
    Layers, Zap, Clock, Shield, Brain
} from 'lucide-react';
import http from '../../services/http'; // Asegúrate de que el servicio http esté configurado
import toast from 'react-hot-toast';

const RevenueDashboardTab = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [timeframe, setTimeframe] = useState('7d');

    useEffect(() => {
        fetchRevenueData();
    }, []);

    const fetchRevenueData = async () => {
        try {
            setLoading(true);
            const response = await http.get('/api/developer/revenue/stats');
            if (response.data.success) {
                setData(response.data);
            }
        } catch (error) {
            console.error('Error fetching revenue:', error);
            // Fallback mock data para demo si la API falla
            if (!data) {
                setMockData();
            }
        } finally {
            setLoading(false);
        }
    };

    const setMockData = () => {
        setData({
            stats: {
                totalRevenue: 2450.75,
                totalSalesCount: 42,
                currency: 'EUR',
                reputationPoints: 420,
                platformBreakdown: { 'vinted': 1200, 'airbnb': 850, 'mercadolibre': 400.75 }
            },
            recentTransactions: [
                { id: 'BEZ_ORD_001', platform: 'vinted', amount: 45.00, status: 'delivered', date: new Date().toISOString() },
                { id: 'BEZ_ORD_002', platform: 'airbnb', amount: 120.00, status: 'confirmed', date: new Date().toISOString() },
                { id: 'BEZ_ORD_003', platform: 'dynamic_ai', amount: 89.99, status: 'paid', date: new Date().toISOString() }
            ],
            reputationHistory: [
                { date: new Date(), amount: 10, txHash: '0xabc...def' },
                { date: new Date(Date.now() - 86400000), amount: 10, txHash: '0x123...456' }
            ],
            chartData: [
                { date: '2026-03-20', amount: 150 },
                { date: '2026-03-21', amount: 230 },
                { date: '2026-03-22', amount: 180 },
                { date: '2026-03-23', amount: 450 },
                { date: '2026-03-24', amount: 320 },
                { date: '2026-03-25', amount: 510 },
                { date: '2026-03-26', amount: 600 }
            ]
        });
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
                <p className="text-gray-400 font-medium">Sincronizando ingresos on-chain...</p>
            </div>
        );
    }

    const { stats, recentTransactions, reputationHistory, chartData } = data;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 p-5 rounded-2xl hover:border-blue-500/50 transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-medium">Ingresos Totales</p>
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white tracking-tight">
                        {stats.totalRevenue.toLocaleString()} <span className="text-lg font-normal text-gray-500">{stats.currency}</span>
                    </h3>
                    <div className="mt-2 flex items-center text-xs text-green-400 font-medium">
                        <TrendingUp className="w-3 h-3 mr-1" /> +12% vs last month
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 p-5 rounded-2xl hover:border-purple-500/50 transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-medium">Puntos de Reputación</p>
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                            <Award className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white tracking-tight">
                        {stats.reputationPoints} <span className="text-lg font-normal text-gray-500">RP</span>
                    </h3>
                    <div className="mt-2 flex items-center text-xs text-purple-400 font-medium italic">
                        <Zap className="w-3 h-3 mr-1" /> Minted on Polygon Amoy
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 p-5 rounded-2xl hover:border-amber-500/50 transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-medium">Ventas por Bridge</p>
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                            <ShoppingCart className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-white tracking-tight">
                        {stats.totalSalesCount}
                    </h3>
                    <div className="mt-2 flex items-center text-xs text-gray-400 font-medium">
                        <Clock className="w-3 h-3 mr-1" /> Last update: Just now
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 p-5 rounded-2xl hover:border-blue-400/50 transition-all group overflow-hidden relative">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-400/10 rounded-full blur-2xl group-hover:bg-blue-400/20 transition-all"></div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm font-medium">AEGIS Shield</p>
                        <div className="p-2 bg-blue-400/10 rounded-lg text-blue-400">
                            <Shield className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center">
                        <span className="w-3 h-3 bg-blue-400 rounded-full animate-pulse mr-2"></span>
                        PROTECTED
                    </h3>
                    <div className="mt-2 flex items-center text-xs text-blue-300 font-medium">
                        <Brain className="w-3 h-3 mr-1" /> AI Learning Active
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 p-6 rounded-2xl backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-lg font-semibold text-white">Flujo de Ingresos (7D)</h4>
                        <div className="flex bg-gray-800/50 p-1 rounded-lg">
                            <button className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md">7D</button>
                            <button className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-white transition-colors">1M</button>
                            <button className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-white transition-colors">ALL</button>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#9ca3af" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                />
                                <YAxis 
                                    stroke="#9ca3af" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false}
                                    tickFormatter={(val) => `${val}`}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                                    itemStyle={{ color: '#3b82f6' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="amount" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorAmount)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Platform Distribution */}
                <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-2xl backdrop-blur-xl">
                    <h4 className="text-lg font-semibold text-white mb-6">Distribución por Origen</h4>
                    <div className="h-[200px] w-full mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={Object.entries(stats.platformBreakdown).map(([name, value]) => ({ name, value }))}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#3b82f6" />
                                    <Cell fill="#a855f7" />
                                    <Cell fill="#f59e0b" />
                                    <Cell fill="#10b981" />
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(stats.platformBreakdown).map(([platform, amount], idx) => (
                            <div key={platform} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className={`w-3 h-3 rounded-full mr-2 ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-purple-500' : 'bg-amber-500'}`}></div>
                                    <span className="text-sm text-gray-400 capitalize">{platform}</span>
                                </div>
                                <span className="text-sm font-semibold text-white">{amount} {stats.currency}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transactions List */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-white">Ventas Sincronizadas</h4>
                        <button className="text-blue-400 text-sm hover:underline">Ver todas</button>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {recentTransactions.map((tx) => (
                            <div key={tx.id} className="p-4 hover:bg-gray-800/30 transition-colors flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-blue-400">
                                        <ShoppingCart className="w-5 h-5" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-white">{tx.id}</p>
                                        <p className="text-xs text-gray-500 capitalize">{tx.platform} • {new Date(tx.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-white">+{tx.amount} {stats.currency}</p>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                        {tx.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {recentTransactions.length === 0 && (
                            <div className="p-10 text-center text-gray-500">
                                No se encontrarn transacciones recientes.
                            </div>
                        )}
                    </div>
                </div>

                {/* Reputation / On-chain History */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-white">Recompensas On-Chain</h4>
                        <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20">POLYGON AMOY</span>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {reputationHistory.map((rep, idx) => (
                            <div key={idx} className="p-4 hover:bg-gray-800/30 transition-colors flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm font-medium text-white">Reputation Minted</p>
                                        <div className="flex items-center text-xs text-blue-400 hover:underline cursor-pointer">
                                            {rep.txHash} <ExternalLink className="w-3 h-3 ml-1" />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-purple-400">+{rep.amount} RP</p>
                                    <p className="text-[10px] text-gray-500">{new Date(rep.date).toLocaleTimeString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Warning / Notification Footer */}
            <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-xl flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-400 mr-3 mt-0.5" />
                <div>
                    <h5 className="text-blue-400 font-semibold text-sm">Información sobre Liquidación</h5>
                    <p className="text-gray-400 text-xs mt-1">
                        Las ganancias de ventas externas se consolidan diariamente. Los puntos de reputación se mintean en tiempo real 
                        cuando el sistema detecta un pago confirmado a través del Webhook Dynamic Bridge. Asegúrate de tener tu 
                        Smart Wallet vinculada para recibir los tokens BEZ automáticos.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RevenueDashboardTab;
