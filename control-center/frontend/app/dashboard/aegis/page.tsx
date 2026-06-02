'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAILogs, useAegisStatus, useAegisSuggestions } from '@/lib/hooks';
import { useRuntimeHealth } from '@/lib/runtime-hooks';
import { useOllamaHealth, useOllamaStats, useOllamaModels, useOllamaPull } from '@/lib/ollama-hooks';
import { useSequencerOnChain } from '@/lib/validator-hooks';
import { api } from '@/lib/api';
import type { AILog, AegisStatus, AegisSuggestion } from '@/lib/types';
import {
    Shield, AlertTriangle, Info, XCircle, ChevronLeft, ChevronRight,
    Pause, Play, RotateCcw, Zap, Bell, BellOff, CheckCircle2, X,
    Activity, Database, Wifi, Brain, Search, Filter, ExternalLink,
    ThumbsDown, Sliders, RefreshCw, Radio, Terminal, Cpu, Download,
    Server, Gauge, AlertCircle,
} from 'lucide-react';
import AIEcosystemNav from '@/components/AIEcosystemNav';

// ── Constants ──
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const severityMap = {
    info: { icon: Info, color: 'text-blue-500 bg-blue-50', label: 'Info' },
    warning: { icon: AlertTriangle, color: 'text-orange-500 bg-orange-50', label: 'Warning' },
    critical: { icon: XCircle, color: 'text-red-500 bg-red-50', label: 'Critical' },
};

const modeLabels: Record<string, { label: string; color: string }> = {
    autonomous: { label: 'Autónomo', color: 'bg-green-100 text-green-700' },
    supervised: { label: 'Supervisado', color: 'bg-yellow-100 text-yellow-700' },
    manual: { label: 'Manual', color: 'bg-gray-100 text-gray-700' },
    paused: { label: 'Pausado', color: 'bg-red-100 text-red-700' },
};

const componentIcons: Record<string, typeof Database> = {
    database: Database,
    redis: Wifi,
    monitor: Activity,
};

// ── SSE Alert type ──
interface CriticalAlert {
    id: string | number;
    module: string;
    action: string;
    severity: string;
    created_at: string;
    circuit_open: boolean;
}

// ── Sub-components ──

