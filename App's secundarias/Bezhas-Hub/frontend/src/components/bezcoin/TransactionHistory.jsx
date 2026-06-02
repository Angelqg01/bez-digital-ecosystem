/**
 * TransactionHistory.jsx
 * 
 * Componente para mostrar el historial de transacciones de BEZ tokens
 * 
 * Características:
 * - Lista de todas las transacciones (compra, transferencia, donación)
 * - Filtros por tipo
 * - Paginación
 * - Enlaces a exploradores de blockchain
 * - Exportar a CSV
 * - Estados de carga y vacío
 * 
 * Ubicación: frontend/src/components/bezcoin/TransactionHistory.jsx
 */

import { useState, useEffect } from 'react';
import { useBezCoin } from '../../context/BezCoinContext';
import { FaSpinner, FaExternalLinkAlt, FaDownload, FaFilter, FaCoins, FaGift, FaPaperPlane } from 'react-icons/fa';
import { motion } from 'framer-motion';

const TransactionHistory = () => {
    const { transactions, fetchTransactionHistory, loading } = useBezCoin();

    const [filteredTransactions, setFilteredTransactions] = useState([]);
    const [filter, setFilter] = useState('all'); // 'all', 'buy', 'transfer', 'donate', 'receive'
    const [currentPage, setCurrentPage] = useState(1);
    const transactionsPerPage = 10;

    useEffect(() => {
        fetchTransactionHistory();
    }, []);

    useEffect(() => {
        if (filter === 'all') {
            setFilteredTransactions(transactions);
        } else {
            setFilteredTransactions(
                transactions.filter(tx => tx.type === filter)
            );
        }
        setCurrentPage(1);
    }, [filter, transactions]);

    // Paginación
    const indexOfLastTx = currentPage * transactionsPerPage;
    const indexOfFirstTx = indexOfLastTx - transactionsPerPage;
    const currentTransactions = filteredTransactions.slice(indexOfFirstTx, indexOfLastTx);
    const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);

    // Exportar a CSV
    const exportToCSV = () => {
        const headers = ['Fecha', 'Tipo', 'Cantidad', 'Desde/Hacia', 'Hash', 'Estado'];
        const csvData = filteredTransactions.map(tx => [
            new Date(tx.timestamp).toLocaleString(),
            tx.type,
            tx.amount,
            tx.from || tx.to || '-',
            tx.hash,
            tx.status
        ]);

        const csvContent = [
            headers.join(','),
            ...csvData.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bezcoin-transactions-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Iconos por tipo
    const getTypeIcon = (type) => {
        switch (type) {
            case 'buy':
                return <FaCoins className="text-green-500" />;
            case 'donate':
                return <FaGift className="text-pink-500" />;
            case 'transfer':
                return <FaPaperPlane className="text-blue-500" />;
            case 'receive':
                return <FaCoins className="text-yellow-500" />;
            default:
                return <FaCoins className="text-gray-500" />;
        }
    };

    // Texto por tipo
    const getTypeText = (type) => {
        switch (type) {
            case 'buy':
                return 'Compra';
            case 'donate':
                return 'Donación';
            case 'transfer':
                return 'Transferencia';
            case 'receive':
                return 'Recibido';
            default:
                return type;
        }
    };

    // Color por estado
    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'failed':
                return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
        }
    };

    if (loading && transactions.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <FaSpinner className="animate-spin text-4xl text-purple-600" />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-white">
                            Historial de Transacciones
                        </h2>
                        <p className="text-white/80 text-sm mt-1">
                            {filteredTransactions.length} transacciones
                        </p>
                    </div>
                    {filteredTransactions.length > 0 && (
                        <button
                            onClick={exportToCSV}
                            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                        >
                            <FaDownload />
                            Exportar CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 flex-wrap">
                    <FaFilter className="text-gray-500" />
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filter === 'all'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilter('buy')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filter === 'buy'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        Compras
                    </button>
                    <button
                        onClick={() => setFilter('transfer')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filter === 'transfer'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        Transferencias
                    </button>
                    <button
                        onClick={() => setFilter('donate')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filter === 'donate'
                                ? 'bg-pink-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        Donaciones
                    </button>
                    <button
                        onClick={() => setFilter('receive')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${filter === 'receive'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                    >
                        Recibidas
                    </button>
                </div>
            </div>

            {/* Transactions List */}
            <div className="overflow-x-auto">
                {currentTransactions.length === 0 ? (
                    <div className="text-center py-12">
                        <FaCoins className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-lg">
                            No hay transacciones {filter !== 'all' && `de tipo "${getTypeText(filter)}"`}
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Cantidad
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Desde/Hacia
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Fecha
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Tx
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {currentTransactions.map((tx, index) => (
                                <motion.tr
                                    key={tx.id || index}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {getTypeIcon(tx.type)}
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {getTypeText(tx.type)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {parseFloat(tx.amount).toFixed(2)} BEZ
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                                            {tx.from ? `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}` :
                                                tx.to ? `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}` : '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(tx.timestamp).toLocaleDateString('es-ES', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(tx.status)}`}>
                                            {tx.status === 'confirmed' ? 'Confirmada' :
                                                tx.status === 'pending' ? 'Pendiente' :
                                                    tx.status === 'failed' ? 'Fallida' : tx.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {tx.hash && (
                                            <a
                                                href={`https://etherscan.io/tx/${tx.hash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center gap-1"
                                            >
                                                <FaExternalLinkAlt size={12} />
                                                <span className="text-xs">Ver</span>
                                            </a>
                                        )}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Anterior
                    </button>

                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Página {currentPage} de {totalPages}
                    </span>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 rounded-lg font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    );
};

export default TransactionHistory;
