'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { AgentDataProvider, useAgentData } from './AgentDataProvider';
import AIEcosystemNav from './AIEcosystemNav';
import { useAgentSSE, useBEZToken, useMCPInvoke } from '@/lib/agent-hooks';
import { useRuntimeHealth } from '@/lib/runtime-hooks';
import type { AgentEntry, AgentGroup } from '@/lib/agent-types';
import {
    Users, Activity, Zap, AlertTriangle, Flame, Brain,
    Wifi, WifiOff, Terminal, ChevronDown, ChevronRight,
    Shield, Cpu, BarChart3,
} from 'lucide-react';

// Carga dinámica del módulo JSX de agentes (sin SSR porque usa APIs del navegador)
const BeZhasAgentMaster = dynamic(
    () => import('@agents/bezhas-agent-master'),
    { ssr: false, loading: () => <AgentsLoading /> }
);

function AgentsLoading() {
    return (
        <div className="flex items-center justify-center h-96 bg-slate-900 rounded-3xl border border-slate-800">
            <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-400 text-sm font-mono">Loading AI Agents Dashboard...</p>
            </div>
        </div>
    );
}

/** Inline fallback UI when the JSX agent module is not available */
function AgentsFallbackUI() {
    const agentData = useAgentData();
    const { events, connected } = useAgentSSE();
    const { data: tokenRes } = useBEZToken();
    const { data: runtimeHealth } = useRuntimeHealth();
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const registry = agentData?.registry;
    const analytics = agentData?.analytics;
    const tools = agentData?.mcpTools ?? [];

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatBox
                    label="Agentes Activos"
                    value={analytics?.agents_active ?? registry?.total_agents ?? 0}
                    icon={<Users className="w-5 h-5 text-blue-500" />}
                />
                <StatBox
                    label="Acciones 24h"
                    value={analytics?.total_actions_24h ?? 0}
                    icon={<Activity className="w-5 h-5 text-emerald-500" />}
                />
                <StatBox
                    label="Alertas Críticas"
                    value={analytics?.critical_alerts_24h ?? 0}
                    icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                    alert={!!analytics?.critical_alerts_24h}
                />
                <StatBox
                    label="BEZ Burned"
                    value={analytics?.bez_burned_24h ?? tokenRes?.data?.total_burned ?? '0'}
                    icon={<Flame className="w-5 h-5 text-orange-500" />}
                />
                <StatBox
                    label="MCP Tools"
                    value={tools.length || registry?.mcp_tools || 0}
                    icon={<Terminal className="w-5 h-5 text-purple-500" />}
                />
            </div>

            {/* Runtime Health + Aegis Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                        <Cpu className="w-4 h-4 text-blue-500" /> Agent Runtime
                    </h3>
                    {runtimeHealth ? (
                        <div className="grid grid-cols-2 gap-3">
                            <MiniStat label="Tools" value={runtimeHealth.tools_registered} />
                            <MiniStat label="Commands" value={runtimeHealth.commands_registered} />
                            <MiniStat label="Plugins" value={runtimeHealth.plugins_loaded} />
                            <MiniStat label="Sessions" value={runtimeHealth.sessions_active} />
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400">Loading runtime...</p>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-bezhas-accent" /> Aegis AI
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <MiniStat label="Status" value={registry?.aegis_status ?? 'offline'} />
                        <MiniStat label="Mode" value={registry?.aegis_mode ?? '—'} />
                    </div>
                    {registry?.aegis_models && (
                        <div className="flex flex-wrap gap-1 mt-3">
                            {Object.entries(registry.aegis_models).map(([name, active]) => (
                                <span key={name} className={`text-[10px] px-2 py-0.5 rounded-full border ${active ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                                    <Brain className="w-2.5 h-2.5 inline mr-0.5" />{name}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Agent Groups */}
            {registry?.groups && registry.groups.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-indigo-500" />
                            Grupos de Agentes ({registry.total_groups})
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {registry.groups.map((group: AgentGroup) => (
                            <div key={group.id}>
                                <button
                                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-all text-left"
                                    onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedGroup === group.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                        <span className="text-sm font-bold text-gray-900">{group.name}</span>
                                        <span className="text-xs text-gray-400">{group.agents.length} agentes</span>
                                    </div>
                                </button>
                                {expandedGroup === group.id && (
                                    <div className="px-5 pb-4 space-y-2">
                                        {group.agents.map((agent: AgentEntry) => (
                                            <div key={agent.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">{agent.id}</p>
                                                    <p className="text-[10px] text-gray-400">
                                                        {agent.activity.actions_24h} acciones | {agent.activity.alerts_24h} alertas
                                                    </p>
                                                </div>
                                                {agent.activity.last_action && (
                                                    <span className="text-[10px] text-gray-400">{new Date(agent.activity.last_action).toLocaleTimeString()}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Live SSE Events */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" /> Eventos en Tiempo Real
                    </h3>
                    <div className="flex items-center gap-2">
                        {connected ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-red-400" />}
                        <span className="text-[10px] text-gray-400">{connected ? 'SSE Conectado' : 'Desconectado'}</span>
                    </div>
                </div>
                {events.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Esperando eventos de agentes...</p>
                ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {events.slice(0, 20).map((ev, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <span className={`w-1.5 h-1.5 rounded-full ${ev.severity === 'critical' ? 'bg-red-500' : ev.severity === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                <span className="font-medium text-gray-700">{ev.module}</span>
                                <span className="text-gray-400">{ev.action}</span>
                                {ev.tx_hash && <span className="font-mono text-blue-500 text-[10px]">{ev.tx_hash.slice(0, 8)}…</span>}
                                <span className="ml-auto text-[10px] text-gray-300">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MCP Tools List */}
            {tools.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                        <Terminal className="w-4 h-4 text-purple-500" /> MCP Tools ({tools.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {tools.map(tool => (
                            <div key={tool.name} className="bg-gray-50 rounded-lg p-3">
                                <p className="text-xs font-bold text-gray-800 font-mono">{tool.name}</p>
                                {tool.description && <p className="text-[10px] text-gray-400 mt-0.5">{tool.description}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatBox({ label, value, icon, alert }: { label: string; value: string | number; icon: React.ReactNode; alert?: boolean }) {
    return (
        <div className={`bg-white rounded-xl border shadow-sm p-4 flex items-center gap-3 ${alert ? 'border-red-200' : 'border-gray-100'}`}>
            <div className="p-2 rounded-lg bg-gray-50">{icon}</div>
            <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{label}</p>
                <p className={`text-lg font-black ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
            </div>
        </div>
    );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-gray-500">{label}</p>
            <p className="text-sm font-bold text-gray-800">{value}</p>
        </div>
    );
}

function AgentsDashboardInner() {
    const agentData = useAgentData();
    const { events, connected } = useAgentSSE();
    const { data: tokenRes } = useBEZToken();
    const { invoke } = useMCPInvoke();
    const [useFallback, setUseFallback] = useState(false);

    // Build wallet-like prop from real data
    const walletProp = agentData?.registry ? {
        connected: agentData.registry.aegis_status !== 'offline',
        address: null as string | null, // Filled by auth context when available
    } : null;

    // Build engine prop with live MCP data
    const engineProp = {
        tools: agentData?.mcpTools || [],
        toolCount: agentData?.registry?.mcp_tools || 0,
        invoke,
        aegisStatus: agentData?.registry?.aegis_status || 'offline',
        aegisMode: agentData?.registry?.aegis_mode || 'unknown',
        aegisModels: agentData?.registry?.aegis_models || {},
    };

    // Build real-time data bridge for JSX components
    const liveDataProp = {
        bezPrice: tokenRes?.data?.price ?? null,
        bezBurned: tokenRes?.data?.total_burned ?? null,
        sseEvents: events,
        sseConnected: connected,
        analytics: agentData?.analytics || null,
        registry: agentData?.registry || null,
    };

    return (
        <div>
            <AIEcosystemNav />
            {useFallback ? (
                <AgentsFallbackUI />
            ) : (
                <ErrorBoundaryFallback onError={() => setUseFallback(true)}>
                    <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-lg">
                        <BeZhasAgentMaster
                            wallet={walletProp}
                            engine={engineProp}
                            liveData={liveDataProp}
                        />
                    </div>
                </ErrorBoundaryFallback>
            )}
        </div>
    );
}

/** Simple error boundary that falls back to inline UI */
import React from 'react';

class ErrorBoundaryFallback extends React.Component<
    { children: React.ReactNode; onError: () => void },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; onError: () => void }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch() {
        this.props.onError();
    }

    render() {
        if (this.state.hasError) return null;
        return this.props.children;
    }
}

export default function AgentsDashboard() {
    return (
        <AgentDataProvider>
            <AgentsDashboardInner />
        </AgentDataProvider>
    );
}
