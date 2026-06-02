'use client';

import { useChannels, useMessages, useNotificationPreferences, useBlockchainSSE } from '@/lib/hooks';
import { api } from '@/lib/api';
import { useState, useMemo } from 'react';
import {
    MessageSquare, Plus, Mail, Send, CheckCircle2, XCircle, Clock,
    Settings2, Trash2, ShieldCheck, Activity, BarChart3, RefreshCw,
} from 'lucide-react';
import { useSWRConfig } from 'swr';
import type { Channel, Message } from '@/lib/types';
import InfraEcosystemNav from '@/components/InfraEcosystemNav';

const CHANNEL_META: Record<string, { label: string; icon: string; color: string }> = {
    email: { label: 'Email', icon: '📧', color: 'bg-blue-50 text-blue-700' },
    whatsapp: { label: 'WhatsApp', icon: '💬', color: 'bg-green-50 text-green-700' },
    telegram: { label: 'Telegram', icon: '✈️', color: 'bg-sky-50 text-sky-700' },
    discord: { label: 'Discord', icon: '🎮', color: 'bg-indigo-50 text-indigo-700' },
    slack: { label: 'Slack', icon: '💼', color: 'bg-purple-50 text-purple-700' },
    webhook: { label: 'Webhook', icon: '🔗', color: 'bg-gray-50 text-gray-700' },
    sms: { label: 'SMS', icon: '📱', color: 'bg-amber-50 text-amber-700' },
};

