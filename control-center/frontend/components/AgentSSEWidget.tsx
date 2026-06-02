'use client';

import { useAgentSSE } from '@/lib/agent-hooks';
import { useCallback, useMemo, useState } from 'react';

type Severity = 'critical' | 'warning' | 'info';

const SEV_STYLE: Record<Severity, { bg: string; dot: string; label: string }> = {
    critical: { bg: 'bg-red-900/30 border-red-700/40', dot: 'bg-red-500', label: 'Crítico' },
    warning: { bg: 'bg-yellow-900/30 border-yellow-600/40', dot: 'bg-yellow-400', label: 'Alerta' },
    info: { bg: 'bg-emerald-900/20 border-emerald-700/30', dot: 'bg-emerald-400', label: 'Info' },
};

export default function AgentSSEWidget({ maxEvents = 30 }: { maxEvents?: number }) {
    const { events, connected } = useAgentSSE();
    const [filter, setFilter] = useState<Severity | 'all'>('all');
    const [collapsed, setCollapsed] = useState(false);

    const sevCounts = useMemo(() => {
        const c = { critical: 0, warning: 0, info: 0 };
        for (const e of events) {
            const s = (e.severity || 'info') as Severity;
            if (c[s] !== undefined) c[s]++;
        }
        return c;
    }, [events]);

    const filtered = useMemo(() => {
        const src = filter === 'all' ? events : events.filter(e => e.severity === filter);
        return src.slice(0, maxEvents);
    }, [events, filter, maxEvents]);

    const fmtTime = useCallback((ts: string) => {
        try { return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
        catch { return ts; }
    }, []);

    return (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                    <h3 className="text-sm font-semibold text-zinc-100">
                        Agent Events {connected ? '(SSE Live)' : '(Desconectado)'}
                    </h3>
                    <span className="text-xs text-zinc-500">{events.length} eventos</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Severity pills */}
                    {(['critical', 'warning', 'info'] as Severity[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilter(f => f === s ? 'all' : s)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${filter === s ? SEV_STYLE[s].bg + ' text-zinc-100' : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${SEV_STYLE[s].dot}`} />
                            {sevCounts[s]}
                        </button>
                    ))}
                    <button onClick={() => setCollapsed(c => !c)} className="text-zinc-500 hover:text-zinc-300 ml-1 text-xs">
                        {collapsed ? '▼' : '▲'}
                    </button>
                </div>
            </div>

            {/* Event list */}
            {!collapsed && (
                <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/50 scrollbar-thin scrollbar-thumb-zinc-800">
                    {filtered.length === 0 && (
                        <div className="px-4 py-6 text-center text-zinc-600 text-xs">
                            {connected ? 'Esperando eventos…' : 'Sin conexión SSE'}
                        </div>
                    )}
                    {filtered.map((ev, i) => {
                        const sev = (ev.severity || 'info') as Severity;
                        const style = SEV_STYLE[sev];
                        return (
                            <div key={ev.id || i} className="flex items-start gap-3 px-4 py-2 hover:bg-zinc-900/50 transition-colors">
                                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="font-mono text-zinc-500">{fmtTime(ev.timestamp)}</span>
                                        <span className="font-semibold text-zinc-300 truncate">{ev.module}</span>
                                        {ev.tx_hash && (
                                            <span className="font-mono text-zinc-600 text-[10px] truncate max-w-[100px]">
                                                tx:{ev.tx_hash.slice(0, 10)}…
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-400 truncate">{ev.action}</p>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.bg} shrink-0`}>
                                    {style.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
