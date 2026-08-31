import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Home,
    Compass,
    TrendingUp,
    Users,
    ShoppingBag,
    Image,
    Wallet,
    Settings,
    HelpCircle,
    BookOpen,
    Sparkles,
    X
} from 'lucide-react';

/**
 * SIDEBAR COMPONENT - Light Mode Design
 * Sidebar minimalista y colapsable
 * Se transforma en menú hamburguesa en móvil
 */
export default function LightSidebar({ isOpen, onClose }) {
    const location = useLocation();

    const menuItems = [
        {
            section: 'Principal',
            items: [
                { icon: Home, label: 'Inicio', path: '/', badge: null },
                { icon: Compass, label: 'Explorar', path: '/explore', badge: null },
                { icon: TrendingUp, label: 'Tendencias', path: '/trending', badge: 'Hot' },
                { icon: Sparkles, label: 'Nuevos', path: '/new', badge: null },
            ]
        },
        {
            section: 'Mercado',
            items: [
                { icon: ShoppingBag, label: 'Marketplace', path: '/marketplace', badge: null },
                { icon: Image, label: 'Mis NFTs', path: '/my-nfts', badge: '12' },
                { icon: BookOpen, label: 'Colecciones', path: '/collections', badge: null },
            ]
        },
        {
            section: 'Social',
            items: [
                { icon: Users, label: 'Comunidad', path: '/community', badge: null },
                { icon: Wallet, label: 'Wallet', path: '/wallet', badge: null },
            ]
        },
        {
            section: 'Configuración',
            items: [
                { icon: Settings, label: 'Ajustes', path: '/settings', badge: null },
                { icon: HelpCircle, label: 'Ayuda', path: '/help', badge: null },
            ]
        }
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <>
            {/* === OVERLAY (Mobile) === */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
                    onClick={onClose}
                />
            )}

            {/* === SIDEBAR === */}
            <aside
                className={`
          fixed lg:sticky top-0 left-0 h-screen
          bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg
          border-r border-primary-100 dark:border-gray-800
          transition-transform duration-300 ease-in-out
          z-50 lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          w-72 lg:w-64 xl:w-72
        `}
            >
                <div className="flex flex-col h-full">

                    {/* === HEADER === */}
                    <div className="flex items-center justify-between p-4 lg:p-6 border-b border-primary-100 dark:border-gray-800">
                        <h2 className="text-lg font-display font-bold text-gradient">
                            Navegación
                        </h2>
                        <button
                            onClick={onClose}
                            className="lg:hidden p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </button>
                    </div>

                    {/* === NAVIGATION === */}
                    <nav className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                        {menuItems.map((section, idx) => (
                            <div key={idx} className="space-y-1">
                                {/* Section Title */}
                                <h3 className="px-3 mb-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    {section.section}
                                </h3>

                                {/* Menu Items */}
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.path);

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            onClick={onClose}
                                            className={`
                        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                        transition-all duration-200
                        ${active
                                                    ? 'bg-gradient-primary text-white shadow-card'
                                                    : 'text-text-secondary dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400'
                                                }
                      `}
                                        >
                                            {/* Active Indicator */}
                                            {active && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                                            )}

                                            {/* Icon */}
                                            <Icon
                                                className={`
                          w-5 h-5 transition-transform duration-200
                          ${active ? 'scale-110' : 'group-hover:scale-110'}
                        `}
                                            />

                                            {/* Label */}
                                            <span className="flex-1 font-medium">
                                                {item.label}
                                            </span>

                                            {/* Badge */}
                                            {item.badge && (
                                                <span
                                                    className={`
                            px-2 py-0.5 text-xs font-semibold rounded-full
                            ${active
                                                            ? 'bg-white/20 text-white'
                                                            : item.badge === 'Hot'
                                                                ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400'
                                                                : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                                                        }
                          `}
                                                >
                                                    {item.badge}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>

                    {/* === FOOTER (CTA / User Info) === */}
                    <div className="p-4 lg:p-6 border-t border-primary-100 dark:border-gray-800">
                        <div className="p-4 bg-gradient-primary rounded-xl text-white space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5" />
                                <h4 className="font-semibold">Crea tu NFT</h4>
                            </div>
                            <p className="text-sm text-white/80">
                                Convierte tu arte en tokens únicos
                            </p>
                            <Link
                                to="/create-nft"
                                onClick={onClose}
                                className="block w-full mt-2 px-4 py-2 bg-white text-primary-600 rounded-lg text-sm font-semibold text-center hover:bg-white/90 transition-colors"
                            >
                                Comenzar
                            </Link>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
