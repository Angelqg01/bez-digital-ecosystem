import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar
} from 'recharts';
import {
    AlertTriangle, TrendingUp, ShieldCheck, Wallet,
    ArrowUpRight, ArrowDownRight, DollarSign, Activity,
    Clock, CheckCircle, XCircle, RefreshCw
} from 'lucide-react';
import { useTreasuryContract } from '../../hooks/useDAOContracts';
import { formatEther } from 'viem';

// Datos simulados basados en la arquitectura del plugin
const MOCK_PORTFOLIO_DATA = [
    { name: 'Token Nativo', value: 700000, percentage: 70, color: '#6366f1', risk: 'high' },
    { name: 'USDC Stablecoins', value: 200000, percentage: 20, color: '#10b981', risk: 'low' },
    { name: 'RWA Bonos', value: 100000, percentage: 10, color: '#f59e0b', risk: 'medium' },
];

const MOCK_CASH_FLOW = [
    { month: 'Ene', ingresos: 45000, gastos: 32000 },
    { month: 'Feb', ingresos: 52000, gastos: 38000 },
    { month: 'Mar', ingresos: 48000, gastos: 35000 },
    { month: 'Abr', ingresos: 61000, gastos: 42000 },
    { month: 'May', ingresos: 58000, gastos: 39000 },
    { month: 'Jun', ingresos: 67000, gastos: 45000 },
];

const MOCK_TRANSACTIONS = [
    {
        id: 1,
        type: 'GRANT',
        description: 'Pago Milestone #4 - Desarrollo Plugin Tesorería',
        amount: 2500,
        token: 'USDC',
        to: '0x742d...8f23',
        status: 'completed',
        timestamp: '2025-11-15 14:23',
        reason: 'Milestone Payment - Smart Contract Development'
    },
    {
        id: 2,
        type: 'ADS',
        description: 'Ingreso Campaña Q4 (DePub Protocol)',
        amount: 12400,
        token: 'USDC',
        to: 'Treasury',
        status: 'completed',
        timestamp: '2025-11-14 09:15',
        reason: 'Ad Revenue Distribution'
    },
    {
        id: 3,
        type: 'VESTING',
        description: 'Liberación Vesting - Core Team Member',
        amount: 5000,
        token: 'DAO',
        to: '0x8a3c...1d45',
        status: 'completed',
        timestamp: '2025-11-13 16:45',
        reason: 'Monthly Vesting Release'
    },
    {
        id: 4,
        type: 'REBALANCE',
        description: 'Swap Automático: DAO → USDC',
        amount: 15000,
        token: 'DAO',
        to: '0x0000...0000',
        status: 'pending',
        timestamp: '2025-11-18 10:30',
        reason: 'Risk Threshold Exceeded (70% > 65%)'
    },
];