const MSG_STATUS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    queued: { label: 'En cola', icon: <Clock className="w-3 h-3" />, color: 'text-yellow-600' },
    sent: { label: 'Enviado', icon: <Send className="w-3 h-3" />, color: 'text-blue-600' },
    delivered: { label: 'Entregado', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-600' },
    read: { label: 'Leído', icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-700' },
    failed: { label: 'Fallido', icon: <XCircle className="w-3 h-3" />, color: 'text-red-600' },
    bounced: { label: 'Rebotado', icon: <XCircle className="w-3 h-3" />, color: 'text-red-500' },
};

export default function ChannelsPage() {
    const [tab, setTab] = useState<'channels' | 'messages' | 'preferences' | 'events'>('channels');
    const { data: channelData, isLoading: channelsLoading } = useChannels();
    const { data: msgData, isLoading: msgsLoading } = useMessages();
    const { data: prefsData } = useNotificationPreferences();
    const { events: liveEvents, connected: sseConnected } = useBlockchainSSE();
    const { mutate } = useSWRConfig();
    const [showAdd, setShowAdd] = useState(false);
    const [verifyModal, setVerifyModal] = useState<Channel | null>(null);

    const channels = channelData?.channels ?? [];
    const messages = msgData?.messages ?? [];
    const prefs = prefsData?.preferences ?? [];
    const availableEvents = prefsData?.availableEvents ?? [];
    const availableChannels = prefsData?.availableChannels ?? [];

    const verifiedCount = channels.filter(c => c.is_verified).length;

    // ── Message statistics ──
    const msgStats = useMemo(() => {
        const total = messages.length;
        const delivered = messages.filter(m => m.status === 'delivered' || m.status === 'read').length;
        const failed = messages.filter(m => m.status === 'failed' || m.status === 'bounced').length;
        const queued = messages.filter(m => m.status === 'queued').length;
        const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
        return { total, delivered, failed, queued, deliveryRate };
    }, [messages]);

    // ── Channel type breakdown ──
    const channelBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        channels.forEach(ch => { map[ch.channel_type] = (map[ch.channel_type] || 0) + 1; });
        return Object.entries(map).sort(([, a], [, b]) => b - a);
    }, [channels]);

    return (
        <div className="space-y-6">
            {/* Ecosystem Nav */}
            <InfraEcosystemNav />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <MessageSquare className="w-7 h-7 text-bezhas-accent" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Comunicación Multicanal</h1>
                        <p className="text-sm text-gray-500">{channels.length} canales registrados · {verifiedCount} verificados</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* SSE indicator */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-500">
                        <div className={`h-2 w-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                        {sseConnected ? 'Eventos en vivo' : 'Sin conexión'}
                    </div>
                    <button onClick={() => setShowAdd(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-bezhas-accent text-white rounded-lg hover:bg-bezhas-accent/90 transition text-sm font-medium">
                        <Plus className="w-4 h-4" /> Agregar Canal
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Canales</p>
                    <p className="text-lg font-bold text-gray-900">{channels.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Verificados</p>
                    <p className="text-lg font-bold text-emerald-600">{verifiedCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Mensajes</p>
                    <p className="text-lg font-bold text-gray-900">{msgStats.total}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Entrega</p>
                    <p className="text-lg font-bold text-blue-600">{msgStats.deliveryRate}%</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase">Fallidos</p>
                    <p className="text-lg font-bold text-red-500">{msgStats.failed}</p>
                </div>
            </div>

            {/* Channel type breakdown chips */}
            {channelBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {channelBreakdown.map(([type, count]) => {
                        const meta = CHANNEL_META[type];
                        return (
                            <span key={type} className={`text-xs px-2.5 py-1 rounded-full ${meta?.color || 'bg-gray-100 text-gray-600'}`}>
                                {meta?.icon || '📌'} {meta?.label || type}: {count}
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {([
                    { key: 'channels', label: 'Canales', icon: <Mail className="w-4 h-4" /> },
                    { key: 'messages', label: 'Mensajes', icon: <Send className="w-4 h-4" /> },
                    { key: 'preferences', label: 'Preferencias', icon: <Settings2 className="w-4 h-4" /> },
                    { key: 'events', label: 'Eventos', icon: <Activity className="w-4 h-4" /> },
                ] as const).map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition
                            ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t.icon} {t.label}
                        {t.key === 'events' && liveEvents.length > 0 && (
                            <span className="ml-1 bg-bezhas-accent text-white text-[10px] px-1.5 py-0.5 rounded-full">{liveEvents.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'channels' && (
                channelsLoading ? (
                    <div className="text-gray-400 text-sm py-8 text-center">Cargando canales...</div>
                ) : channels.length === 0 ? (
                    <div className="text-gray-400 text-sm py-16 text-center">
                        <Mail className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                        No hay canales registrados
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {channels.map(ch => {
                            const meta = CHANNEL_META[ch.channel_type] || CHANNEL_META.webhook;
                            return (
                                <div key={ch.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${meta.color}`}>
                                            {meta.icon} {meta.label}
                                        </span>
                                        {ch.is_verified ? (
                                            <span className="flex items-center gap-1 text-xs text-green-600">
                                                <ShieldCheck className="w-3.5 h-3.5" /> Verificado
                                            </span>
                                        ) : (
                                            <button onClick={() => setVerifyModal(ch)}
                                                className="text-xs text-bezhas-accent hover:underline">Verificar</button>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 truncate">{ch.display_name || ch.channel_id}</p>
                                    <p className="text-xs text-gray-400 truncate">{ch.channel_id}</p>
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                                        <p className="text-[10px] text-gray-300">{new Date(ch.created_at).toLocaleDateString()}</p>
                                        <button onClick={async () => {
                                            await api.del(`/channels/${ch.id}`);
                                            mutate((key: string) => typeof key === 'string' && key.startsWith('/channels'));
                                        }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {tab === 'messages' && (
                msgsLoading ? (
                    <div className="text-gray-400 text-sm py-8 text-center">Cargando mensajes...</div>
                ) : messages.length === 0 ? (
                    <div className="text-gray-400 text-sm py-16 text-center">
                        <Send className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                        No hay mensajes enviados
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="text-left px-4 py-3">Canal</th>
                                    <th className="text-left px-4 py-3">Destinatario</th>
                                    <th className="text-left px-4 py-3">Asunto</th>
                                    <th className="text-left px-4 py-3">Estado</th>
                                    <th className="text-left px-4 py-3">Fecha</th>
                                    <th className="text-left px-4 py-3">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {messages.map(msg => {
                                    const chMeta = CHANNEL_META[msg.channel_type] || CHANNEL_META.webhook;
                                    const sMeta = MSG_STATUS[msg.status] || MSG_STATUS.queued;
                                    return (
                                        <tr key={msg.id} className="hover:bg-gray-50/50">
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${chMeta.color}`}>
                                                    {chMeta.icon} {chMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 truncate max-w-[200px]">{msg.recipient}</td>
                                            <td className="px-4 py-3 text-gray-900">{msg.subject || msg.template || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`flex items-center gap-1 text-xs ${sMeta.color}`}>
                                                    {sMeta.icon} {sMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-400">{new Date(msg.created_at).toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                {(msg.status === 'failed' || msg.status === 'bounced') && (
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await api.post('/channels/send', {
                                                                    channelType: msg.channel_type,
                                                                    recipient: msg.recipient,
                                                                    subject: msg.subject,
                                                                    body: msg.body || '',
                                                                    template: msg.template,
                                                                });
                                                                mutate((key: string) => typeof key === 'string' && key.startsWith('/channels'));
                                                            } catch { /* toast error */ }
                                                        }}
                                                        className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition"
                                                        title="Reintentar envío"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {tab === 'preferences' && (
                <PreferencesPanel
                    prefs={prefs}
                    availableEvents={availableEvents}
                    availableChannels={availableChannels}
                    onUpdate={() => mutate((key: string) => typeof key === 'string' && key.startsWith('/channels'))}
                />
            )}

            {/* Events Tab: Live blockchain events that trigger notifications */}
            {tab === 'events' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-700">Eventos Blockchain en Tiempo Real</h3>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                <div className={`h-2 w-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
                                {sseConnected ? 'Conectado' : 'Desconectado'}
                            </div>
                        </div>
                        {liveEvents.length === 0 ? (
                            <div className="py-8 text-center text-gray-400 text-sm">
                                <Activity className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                Esperando eventos blockchain...
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {liveEvents.slice(0, 50).map((evt, i) => (
                                    <div key={`${evt.timestamp}-${i}`}
                                        className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-xs hover:bg-gray-100 transition">
                                        <div className="flex items-center gap-2">
                                            <Activity className="w-3 h-3 text-bezhas-accent shrink-0" />
                                            <span className="font-medium text-gray-700">{evt.channel}</span>
                                            <span className="text-gray-400 truncate max-w-[300px]">
                                                {JSON.stringify(evt.data).slice(0, 80)}
                                            </span>
                                        </div>
                                        <span className="text-gray-300 whitespace-nowrap ml-2">
                                            {new Date(evt.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notification event mapping info */}
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Eventos que Generan Notificaciones</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {availableEvents.map(evt => {
                                const pref = prefs.find(p => p.event_type === evt);
                                const enabled = pref?.is_enabled ?? true;
                                const chTypes = pref?.channel_types ?? [];
                                return (
                                    <div key={evt} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                        <span className="text-xs font-medium text-gray-700">{evt.replaceAll('_', ' ')}</span>
                                        <div className="flex items-center gap-1">
                                            {chTypes.map(ch => {
                                                const meta = CHANNEL_META[ch];
                                                return <span key={ch} className="text-[10px]">{meta?.icon || '📌'}</span>;
                                            })}
                                            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                {enabled ? 'ON' : 'OFF'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Channel Modal */}
            {showAdd && <AddChannelModal onClose={() => {
                setShowAdd(false);
                mutate((key: string) => typeof key === 'string' && key.startsWith('/channels'));
            }} />}

            {/* Verify Modal */}
            {verifyModal && <VerifyModal channel={verifyModal} onClose={() => {
                setVerifyModal(null);
                mutate((key: string) => typeof key === 'string' && key.startsWith('/channels'));
            }} />}
        </div>
    );
}

function PreferencesPanel({ prefs, availableEvents, availableChannels, onUpdate }: {
    prefs: { event_type: string; channel_types: string[]; is_enabled: boolean }[];
    availableEvents: string[];
    availableChannels: string[];
    onUpdate: () => void;
}) {
    async function togglePref(eventType: string, channelTypes: string[], isEnabled: boolean) {
        await api.put('/channels/preferences', { eventType, channelTypes, isEnabled });
        onUpdate();
    }

    const prefMap = new Map(prefs.map(p => [p.event_type, p]));

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Preferencias de Notificación por Evento</h3>
            <div className="space-y-3">
                {availableEvents.map(evt => {
                    const pref = prefMap.get(evt);
                    const enabled = pref?.is_enabled ?? true;
                    const selectedChannels = pref?.channel_types ?? [];

                    return (
                        <div key={evt} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div>
                                <p className="text-sm font-medium text-gray-700">{evt.replaceAll('_', ' ')}</p>
                                <div className="flex gap-1 mt-1">
                                    {availableChannels.map(ch => {
                                        const meta = CHANNEL_META[ch];
                                        const active = selectedChannels.includes(ch);
                                        return (
                                            <button key={ch}
                                                onClick={() => {
                                                    const newChannels = active
                                                        ? selectedChannels.filter(c => c !== ch)
                                                        : [...selectedChannels, ch];
                                                    togglePref(evt, newChannels, true);
                                                }}
                                                className={`text-[10px] px-1.5 py-0.5 rounded transition
                                                    ${active ? meta?.color || 'bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-300'}`}>
                                                {meta?.icon || '📌'} {meta?.label || ch}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <button onClick={() => togglePref(evt, selectedChannels, !enabled)}
                                className={`w-10 h-5 rounded-full transition ${enabled ? 'bg-bezhas-accent' : 'bg-gray-200'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AddChannelModal({ onClose }: { onClose: () => void }) {
    const [channelType, setChannelType] = useState('email');
    const [channelId, setChannelId] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const placeholders: Record<string, string> = {
        email: 'usuario@ejemplo.com',
        whatsapp: '+1234567890',
        telegram: '@usuario o chat_id',
        discord: 'webhook URL o user#1234',
        slack: '#canal o webhook URL',
        webhook: 'https://tu-servidor.com/webhook',
        sms: '+1234567890',
    };

    async function handleAdd() {
        if (!channelId) { setError('El identificador del canal es requerido'); return; }
        setLoading(true);
        setError('');
        try {
            await api.post('/channels', { channelType, channelId, displayName: displayName || undefined });
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al registrar canal');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Agregar Canal de Comunicación</h2>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Tipo de Canal</label>
                        <select value={channelType} onChange={e => setChannelType(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            {Object.entries(CHANNEL_META).map(([k, v]) => (
                                <option key={k} value={k}>{v.icon} {v.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Identificador</label>
                        <input type="text" value={channelId} onChange={e => setChannelId(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            placeholder={placeholders[channelType]} />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700">Nombre (opcional)</label>
                        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="Mi email principal" />
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex gap-3 pt-2">
                        <button onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                            Cancelar
                        </button>
                        <button onClick={handleAdd} disabled={loading}
                            className="flex-1 px-4 py-2 text-sm bg-bezhas-accent text-white rounded-lg hover:bg-bezhas-accent/90 disabled:opacity-50">
                            {loading ? 'Registrando...' : 'Agregar Canal'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function VerifyModal({ channel, onClose }: { channel: Channel; onClose: () => void }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleVerify() {
        if (code.length !== 6) { setError('El código debe ser de 6 dígitos'); return; }
        setLoading(true);
        setError('');
        try {
            const result = await api.post<{ success: boolean; error?: string }>('/channels/verify', {
                channelType: channel.channel_type,
                channelId: channel.channel_id,
                code,
            });
            if (result.success) {
                onClose();
            } else {
                setError(result.error || 'Código inválido');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error de verificación');
        } finally {
            setLoading(false);
        }
    }

    const meta = CHANNEL_META[channel.channel_type] || CHANNEL_META.webhook;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-bold text-gray-900 mb-2">Verificar Canal</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Ingresa el código de 6 dígitos enviado a tu {meta.label}: <strong>{channel.channel_id}</strong>
                </p>

                {channel._verificationCode && (
                    <div className="bg-yellow-50 text-yellow-700 text-xs p-2 rounded mb-3">
                        [Dev] Código: <strong>{channel._verificationCode}</strong>
                    </div>
                )}

                <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="000000" maxLength={6} />

                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

                <div className="flex gap-3 mt-4">
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button onClick={handleVerify} disabled={loading || code.length !== 6}
                        className="flex-1 px-4 py-2 text-sm bg-bezhas-accent text-white rounded-lg hover:bg-bezhas-accent/90 disabled:opacity-50">
                        {loading ? 'Verificando...' : 'Verificar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
