/* eslint-disable */
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Bell, Check, CheckCheck, Trash2, Filter,
    Wallet, ShoppingBag, Users, MessageCircle,
    TrendingUp, Shield, Gift, Zap, Loader2
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface Notification {
    id: string;
    type: 'transaction' | 'social' | 'system' | 'reward' | 'security';
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    href?: string;
}

// â”€â”€â”€ Mock Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MOCK_NOTIFICATIONS: Notification[] = [
    { id: '1', type: 'transaction', title: 'Pago recibido', message: 'Has recibido 250 BEZ de 0x52Df...044E por una transacciÃ³n de Quality Escrow.', read: false, createdAt: new Date(Date.now() - 600000).toISOString(), href: '/wallet' },
    { id: '2', type: 'social', title: 'Nuevo seguidor', message: 'CryptoTrader_ES ha comenzado a seguirte.', read: false, createdAt: new Date(Date.now() - 3600000).toISOString(), href: '/feed' },
    { id: '3', type: 'reward', title: 'Â¡Recompensa diaria!', message: 'Has ganado 15 BEZ por tu actividad diaria en el ecosistema. Â¡Sigue asÃ­!', read: false, createdAt: new Date(Date.now() - 7200000).toISOString() },
    { id: '4', type: 'system', title: 'ActualizaciÃ³n de plataforma', message: 'BeZhas v3.2 se ha desplegado con soporte multi-chain y mejoras en Quality Escrow.', read: true, createdAt: new Date(Date.now() - 14400000).toISOString() },
    { id: '5', type: 'security', title: 'Nuevo inicio de sesiÃ³n', message: 'Se detectÃ³ un nuevo inicio de sesiÃ³n desde Chrome/Windows. Si no fuiste tÃº, revisa tu seguridad.', read: true, createdAt: new Date(Date.now() - 28800000).toISOString(), href: '/settings' },
    { id: '6', type: 'transaction', title: 'Escrow finalizado', message: 'El escrow #QE-4502 ha sido liberado exitosamente. 180 BEZ acreditados a tu wallet.', read: true, createdAt: new Date(Date.now() - 43200000).toISOString(), href: '/bezpay' },
    { id: '7', type: 'social', title: 'MenciÃ³n en un post', message: 'ArtistaNFT te mencionÃ³ en un post sobre tokenizaciÃ³n de arte digital.', read: true, createdAt: new Date(Date.now() - 86400000).toISOString(), href: '/feed' },
    { id: '8', type: 'reward', title: 'Bono VIP', message: 'Tu suscripciÃ³n VIP Gold ha generado un bono de 500 BEZ este mes.', read: true, createdAt: new Date(Date.now() - 172800000).toISOString(), href: '/bezpay' },
];

const ICONS: Record<Notification['type'], React.ElementType> = {
    transaction: Wallet,
    social: Users,
    system: Zap,
    reward: Gift,
    security: Shield,
};

const COLORS: Record<Notification['type'], string> = {
    transaction: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    social: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400',
    system: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    reward: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    security: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

export default function NotificationsPage() {
    const { isConnected } = useAccount();
    const { open } = useWeb3Modal();

    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
    const [filter, setFilter] = useState<'all' | Notification['type']>('all');
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        if (isConnected) {
            const fetchNotifications = async () => {
                try {
                    setIsLoading(true);
                    const token = localStorage.getItem('token'); // Typical auth mechanism
                    const res = await fetch('http://localhost:3001/api/notifications', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        if (json.success && json.data.length > 0) {
                            setNotifications(json.data);
                            return;
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch from API, falling back to mock:', error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchNotifications();
        }
    }, [isConnected]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);

    const markAllRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        try {
            const token = localStorage.getItem('token');
            await fetch('http://localhost:3001/api/notifications/read-all', { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        } catch (e) {}
    };

    const markRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3001/api/notifications/${id}/read`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
        } catch (e) {}
    };

    const deleteNotif = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3001/api/notifications/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        } catch (e) {}
    };

    const timeAgo = (date: string) => {
        const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl shadow-soft-lg border border-light-border dark:border-gray-800 text-center max-w-md">
                    <Bell size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                    <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white mb-4">Notificaciones</h2>
                    <p className="text-gray-500 mb-6">Conecta tu wallet para ver tus notificaciones.</p>
                    <button onClick={() => open()} className="bg-gradient-primary text-white font-bold py-3 px-8 rounded-xl shadow-button hover:opacity-90 transition-opacity">Conectar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-6 py-8 max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Bell className="text-primary-500" />
                        Notificaciones
                        {unreadCount > 0 && (
                            <span className="text-sm bg-primary-600 text-white px-3 py-1 rounded-full font-bold">{unreadCount}</span>
                        )}
                    </h1>
                </div>
                {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-sm text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-1 hover:underline">
                        <CheckCheck size={16} /> Marcar todo como leÃ­do
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide">
                {[
                    { id: 'all' as const, label: 'Todas' },
                    { id: 'transaction' as const, label: 'ðŸ’° Transacciones' },
                    { id: 'social' as const, label: 'ðŸ‘¥ Social' },
                    { id: 'reward' as const, label: 'ðŸŽ Recompensas' },
                    { id: 'security' as const, label: 'ðŸ”’ Seguridad' },
                    { id: 'system' as const, label: 'âš¡ Sistema' },
                ].map(f => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter === f.id
                            ? 'bg-primary-600 text-white shadow-button'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-light-border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Notification List */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-12 text-center">
                        <Bell size={48} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500">No hay notificaciones</p>
                    </div>
                ) : (
                    filtered.map(n => {
                        const Icon = ICONS[n.type];
                        const colorClass = COLORS[n.type];
                        const Wrapper = n.href ? Link : 'div';
                        const wrapperProps = n.href ? { href: n.href } : {};

                        return (
                            <Wrapper
                                key={n.id}
                                {...wrapperProps}
                                onClick={() => markRead(n.id)}
                                className={`block bg-white dark:bg-gray-900 rounded-2xl border p-5 shadow-soft-lg transition-all hover:shadow-xl cursor-pointer ${!n.read ? 'border-primary-200 dark:border-primary-800 bg-primary-50/30 dark:bg-primary-900/10' : 'border-light-border dark:border-gray-800'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                                        <Icon size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className={`font-bold text-sm ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {n.title}
                                                {!n.read && <span className="inline-block w-2 h-2 bg-primary-500 rounded-full ml-2" />}
                                            </h3>
                                            <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{n.message}</p>
                                    </div>
                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotif(n.id); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </Wrapper>
                        );
                    })
                )}
            </div>
        </div>
    );
}

