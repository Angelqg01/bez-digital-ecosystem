import React, { useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import {
    Wallet, Users, Vote, Megaphone, Settings, Shield,
    TrendingUp, Clock, AlertTriangle, CheckCircle
} from 'lucide-react';
import ConnectWalletButton from '../../components/common/ConnectWalletButton';

const DAOLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [daoStats] = useState({
        tvl: 1245000,
        members: 247,
        activeProposals: 3,
        nextVoting: '2 días'
    });

    const navItems = [
        {
            id: 'treasury',
            label: 'Tesorería',
            icon: Wallet,
            path: '/dao/treasury',
            description: 'Gestión de activos y rebalanceo automático',
            color: 'indigo'
        },
        {
            id: 'talent',
            label: 'RR.HH & Talento',
            icon: Users,
            path: '/dao/talent',
            description: 'Vesting, milestones y compensación',
            color: 'purple'
        },
        {
            id: 'governance',
            label: 'Gobernanza',
            icon: Vote,
            path: '/dao/governance',
            description: 'Votación on-chain y propuestas',
            color: 'blue'
        },
        {
            id: 'advertising',
            label: 'Publicidad DePub',
            icon: Megaphone,
            path: '/dao/advertising',
            description: 'Tokenización de inventario publicitario',
            color: 'pink'
        },
        {
            id: 'admin',
            label: 'Panel Admin DAO',
            icon: Shield,
            path: '/dao/admin',
            description: 'Gestión completa de DAO (Admin)',
            color: 'red'
        },
        {
            id: 'plugins',
            label: 'Gestión de Plugins',
            icon: Settings,
            path: '/dao/plugins',
            description: 'Plugin Manager y permisos',
            color: 'gray'
        }
    ];

    const isActive = (path) => location.pathname === path;

    const getColorClasses = (color, active) => {
        const colors = {
            indigo: active
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                : 'text-indigo-700 hover:bg-indigo-50',
            purple: active
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'text-purple-700 hover:bg-purple-50',
            blue: active
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                : 'text-blue-700 hover:bg-blue-50',
            pink: active
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white'
                : 'text-pink-700 hover:bg-pink-50',
            red: active
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
                : 'text-red-700 hover:bg-red-50',
            gray: active
                ? 'bg-gradient-to-r from-gray-700 to-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-50',
        };
        return colors[color] || colors.gray;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">

            {/* Header with DAO Stats */}
            <header className="bg-black/30 backdrop-blur-lg border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                                <Shield className="text-white" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">
                                    BeZhas DAO
                                </h1>
                                <p className="text-sm text-gray-300">
                                    Organización Autónoma Descentralizada
                                </p>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="hidden lg:flex items-center gap-6">
                            <div className="text-center">
                                <p className="text-xs text-gray-400">TVL Total</p>
                                <p className="text-lg font-bold text-white">
                                    ${(daoStats.tvl / 1000).toFixed(0)}k
                                </p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-400">Miembros</p>
                                <p className="text-lg font-bold text-white">{daoStats.members}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-gray-400">Propuestas</p>
                                <p className="text-lg font-bold text-green-400">{daoStats.activeProposals}</p>
                            </div>
                            <ConnectWalletButton
                                variant="primary"
                                size="md"
                                showAddress={true}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="bg-white/5 backdrop-blur-sm border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-2 overflow-x-auto py-4">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.path);

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => navigate(item.path)}
                                    className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all whitespace-nowrap font-medium ${getColorClasses(item.color, active)
                                        } ${active ? 'shadow-lg' : ''}`}
                                >
                                    <Icon size={20} />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold">{item.label}</p>
                                        {!active && (
                                            <p className="text-xs opacity-70">{item.description}</p>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="max-w-7xl mx-auto">
                {location.pathname === '/dao' || location.pathname === '/dao/' ? (
                    /* Default Landing Page */
                    <div className="p-6 space-y-6">
                        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 text-center">
                            <Shield className="mx-auto mb-4 text-purple-400" size={64} />
                            <h2 className="text-3xl font-bold text-white mb-4">
                                Bienvenido a BeZhas DAO
                            </h2>
                            <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed mb-6">
                                Organización Autónoma Descentralizada basada en arquitectura Core-Plugin.
                                Gestión transparente de tesorería, gobernanza híbrida on/off-chain,
                                y sistema de compensación por desempeño con verificación de oráculos.
                            </p>
                            <div className="flex justify-center gap-4">
                                <button
                                    onClick={() => navigate('/dao/treasury')}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:shadow-xl transition-all transform hover:scale-105 font-semibold"
                                >
                                    Explorar Tesorería
                                </button>
                                <button
                                    onClick={() => navigate('/dao/governance')}
                                    className="bg-white/10 backdrop-blur text-white border border-white/30 px-8 py-3 rounded-xl hover:bg-white/20 transition-all font-semibold"
                                >
                                    Ver Propuestas
                                </button>
                            </div>
                        </div>

                        {/* Feature Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {navItems.filter(item => item.id !== 'plugins').map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => navigate(item.path)}
                                        className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 hover:bg-white/20 transition-all hover:scale-105 text-left group"
                                    >
                                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center mb-4 group-hover:shadow-lg transition-shadow">
                                            <Icon className="text-white" size={24} />
                                        </div>
                                        <h3 className="text-white font-bold text-lg mb-2">{item.label}</h3>
                                        <p className="text-gray-300 text-sm leading-relaxed">
                                            {item.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Architecture Info */}
                        <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 backdrop-blur-lg border border-purple-500/30 rounded-2xl p-6">
                            <h3 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
                                <Settings size={24} />
                                Arquitectura Core-Plugin
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="bg-black/30 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-purple-400 mb-2">
                                        <Shield size={16} />
                                        <span className="font-semibold">Plugin Manager</span>
                                    </div>
                                    <p className="text-gray-300 text-xs">
                                        Guardián de permisos entre el Core inmutable y los plugins intercambiables.
                                        Kill Switch para seguridad.
                                    </p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                        <TrendingUp size={16} />
                                        <span className="font-semibold">Módulos Especializados</span>
                                    </div>
                                    <p className="text-gray-300 text-xs">
                                        4 plugins principales: Tesorería, Gobernanza, RR.HH y Publicidad.
                                        Cada uno con lógica aislada.
                                    </p>
                                </div>
                                <div className="bg-black/30 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-green-400 mb-2">
                                        <CheckCircle size={16} />
                                        <span className="font-semibold">Verificación Oracle</span>
                                    </div>
                                    <p className="text-gray-300 text-xs">
                                        Integración con Chainlink para precios y validación de milestones.
                                        Automatización total.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Render child routes */
                    <Outlet />
                )}
            </main>
        </div>
    );
};

export default DAOLayout;
