import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaEuroSign, FaCoins, FaCreditCard, FaWallet, FaHistory, FaFilter } from 'react-icons/fa';
import { billingService } from '../../services/adCenter.service';
import toast from 'react-hot-toast';

const BillingPage = () => {
    const [balance, setBalance] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showAddFundsModal, setShowAddFundsModal] = useState(false);
    const [fundMethod, setFundMethod] = useState(null);
    const [fundAmount, setFundAmount] = useState('');
    const [processing, setProcessing] = useState(false);

    // Filtros
    const [filterType, setFilterType] = useState('all');
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

    const loadBalance = useCallback(async () => {
        try {
            const response = await billingService.getBalance();
            if (response.success) {
                setBalance(response.data);
            }
        } catch (error) {
            console.error('Error loading balance:', error);
            toast.error('Error al cargar saldo');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const params = {
                page: pagination.page,
                limit: pagination.limit
            };

            if (filterType !== 'all') {
                params.type = filterType;
            }

            const response = await billingService.getHistory(params);
            if (response.success) {
                const transactions = Array.isArray(response.data)
                    ? response.data
                    : response.data?.transactions || [];
                setHistory(transactions);
                setPagination(prev => ({
                    ...prev,
                    total: response.data?.pagination?.totalPages || response.pagination?.pages || 0
                }));
            }
        } catch (error) {
            console.error('Error loading history:', error);
            toast.error('Error al cargar historial');
        } finally {
            setHistoryLoading(false);
        }
    }, [pagination.page, pagination.limit, filterType]);

    useEffect(() => {
        loadBalance();
        loadHistory();
    }, [loadBalance, loadHistory]);

    const handleAddFiatFunds = async () => {
        const amount = parseFloat(fundAmount);

        if (!amount || amount < 10) {
            toast.error('El monto mínimo es €10');
            return;
        }

        if (amount > 10000) {
            toast.error('El monto máximo es €10,000');
            return;
        }

        setProcessing(true);
        try {
            const response = await billingService.addFiatFunds(amount);

            if (response.success) {
                // Aquí se debería integrar con Stripe Elements
                // Por ahora, simular éxito
                toast.success('Redirigiendo a Stripe...');

                // En producción: window.location.href = response.data.stripeUrl;
                console.log('Stripe Payment Intent:', response.data);

                setTimeout(() => {
                    setShowAddFundsModal(false);
                    setFundAmount('');
                    loadBalance();
                    loadHistory();
                }, 2000);
            }
        } catch (error) {
            console.error('Error adding FIAT funds:', error);
            toast.error(error.response?.data?.message || 'Error al procesar pago');
        } finally {
            setProcessing(false);
        }
    };

    const handleAddBezFunds = async () => {
        const amount = parseFloat(fundAmount);

        if (!amount || amount < 1) {
            toast.error('El monto mínimo es 1 BEZ');
            return;
        }

        setProcessing(true);
        try {
            // Aquí se debería integrar con Web3 para obtener txHash
            // Por ahora, simular
            const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);

            const response = await billingService.addBezFunds(amount, mockTxHash);

            if (response.success) {
                toast.success('Fondos BEZ acreditados exitosamente');
                setShowAddFundsModal(false);
                setFundAmount('');
                loadBalance();
                loadHistory();
            }
        } catch (error) {
            console.error('Error adding BEZ funds:', error);
            toast.error(error.response?.data?.message || 'Error al acreditar BEZ');
        } finally {
            setProcessing(false);
        }
    };

    const transactionTypeLabels = {
        deposit_fiat: 'Depósito FIAT',
        deposit_bez: 'Depósito BEZ',
        campaign_charge: 'Cargo de Campaña',
        daily_charge: 'Cargo Diario',
        ai_usage: 'Consumo IA',
        ai_reservation: 'Reserva IA',
        refund: 'Reembolso',
        adjustment: 'Ajuste'
    };

    const transactionTypeColors = {
        deposit_fiat: 'text-green-400',
        deposit_bez: 'text-purple-400',
        campaign_charge: 'text-red-400',
        daily_charge: 'text-orange-400',
        ai_usage: 'text-cyan-400',
        ai_reservation: 'text-amber-400',
        refund: 'text-blue-400',
        adjustment: 'text-yellow-400'
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando información de billing...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Billing & Fondos
                    </h1>
                    <p className="text-gray-400">
                        Gestiona tu saldo y transacciones publicitarias
                    </p>
                </motion.div>

                {/* Balance Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* FIAT Balance */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <FaEuroSign className="text-3xl opacity-80" />
                            <span className="text-sm opacity-80">FIAT</span>
                        </div>
                        <h3 className="text-4xl font-bold mb-1">
                            €{balance?.fiatBalance?.toFixed(2) || '0.00'}
                        </h3>
                        <p className="text-blue-100 text-sm">Saldo en Euros</p>
                    </motion.div>

                    {/* BEZ Balance */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-6 text-white"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <FaCoins className="text-3xl opacity-80" />
                            <span className="text-sm opacity-80">BEZ-Coin</span>
                        </div>
                        <h3 className="text-4xl font-bold mb-1">
                            {balance?.bezBalance?.toFixed(2) || '0'} BEZ
                        </h3>
                        <p className="text-purple-100 text-sm">
                            ≈ €{balance?.bezBalanceInEur?.toFixed(2) || '0.00'}
                        </p>
                    </motion.div>

                    {/* Total Available */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 text-white"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <FaWallet className="text-3xl opacity-80" />
                            <span className="text-sm opacity-80">Total</span>
                        </div>
                        <h3 className="text-4xl font-bold mb-1">
                            €{balance?.totalAvailableEur?.toFixed(2) || '0.00'}
                        </h3>
                        <p className="text-green-100 text-sm">Disponible para campañas</p>
                    </motion.div>
                </div>

                {/* Add Funds Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
                >
                    <button
                        onClick={() => {
                            setFundMethod('fiat');
                            setShowAddFundsModal(true);
                        }}
                        className="flex items-center justify-center space-x-3 px-6 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all"
                    >
                        <FaCreditCard className="text-xl" />
                        <span>Añadir Fondos FIAT</span>
                    </button>

                    <button
                        onClick={() => {
                            setFundMethod('bez');
                            setShowAddFundsModal(true);
                        }}
                        className="flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
                    >
                        <FaCoins className="text-xl" />
                        <span>Añadir Fondos BEZ-Coin</span>
                    </button>
                </motion.div>

                {/* Transaction History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
                            <FaHistory />
                            <span>Historial de Transacciones</span>
                        </h2>

                        {/* Filter */}
                        <div className="flex items-center space-x-2">
                            <FaFilter className="text-gray-400" />
                            <select
                                value={filterType}
                                onChange={(e) => {
                                    setFilterType(e.target.value);
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                                <option value="all">Todas</option>
                                <option value="deposit_fiat">Depósitos FIAT</option>
                                <option value="deposit_bez">Depósitos BEZ</option>
                                <option value="campaign_charge">Cargos de Campaña</option>
                                <option value="daily_charge">Cargos Diarios</option>
                                <option value="ai_usage">Consumo IA</option>
                                <option value="ai_reservation">Reservas IA</option>
                                <option value="refund">Reembolsos</option>
                            </select>
                        </div>
                    </div>

                    {historyLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                            <p className="text-gray-400">Cargando historial...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-12">
                            <FaHistory className="text-6xl text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">No hay transacciones aún</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-700">
                                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Fecha</th>
                                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Tipo</th>
                                            <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Descripción</th>
                                            <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">Monto</th>
                                            <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((tx) => (
                                            <tr key={tx._id} className="border-b border-gray-700 hover:bg-gray-700 hover:bg-opacity-30 transition-colors">
                                                <td className="py-4 px-4 text-gray-300 text-sm">
                                                    {new Date(tx.createdAt).toLocaleDateString('es-ES', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`text-sm font-medium ${transactionTypeColors[tx.type]}`}>
                                                        {transactionTypeLabels[tx.type]}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4 text-gray-400 text-sm">
                                                    {tx.description || '-'}
                                                </td>
                                                <td className={`py-4 px-4 text-right font-bold ${tx.type.includes('deposit') || tx.type === 'refund'
                                                    ? 'text-green-400'
                                                    : 'text-red-400'
                                                    }`}>
                                                    {tx.type.includes('deposit') || tx.type === 'refund' ? '+' : '-'}
                                                    {tx.currency === 'BEZ'
                                                        ? `${Number(tx.amount || 0).toFixed(2)} BEZ`
                                                        : `€${Number(tx.amountEur ?? tx.amount ?? 0).toFixed(2)}`}
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${tx.status === 'completed'
                                                        ? 'bg-green-600 bg-opacity-20 text-green-400'
                                                        : tx.status === 'pending'
                                                            ? 'bg-yellow-600 bg-opacity-20 text-yellow-400'
                                                            : 'bg-red-600 bg-opacity-20 text-red-400'
                                                        }`}>
                                                        {tx.status === 'completed' ? 'Completado' : tx.status === 'pending' ? 'Pendiente' : 'Fallido'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {pagination.total > 1 && (
                                <div className="flex items-center justify-center space-x-2 mt-6">
                                    <button
                                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                        disabled={pagination.page === 1}
                                        className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-all"
                                    >
                                        ← Anterior
                                    </button>

                                    <span className="text-gray-400">
                                        Página {pagination.page} de {pagination.total}
                                    </span>

                                    <button
                                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.total, prev.page + 1) }))}
                                        disabled={pagination.page === pagination.total}
                                        className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-all"
                                    >
                                        Siguiente →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            </div>

            {/* Add Funds Modal */}
            {showAddFundsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full"
                    >
                        <h3 className="text-2xl font-bold text-white mb-4">
                            {fundMethod === 'fiat' ? 'Añadir Fondos FIAT' : 'Añadir Fondos BEZ'}
                        </h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Monto {fundMethod === 'fiat' ? '(€)' : '(BEZ)'}
                            </label>
                            <input
                                type="number"
                                min={fundMethod === 'fiat' ? '10' : '1'}
                                step={fundMethod === 'fiat' ? '1' : '0.01'}
                                value={fundAmount}
                                onChange={(e) => setFundAmount(e.target.value)}
                                placeholder={fundMethod === 'fiat' ? 'Mínimo €10' : 'Mínimo 1 BEZ'}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            {fundMethod === 'fiat' && (
                                <p className="text-xs text-gray-500 mt-2">
                                    Mínimo €10, Máximo €10,000
                                </p>
                            )}
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => {
                                    setShowAddFundsModal(false);
                                    setFundAmount('');
                                }}
                                disabled={processing}
                                className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={fundMethod === 'fiat' ? handleAddFiatFunds : handleAddBezFunds}
                                disabled={processing || !fundAmount}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? 'Procesando...' : 'Confirmar'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default BillingPage;
