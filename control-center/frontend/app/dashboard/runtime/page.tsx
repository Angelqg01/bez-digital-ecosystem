'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import StatCard from '@/components/StatCard';
import ToolInvoker from '@/components/ToolInvoker';
import {
    Activity, Wrench, Terminal, Plug, ShieldCheck, Zap,
    Radio, AlertTriangle,
} from 'lucide-react';

interface RuntimeHealth {
    status: string;
    version: string;
    tools_registered: number;
    commands_registered: number;
    plugins_loaded: number;
    sessions_active: number;
    circuits?: Record<string, { state: string; failures: number }>;
}

interface ToolDescriptor {
    name: string;
    description: string;
    permissions: string[];
    sector: string | null;
}

interface SSEEvent {
    id: number;
    type: string;
    ts: number;
    tool?: string;
    command?: string;
    [key: string]: unknown;
}

export default function RuntimeDashboardPage() {
    const { data: health, error: healthErr } = useSWR<{ status: string } & RuntimeHealth>(
        '/runtime/health', fetcher, { refreshInterval: 5000 }
    );
    const { data: toolsRes } = useSWR<{ data: { tools: ToolDescriptor[]; total: number } }>(
        '/runtime/tools', fetcher, { refreshInterval: 30000 }
    );
    const { data: cmdsRes } = useSWR<{ data: { commands: unknown[]; total: number } }>(
        '/runtime/commands', fetcher, { refreshInterval: 30000 }
    );

    // SSE live event stream
    const [events, setEvents] = useState<SSEEvent[]>([]);
    const esRef = useRef<EventSource | null>(null);

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('bezhas_token') : '';
        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/runtime/stream?token=${token || ''}`;
        const es = new EventSource(url);
        esRef.current = es;

        es.onmessage = (e) => {
            try {
                const evt: SSEEvent = JSON.parse(e.data);
                setEvents(prev => [evt, ...prev].slice(0, 100));
            } catch { /* ignore */ }
        };

        es.onerror = () => {
            es.close();
            // Auto-reconnect after 5s
            setTimeout(() => {
                if (esRef.current === es) {
                    esRef.current = null;
                }
            }, 5000);
        };

        return () => { es.close(); };
    }, []);

    const tools = toolsRes?.data?.tools || [];
    const isOnline = health?.status === 'ok';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Agent Runtime</h1>
                    <p className="text-sm text-gray-500">
                        v{health?.version || '—'} · {isOnline ? 'Operativo' : 'Desconectado'}
                    </p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isOnline ? '● Online' : '● Offline'}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Tools Registradas" value={health?.tools_registered ?? '—'} icon={<Wrench className="w-5 h-5" />} />
                <StatCard label="Comandos" value={health?.commands_registered ?? '—'} icon={<Terminal className="w-5 h-5" />} />
                <StatCard label="Plugins Cargados" value={health?.plugins_loaded ?? '—'} icon={<Plug className="w-5 h-5" />} />
                <StatCard label="Sesiones Activas" value={health?.sessions_active ?? '—'} icon={<Activity className="w-5 h-5" />} />
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Tool list + invoker */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Tool Invoker */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-bezhas-accent" /> Invocar Tool
                        </h2>
                        <ToolInvoker tools={tools} />
                    </div>

                    {/* Tools table */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-gray-500" /> Tools ({tools.length})
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 border-b">
                                        <th className="pb-2 font-medium">Nombre</th>
                                        <th className="pb-2 font-medium">Descripcion</th>
                                        <th className="pb-2 font-medium">Sector</th>
                                        <th className="pb-2 font-medium">Permisos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tools.map(t => (
                                        <tr key={t.name} className="border-b border-gray-50 hover:bg-gray-50/50">
                                            <td className="py-2 font-mono text-xs text-bezhas-accent">{t.name}</td>
                                            <td className="py-2 text-gray-600 max-w-xs truncate">{t.description}</td>
                                            <td className="py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs ${t.sector ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'}`}>
                                                    {t.sector || 'global'}
                                                </span>
                                            </td>
                                            <td className="py-2 text-xs text-gray-400">{t.permissions?.join(', ')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right: Live events feed */}
                <div className="space-y-4">
                    {/* Circuit Breakers */}
                    {health?.circuits && Object.keys(health.circuits).length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-gray-500" /> Circuit Breakers
                            </h3>
                            {Object.entries(health.circuits).map(([name, info]) => (
                                <div key={name} className="flex items-center justify-between py-1.5 text-sm">
                                    <span className="font-mono text-xs">{name}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${info.state === 'CLOSED' ? 'bg-green-100 text-green-700'
                                        : info.state === 'OPEN' ? 'bg-red-100 text-red-700'
                                            : 'bg-yellow-100 text-yellow-700'
                                        }`}>{info.state}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Live Events */}
                    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Radio className="w-4 h-4 text-red-500 animate-pulse" /> Eventos en Tiempo Real
                        </h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {events.length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-4">Esperando eventos...</p>
                            )}
                            {events.map(evt => (
                                <div key={evt.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-gray-50">
                                    <EventIcon type={evt.type} />
                                    <div className="min-w-0">
                                        <span className="font-medium text-gray-700">{evt.type}</span>
                                        {evt.tool && <span className="ml-1 text-gray-500">({evt.tool})</span>}
                                        <p className="text-gray-400 truncate">
                                            {new Date(evt.ts).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {healthErr && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 inline mr-1" /> No se pudo conectar al Agent Runtime
                </div>
            )}
        </div>
    );
}

function EventIcon({ type }: { type: string }) {
    if (type.startsWith('tool:')) return <Wrench className="w-3.5 h-3.5 text-bezhas-accent shrink-0 mt-0.5" />;
    if (type.startsWith('command:')) return <Terminal className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />;
    if (type.startsWith('circuit:')) return <ShieldCheck className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />;
    return <Activity className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />;
}
