
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Shield, Users, FileText, LayoutDashboard, Settings, RefreshCw, Menu, X, Megaphone, Cpu, Blocks } from 'lucide-react';
import { LOGOS } from '../config/cryptoLogos';
import { useHideRightSidebar } from '../hooks/useHideRightSidebar';

export default function AdminLayout() {
    useHideRightSidebar();
    const [collapsed, setCollapsed] = useState(false);

    // Auto-colapsar en pantallas pequeñas
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth < 768) {
                setCollapsed(true);
            }
        }
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="min-h-screen flex bg-dark-background dark:bg-light-background">
            {/* Sidebar */}
            <aside className={`bg-dark-surface dark:bg-light-surface flex flex-col transition-all duration-300 border-r border-gray-700 ${collapsed ? 'w-16' : 'w-64'}`}>
                {/* Header con botón de colapso */}
                <div className={`flex items-center gap-2 p-4 border-b border-gray-700 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                    <div className={`font-bold flex items-center gap-2 ${collapsed ? 'text-xl' : 'text-2xl'}`}>
                        <Shield size={collapsed ? 24 : 28} />
                        {!collapsed && <span>Admin</span>}
                    </div>
                    {!collapsed && (
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="p-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
                            title="Contraer sidebar"
                        >
                            <Menu size={20} />
                        </button>
                    )}
                </div>

                {/* Botón de expandir cuando está colapsado */}
                {collapsed && (
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="p-3 mx-auto mt-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
                        title="Expandir sidebar"
                    >
                        <Menu size={20} />
                    </button>
                )}

                {/* Navigation */}
                <nav className={`flex-1 space-y-2 ${collapsed ? 'p-2' : 'p-4'}`}>
                    <NavLink
                        to="/admin"
                        end
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        title={collapsed ? 'Dashboard' : undefined}
                    >
                        <LayoutDashboard size={20} />
                        {!collapsed && 'Dashboard'}
                    </NavLink>
                    <NavLink
                        to="/admin/users"
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        title={collapsed ? 'Usuarios' : undefined}
                    >
                        <Users size={20} />
                        {!collapsed && 'Usuarios'}
                    </NavLink>
                    <NavLink
                        to="/admin/content"
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        title={collapsed ? 'Contenido' : undefined}
                    >
                        <FileText size={20} />
                        {!collapsed && 'Contenido'}
                    </NavLink>
                    <NavLink
                        to="/admin/ads"
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        title={collapsed ? 'Anuncios' : undefined}
                    >
                        <Megaphone size={20} />
                        {!collapsed && 'Anuncios'}
                    </NavLink>
                    <NavLink
                        to="/admin/ai"
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        title={collapsed ? 'AI Engine' : undefined}
                    >
                        <Cpu size={20} />
                        {!collapsed && 'AI Engine'}
                    </NavLink>
                    <NavLink
                        to="/admin/sdk"
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} ${isActive ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        title={collapsed ? 'SDK & AI' : undefined}
                    >
                        <Blocks size={20} />
                        {!collapsed && 'SDK & AI'}
                    </NavLink>
                    <NavLink
                        to="/admin/magazine"
                        className={({ isActive }) => `flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} ${isActive ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        title={collapsed ? 'Magazine' : undefined}
                    >
                        <FileText size={20} />
                        {!collapsed && 'Magazine'}
                    </NavLink>
                    {/* Logos de criptomonedas y BEZ-Coin */}
                    <div className={`border-t border-gray-700 pt-4 flex flex-col gap-2 ${collapsed ? 'mt-4' : 'mt-8'}`}>
                        <button className={`flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} text-gray-400 hover:text-blue-400`}
                            title={collapsed ? 'Ethereum' : undefined}
                        >
                            <img src={LOGOS.ethereum} alt="Ethereum" style={{ width: collapsed ? 24 : 28, height: collapsed ? 24 : 28 }} />
                            {!collapsed && 'Ethereum'}
                        </button>
                        <button className={`flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} text-gray-400 hover:text-blue-400`}
                            title={collapsed ? 'Polygon' : undefined}
                        >
                            <img src={LOGOS.polygon} alt="Polygon" style={{ width: collapsed ? 24 : 28, height: collapsed ? 24 : 28 }} />
                            {!collapsed && 'Polygon'}
                        </button>
                        <button className={`flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} text-gray-400 hover:text-blue-400`}
                            title={collapsed ? 'Bitcoin' : undefined}
                        >
                            <img src={LOGOS.bitcoin} alt="Bitcoin" style={{ width: collapsed ? 24 : 28, height: collapsed ? 24 : 28 }} />
                            {!collapsed && 'Bitcoin'}
                        </button>
                        <button className={`flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} text-yellow-400 hover:text-yellow-500`}
                            title={collapsed ? 'BeZhas Coin' : undefined}
                        >
                            <img src={LOGOS.bezcoin} alt="BeZhas Coin" style={{ width: collapsed ? 24 : 32, height: collapsed ? 24 : 32, borderRadius: 8 }} />
                            {!collapsed && 'BeZhas Coin'}
                        </button>
                        <button className={`flex items-center gap-2 rounded-lg transition-all ${collapsed ? 'justify-center p-3' : 'px-4 py-2'} text-gray-400 hover:text-blue-400`}
                            title={collapsed ? 'Actualizar' : undefined}
                        >
                            <RefreshCw size={20} />
                            {!collapsed && 'Actualizar'}
                        </button>
                    </div>
                </nav>
            </aside>
            {/* Main Content */}
            <main className="flex-1 p-8 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
