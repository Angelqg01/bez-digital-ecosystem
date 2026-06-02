/**
 * BEZWalletCard Component
 * Componente para mostrar balance y acciones de BEZ-Coin
 */

import React, { useState } from 'react';
import { useBEZCoin } from '../../hooks/useBEZCoin';
import { toast } from 'react-hot-toast';
import {
    FaCoins,
    FaPaperPlane,
    FaFire,
    FaExchangeAlt,
    FaWallet,
    FaExternalLinkAlt,
    FaSync
} from 'react-icons/fa';

const BEZWalletCard = () => {
    const {
        balance,
        tokenInfo,
        networkStatus,
        loading,
        isConnected,
        address,
        transfer,
        burn,
        switchToPolygon,
        addToWallet,
        refresh,
        needsNetworkSwitch,
        canTransact
    } = useBEZCoin();

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showBurnModal, setShowBurnModal] = useState(false);
    const [transferAddress, setTransferAddress] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [burnAmount, setBurnAmount] = useState('');
    const [processing, setProcessing] = useState(false);

    // Manejar transferencia
    const handleTransfer = async () => {
        if (!transferAddress || !transferAmount) {
            toast.error('Completa todos los campos');
            return;
        }

        try {
            setProcessing(true);
            const result = await transfer(transferAddress, transferAmount);

            if (result.success) {
                toast.success(`¡${transferAmount} BEZ transferidos exitosamente!`);
                setShowTransferModal(false);
                setTransferAddress('');
                setTransferAmount('');
            } else {
                toast.error(result.error || 'Error en la transferencia');
            }
        } catch (error) {
            toast.error('Error al transferir BEZ');
        } finally {
            setProcessing(false);
        }
    };

    // Manejar quema
    const handleBurn = async () => {
        if (!burnAmount) {
            toast.error('Ingresa la cantidad a quemar');
            return;
        }

        try {
            setProcessing(true);
            const result = await burn(burnAmount);

            if (result.success) {
                toast.success(`¡${burnAmount} BEZ quemados exitosamente!`);
                setShowBurnModal(false);
                setBurnAmount('');
            } else {
                toast.error(result.error || 'Error al quemar tokens');
            }
        } catch (error) {
            toast.error('Error al quemar BEZ');
        } finally {
            setProcessing(false);
        }
    };

    // Cambiar a Polygon
    const handleSwitchNetwork = async () => {
        const success = await switchToPolygon();
        if (success) {
            toast.success('Cambiado a Polygon exitosamente');
        } else {
            toast.error('Error al cambiar de red');
        }
    };

    // Agregar a wallet
    const handleAddToWallet = async () => {
        const success = await addToWallet();
        if (success) {
            toast.success('BEZ-Coin agregado a tu wallet');
        } else {
            toast.error('Error al agregar BEZ a wallet');
        }
    };

    if (!isConnected) {
        return (
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="text-center">
                    <FaWallet className="text-5xl mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Conecta tu wallet para ver tu balance de BEZ</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Card principal */}
            <div className="bg-gradient-to-br from-purple-500 via-blue-600 to-cyan-500 rounded-xl p-6 text-white shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                            <FaCoins className="text-2xl" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{tokenInfo.symbol}</h3>
                            <p className="text-sm text-white/80">{tokenInfo.name}</p>
                        </div>
                    </div>

                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <FaSync className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* Balance */}
                <div className="mb-6">
                    <p className="text-sm text-white/80 mb-1">Balance Disponible</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{balance.display}</span>
                        <span className="text-xl text-white/80">{balance.symbol}</span>
                    </div>
                </div>

                {/* Estado de red */}
                {needsNetworkSwitch && (
                    <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">⚠️ Red Incorrecta</p>
                                <p className="text-xs text-white/80">
                                    Cambia a Polygon para usar BEZ-Coin
                                </p>
                            </div>
                            <button
                                onClick={handleSwitchNetwork}
                                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Cambiar Red
                            </button>
                        </div>
                    </div>
                )}

                {/* Información de red */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 mb-4 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-white/70">Red:</span>
                        <span className="font-medium">{networkStatus.networkName}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-white/70">Dirección:</span>
                        <span className="font-mono text-xs">
                            {address?.slice(0, 6)}...{address?.slice(-4)}
                        </span>
                    </div>
                </div>

                {/* Acciones */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setShowTransferModal(true)}
                        disabled={!canTransact}
                        className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm rounded-lg py-3 font-medium transition-colors"
                    >
                        <FaPaperPlane />
                        Enviar
                    </button>

                    <button
                        onClick={() => setShowBurnModal(true)}
                        disabled={!canTransact}
                        className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm rounded-lg py-3 font-medium transition-colors"
                    >
                        <FaFire />
                        Quemar
                    </button>
                </div>

                {/* Enlaces */}
                <div className="flex gap-2 mt-4">
                    <button
                        onClick={handleAddToWallet}
                        className="flex-1 flex items-center justify-center gap-2 text-sm py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <FaWallet className="text-xs" />
                        Agregar a Wallet
                    </button>

                    <a
                        href={tokenInfo.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 text-sm py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <FaExternalLinkAlt className="text-xs" />
                        Ver en Explorer
                    </a>
                </div>
            </div>

            {/* Modal de Transferencia */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold mb-4 dark:text-white">Enviar BEZ</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    Dirección Destino
                                </label>
                                <input
                                    type="text"
                                    value={transferAddress}
                                    onChange={(e) => setTransferAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    Cantidad BEZ
                                </label>
                                <input
                                    type="number"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.000001"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Balance disponible: {balance.display} BEZ
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowTransferModal(false)}
                                disabled={processing}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleTransfer}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {processing ? 'Enviando...' : 'Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Quemar */}
            {showBurnModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center gap-2">
                            <FaFire className="text-orange-500" />
                            Quemar BEZ
                        </h3>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                ⚠️ <strong>Advertencia:</strong> Los tokens quemados se destruyen permanentemente y no se pueden recuperar.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                                    Cantidad a Quemar
                                </label>
                                <input
                                    type="number"
                                    value={burnAmount}
                                    onChange={(e) => setBurnAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.000001"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Balance disponible: {balance.display} BEZ
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowBurnModal(false)}
                                disabled={processing}
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-white"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleBurn}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <FaFire />
                                {processing ? 'Quemando...' : 'Quemar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BEZWalletCard;
