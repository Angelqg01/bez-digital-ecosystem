import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, PlusCircle, Coins, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { sidebarNavItems, getCategorizedItems } from '../config/sidebarConfig';
import { useBezCoin } from '../context/BezCoinContext';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { BezhasTokenAddress, BezhasTokenABI } from '../contract-config';

export default function SidebarDrawer({ open, setOpen }) {
    const [collapsed, setCollapsed] = useState(false);
    const categorizedItems = getCategorizedItems(sidebarNavItems);
    const { setShowBuyModal, balance: contextBalance, balanceVisible, toggleBalanceVisibility } = useBezCoin();
    const { address, isConnected } = useAccount();
    const [bezBalance, setBezBalance] = useState('0');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch BEZ balance from blockchain (only for connected user)
    const fetchBezBalance = useCallback(async () => {
        if (!isConnected || !address || !BezhasTokenAddress) {
            setBezBalance('0');
            return;
        }

        try {
            if (!window.ethereum) return;
            setIsRefreshing(true);

            const provider = new ethers.BrowserProvider(window.ethereum);
            const code = await provider.getCode(BezhasTokenAddress);

            if (code === '0x') {
                setBezBalance('0');
                return;
            }

            const contract = new ethers.Contract(BezhasTokenAddress, BezhasTokenABI, provider);
            const balance = await contract.balanceOf(address);
            const formatted = ethers.formatUnits(balance, 18);
            setBezBalance(parseFloat(formatted).toFixed(2));
        } catch (error) {
            console.error("Error fetching BEZ balance in sidebar:", error);
            setBezBalance('0');
        } finally {
            setIsRefreshing(false);
        }
    }, [isConnected, address]);

    // Use context balance as primary, fallback to fetched
    useEffect(() => {
        if (contextBalance && parseFloat(contextBalance) > 0) {
            setBezBalance(parseFloat(contextBalance).toFixed(2));
        } else {
            fetchBezBalance();
        }
    }, [contextBalance, fetchBezBalance]);

    // Refresh on account change
    useEffect(() => {
        if (isConnected && address) {
            fetchBezBalance();
        }
    }, [isConnected, address, fetchBezBalance]);

    return (
        <>
            {/* Sidebar */}
            <aside
                className={`sidebar-transition bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col fixed top-0 left-0 z-40 transition-all duration-300 ${open ? 'translate-x-0' : '-translate-x-full'
                    } ${collapsed ? 'w-20' : 'w-64'
                    } md:relative md:translate-x-0`}
            >
                {/* Logo, Hamburguesa y Toggle dentro del Sidebar */}
                <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200 dark:border-gray-800">
                    {/* Botón Hamburguesa (solo en mobile) */}
                    <button
                        onClick={() => setOpen(!open)}
                        className="md:hidden p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-700 dark:text-gray-200"
                        aria-label="Cerrar menú"
                    >
                        {open ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    {/* Logo */}
                    <div className={`flex items-center gap-3 transition-all ${collapsed ? 'justify-center w-full' : 'flex-1'}`}>
                        {!collapsed && (
                            <span className="text-xl font-bold text-gray-900 dark:text-white">
                                BeZhas<span className="text-purple-600 dark:text-purple-400">Web3</span>
                            </span>
                        )}
                    </div>

                    {/* Botón Toggle Colapsar/Expandir (solo en desktop) */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden md:block p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-300"
                        title={collapsed ? 'Expandir' : 'Colapsar'}
                        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
                    >
                        <Menu size={24} />
                    </button>
                </div>

                {/* Navigation con scroll independiente */}
                <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {Object.entries(categorizedItems).map(([categoryKey, category]) => {
                        if (category.items.length === 0) return null;

                        return (
                            <div key={categoryKey} className="mb-6">
                                {/* Category Label */}
                                {!collapsed && (
                                    <h3 className="text-xs font-semibold uppercase tracking-wider px-4 mb-2 text-gray-500 dark:text-gray-400">
                                        {category.label}
                                    </h3>
                                )}

                                {/* Category Items */}
                                <ul className="space-y-1">
                                    {category.items.map(item => (
                                        <li key={item.path}>
                                            {item.path.startsWith('http') ? (
                                                <a
                                                    href={item.path}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`
                                                        flex items-center gap-4 px-4 py-3 rounded-xl transition-all group
                                                        hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300
                                                        ${collapsed ? 'justify-center' : ''}
                                                    `}
                                                    onClick={() => {
                                                        if (window.innerWidth < 768) setOpen(false);
                                                    }}
                                                    title={collapsed ? item.label : item.description || ''}
                                                >
                                                    <span className="flex-shrink-0">{item.icon}</span>
                                                    {!collapsed && (
                                                        <span className="flex-1 font-medium">{item.label}</span>
                                                    )}
                                                    {!collapsed && (
                                                        <span className="text-xs text-gray-400 group-hover:text-purple-500">↗</span>
                                                    )}
                                                </a>
                                            ) : (
                                                <NavLink
                                                    to={item.path}
                                                    className={({ isActive }) => `
                                                        flex items-center gap-4 px-4 py-3 rounded-xl transition-all group
                                                        ${isActive
                                                            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 shadow-sm'
                                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                                                        }
                                                        ${collapsed ? 'justify-center' : ''}
                                                    `}
                                                    onClick={() => {
                                                        if (window.innerWidth < 768) setOpen(false);
                                                    }}
                                                    title={collapsed ? item.label : item.description || ''}
                                                >
                                                    <span className="flex-shrink-0">
                                                        {item.icon}
                                                    </span>
                                                    {!collapsed && (
                                                        <span className="flex-1 font-medium">{item.label}</span>
                                                    )}
                                                </NavLink>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </nav>

                {/* BEZ Balance Display - Only for connected user (private) */}
                {isConnected && (
                    <div className={`px-4 pt-4 ${collapsed ? 'text-center' : ''}`}>
                        <div className={`bg-gradient-to-r from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-xl p-3 ${collapsed ? 'px-2' : ''}`}>
                            <div className="flex items-center justify-between gap-2">
                                <div className={`flex items-center gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
                                    <Coins className="text-yellow-500" size={collapsed ? 20 : 18} />
                                    {!collapsed && (
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                            Mi Balance
                                        </span>
                                    )}
                                </div>
                                {!collapsed && (
                                    <button
                                        onClick={fetchBezBalance}
                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                        title="Actualizar balance"
                                        disabled={isRefreshing}
                                    >
                                        <RefreshCw size={14} className={`text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    </button>
                                )}
                                {/* Toggle de visibilidad (solo visible cuando está expandido) */}
                                {!collapsed && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleBalanceVisibility();
                                        }}
                                        className="p-1 hover:bg-cyan-500/20 rounded-full transition-colors ml-2"
                                        title={balanceVisible ? "Ocultar balance" : "Mostrar balance"}
                                    >
                                        {balanceVisible ? (
                                            <Eye size={16} className="text-cyan-600 dark:text-cyan-400 opacity-80 hover:opacity-100" />
                                        ) : (
                                            <EyeOff size={16} className="text-cyan-600 dark:text-cyan-400 opacity-80 hover:opacity-100" />
                                        )}
                                    </button>
                                )}
                            </div>
                            <p className={`font-bold text-cyan-600 dark:text-cyan-400 ${collapsed ? 'text-sm mt-1' : 'text-lg mt-1'}`}>
                                {balanceVisible ? (
                                    <>{bezBalance} <span className="text-xs font-normal opacity-75">BEZ</span></>
                                ) : (
                                    <span className="tracking-widest">••••••</span>
                                )}
                            </p>
                            {!collapsed && balanceVisible && parseFloat(bezBalance) < 10 && (
                                <p className="text-xs text-orange-500 dark:text-orange-400 mt-1 flex items-center gap-1">
                                    ⚠️ Balance bajo - ¡Compra más BEZ!
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Buy Button */}
                <div className={`p-4 ${collapsed ? 'flex justify-center' : ''}`}>
                    <button
                        onClick={() => setShowBuyModal(true)}
                        className={`w-full flex items-center gap-2 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg shadow-primary-500/20 ${collapsed ? 'p-3 justify-center' : 'px-4 py-3'
                            }`}
                        title="Comprar BEZ"
                    >
                        <PlusCircle size={20} />
                        {!collapsed && <span className="font-bold">Comprar BEZ</span>}
                    </button>
                </div>

                {/* User Profile (Bottom) - Only for connected user */}
                {!collapsed && isConnected && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                        <NavLink
                            to="/profile"
                            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            onClick={() => { if (window.innerWidth < 768) setOpen(false); }}
                        >
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-purple-600 to-pink-600"
                            >
                                {address ? address.slice(2, 4).toUpperCase() : '?'}
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm text-gray-900 dark:text-white">Mi Perfil</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Conectar wallet'}
                                </p>
                            </div>
                        </NavLink>
                    </div>
                )}
            </aside>

            {/* Mobile Overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden"
                    onClick={() => setOpen(false)}
                />
            )}
        </>
    );
}
