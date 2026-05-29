"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    User, Copy, Check, Edit, Activity,
    Wallet, ExternalLink, TrendingUp, Send, ArrowDownToLine,
    LayoutDashboard, Settings as SettingsIcon,
    BarChart3, Users, MessageSquare, RefreshCw,
    Shield, Bell, Save, Grid, ShoppingBag, Gift, MessageCircle, Eye, EyeOff, Loader2
} from 'lucide-react';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { toast } from 'react-hot-toast';
import api from '../../../lib/api';
import { useBezBalance } from '../../../hooks/useBezBalance';
import { useBezPay } from '../../../context/BezPayContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface UserProfile {
    username: string;
    bio: string;
    avatar: string;
    email: string;
    role: string;
    postsCount: number;
    followersCount: number;
    followingCount: number;
    createdAt: string | number;
}

interface Transaction {
    hash: string;
    from: string;
    to: string;
    value: string;
    type: 'send' | 'receive';
    timestamp: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatAddress = (addr?: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const formatDate = (ts: string | number) => {
    try {
        return new Date(ts).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return 'Fecha no disponible'; }
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function ProfilePage() {
    const params = useParams();
    const routeAddress = params?.id as string | undefined;

    const { address: connectedAddress, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { open } = useWeb3Modal();
    const { data: ethBalance } = useBalance({ address: connectedAddress });

    const address = routeAddress || connectedAddress;
    const isOwnProfile = !!(connectedAddress && address && connectedAddress.toLowerCase() === address.toLowerCase());

    const { balance: bezBalance, isLoading: bezLoading } = useBezBalance(address);
    const { openBuyBez, livePrice } = useBezPay();

    // ── State ────────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState('overview');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [balanceVisible, setBalanceVisible] = useState(true);

    // Wallet states
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Settings states
    const [editUsername, setEditUsername] = useState('');
    const [editBio, setEditBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // ── Data Loading ─────────────────────────────────────────────────────────
    const loadProfileData = useCallback(async () => {
        if (!address) return;
        setProfileLoading(true);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await api.get(`/api/profile/${address}`, { signal: controller.signal });
            clearTimeout(timeout);
            setProfile(res.data);
        } catch {
            // Fallback profile
            setProfile({
                username: `User_${address?.slice(2, 8)}`,
                bio: 'Este usuario aún no ha añadido una biografía.',
                avatar: `https://ui-avatars.com/api/?name=${address?.slice(2, 8)}&background=random&size=128`,
                email: '',
                role: 'user',
                postsCount: 0,
                followersCount: 0,
                followingCount: 0,
                createdAt: Date.now(),
            });
        } finally {
            setProfileLoading(false);
        }
    }, [address]);

    useEffect(() => { if (address) loadProfileData(); }, [address, loadProfileData]);

    useEffect(() => {
        if (profile) {
            setEditUsername(profile.username || '');
            setEditBio(profile.bio || '');
        }
    }, [profile]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleCopy = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            toast.success('Dirección copiada');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleUpdateProfile = async () => {
        if (!editUsername.trim()) { toast.error('El nombre no puede estar vacío.'); return; }
        setIsSaving(true);
        try {
            await api.put(`/api/profile/${address}`, { username: editUsername, bio: editBio });
            toast.success('Perfil actualizado');
            await loadProfileData();
        } catch {
            toast.error('Error al actualizar perfil. Usando modo offline.');
            setProfile(prev => prev ? { ...prev, username: editUsername, bio: editBio } : prev);
        } finally {
            setIsSaving(false);
        }
    };

    // Derived
    const bezUsdValue = (parseFloat(bezBalance) * livePrice).toFixed(2);

    // ── Tab config ───────────────────────────────────────────────────────────
    const tabs = [
        { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
        { id: 'nfts', label: 'NFTs', icon: Grid },
        { id: 'activity', label: 'Actividad', icon: Activity },
    ];
    if (isOwnProfile) {
        tabs.push(
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'settings', label: 'Configuración', icon: SettingsIcon },
        );
    }

    // ── Not Connected ────────────────────────────────────────────────────────
    if (!isConnected && !routeAddress) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl shadow-soft-lg border border-light-border dark:border-gray-800 text-center max-w-md">
                    <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Wallet className="w-10 h-10 text-primary-500" />
                    </div>
                    <h2 className="text-3xl font-display font-bold mb-4 text-gray-900 dark:text-white">Accede a tu Perfil</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-8">Conecta tu wallet para ver tu perfil, activos y estadísticas.</p>
                    <button onClick={() => open()} className="bg-gradient-primary text-white font-bold py-4 px-8 rounded-xl shadow-button hover:opacity-90 transition-opacity w-full">
                        Conectar Wallet
                    </button>
                </div>
            </div>
        );
    }

    // ── Loading ──────────────────────────────────────────────────────────────
    if (profileLoading && !profile) {
        return (
            <div className="flex items-center justify-center min-h-[70vh]">
                <Loader2 className="animate-spin text-primary-500" size={40} />
            </div>
        );
    }

    // ── Main Render ──────────────────────────────────────────────────────────
    return (
        <div className="container mx-auto px-6 py-8 max-w-7xl">
            {/* ─── Profile Header ─────────────────────────────────────────── */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-light-border dark:border-gray-800 mb-6 shadow-soft-lg">
                {/* Banner */}
                <div className="h-48 bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 relative">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
                </div>

                <div className="p-6 lg:p-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-end -mt-24 gap-6">
                        {/* Avatar */}
                        <img
                            src={profile?.avatar || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=6366f1&color=fff&size=128`}
                            alt="Avatar"
                            className="w-32 h-32 rounded-full border-4 border-white dark:border-gray-900 shadow-xl object-cover"
                        />

                        {/* Info */}
                        <div className="flex-1">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div>
                                    <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white">
                                        {profile?.username || 'Usuario Anónimo'}
                                    </h1>
                                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-1">
                                        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg">{formatAddress(address)}</span>
                                        <button onClick={handleCopy} className="p-1.5 hover:text-primary-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                        </button>
                                        <a href={`https://polygonscan.com/address/${address}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:text-primary-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                                            <ExternalLink size={16} />
                                        </a>
                                        {profile?.role === 'admin' && (
                                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full text-xs font-semibold">Admin</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {!isOwnProfile && (
                                        <button className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-colors shadow-button">
                                            <MessageSquare size={16} /> Mensaje
                                        </button>
                                    )}
                                    {isOwnProfile && (
                                        <button onClick={() => setActiveTab('settings')} className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-colors">
                                            <SettingsIcon size={16} /> Editar Perfil
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="mt-6 text-gray-500 dark:text-gray-400 max-w-3xl">{profile?.bio || 'Este usuario aún no ha añadido una biografía.'}</p>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        {/* BEZ Balance */}
                        {isOwnProfile ? (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-light-border dark:border-gray-700 group">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">🪙 BEZ Balance</p>
                                    <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                        {balanceVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                    </button>
                                </div>
                                {bezLoading ? (
                                    <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
                                ) : (
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        {balanceVisible ? bezBalance : '••••••'}
                                    </p>
                                )}
                                {balanceVisible && <p className="text-xs text-gray-400 mt-1">≈ ${bezUsdValue} USD</p>}
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-light-border dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400">💎 BEZ Tokens</p>
                                <p className="text-lg font-medium text-gray-400 mt-1">Privado</p>
                            </div>
                        )}

                        {isOwnProfile ? (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-light-border dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400">⛽ Gas Token</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                    {ethBalance ? (Number(ethBalance.value) / 10 ** ethBalance.decimals).toFixed(4) : '0.00'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">{ethBalance?.symbol || 'POL'}</p>
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-light-border dark:border-gray-700">
                                <p className="text-sm text-gray-500 dark:text-gray-400">⛽ Gas Token</p>
                                <p className="text-lg font-medium text-gray-400 mt-1">Privado</p>
                            </div>
                        )}

                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-light-border dark:border-gray-700">
                            <p className="text-sm text-gray-500 dark:text-gray-400">📝 Posts</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{profile?.postsCount || 0}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-light-border dark:border-gray-700">
                            <p className="text-sm text-gray-500 dark:text-gray-400">👥 Seguidores</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{profile?.followersCount || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Tab Navigation ─────────────────────────────────────────── */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-primary-600 text-white shadow-button'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-light-border dark:border-gray-700'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── Tab Content ────────────────────────────────────────────── */}
            <div className="space-y-6">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Personal Info */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="text-primary-500" size={22} /> Información
                            </h3>
                            <div className="space-y-4">
                                <div><p className="text-sm text-gray-400">Email</p><p className="text-gray-900 dark:text-white font-medium">{profile?.email || 'No configurado'}</p></div>
                                <div><p className="text-sm text-gray-400">Miembro desde</p><p className="text-gray-900 dark:text-white font-medium">{profile?.createdAt ? formatDate(profile.createdAt) : 'Hoy'}</p></div>
                                <div><p className="text-sm text-gray-400">Rol</p><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${profile?.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>{profile?.role || 'Usuario'}</span></div>
                            </div>
                        </div>

                        {/* Wallet Summary */}
                        {isOwnProfile && (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Wallet className="text-green-500" size={22} /> Resumen Wallet
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-400">Balance BEZ</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{bezBalance} <span className="text-sm text-yellow-500">BEZ</span></p>
                                        <p className="text-xs text-gray-400">≈ ${bezUsdValue} USD</p>
                                    </div>
                                    <button onClick={() => openBuyBez()} className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold py-2.5 px-4 rounded-xl transition-all hover:opacity-90 shadow-lg">
                                        🪙 Comprar BEZ
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Quick Access */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Activity className="text-cyan-500" size={22} /> Acceso Rápido
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { href: '/bezpay', icon: MessageCircle, label: 'BezPay', from: 'from-pink-500', to: 'to-rose-500' },
                                    { href: '/marketplace', icon: ShoppingBag, label: 'Marketplace', from: 'from-purple-500', to: 'to-indigo-500' },
                                    { href: '/wallet', icon: Wallet, label: 'Mi Wallet', from: 'from-blue-500', to: 'to-cyan-500' },
                                    { href: '/rwa', icon: Gift, label: 'RWA', from: 'from-yellow-500', to: 'to-orange-500' },
                                ].map((item, i) => (
                                    <Link key={i} href={item.href} className={`bg-gradient-to-br ${item.from} ${item.to} text-white font-semibold py-3 px-4 rounded-xl transition-all flex flex-col items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5`}>
                                        <item.icon size={22} />
                                        <span className="text-sm">{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* NFTs TAB */}
                {activeTab === 'nfts' && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-12 text-center shadow-soft-lg">
                        <Grid size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">Colección NFT</h3>
                        <p className="text-gray-500 text-sm max-w-md mx-auto">
                            Los NFTs de tu wallet aparecerán aquí automáticamente. Crea, compra o recibe NFTs en el Marketplace.
                        </p>
                        <Link href="/marketplace" className="inline-flex items-center gap-2 mt-6 bg-primary-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-primary-700 transition-colors shadow-button">
                            <ShoppingBag size={18} /> Explorar Marketplace
                        </Link>
                    </div>
                )}

                {/* ACTIVITY TAB */}
                {activeTab === 'activity' && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-8 shadow-soft-lg">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <Activity size={20} className="text-primary-500" /> Actividad Reciente
                        </h3>
                        <div className="text-center py-12 text-gray-500">
                            <Activity size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                            <p className="text-lg">No hay actividad reciente</p>
                            <p className="text-sm mt-2 max-w-md mx-auto">Las transacciones, posts e interacciones aparecerán aquí.</p>
                        </div>
                    </div>
                )}

                {/* WALLET TAB */}
                {isOwnProfile && activeTab === 'wallet' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gradient-to-br from-primary-600 to-indigo-600 rounded-2xl p-6 shadow-xl text-white">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">Balance BEZ</h3>
                                    <button onClick={() => openBuyBez()} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"><ShoppingBag size={18} /></button>
                                </div>
                                {bezLoading ? (
                                    <div className="h-10 w-40 bg-white/20 rounded-lg animate-pulse" />
                                ) : (
                                    <p className="text-4xl font-bold mb-1">{bezBalance}</p>
                                )}
                                <p className="text-white/70 text-sm">≈ ${bezUsdValue} USD</p>
                            </div>

                            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 shadow-xl text-white">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">Gas Token</h3>
                                    <TrendingUp className="text-white/70" size={20} />
                                </div>
                                <p className="text-4xl font-bold mb-1">
                                    {ethBalance ? (Number(ethBalance.value) / 10 ** ethBalance.decimals).toFixed(4) : '0.00'}
                                </p>
                                <p className="text-white/70 text-sm">{ethBalance?.symbol || 'POL'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { icon: Send, label: 'Enviar', desc: 'Transferir BEZ', color: 'text-blue-500' },
                                { icon: ArrowDownToLine, label: 'Recibir', desc: 'Obtener BEZ', color: 'text-green-500' },
                                { icon: TrendingUp, label: 'Swap', desc: 'Intercambiar', color: 'text-yellow-500' },
                            ].map((a, i) => (
                                <button key={i} onClick={() => toast('Módulo en desarrollo — Fase 3C', { icon: '🚧' })} className="bg-white dark:bg-gray-900 border border-light-border dark:border-gray-800 rounded-2xl p-5 hover:shadow-lg transition-all text-left group">
                                    <a.icon className={`${a.color} mb-3 group-hover:scale-110 transition-transform`} size={24} />
                                    <h4 className="text-gray-900 dark:text-white font-bold">{a.label}</h4>
                                    <p className="text-gray-500 text-sm">{a.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* SETTINGS TAB */}
                {isOwnProfile && activeTab === 'settings' && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-8 shadow-soft-lg max-w-2xl">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <SettingsIcon size={20} className="text-primary-500" /> Configuración del Perfil
                        </h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Nombre de Usuario</label>
                                <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Biografía</label>
                                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={4} maxLength={500} className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                                <p className="text-xs text-gray-400 mt-1 text-right">{editBio.length}/500</p>
                            </div>
                            <button onClick={handleUpdateProfile} disabled={isSaving} className="bg-gradient-primary text-white font-bold py-3 px-8 rounded-xl shadow-button hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2">
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800">
                            <h4 className="text-sm font-bold text-red-500 mb-4 flex items-center gap-2"><Shield size={16} /> Zona Peligrosa</h4>
                            <button onClick={() => { disconnect(); toast.success('Wallet desconectada'); }} className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-semibold py-3 px-6 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                                🔐 Desconectar Wallet
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