const TreasuryDashboard = () => {
    // Estados
    const [portfolioData, setPortfolioData] = useState(MOCK_PORTFOLIO_DATA);
    const [cashFlowData] = useState(MOCK_CASH_FLOW);
    const [transactions] = useState(MOCK_TRANSACTIONS);
    const [riskMetrics, setRiskMetrics] = useState({
        currentExposure: 70,
        threshold: 65,
        needsRebalance: true
    });
    const [totalValue, setTotalValue] = useState(1000000);
    const [monthlyGrowth] = useState(4.5);
    const [isLoading, setIsLoading] = useState(false);

    // Integración con Smart Contracts
    const { needsRebalance, currentExposure, totalValue: onChainTotalValue, assetComposition, executeRebalance, isRebalancing } = useTreasuryContract();

    useEffect(() => {
        if (currentExposure !== undefined && needsRebalance !== undefined) {
            setRiskMetrics(prev => ({
                ...prev,
                currentExposure: Number(currentExposure),
                needsRebalance: needsRebalance
            }));
        }
        if (onChainTotalValue) {
            setTotalValue(Number(formatEther(onChainTotalValue)));
        }
        if (assetComposition) {
            const native = Number(formatEther(assetComposition[0]));
            const stable = Number(formatEther(assetComposition[1]));
            const rwa = Number(formatEther(assetComposition[2]));
            const total = native + stable + rwa;

            if (total > 0) {
                setPortfolioData([
                    { name: 'Token Nativo', value: native, percentage: Math.round((native / total) * 100), color: '#6366f1', risk: 'high' },
                    { name: 'USDC Stablecoins', value: stable, percentage: Math.round((stable / total) * 100), color: '#10b981', risk: 'low' },
                    { name: 'RWA Bonos', value: rwa, percentage: Math.round((rwa / total) * 100), color: '#f59e0b', risk: 'medium' },
                ]);
            }
        }
    }, [currentExposure, needsRebalance, onChainTotalValue, assetComposition]);

    const handleRebalance = async () => {
        setIsLoading(true);
        try {
            // Aquí iría la llamada al contrato
            // await treasuryContract.executeRebalance(USDC_ADDRESS, amountToSwap);

            // Simulación
            setTimeout(() => {
                setRiskMetrics(prev => ({ ...prev, currentExposure: 50, needsRebalance: false }));
                setIsLoading(false);
            }, 2000);
        } catch (error) {
            console.error('Rebalance failed:', error);
            setIsLoading(false);
        }
    };

    const getTypeColor = (type) => {
        const colors = {
            GRANT: 'bg-blue-100 text-blue-700',
            ADS: 'bg-purple-100 text-purple-700',
            VESTING: 'bg-green-100 text-green-700',
            REBALANCE: 'bg-orange-100 text-orange-700',
        };
        return colors[type] || 'bg-gray-100 text-gray-700';
    };

    const getStatusIcon = (status) => {
        return status === 'completed' ? (
            <CheckCircle size={16} className="text-green-600" />
        ) : status === 'pending' ? (
            <Clock size={16} className="text-orange-600" />
        ) : (
            <XCircle size={16} className="text-red-600" />
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="max-w-7xl mx-auto p-6 space-y-6">

                {/* HEADER */}
                <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Wallet className="text-indigo-600" size={32} />
                            Tesorería Automatizada
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Protocolo de Gestión de Activos con Rebalanceo Automático
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all ${riskMetrics.needsRebalance
                            ? 'bg-red-100 text-red-700 animate-pulse'
                            : 'bg-green-100 text-green-700'
                            }`}>
                            {riskMetrics.needsRebalance ? (
                                <>
                                    <AlertTriangle size={18} />
                                    Riesgo Alto ({riskMetrics.currentExposure}%)
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={18} />
                                    Cartera Saludable
                                </>
                            )}
                        </span>
                        <button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium">
                            Nueva Propuesta
                        </button>
                    </div>
                </header>

                {/* KPI CARDS + RISK ALERT */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* Total Value Locked (TVL) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-gray-500">
                                <DollarSign size={20} />
                                <h3 className="font-medium">TVL Total</h3>
                            </div>
                            <div className="bg-green-100 p-2 rounded-lg">
                                <TrendingUp size={20} className="text-green-600" />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                            ${totalValue.toLocaleString()}
                        </p>
                        <span className="text-green-500 text-sm flex items-center mt-2">
                            <ArrowUpRight size={14} className="mr-1" />
                            +{monthlyGrowth}% vs mes anterior
                        </span>
                    </div>

                    {/* Assets Under Management */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-gray-500">
                                <Activity size={20} />
                                <h3 className="font-medium">Activos</h3>
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">3</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Tokens Nativos, Stablecoins, RWA
                        </p>
                    </div>

                    {/* Monthly Net Flow */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-gray-500">
                                <ArrowUpRight size={20} />
                                <h3 className="font-medium">Flujo Neto</h3>
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-green-600">
                            +$22,000
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            Ingresos - Gastos (Jun 2025)
                        </p>
                    </div>

                    {/* Risk Alert Card */}
                    {riskMetrics.needsRebalance && (
                        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl border-2 border-orange-200 p-6 shadow-lg">
                            <div className="flex items-center gap-2 text-orange-800 mb-3">
                                <AlertTriangle size={24} className="animate-pulse" />
                                <h3 className="font-bold text-lg">Acción Requerida</h3>
                            </div>
                            <p className="text-sm text-orange-700 mb-4 leading-relaxed">
                                La exposición al token nativo <strong>({riskMetrics.currentExposure}%)</strong> supera
                                el límite de seguridad del <strong>65%</strong>.
                            </p>
                            <button
                                onClick={handleRebalance}
                                disabled={isLoading}
                                className="w-full bg-orange-600 text-white py-2.5 rounded-xl hover:bg-orange-700 transition-all transform hover:scale-105 text-sm font-semibold shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <RefreshCw size={16} className="animate-spin" />
                                        Ejecutando...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        Ejecutar Rebalanceo
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* SANDWICH GRID: Charts + Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* COLUMN 1: Asset Composition Pie Chart */}
                    <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Activity size={20} className="text-indigo-600" />
                            Composición de Activos
                        </h3>
                        <div className="h-64 w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={portfolioData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {portfolioData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => `$${value.toLocaleString()}`}
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3 mt-4">
                            {portfolioData.map((item) => (
                                <div key={item.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        ></span>
                                        <span className="text-gray-700 font-medium">{item.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-bold text-gray-900">{item.percentage}%</span>
                                        <span className="text-gray-500 text-xs ml-2">
                                            ${(item.value / 1000).toFixed(0)}k
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* COLUMN 2-3: Cash Flow Chart */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <TrendingUp size={20} className="text-green-600" />
                                Flujo de Caja (Últimos 6 meses)
                            </h3>
                            <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                                    <span className="text-gray-600">Ingresos (Ads + Grants)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                                    <span className="text-gray-600">Gastos (HR + Ops)</span>
                                </div>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={cashFlowData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value / 1000}k`} />
                                <Tooltip
                                    formatter={(value) => `$${value.toLocaleString()}`}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255,255,255,0.95)',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Bar dataKey="ingresos" fill="#10b981" radius={[8, 8, 0, 0]} />
                                <Bar dataKey="gastos" fill="#ef4444" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* TRANSACTION HISTORY TABLE */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Clock size={20} className="text-indigo-600" />
                            Historial de Ejecuciones Automatizadas
                        </h3>
                        <button className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
                            Ver Todas
                            <ArrowUpRight size={14} />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 border-b border-gray-100">
                                <tr>
                                    <th className="p-4 text-left font-medium">Tipo</th>
                                    <th className="p-4 text-left font-medium">Descripción</th>
                                    <th className="p-4 text-left font-medium">Valor</th>
                                    <th className="p-4 text-left font-medium">Destinatario</th>
                                    <th className="p-4 text-left font-medium">Estado</th>
                                    <th className="p-4 text-left font-medium">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4">
                                            <span className={`${getTypeColor(tx.type)} px-3 py-1 rounded-full text-xs font-semibold`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-medium text-gray-900">{tx.description}</p>
                                            <p className="text-xs text-gray-500 mt-1">{tx.reason}</p>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-gray-900">
                                                {tx.type === 'ADS' ? '+' : '-'}${tx.amount.toLocaleString()}
                                            </span>
                                            <span className="text-gray-500 text-xs ml-1">{tx.token}</span>
                                        </td>
                                        <td className="p-4 text-gray-600 font-mono text-xs">{tx.to}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(tx.status)}
                                                <span className="capitalize">{tx.status}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-500 text-xs">{tx.timestamp}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default TreasuryDashboard;
