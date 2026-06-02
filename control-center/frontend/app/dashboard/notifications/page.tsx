'use client';

import { useNotifications } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Bell, CheckCheck, AlertCircle, Info, Package, Zap } from 'lucide-react';
import { useSWRConfig } from 'swr';

const typeIcons: Record<string, React.ReactNode> = {
    alert: <AlertCircle className="w-4 h-4 text-red-500" />,
    info: <Info className="w-4 h-4 text-blue-500" />,
    gas: <Zap className="w-4 h-4 text-orange-500" />,
    nft: <Package className="w-4 h-4 text-purple-500" />,
};

export default function NotificationsPage() {
    const { data: notifications, isLoading } = useNotifications();
    const { mutate } = useSWRConfig();

    const unread = notifications?.filter(n => !n.read) ?? [];
    const all = notifications ?? [];

    async function markAllRead() {
        try {
            await api.post('/notifications/read-all', {});
            mutate('/notifications');
        } catch { /* silent */ }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bell className="w-7 h-7 text-bezhas-accent" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
                        <p className="text-sm text-gray-500">{unread.length} sin leer de {all.length} totales</p>
                    </div>
                </div>
                {unread.length > 0 && (
                    <button onClick={markAllRead}
                        className="flex items-center gap-1.5 text-sm text-bezhas-accent hover:underline">
                        <CheckCheck className="w-4 h-4" /> Marcar todas como leídas
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center">Cargando notificaciones...</div>
            ) : all.length === 0 ? (
                <div className="text-gray-400 text-sm py-16 text-center">
                    <Bell className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                    No hay notificaciones
                </div>
            ) : (
                <div className="space-y-2">
                    {all.map(n => (
                        <div key={n.id} className={`flex items-start gap-4 p-4 rounded-xl border transition ${n.read ? 'bg-white border-gray-100' : 'bg-blue-50/40 border-bezhas-accent/20'
                            }`}>
                            <div className="mt-0.5">{typeIcons[n.type] ?? <Bell className="w-4 h-4 text-gray-400" />}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className={`text-sm font-semibold ${n.read ? 'text-gray-700' : 'text-gray-900'}`}>{n.title}</h3>
                                    {!n.read && <span className="w-2 h-2 rounded-full bg-bezhas-accent flex-shrink-0" />}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
