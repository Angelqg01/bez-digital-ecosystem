import React, { useState } from 'react';
import { Wallet, LogOut, Copy, ExternalLink, CheckCircle2, Loader } from 'lucide-react';
import { useWalletConnect } from '../../hooks/useWalletConnect';
import { toast } from 'react-hot-toast';

/**
 * 🎯 Botón Compacto de Wallet para Header/Navbar
 * 
 * Componente optimizado para espacios reducidos como headers.
 * - Muestra ícono + dirección corta cuando está conectado
 * - Dropdown con opciones al hacer click
 * - "Conectar" cuando no hay wallet
 */
const WalletHeaderButton = ({ className = '' }) => {
    const { isConnected, address, isConnecting, connectWallet, disconnectWallet, shortAddress } = useWalletConnect();
    const [showDropdown, setShowDropdown] = useState(false);

    const handleCopyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            toast.success('Dirección copiada al portapapeles');
            setShowDropdown(false);
        }
    };

    const handleViewExplorer = () => {
        if (address) {
            // Polygon Mainnet
            window.open(`https://polygonscan.com/address/${address}`, '_blank');
            setShowDropdown(false);
        }
    };

    const handleDisconnect = async () => {
        await disconnectWallet();
        setShowDropdown(false);
        toast.success('Wallet desconectada');
    };

    const handleConnect = async () => {
        await connectWallet();
    };

    // Si está conectando
    if (isConnecting) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}>
                <Loader className="animate-spin" size={18} />
                <span className="text-sm text-gray-600 dark:text-gray-400">Conectando...</span>
            </div>
        );
    }

    // Si NO está conectado
    if (!isConnected) {
        return (
            <button
                onClick={handleConnect}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600
                    text-white shadow-lg hover:shadow-xl transform hover:scale-105
                    ${className}`}
            >
                <Wallet size={18} />
                <span className="hidden sm:inline">Conectar</span>
            </button>
        );
    }

    // Si ESTÁ conectado - Mostrar dirección con dropdown
    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all
                    bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600
                    text-white shadow-lg hover:shadow-xl
                    ${className}`}
            >
                <CheckCircle2 size={16} />
                <span className="font-mono text-sm hidden sm:inline">{shortAddress}</span>
                <span className="sm:hidden">
                    <Wallet size={16} />
                </span>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
                <>
                    {/* Overlay para cerrar al hacer click afuera */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
                    />

                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-fadeIn">
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-500">
                            <div className="flex items-center gap-2 text-white">
                                <CheckCircle2 size={18} />
                                <span className="font-semibold">Wallet Conectada</span>
                            </div>
                            <p className="text-xs text-white/80 mt-1 font-mono break-all">{address}</p>
                        </div>

                        {/* Opciones */}
                        <div className="p-2">
                            <button
                                onClick={handleCopyAddress}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                            >
                                <Copy size={18} className="text-gray-600 dark:text-gray-400" />
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-white text-sm">Copiar Dirección</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Al portapapeles</p>
                                </div>
                            </button>

                            <button
                                onClick={handleViewExplorer}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                            >
                                <ExternalLink size={18} className="text-gray-600 dark:text-gray-400" />
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-white text-sm">Ver en Explorer</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">PolygonScan</p>
                                </div>
                            </button>

                            <hr className="my-2 border-gray-200 dark:border-gray-700" />

                            <button
                                onClick={handleDisconnect}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left group"
                            >
                                <LogOut size={18} className="text-red-600 dark:text-red-400" />
                                <div>
                                    <p className="font-medium text-red-600 dark:text-red-400 text-sm">Desconectar</p>
                                    <p className="text-xs text-red-500/70 dark:text-red-400/70">Cerrar sesión</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WalletHeaderButton;
