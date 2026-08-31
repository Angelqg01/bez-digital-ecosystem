import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useWalletConnect } from '../../hooks/useWalletConnect';
import { Wallet, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * Componente mejorado para conexión de wallet con mejor manejo de errores
 * y feedback visual
 */
export default function WalletConnectionButton({ variant = 'default', className = '' }) {
    const { address, isConnected, isConnecting, isReconnecting } = useAccount();
    const { connectWallet, disconnectWallet } = useWalletConnect();
    const [isHovered, setIsHovered] = useState(false);

    // Monitor connection state changes
    useEffect(() => {
        if (isConnected && address) {
            console.log('✅ Wallet conectada:', address);
        }
    }, [isConnected, address]);

    const handleConnect = async () => {
        try {
            const success = await connectWallet();
            if (!success) {
                toast.error('Error al conectar la wallet');
            }
        } catch (error) {
            console.error('Error al conectar:', error);
            toast.error('Error al abrir el selector de wallet');
        }
    };

    const handleDisconnect = async () => {
        try {
            const success = await disconnectWallet();
            if (success) {
                toast.success('🔐 Wallet desconectada de forma segura');
            } else {
                toast.error('Error al desconectar la wallet');
            }
        } catch (error) {
            console.error('Error al desconectar:', error);
            toast.error('Error al desconectar la wallet');
        }
    };

    const formatAddress = (addr) => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    // Variantes de estilo
    const variants = {
        default: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white',
        outline: 'border-2 border-purple-500 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20',
        ghost: 'hover:bg-gray-100 dark:hover:bg-gray-800',
        success: 'bg-green-500 hover:bg-green-600 text-white',
    };

    // Estado de carga
    if (isConnecting || isReconnecting) {
        return (
            <button
                disabled
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all opacity-50 cursor-not-allowed ${variants[variant]} ${className}`}
            >
                <Loader size={18} className="animate-spin" />
                <span>Conectando...</span>
            </button>
        );
    }

    // Estado conectado
    if (isConnected) {
        return (
            <div className="relative">
                <button
                    onClick={handleDisconnect}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${isHovered ? 'bg-red-500 hover:bg-red-600' : variants.success
                        } ${className}`}
                >
                    {isHovered ? (
                        <>
                            <AlertCircle size={18} />
                            <span>Desconectar</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle size={18} />
                            <span className="hidden md:inline">{formatAddress(address)}</span>
                            <span className="md:hidden">Conectado</span>
                        </>
                    )}
                </button>
            </div>
        );
    }

    // Estado desconectado
    return (
        <button
            onClick={handleConnect}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl ${variants[variant]} ${className}`}
        >
            <Wallet size={18} />
            <span>Conectar Wallet</span>
        </button>
    );
}