function StatusPanel({ status, isLoading }: { status?: { data: AegisStatus }; isLoading: boolean }) {
    const s = status?.data;
    if (isLoading || !s) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
                </div>
            </div>
        );
    }

    const modeInfo = modeLabels[s.mode] ?? modeLabels.manual;
    const uptimeH = Math.floor((s.uptime_seconds || 0) / 3600);
    const uptimeM = Math.floor(((s.uptime_seconds || 0) % 3600) / 60);
    const modelEntries = Object.entries(s.models || {});
    const activeModels = modelEntries.filter(([, v]) => v).length;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-bezhas-accent" /> Estado del Sistema
                </h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${modeInfo.color}`}>
                    {modeInfo.label}
                </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Health</p>
                    <p className={`text-lg font-bold ${s.system_status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                        {s.system_status === 'healthy' ? '● OK' : '● ' + s.system_status}
                    </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Uptime</p>
                    <p className="text-lg font-bold text-gray-800">{uptimeH}h {uptimeM}m</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Modelos ML</p>
                    <p className="text-lg font-bold text-gray-800">{activeModels}/{modelEntries.length}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">Componentes</p>
                    <div className="flex justify-center gap-2 mt-1">
                        {Object.entries(s.components || {}).map(([key, val]) => {
                            const Icon = componentIcons[key] || Activity;
                            const ok = val === 'connected' || val === 'running' || val === 'ok';
                            return (
                                <span key={key} title={`${key}: ${val}`}>
                                    <Icon className={`w-5 h-5 ${ok ? 'text-green-500' : 'text-red-400'}`} />
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {modelEntries.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {modelEntries.map(([name, active]) => (
                        <span key={name} className={`text-xs px-2 py-0.5 rounded-full border ${active ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                            <Brain className="w-3 h-3 inline mr-1" />{name}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function SuggestionsPanel({
    suggestions,
    isLoading,
    onApprove,
    onReject,
    busy,
}: {
    suggestions: AegisSuggestion[];
    isLoading: boolean;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    busy: string | null;
}) {
    if (isLoading) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
                <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}</div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> Sugerencias Pendientes
                {suggestions.length > 0 && (
                    <span className="ml-auto bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        {suggestions.length}
                    </span>
                )}
            </h2>
            {suggestions.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">Sin sugerencias pendientes</p>
            ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {suggestions.map((sug) => (
                        <div key={sug.id} className="border border-gray-100 rounded-lg p-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{sug.type}: {sug.target}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{sug.reason}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-mono text-gray-400">
                                        {(sug.confidence * 100).toFixed(0)}% confianza
                                    </span>
                                    <span className="text-xs text-gray-300">·</span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(sug.created_at).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <button
                                    onClick={() => onApprove(sug.id)}
                                    disabled={busy === sug.id}
                                    className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40"
                                    title="Aprobar"
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onReject(sug.id)}
                                    disabled={busy === sug.id}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40"
                                    title="Rechazar"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AdminControls({
    onAction,
    busy,
}: {
    onAction: (action: string, payload?: Record<string, unknown>) => void;
    busy: string | null;
}) {
    const [threshold, setThreshold] = useState(0.7);

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" /> Controles Administrativos
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                    onClick={() => onAction('pause')}
                    disabled={busy === 'pause'}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium disabled:opacity-40"
                >
                    <Pause className="w-3.5 h-3.5" /> Pausar
                </button>
                <button
                    onClick={() => onAction('resume')}
                    disabled={busy === 'resume'}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium disabled:opacity-40"
                >
                    <Play className="w-3.5 h-3.5" /> Reanudar
                </button>
                <button
                    onClick={() => onAction('retrain')}
                    disabled={busy === 'retrain'}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-medium disabled:opacity-40"
                >
                    <RotateCcw className="w-3.5 h-3.5" /> Re-entrenar
                </button>
                <button
                    onClick={() => onAction('trigger', { action: 'health_check' })}
                    disabled={busy === 'trigger'}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium disabled:opacity-40"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Health Check
                </button>
            </div>

            <div className="flex items-center gap-3 pt-1">
                <label className="text-xs text-gray-500 whitespace-nowrap">Umbral anomalía:</label>
                <input
                    type="range" min="0.1" max="1" step="0.05"
                    value={threshold}
                    onChange={e => setThreshold(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-500"
                />
                <span className="text-xs font-mono text-gray-600 w-10 text-right">{threshold.toFixed(2)}</span>
                <button
                    onClick={() => onAction('threshold', { level: threshold })}
                    disabled={busy === 'threshold'}
                    className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-medium hover:bg-indigo-200 disabled:opacity-40"
                >
                    Aplicar
                </button>
            </div>
        </div>
    );
}

function AlertsBanner({ alerts, onDismiss }: { alerts: CriticalAlert[]; onDismiss: () => void }) {
    if (alerts.length === 0) return null;

    return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <Radio className="w-4 h-4 animate-pulse" /> Alertas Críticas en Tiempo Real
                    <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full">{alerts.length}</span>
                </h3>
                <button onClick={onDismiss} className="text-red-400 hover:text-red-600" title="Limpiar alertas">
                    <BellOff className="w-4 h-4" />
                </button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
                {alerts.map((a, i) => (
                    <div key={`${a.id}-${i}`} className="flex items-center gap-2 text-xs text-red-700">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium">{a.module}</span>
                        <span className="text-red-500">→ {a.action}</span>
                        <span className="ml-auto text-red-400">{new Date(a.created_at).toLocaleTimeString()}</span>
                        {a.circuit_open && (
                            <span className="bg-red-700 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">CIRCUIT OPEN</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function FilterBar({
    filters,
    onChange,
}: {
    filters: { severity: string; module: string; q: string; from: string; to: string; wallet: string };
    onChange: (f: typeof filters) => void;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-2 items-end">
                <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Severidad</label>
                    <select
                        value={filters.severity}
                        onChange={e => onChange({ ...filters, severity: e.target.value })}
                        className="block w-28 mt-0.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                    >
                        <option value="">Todas</option>
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Módulo</label>
                    <input
                        type="text" placeholder="Ej: gas_oracle"
                        value={filters.module}
                        onChange={e => onChange({ ...filters, module: e.target.value })}
                        className="block w-32 mt-0.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Buscar</label>
                    <div className="relative mt-0.5">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <input
                            type="text" placeholder="Texto libre..."
                            value={filters.q}
                            onChange={e => onChange({ ...filters, q: e.target.value })}
                            className="block w-40 text-xs border border-gray-200 rounded-lg pl-6 pr-2 py-1.5"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Desde</label>
                    <input
                        type="date"
                        value={filters.from}
                        onChange={e => onChange({ ...filters, from: e.target.value })}
                        className="block mt-0.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Hasta</label>
                    <input
                        type="date"
                        value={filters.to}
                        onChange={e => onChange({ ...filters, to: e.target.value })}
                        className="block mt-0.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">Wallet</label>
                    <input
                        type="text" placeholder="0x..."
                        value={filters.wallet}
                        onChange={e => onChange({ ...filters, wallet: e.target.value })}
                        className="block w-36 mt-0.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                    />
                </div>
                {Object.values(filters).some(Boolean) && (
                    <button
                        onClick={() => onChange({ severity: '', module: '', q: '', from: '', to: '', wallet: '' })}
                        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 pb-0.5"
                    >
                        <X className="w-3 h-3" /> Limpiar
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main Page ──

export default function AegisPage() {
    // State
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ severity: '', module: '', q: '', from: '', to: '', wallet: '' });
    const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
    const [busySuggestion, setBusySuggestion] = useState<string | null>(null);
    const [busyControl, setBusyControl] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Data hooks
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const { data: logsData, isLoading: logsLoading, mutate: mutateLogs } = useAILogs(page, activeFilters);
    const { data: statusData, isLoading: statusLoading } = useAegisStatus();
    const { data: suggestionsData, isLoading: sugLoading, mutate: mutateSuggestions } = useAegisSuggestions();
    const { data: runtimeHealth } = useRuntimeHealth();

    // Ollama hooks (FASE 4)
    const { data: ollamaHealth } = useOllamaHealth();
    const { data: ollamaStats } = useOllamaStats();
    const { data: ollamaModelsData } = useOllamaModels();
    const ollamaPull = useOllamaPull();
    const { status: sequencerOnChain } = useSequencerOnChain();

    const logs = logsData?.rows ?? [];
    const total = logsData?.total ?? 0;
    const pages = Math.ceil(total / 20);
    const suggestions = suggestionsData?.data?.suggestions ?? [];

    // Toast helper
    const flash = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [filters]);

    // SSE connection for critical alerts
    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : null;
        const params = token ? `?token=${encodeURIComponent(token)}` : '';
        const es = new EventSource(`${API_BASE}/aegis/alerts/stream${params}`);
        eventSourceRef.current = es;

        es.addEventListener('critical', (e) => {
            try {
                const parsed = JSON.parse(e.data);
                const alert: CriticalAlert = {
                    id: parsed.row?.id ?? Date.now(),
                    module: parsed.row?.module ?? 'unknown',
                    action: parsed.row?.action ?? '',
                    severity: 'critical',
                    created_at: parsed.row?.created_at ?? new Date().toISOString(),
                    circuit_open: parsed.circuit_open ?? false,
                };
                setAlerts((prev: CriticalAlert[]) => [alert, ...prev].slice(0, 50));
            } catch { /* ignore malformed */ }
        });

        es.onerror = () => {
            // Reconnect handled by browser; if closed, clean up
            if (es.readyState === EventSource.CLOSED) {
                es.close();
            }
        };

        return () => { es.close(); };
    }, []);

    // ── Handlers ──

    const handleApproveSuggestion = useCallback(async (id: string) => {
        setBusySuggestion(id);
        try {
            await api.post(`/aegis/suggestions/${encodeURIComponent(id)}/approve`, {});
            flash('Sugerencia aprobada');
            mutateSuggestions();
        } catch {
            flash('Error al aprobar sugerencia', 'err');
        } finally {
            setBusySuggestion(null);
        }
    }, [flash, mutateSuggestions]);

    const handleRejectSuggestion = useCallback(async (id: string) => {
        setBusySuggestion(id);
        try {
            await api.post(`/aegis/suggestions/${encodeURIComponent(id)}/reject`, {});
            flash('Sugerencia rechazada');
            mutateSuggestions();
        } catch {
            flash('Error al rechazar sugerencia', 'err');
        } finally {
            setBusySuggestion(null);
        }
    }, [flash, mutateSuggestions]);

    const handleAdminAction = useCallback(async (action: string, payload?: Record<string, unknown>) => {
        setBusyControl(action);
        const endpointMap: Record<string, { method: 'post' | 'put'; path: string }> = {
            pause: { method: 'post', path: '/aegis/pause' },
            resume: { method: 'post', path: '/aegis/resume' },
            retrain: { method: 'post', path: '/aegis/retrain' },
            trigger: { method: 'post', path: '/aegis/trigger' },
            threshold: { method: 'put', path: '/aegis/threshold' },
        };
        const ep = endpointMap[action];
        if (!ep) return;
        try {
            if (ep.method === 'post') {
                await api.post(ep.path, payload ?? {});
            } else {
                await api.put(ep.path, payload ?? {});
            }
            flash(`Acción "${action}" ejecutada`);
        } catch {
            flash(`Error en acción "${action}"`, 'err');
        } finally {
            setBusyControl(null);
        }
    }, [flash]);

    const handleFalsePositive = useCallback(async (log: AILog) => {
        try {
            await api.post('/aegis/false-positive', {
                log_id: log.id,
                module: log.module,
                action: log.action,
            });
            flash('Marcado como falso positivo');
            mutateLogs();
        } catch {
            flash('Error al marcar falso positivo', 'err');
        }
    }, [flash, mutateLogs]);

    // ── Render ──

    return (
        <div className="space-y-5">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all ${toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}>
                    {toast.msg}
                </div>
            )}

            {/* Cross-page navigation */}
            <AIEcosystemNav />

            {/* Sequencer AI Pause Status */}
            {sequencerOnChain?.isPaused && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm font-medium">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="font-bold">Sequencer L2 pausado por AEGIS</span>
                    <span className="text-amber-500">{sequencerOnChain.pauseReason}</span>
                    <span className="ml-auto text-[10px] font-bold text-amber-500 uppercase">ON-CHAIN</span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="w-7 h-7 text-bezhas-accent" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Aegis AI</h1>
                    <p className="text-sm text-gray-500">Motor de inteligencia artificial — monitoreo, control y trazabilidad</p>
                </div>
            </div>

            {/* Runtime Infrastructure Health */}
            {runtimeHealth && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
                        <Terminal className="w-5 h-5 text-blue-500" />
                        <div>
                            <p className="text-xs text-gray-500">Tools</p>
                            <p className="text-lg font-bold text-gray-900">{runtimeHealth.tools_registered ?? 0}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
                        <Cpu className="w-5 h-5 text-purple-500" />
                        <div>
                            <p className="text-xs text-gray-500">Plugins</p>
                            <p className="text-lg font-bold text-gray-900">{runtimeHealth.plugins_loaded ?? 0}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
                        <Activity className="w-5 h-5 text-green-500" />
                        <div>
                            <p className="text-xs text-gray-500">Sessions</p>
                            <p className="text-lg font-bold text-gray-900">{runtimeHealth.sessions_active ?? 0}</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-100 p-3 flex items-center gap-3">
                        <Zap className="w-5 h-5 text-amber-500" />
                        <div>
                            <p className="text-xs text-gray-500">Commands</p>
                            <p className="text-lg font-bold text-gray-900">{runtimeHealth.commands_registered ?? 0}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Ollama Local LLM Panel (FASE 4) */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Server className="w-4 h-4 text-purple-500" /> Ollama — LLMs Locales
                    </h2>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ollamaHealth?.healthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {ollamaHealth?.healthy ? '● Conectado' : '● Desconectado'}
                    </span>
                </div>

                {ollamaStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Requests (Local)</p>
                            <p className="text-lg font-bold text-gray-800">{ollamaStats.localRequests}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Tokens Procesados</p>
                            <p className="text-lg font-bold text-gray-800">{ollamaStats.tokensProcessed.toLocaleString()}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Latencia Avg</p>
                            <p className="text-lg font-bold text-gray-800">{ollamaStats.avgLatencyMs}ms</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">Fallbacks</p>
                            <p className={`text-lg font-bold ${ollamaStats.fallbacksTriggered > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{ollamaStats.fallbacksTriggered}</p>
                        </div>
                    </div>
                )}

                {ollamaStats?.quotas && (
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(ollamaStats.quotas).map(([provider, q]: [string, any]) => (
                            <div key={provider} className="bg-gray-50 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-600 capitalize">{provider}</span>
                                    <span className={`text-[10px] font-bold uppercase ${q.exhausted ? 'text-red-600' : 'text-green-600'}`}>
                                        {q.exhausted ? 'AGOTADA' : 'ACTIVO'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className={`h-2 rounded-full transition-all ${q.exhausted ? 'bg-red-500' : 'bg-green-500'}`}
                                        style={{ width: `${Math.min((q.used / q.limit) * 100, 100)}%` }} />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">{q.used.toLocaleString()} / {q.limit.toLocaleString()} tokens</p>
                            </div>
                        ))}
                    </div>
                )}

                {ollamaModelsData?.models && ollamaModelsData.models.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {ollamaModelsData.models.map((m: any) => (
                            <span key={m.name} className="text-xs px-2 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 font-medium flex items-center gap-1">
                                <Brain className="w-3 h-3" />{m.name}
                            </span>
                        ))}
                    </div>
                )}

                {ollamaHealth?.healthy && (
                    <div className="flex gap-2">
                        {['gemma4', 'qwen3', 'kimi-k2', 'deepseek-v4-pro'].map(m => {
                            const installed = ollamaModelsData?.models?.some((om: any) => om.name.includes(m));
                            return (
                                <button key={m} disabled={!!installed || ollamaPull.pulling}
                                    onClick={() => ollamaPull.pull(m)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition ${installed ? 'bg-green-50 text-green-600 cursor-default' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>
                                    {installed ? <CheckCircle2 className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                    {m}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Critical alerts (SSE) */}
            <AlertsBanner alerts={alerts} onDismiss={() => setAlerts([])} />

            {/* Status + Suggestions row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <StatusPanel status={statusData} isLoading={statusLoading} />
                <SuggestionsPanel
                    suggestions={suggestions}
                    isLoading={sugLoading}
                    onApprove={handleApproveSuggestion}
                    onReject={handleRejectSuggestion}
                    busy={busySuggestion}
                />
            </div>

            {/* Admin Controls */}
            <AdminControls onAction={handleAdminAction} busy={busyControl} />

            {/* Filters */}
            <FilterBar filters={filters} onChange={setFilters} />

            {/* Logs Table with blockchain traceability */}
            {logsLoading ? (
                <div className="text-gray-400 text-sm py-8 text-center">Cargando logs de IA...</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-left">
                                <tr>
                                    <th className="px-3 py-3">Severidad</th>
                                    <th className="px-3 py-3">Módulo</th>
                                    <th className="px-3 py-3">Acción</th>
                                    <th className="px-3 py-3">Confianza</th>
                                    <th className="px-3 py-3">Tx Hash</th>
                                    <th className="px-3 py-3">Bloque</th>
                                    <th className="px-3 py-3">Contrato</th>
                                    <th className="px-3 py-3">Wallet</th>
                                    <th className="px-3 py-3">Gas</th>
                                    <th className="px-3 py-3">Fecha</th>
                                    <th className="px-3 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {logs.map((log) => {
                                    const sev = severityMap[log.severity] ?? severityMap.info;
                                    const SevIcon = sev.icon;
                                    const shortHash = log.tx_hash
                                        ? `${log.tx_hash.slice(0, 6)}…${log.tx_hash.slice(-4)}`
                                        : null;
                                    const shortWallet = log.wallet_address
                                        ? `${log.wallet_address.slice(0, 6)}…${log.wallet_address.slice(-4)}`
                                        : null;
                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50/50">
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sev.color}`}>
                                                    <SevIcon className="w-3 h-3" />{sev.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 font-medium text-gray-900 text-xs">{log.module}</td>
                                            <td className="px-3 py-2.5 text-gray-600 text-xs">{log.action}</td>
                                            <td className="px-3 py-2.5 text-xs">
                                                {log.confidence != null ? (
                                                    <span className="font-mono">{(log.confidence * 100).toFixed(1)}%</span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-mono">
                                                {shortHash ? (
                                                    <span className="text-blue-600" title={log.tx_hash!}>
                                                        {shortHash} <ExternalLink className="w-2.5 h-2.5 inline" />
                                                    </span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-mono text-gray-500">
                                                {log.block_number ?? <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-gray-600">
                                                {log.contract_name ?? <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-mono">
                                                {shortWallet ? (
                                                    <span className="text-indigo-600" title={log.wallet_address!}>{shortWallet}</span>
                                                ) : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-mono text-gray-500">
                                                {log.gas_used ?? <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-gray-400 text-[11px] whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {(log.severity === 'warning' || log.severity === 'critical') && (
                                                    <button
                                                        onClick={() => handleFalsePositive(log)}
                                                        className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                                                        title="Marcar como falso positivo"
                                                    >
                                                        <ThumbsDown className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {logs.length === 0 && (
                                    <tr><td colSpan={11} className="text-center py-8 text-gray-400">Sin logs registrados</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pages > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                            <span className="text-xs text-gray-500">{total} registros — Página {page} de {pages}</span>
                            <div className="flex gap-2">
                                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                    className="p-1 rounded border disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                                    className="p-1 rounded border disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
