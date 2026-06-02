'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
    BrainCircuit, Power, MessageSquare, Send, Bot, Shield,
    Settings, RefreshCw, Loader2, AlertCircle, CheckCircle2,
    Zap, Hash, Globe, Sparkles, Terminal, Plug, ShieldAlert,
    Brain, Trash2, History, StopCircle,
} from 'lucide-react';
import { useAgentConfig, useAgentStatus } from '@/lib/hooks';
import { useRuntimeHealth, useRuntimeTools, useRuntimeCommands, useRuntimePlugins } from '@/lib/runtime-hooks';
import { api } from '@/lib/api';
import type { AgentConfig } from '@/lib/types';
import AIEcosystemNav from '@/components/AIEcosystemNav';

/* ── Reusable UI Pieces ── */

function Section({ title, icon, children, actions }: {
    title: string; icon: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">{icon} {title}</h2>
                {actions}
            </div>
            {children}
        </div>
    );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <label className="flex items-center gap-3 cursor-pointer">
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-bezhas-accent' : 'bg-gray-300'}`}
            >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-gray-700">{label}</span>
        </label>
    );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
    return (
        <div className="bg-gray-50 rounded-lg p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white shadow-sm">{icon}</div>
            <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}

function StatusDot({ ok }: { ok: boolean }) {
    return <span className={`w-2 h-2 rounded-full inline-block ${ok ? 'bg-green-500' : 'bg-red-400'}`} />;
}

/* ── Main Page ── */

