import React, { useState } from 'react';
import {
    Search,
    Bell,
    User,
    Menu,
    X,
    ShoppingCart,
    Heart,
    Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * HEADER COMPONENT - Light Mode Design
 * Header fijo responsivo con navegación y búsqueda
 * Paleta: Lavanda/Pastel
 */
export default function LightHeader({ onMenuToggle, isMenuOpen }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const notifications = [
        { id: 1, text: 'Nueva publicación de @usuario', time: 'Hace 5min', unread: true },
        { id: 2, text: 'Tu NFT fue vendido', time: 'Hace 1h', unread: true },
        { id: 3, text: '@amigo te mencionó', time: 'Hace 2h', unread: false },
    ];

    const unreadCount = notifications.filter(n => n.unread).length;

    return (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-primary-100 dark:border-gray-800 shadow-soft">
            <div className="container-responsive">
                <div className="flex items-center justify-between h-16 md:h-20">

                    {/* === LOGO & MENU TOGGLE === */}
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={onMenuToggle}
                            className="lg:hidden p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors focus-visible"
                            aria-label="Toggle menu"
                        >
                            {isMenuOpen ? (
                                <X className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            ) : (
                                <Menu className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                            )}
                        </button>

                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-card group-hover:shadow-glow transition-shadow">
                                <span className="text-2xl font-bold text-white">B</span>
                            </div>
                            <span className="hidden sm:block text-xl md:text-2xl font-display font-bold text-gradient">
                                BeZhas
                            </span>
                        </Link>
                    </div>

                    {/* === SEARCH BAR (Desktop & Tablet) === */}
                    <div className="hidden md:flex flex-1 max-w-xl mx-8">
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Buscar NFTs, usuarios, colecciones..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-2.5 bg-primary-50/50 dark:bg-gray-800 border-2 border-primary-100 dark:border-gray-700 rounded-xl text-text-primary dark:text-white placeholder:text-text-muted focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-gray-800 transition-all"
                            />
                        </div>
                    </div>

                    {/* === ACTIONS (Right Side) === */}
                    <div className="flex items-center gap-2 md:gap-3">

                        {/* Mobile Search Icon */}
                        <button className="md:hidden p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors focus-visible">
                            <Search className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </button>

                        {/* Favorites (Hidden on mobile) */}
                        <Link
                            to="/favorites"
                            className="hidden sm:flex p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors focus-visible relative group"
                        >
                            <Heart className="w-5 h-5 text-primary-600 dark:text-primary-400 group-hover:fill-accent-400 group-hover:text-accent-400 transition-colors" />
                        </Link>

                        {/* Cart */}
                        <Link
                            to="/cart"
                            className="hidden sm:flex p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors focus-visible relative"
                        >
                            <ShoppingCart className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent-500 text-white text-xs rounded-full flex items-center justify-center">
                                2
                            </span>
                        </Link>

                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors focus-visible relative"
                            >
                                <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-accent-500 rounded-full animate-pulse" />
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-soft-lg border border-primary-100 dark:border-gray-700 animate-slide-down overflow-hidden">
                                    <div className="p-4 border-b border-primary-100 dark:border-gray-700">
                                        <h3 className="font-semibold text-text-primary dark:text-white">Notificaciones</h3>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        {notifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`p-4 border-b border-primary-50 dark:border-gray-700 hover:bg-primary-50/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${notif.unread ? 'bg-primary-50/30 dark:bg-gray-700/30' : ''
                                                    }`}
                                            >
                                                <p className="text-sm text-text-primary dark:text-white">{notif.text}</p>
                                                <span className="text-xs text-text-muted mt-1">{notif.time}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <Link
                                        to="/notifications"
                                        className="block p-3 text-center text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors font-medium"
                                    >
                                        Ver todas
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-800 transition-colors focus-visible"
                            >
                                <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-primary rounded-lg flex items-center justify-center">
                                    <User className="w-5 h-5 text-white" />
                                </div>
                                <span className="hidden lg:block text-sm font-medium text-text-primary dark:text-white">
                                    Usuario
                                </span>
                            </button>

                            {/* User Dropdown */}
                            {showUserMenu && (
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-soft-lg border border-primary-100 dark:border-gray-700 animate-slide-down overflow-hidden">
                                    <div className="p-3 border-b border-primary-100 dark:border-gray-700">
                                        <p className="font-semibold text-text-primary dark:text-white">Mi Cuenta</p>
                                        <p className="text-xs text-text-muted">0x1234...5678</p>
                                    </div>
                                    <nav className="p-2">
                                        <Link
                                            to="/profile"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors text-text-primary dark:text-white"
                                        >
                                            <User className="w-4 h-4" />
                                            <span className="text-sm">Perfil</span>
                                        </Link>
                                        <Link
                                            to="/settings"
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors text-text-primary dark:text-white"
                                        >
                                            <Settings className="w-4 h-4" />
                                            <span className="text-sm">Configuración</span>
                                        </Link>
                                    </nav>
                                    <div className="p-2 border-t border-primary-100 dark:border-gray-700">
                                        <button className="w-full px-3 py-2 text-sm text-left text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded-lg transition-colors font-medium">
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* === MOBILE SEARCH BAR === */}
                <div className="md:hidden pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-primary-50/50 dark:bg-gray-800 border-2 border-primary-100 dark:border-gray-700 rounded-lg text-sm text-text-primary dark:text-white placeholder:text-text-muted focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:bg-white dark:focus:bg-gray-800 transition-all"
                        />
                    </div>
                </div>
            </div>
        </header>
    );
}
