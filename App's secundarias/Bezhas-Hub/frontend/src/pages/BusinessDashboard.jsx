import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
    LayoutDashboard,
    TrendingUp,
    Activity,
    Sparkles,
    Zap
} from 'lucide-react';
import FunctionCard from '../components/dashboard/FunctionCard';
import { businessFunctionsData } from '../data/businessFunctionsData';
import ConnectWalletButton from '../components/common/ConnectWalletButton';
import { useBezCoin } from '../context/BezCoinContext';

/**
 * 🏢 Dashboard Empresarial BeZhas
 * Página principal del dashboard con todas las funciones empresariales Web3
 */
const BusinessDashboard = () => {
    const { address, isConnected } = useAccount();
    const { balance } = useBezCoin();
    const [greeting, setGreeting] = useState('');

    // Saludo dinámico según hora del día
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Buenos días');
        else if (hour < 18) setGreeting('Buenas tardes');
        else setGreeting('Buenas noches');
    }, []);

    // Stats del usuario
    const userStats = {
        bezBalance: parseFloat(balance).toFixed(2),
        activeFunctions: businessFunctionsData.length,
        walletConnected: isConnected ? 'Conectada' : 'Desconectada',
        networkStatus: 'Operativa'
    };

    return (
        <div className="min-h-screen bg-[#0A0E1A] text-white">
            {/* Hero Section */}
            <div className="relative bg-gradient-to-br from-purple-900/20 via-[#0A0E1A] to-pink-900/20 border-b border-gray-800">
                {/* Patrón de fondo decorativo */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                        backgroundSize: '30px 30px'
                    }}></div>
                </div>

                <div className="relative max-w-7xl mx-auto px-6 py-12">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-lg">
                                    <LayoutDashboard size={28} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 animate-gradient">
                                        {greeting}
                                    </h1>
                                    <p className="text-gray-400 text-sm mt-1">
                                        Bienvenido al Dashboard Empresarial BeZhas
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Botón Conectar/Estado Wallet */}
                        {!isConnected ? (
                            <ConnectWalletButton className="px-6 py-3" />
                        ) : (
                            <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-600/30 rounded-xl">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-sm font-semibold text-green-400">Wallet Conectada</span>
                            </div>
                        )}
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Balance BEZ */}
                        <div className="bg-gradient-to-br from-cyan-600/10 to-blue-600/10 border border-cyan-600/20 rounded-xl p-5 hover:border-cyan-600/40 transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-cyan-400 text-sm font-semibold">Balance BEZ</span>
                                <Sparkles size={20} className="text-cyan-400" />
                            </div>
                            <p className="text-3xl font-bold text-white">{userStats.bezBalance}</p>
                            <p className="text-cyan-300/60 text-xs mt-1">Tokens Disponibles</p>
                        </div>

                        {/* Funciones Activas */}
                        <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-600/20 rounded-xl p-5 hover:border-purple-600/40 transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-purple-400 text-sm font-semibold">Funciones</span>
                                <Activity size={20} className="text-purple-400" />
                            </div>
                            <p className="text-3xl font-bold text-white">{userStats.activeFunctions}</p>
                            <p className="text-purple-300/60 text-xs mt-1">Disponibles</p>
                        </div>

                        {/* Estado Wallet */}
                        <div className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 border border-green-600/20 rounded-xl p-5 hover:border-green-600/40 transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-green-400 text-sm font-semibold">Wallet</span>
                                <Zap size={20} className="text-green-400" />
                            </div>
                            <p className="text-2xl font-bold text-white">{userStats.walletConnected}</p>
                            <p className="text-green-300/60 text-xs mt-1">
                                {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : 'No conectada'}
                            </p>
                        </div>

                        {/* Estado Red */}
                        <div className="bg-gradient-to-br from-amber-600/10 to-orange-600/10 border border-amber-600/20 rounded-xl p-5 hover:border-amber-600/40 transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-amber-400 text-sm font-semibold">Red</span>
                                <TrendingUp size={20} className="text-amber-400" />
                            </div>
                            <p className="text-2xl font-bold text-white">{userStats.networkStatus}</p>
                            <p className="text-amber-300/60 text-xs mt-1">Hardhat Local</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Funciones Empresariales */}
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Section Header */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                        <span className="text-3xl">🏢</span>
                        Funciones Empresariales Web3
                    </h2>
                    <p className="text-gray-400">
                        Explora todas las capacidades de BeZhas para empresas. Haz click en el icono de información para detalles o en la flecha para ir directamente.
                    </p>
                </div>

                {/* Grid de Funciones */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {businessFunctionsData.map((func) => (
                        <FunctionCard
                            key={func.id}
                            {...func}
                        />
                    ))}
                </div>

                {/* Footer Info */}
                <div className="mt-12 p-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/20 rounded-xl">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-purple-600/20 rounded-lg">
                            <Sparkles size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">
                                ¿Necesitas ayuda con alguna función?
                            </h3>
                            <p className="text-gray-400 text-sm mb-3">
                                Nuestro equipo de soporte está disponible 24/7 para ayudarte con cualquier duda sobre las funciones empresariales de BeZhas.
                            </p>
                            <a
                                href="/docs"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white font-semibold text-sm transition-all duration-200"
                            >
                                Ver Documentación
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessDashboard;