export default function AIAgentPage() {
    const { data: cfgData, error: cfgErr, isLoading: cfgLoading, mutate: mutateCfg } = useAgentConfig();
    const { data: statusData, error: statusErr, isLoading: statusLoading, mutate: mutateStatus } = useAgentStatus();
    const { data: runtimeHealth } = useRuntimeHealth();
    const { data: toolsData } = useRuntimeTools();
    const { data: commandsData } = useRuntimeCommands();
    const { data: pluginsData } = useRuntimePlugins();

    const [saving, setSaving] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
    const [draft, setDraft] = useState<AgentConfig | null>(null);

    // Chat test state
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'agent'; text: string; streaming?: boolean }[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const esRef = useRef<EventSource | null>(null);

    // Memory panel state
    const [memoryStats, setMemoryStats] = useState<{ messageCount: number; maxMessages: number; lastMessageAt: string | null } | null>(null);
    const [memoryHistory, setMemoryHistory] = useState<string>('');
    const [memoryTab, setMemoryTab] = useState<'chat' | 'memory'>('chat');
    const [clearingMemory, setClearingMemory] = useState(false);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const config = draft ?? cfgData?.config;

    const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const updateField = useCallback(<K extends keyof AgentConfig>(key: K, val: AgentConfig[K]) => {
        if (!config) return;
        setDraft({ ...config, [key]: val });
    }, [config]);

    const updateChannel = useCallback((ch: 'telegram' | 'discord' | 'whatsapp', field: string, val: unknown) => {
        if (!config) return;
        setDraft({
            ...config,
            channels: {
                ...config.channels,
                [ch]: { ...config.channels[ch], [field]: val },
            },
        });
    }, [config]);

    const handleSave = useCallback(async () => {
        if (!draft) return;
        setSaving(true);
        try {
            // Backend expects config fields directly, not wrapped in { config: ... }
            await api.put('/agent/config', draft);
            // If channels were modified, restart them automatically
            if (draft.channels) {
                try { await api.post('/agent/channels/restart', {}); } catch { /* non-critical */ }
            }
            await mutateCfg();
            await mutateStatus();
            setDraft(null);
            showToast('ok', 'Configuración guardada y canales reiniciados');
        } catch (e: unknown) {
            showToast('err', e instanceof Error ? e.message : 'Error al guardar');
        } finally {
            setSaving(false);
        }
    }, [draft, mutateCfg, mutateStatus, showToast]);

    const handleRestart = useCallback(async () => {
        setRestarting(true);
        try {
            await api.post('/agent/channels/restart', {});
            await mutateStatus();
            showToast('ok', 'Canales reiniciados');
        } catch {
            showToast('err', 'Error al reiniciar canales');
        } finally {
            setRestarting(false);
        }
    }, [mutateStatus, showToast]);

    // SSE-based streaming chat handler
    const handleChat = useCallback(() => {
        if (!chatInput.trim() || isStreaming) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsStreaming(true);
        setChatLoading(true);

        // Add a placeholder agent message that we'll fill in
        setChatMessages(prev => [...prev, { role: 'agent', text: '', streaming: true }]);

        // Get auth token for SSE request
        const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
        const url = `/api/agent/stream?message=${encodeURIComponent(userMsg)}`;

        // Close any existing EventSource
        if (esRef.current) { esRef.current.close(); }

        // We use fetch with streaming because EventSource doesn't support custom headers
        const abortController = new AbortController();

        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`, {
            method: 'GET',
            headers: {
                Accept: 'text/event-stream',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: abortController.signal,
        }).then(async (response) => {
            if (!response.ok || !response.body) {
                throw new Error('Stream failed');
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accum = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('event: chunk')) continue;
                    if (line.startsWith('data: ') && !line.includes('event: done') && !line.includes('event: start')) {
                        // Parse SSE data line
                        const raw = line.slice(6);
                        // Check if it's JSON (start/done events) or plain text (chunk)
                        try {
                            const parsed = JSON.parse(raw);
                            // done event: { data: ... }
                            if (parsed.data !== undefined || parsed.message) continue;
                        } catch {
                            // Plain text chunk
                            accum += raw;
                            setChatMessages(prev => {
                                const updated = [...prev];
                                const lastIdx = updated.length - 1;
                                if (updated[lastIdx]?.role === 'agent') {
                                    updated[lastIdx] = { role: 'agent', text: accum, streaming: true };
                                }
                                return updated;
                            });
                        }
                    }
                }
            }

            // Mark streaming done
            setChatMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'agent') {
                    updated[lastIdx] = { role: 'agent', text: accum || 'Sin respuesta.', streaming: false };
                }
                return updated;
            });
        }).catch((err) => {
            if (err.name === 'AbortError') return;
            setChatMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'agent') {
                    updated[lastIdx] = { role: 'agent', text: '⚠️ Error al comunicarse con el agente.', streaming: false };
                }
                return updated;
            });
        }).finally(() => {
            setIsStreaming(false);
            setChatLoading(false);
        });

        // Store abort function
        esRef.current = { close: () => abortController.abort() } as unknown as EventSource;
    }, [chatInput, isStreaming]);

    const handleStopStream = useCallback(() => {
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        setIsStreaming(false);
        setChatLoading(false);
        setChatMessages(prev => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]?.streaming) {
                updated[lastIdx] = { ...updated[lastIdx], streaming: false, text: updated[lastIdx].text + ' [detenido]' };
            }
            return updated;
        });
    }, []);

    // Memory management helpers
    const loadMemoryStats = useCallback(async () => {
        try {
            const res = await api.get<{ data: { messageCount: number; maxMessages: number; lastMessageAt: string | null } }>(
                `/agent/memory/api:${(config as {address?: string})?.address || 'anonymous'}`
            );
            setMemoryStats(res.data);
        } catch { /* non-critical */ }
    }, [config]);

    const handleClearMemory = useCallback(async () => {
        setClearingMemory(true);
        try {
            await api.del(`/agent/memory/api:${(config as {address?: string})?.address || 'anonymous'}`);
            setMemoryStats(prev => prev ? { ...prev, messageCount: 0, lastMessageAt: null } : null);
            setChatMessages([]);
            showToast('ok', 'Memoria conversacional borrada');
        } catch {
            showToast('err', 'Error al borrar la memoria');
        } finally {
            setClearingMemory(false);
        }
    }, [config, showToast]);

    /* ── Loading / Error states ── */

    if (cfgLoading || statusLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Cargando AI Agent…
            </div>
        );
    }

    if (cfgErr || statusErr || !config) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500 gap-2">
                <AlertCircle className="w-5 h-5" /> No se pudo cargar la configuración del Agente IA.
            </div>
        );
    }

    const stats = statusData?.agent?.stats;
    const channels = statusData?.channels ?? {};
    const services = statusData?.services;
    const isDirty = draft !== null;

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Cross-page navigation */}
            <AIEcosystemNav />

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BrainCircuit className="w-7 h-7 text-bezhas-accent" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">AI Agent</h1>
                        <p className="text-sm text-gray-500">Agente IA unificado — configura canales, personalidad y permisos</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isDirty && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-bezhas-accent text-white rounded-lg text-sm font-medium hover:bg-bezhas-accent/90 disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Guardar
                        </button>
                    )}
                    <button
                        onClick={handleRestart}
                        disabled={restarting}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                    >
                        {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Reiniciar Canales
                    </button>
                </div>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Mensajes procesados" value={stats.messagesProcessed} icon={<MessageSquare className="w-5 h-5 text-blue-500" />} />
                    <StatCard label="Comandos ejecutados" value={stats.commandsExecuted} icon={<Hash className="w-5 h-5 text-purple-500" />} />
                    <StatCard label="Tools invocados" value={stats.toolsInvoked} icon={<Zap className="w-5 h-5 text-amber-500" />} />
                    <StatCard label="Errores" value={stats.errors} icon={<AlertCircle className="w-5 h-5 text-red-400" />} />
                </div>
            )}

            {/* General Settings */}
            <Section title="General" icon={<Settings className="w-5 h-5 text-gray-500" />}>
                <div className="space-y-4">
                    <Toggle checked={config.enabled} onChange={(v) => updateField('enabled', v)} label="Agente activo" />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Personalidad</label>
                        <textarea
                            className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-800 resize-none focus:ring-2 focus:ring-bezhas-accent/30 focus:border-bezhas-accent"
                            rows={3}
                            value={config.personality}
                            onChange={(e) => updateField('personality', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                            <select
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-bezhas-accent/30"
                                value={config.language}
                                onChange={(e) => updateField('language', e.target.value)}
                            >
                                <option value="es">Español</option>
                                <option value="en">English</option>
                                <option value="pt">Português</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit (msg/min)</label>
                            <input
                                type="number"
                                min={1}
                                max={100}
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-gray-800 focus:ring-2 focus:ring-bezhas-accent/30"
                                value={config.maxMessagesPerMinute}
                                onChange={(e) => updateField('maxMessagesPerMinute', parseInt(e.target.value, 10) || 10)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Roles permitidos</label>
                        <div className="flex gap-2 flex-wrap">
                            {['admin', 'enterprise', 'user', 'edge_node'].map(role => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => {
                                        const roles = config.allowedRoles.includes(role)
                                            ? config.allowedRoles.filter(r => r !== role)
                                            : [...config.allowedRoles, role];
                                        updateField('allowedRoles', roles);
                                    }}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${config.allowedRoles.includes(role)
                                        ? 'bg-bezhas-accent/10 text-bezhas-accent border-bezhas-accent/30'
                                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                        }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>

            {/* Channel Configs */}
            <Section
                title="Canales de Comunicación"
                icon={<Globe className="w-5 h-5 text-bezhas-purple" />}
                actions={
                    <div className="flex items-center gap-3 text-xs">
                        {(['telegram', 'discord', 'whatsapp'] as const).map((ch) => {
                            const st = channels[ch];
                            const channelConfig = config.channels[ch];
                            const enabled = channelConfig?.enabled;
                            const hasToken = Boolean(channelConfig?.token || channelConfig?.accessToken);
                            return (
                                <span key={ch} className="flex items-center gap-1.5 capitalize">
                                    <span className={`w-2 h-2 rounded-full ${
                                        !enabled ? 'bg-gray-300'
                                        : st?.running ? 'bg-green-500 animate-pulse'
                                        : hasToken ? 'bg-amber-400'
                                        : 'bg-red-300'
                                    }`} />
                                    {ch}
                                </span>
                            );
                        })}
                    </div>
                }
            >
                <div className="space-y-6">
                    {/* Telegram */}
                    <div className={`border rounded-lg p-4 space-y-3 ${
                        channels.telegram?.running ? 'border-green-200 bg-green-50/30'
                        : config.channels.telegram?.enabled ? 'border-amber-200'
                        : 'border-gray-100'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-blue-500" />
                                <span className="font-medium text-sm text-gray-800">Telegram</span>
                                {channels.telegram?.running && (
                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">● ACTIVO</span>
                                )}
                                {config.channels.telegram?.enabled && !channels.telegram?.running && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠ Sin conectar</span>
                                )}
                            </div>
                            <Toggle
                                checked={config.channels.telegram.enabled}
                                onChange={(v) => updateChannel('telegram', 'enabled', v)}
                                label=""
                            />
                        </div>
                        {config.channels.telegram.enabled && (
                            <div className="space-y-2">
                                <label className="block text-xs text-gray-500 mb-1">Bot Token</label>
                                <input
                                    type="password"
                                    className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                                    value={config.channels.telegram.token ?? ''}
                                    onChange={(e) => updateChannel('telegram', 'token', e.target.value)}
                                />
                                {!config.channels.telegram.token && (
                                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                        <span className="text-blue-500">ℹ</span>
                                        Obtén tu token en{' '}
                                        <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                            @BotFather
                                        </a>
                                        {' '}→ /newbot → copiar token
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Discord */}
                    <div className={`border rounded-lg p-4 space-y-3 ${
                        channels.discord?.running ? 'border-green-200 bg-green-50/30'
                        : config.channels.discord?.enabled ? 'border-amber-200'
                        : 'border-gray-100'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                <span className="font-medium text-sm text-gray-800">Discord</span>
                                {channels.discord?.running && (
                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">● ACTIVO</span>
                                )}
                                {config.channels.discord?.enabled && !channels.discord?.running && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠ Sin conectar</span>
                                )}
                            </div>
                            <Toggle
                                checked={config.channels.discord.enabled}
                                onChange={(v) => updateChannel('discord', 'enabled', v)}
                                label=""
                            />
                        </div>
                        {config.channels.discord.enabled && (
                            <div className="space-y-2">
                                <label className="block text-xs text-gray-500 mb-1">Bot Token</label>
                                <input
                                    type="password"
                                    className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    placeholder="MTEyMzQ1Njc4OTAxMjM0NTY3OA.Ghxxx.xxx"
                                    value={config.channels.discord.token ?? ''}
                                    onChange={(e) => updateChannel('discord', 'token', e.target.value)}
                                />
                                {!config.channels.discord.token && (
                                    <p className="text-[11px] text-gray-500 flex items-center gap-1">
                                        <span className="text-indigo-500">ℹ</span>
                                        Ve a{' '}
                                        <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                                            Discord Developer Portal
                                        </a>
                                        {' '}→ New Application → Bot → Reset Token
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* WhatsApp */}
                    <div className={`border rounded-lg p-4 space-y-3 ${
                        channels.whatsapp?.running ? 'border-green-200 bg-green-50/30'
                        : config.channels.whatsapp?.enabled ? 'border-amber-200'
                        : 'border-gray-100'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-green-500" />
                                <span className="font-medium text-sm text-gray-800">WhatsApp</span>
                                {channels.whatsapp?.running && (
                                    <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">● ACTIVO</span>
                                )}
                                {config.channels.whatsapp?.enabled && !channels.whatsapp?.running && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">⚠ Sin conectar</span>
                                )}
                            </div>
                            <Toggle
                                checked={config.channels.whatsapp.enabled}
                                onChange={(v) => updateChannel('whatsapp', 'enabled', v)}
                                label=""
                            />
                        </div>
                        {config.channels.whatsapp.enabled && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Phone Number ID</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-green-500/20"
                                            value={config.channels.whatsapp.phoneNumberId ?? ''}
                                            onChange={(e) => updateChannel('whatsapp', 'phoneNumberId', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Access Token</label>
                                        <input
                                            type="password"
                                            className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-green-500/20"
                                            value={config.channels.whatsapp.accessToken ?? ''}
                                            onChange={(e) => updateChannel('whatsapp', 'accessToken', e.target.value)}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-gray-500 mb-1">Verify Token (webhook)</label>
                                        <input
                                            type="text"
                                            className="w-full border border-gray-200 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-green-500/20"
                                            value={config.channels.whatsapp.verifyToken ?? ''}
                                            onChange={(e) => updateChannel('whatsapp', 'verifyToken', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-3 text-[11px] text-gray-500">
                                    <p className="font-semibold text-gray-700 mb-1">Webhook URL (configurar en Meta):</p>
                                    <code className="font-mono bg-white border border-gray-200 px-2 py-1 rounded select-all block">
                                        {(typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : 'https://tu-dominio.com/api') || 'http://localhost:3001/api'}/agent/webhook/whatsapp
                                    </code>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Section>

            {/* Services Health */}
            {services && (
                <Section title="Estado de Servicios" icon={<Shield className="w-5 h-5 text-bezhas-emerald" />}>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Aegis</span>
                            <StatusDot ok={services.aegis?.status === 'ok'} />
                        </div>
                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">AI Engine (MCP)</span>
                            <StatusDot ok={services.aiEngine?.status === 'ok'} />
                        </div>
                    </div>
                </Section>
            )}

            {/* Runtime Health & Infrastructure */}
            {runtimeHealth && (
                <Section title="Agent Runtime" icon={<Terminal className="w-5 h-5 text-indigo-500" />}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <StatCard label="Tools Registrados" value={runtimeHealth.tools_registered} icon={<Zap className="w-5 h-5 text-amber-500" />} />
                        <StatCard label="Comandos" value={runtimeHealth.commands_registered} icon={<Hash className="w-5 h-5 text-purple-500" />} />
                        <StatCard label="Plugins" value={runtimeHealth.plugins_loaded} icon={<Plug className="w-5 h-5 text-blue-500" />} />
                        <StatCard label="Sesiones Activas" value={runtimeHealth.sessions_active} icon={<MessageSquare className="w-5 h-5 text-green-500" />} />
                    </div>

                    {/* Circuit Breakers */}
                    {runtimeHealth.circuits && Object.keys(runtimeHealth.circuits).length > 0 && (
                        <div className="mt-4">
                            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3" /> Circuit Breakers
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {Object.entries(runtimeHealth.circuits).map(([name, info]) => (
                                    <div key={name} className={`flex items-center justify-between py-1.5 px-3 rounded-lg text-xs ${info.state === 'closed' ? 'bg-green-50 text-green-700' :
                                            info.state === 'open' ? 'bg-red-50 text-red-700' :
                                                'bg-amber-50 text-amber-700'
                                        }`}>
                                        <span className="font-medium truncate">{name}</span>
                                        <span className="font-bold uppercase">{info.state}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Section>
            )}

            {/* Registered Tools */}
            {toolsData?.data?.tools && toolsData.data.tools.length > 0 && (
                <Section title={`Tools Disponibles (${toolsData.data.total})`} icon={<Zap className="w-5 h-5 text-amber-500" />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {toolsData.data.tools.map(tool => (
                            <div key={tool.name} className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                                <Terminal className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-gray-800 font-mono truncate">{tool.name}</p>
                                    {tool.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{tool.description}</p>}
                                    {tool.sector && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded mt-1 inline-block">{tool.sector}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* Plugins */}
            {pluginsData?.data?.plugins && pluginsData.data.plugins.length > 0 && (
                <Section title={`Plugins (${pluginsData.data.total})`} icon={<Plug className="w-5 h-5 text-blue-500" />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {pluginsData.data.plugins.map(plugin => (
                            <div key={plugin.name} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs font-bold text-gray-800">{plugin.name}</p>
                                <div className="flex gap-2 mt-1">
                                    {plugin.sector && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{plugin.sector}</span>}
                                    {plugin.version && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">v{plugin.version}</span>}
                                    {plugin.tools != null && <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">{plugin.tools} tools</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* Test Chat + Memory */}
            <Section
                title="Chat en Tiempo Real"
                icon={<MessageSquare className="w-5 h-5 text-blue-500" />}
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setMemoryTab('chat'); }}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                                memoryTab === 'chat' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            <MessageSquare className="w-3 h-3 inline mr-1" />Chat
                        </button>
                        <button
                            onClick={() => { setMemoryTab('memory'); loadMemoryStats(); }}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                                memoryTab === 'memory' ? 'bg-violet-50 text-violet-700' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            <Brain className="w-3 h-3 inline mr-1" />Memoria
                        </button>
                    </div>
                }
            >
                {memoryTab === 'chat' ? (
                    <>
                        <div className="border border-gray-100 rounded-xl bg-gray-50 h-80 overflow-y-auto p-4 space-y-3 mb-3 scroll-smooth">
                            {chatMessages.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                                    <Bot className="w-10 h-10 text-gray-200" />
                                    <p className="text-xs text-center">
                                        Escribe un mensaje para probar el agente<br />
                                        ej: <code className="bg-gray-100 px-1 rounded">/status</code>, <code className="bg-gray-100 px-1 rounded">/help</code>, <code className="bg-gray-100 px-1 rounded">/memory</code>
                                    </p>
                                </div>
                            )}
                            {chatMessages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {m.role === 'agent' && (
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-bezhas-accent to-bezhas-purple flex items-center justify-center mr-2 shrink-0 mt-0.5">
                                            <Bot className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    )}
                                    <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                                        m.role === 'user'
                                            ? 'bg-bezhas-accent text-white rounded-br-sm'
                                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                                    }`}>
                                        {m.text}
                                        {m.streaming && (
                                            <span className="inline-flex ml-1 gap-0.5 align-middle">
                                                {[0, 1, 2].map(d => (
                                                    <span key={d}
                                                        className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                                                        style={{ animationDelay: `${d * 0.2}s` }}
                                                    />
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {chatLoading && !isStreaming && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-gray-400 flex items-center gap-2 shadow-sm">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Conectando...
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                id="agent-chat-input"
                                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-bezhas-accent/30 focus:border-bezhas-accent outline-none transition"
                                placeholder={isStreaming ? 'El agente está respondiendo...' : 'Escribe un mensaje o comando…'}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !isStreaming && handleChat()}
                                disabled={isStreaming}
                            />
                            {isStreaming ? (
                                <button
                                    onClick={handleStopStream}
                                    className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-medium hover:bg-red-200 transition flex items-center gap-2"
                                    title="Detener respuesta"
                                >
                                    <StopCircle className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    id="agent-chat-send"
                                    onClick={handleChat}
                                    disabled={chatLoading || !chatInput.trim()}
                                    className="px-4 py-2 bg-bezhas-accent text-white rounded-xl text-sm font-medium hover:bg-bezhas-accent/90 disabled:opacity-50 flex items-center gap-2 transition"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                            ⚡ Streaming SSE — respuestas en tiempo real · Usa <code>/help</code> para ver todos los comandos
                        </p>
                    </>
                ) : (
                    <>
                        {/* Memory Stats Panel */}
                        <div className="space-y-4">
                            {memoryStats ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-violet-50 rounded-xl p-4">
                                        <p className="text-xs text-violet-500 font-medium">Mensajes guardados</p>
                                        <p className="text-2xl font-bold text-violet-700 mt-1">
                                            {memoryStats.messageCount}
                                            <span className="text-sm font-normal text-violet-400"> /{memoryStats.maxMessages}</span>
                                        </p>
                                        <div className="mt-2 h-1.5 bg-violet-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-violet-400 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, (memoryStats.messageCount / memoryStats.maxMessages) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4">
                                        <p className="text-xs text-gray-500 font-medium">Última actividad</p>
                                        <p className="text-sm font-medium text-gray-700 mt-2">
                                            {memoryStats.lastMessageAt
                                                ? new Date(memoryStats.lastMessageAt).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                                                : 'Sin mensajes'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
                                </div>
                            )}

                            <div className="flex items-center justify-between py-3 px-4 bg-amber-50 border border-amber-100 rounded-xl">
                                <div>
                                    <p className="text-sm font-medium text-amber-800">Borrar historial conversacional</p>
                                    <p className="text-xs text-amber-600 mt-0.5">Esta acción no se puede deshacer. El agente perderá el contexto de esta sesión.</p>
                                </div>
                                <button
                                    id="clear-memory-btn"
                                    onClick={handleClearMemory}
                                    disabled={clearingMemory}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50 transition"
                                >
                                    {clearingMemory ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                    Limpiar
                                </button>
                            </div>

                            <div className="bg-blue-50 rounded-xl p-4">
                                <p className="text-xs font-semibold text-blue-700 mb-2">Comandos de memoria disponibles en el chat</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {['/memory', '/history', '/clear'].map(cmd => (
                                        <button
                                            key={cmd}
                                            onClick={() => { setChatInput(cmd); setMemoryTab('chat'); }}
                                            className="text-xs bg-white border border-blue-100 text-blue-600 rounded-lg px-2 py-1.5 font-mono hover:bg-blue-50 transition"
                                        >
                                            {cmd}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Section>
        </div>
    );
}
