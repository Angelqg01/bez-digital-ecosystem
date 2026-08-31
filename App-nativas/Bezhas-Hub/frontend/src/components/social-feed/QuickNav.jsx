import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    Home,
    MessageCircle,
    UsersRound,
    Bell,
    MessageSquare,
    User,
    Gift,
    Store,
    Trophy,
    Wallet
} from 'lucide-react';

/**
 * QuickNav - Navegación rápida integrada en el feed
 * Muestra los enlaces principales del sidebar de forma compacta
 */
const QuickNav = () => {
    const quickLinks = [
        { path: '/', icon: Home, label: 'Inicio' },
        { path: '/social', icon: MessageCircle, label: 'BeHistory' },
        { path: '/notifications', icon: Bell, label: 'Notificaciones' },
        { path: '/chat', icon: MessageSquare, label: 'Chat IA', badge: true },
        { path: '/profile', icon: User, label: 'Perfil' },
        { path: '/rewards', icon: Gift, label: 'Recompensas' },
        { path: '/marketplace', icon: Store, label: 'Marketplace' },
        // { path: '/leaderboard', icon: Trophy, label: 'Ranking' }, // REMOVED: Rankings system eliminated
        { path: '/wallet', icon: Wallet, label: 'Wallet' }
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                    Acceso Rápido
                </h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {quickLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            className={({ isActive }) =>
                                `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`
                            }
                        >
                            <Icon size={16} className="flex-shrink-0" />
                            <span className="truncate">{link.label}</span>
                            {link.badge && (
                                <span className="ml-auto px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] rounded-full">
                                    IA
                                </span>
                            )}
                        </NavLink>
                    );
                })}
            </div>
        </div>
    );
};

export default QuickNav;
