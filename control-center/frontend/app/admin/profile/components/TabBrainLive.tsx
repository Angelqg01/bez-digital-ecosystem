'use client';

import { useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCw, Zap, Coins, GitBranch } from 'lucide-react';

const BRAIN_URL = process.env.NEXT_PUBLIC_BRAIN_URL || 'http://localhost:4007';

type UsageSummary = {
    totals: { calls: number; tokens: number; bez: number };
    topFunctions: { fn: string; calls: number; tokens: number; bez: number }[];
    topEdges: { source: string; target: string; fn: string; calls: number; bez: number }[];
    topNodes: { name: string; calls: number }[];
    updatedAt: string;
};

export default function TabBrainLive() {
    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [online, setOnline] = useState<boolean | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let alive = true;
        const poll = async () => {
            try {
                const res = await fetch(`${BRAIN_URL}/telemetry/summary?limit=8`, { cache: 'no-store' });
                const data = await res.json();
                if (alive) { setSummary(data); setOnline(true); }
            } catch {
                if (alive) setOnline(false);
            }
        };
        poll();
        const id = setInterval(poll, 4000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    const maxCalls = summary?.topFunctions[0]?.calls || 1;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Brain Live · Red en vivo</h2>
                    <p className="text-gray-400 text-sm max-w-3xl">
                        Grafo de conocimiento + telemetría de API en tiempo real: qué actor usa qué función, tokens consumidos y BEZ movido.
                        Los nodos-actor (rosa) son agentes/tenants/usuarios API; las líneas teal con partículas doradas son tráfico vivo.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                        online ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                               : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        {online === null ? 'conectando' : online ? 'Brain :4007 online' : 'Brain offline'}
                    </span>
                    <button onClick={() => setReloadKey((k) => k + 1)} className="flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10">
                        <RefreshCw size={14} /> Recargar mapa
                    </button>
                    <a href={`${BRAIN_URL}/ui`} target="_blank" rel="noreferrer" className="flex items-center gap-2 border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20">
                        <ExternalLink size={14} /> Abrir aparte
                    </a>
                </div>
            </div>

            {/* KPIs de red */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                {[
                    { label: 'Llamadas API', value: summary?.totals.calls ?? 0, Icon: Activity, accent: 'text-cyan-300' },
                    { label: 'Tokens', value: summary?.totals.tokens ?? 0, Icon: Zap, accent: 'text-amber-300' },
                    { label: 'BEZ movido', value: (summary?.totals.bez ?? 0).toFixed(2), Icon: Coins, accent: 'text-pink-300' },
                    { label: 'Conexiones activas', value: summary?.topEdges.length ?? 0, Icon: GitBranch, accent: 'text-violet-300' },
                ].map(({ label, value, Icon, accent }) => (
                    <div key={label} className="border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between text-gray-500">
                            <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
                            <Icon size={16} className={accent} />
                        </div>
                        <div className={`mt-3 text-2xl font-black ${accent}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
                    </div>
                ))}
            </div>

            {/* Consola embebida en vivo */}
            <div className="border border-white/10 bg-[#05060a]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-widest text-gray-500">
                    <span>{BRAIN_URL}/ui</span>
                    <span>arrastra · zoom · clic en nodo</span>
                </div>
                {online === false ? (
                    <div className="flex h-[680px] flex-col items-center justify-center gap-3 text-center text-gray-500">
                        <Activity size={32} className="text-red-400" />
                        <p className="text-sm">Brain Console no responde en <code className="text-gray-300">{BRAIN_URL}</code>.</p>
                        <p className="text-xs">Arranca el servicio: <code className="text-cyan-300">cd obsidian-mcp &amp;&amp; pnpm dev</code></p>
                    </div>
                ) : (
                    <iframe key={reloadKey} src={`${BRAIN_URL}/ui`} title="BeZhas Brain Console" className="h-[680px] w-full border-0" />
                )}
            </div>

            {/* Detalle de uso: funciones + conexiones más usadas */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-4 flex items-center gap-3 text-amber-300">
                        <Zap size={20} />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Funciones más usadas</h3>
                    </div>
                    <div className="space-y-2">
                        {summary?.topFunctions.length ? summary.topFunctions.map((f) => (
                            <div key={f.fn} className="flex items-center gap-3 text-xs">
                                <span className="flex-1 truncate text-gray-200">{f.fn}</span>
                                <div className="h-1.5 rounded bg-gradient-to-r from-cyan-400 to-cyan-400/20" style={{ width: `${Math.max(12, (f.calls / maxCalls) * 160)}px` }} />
                                <span className="w-10 text-right font-mono text-amber-300">{f.calls}</span>
                            </div>
                        )) : <p className="text-xs text-gray-500">Sin tráfico aún — usa la API o corre <code className="text-cyan-300">pnpm sim</code>.</p>}
                    </div>
                </section>

                <section className="border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-4 flex items-center gap-3 text-cyan-300">
                        <GitBranch size={20} />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white">Conexiones más activas</h3>
                    </div>
                    <div className="space-y-2">
                        {summary?.topEdges.length ? summary.topEdges.map((e, i) => (
                            <div key={`${e.source}-${e.target}-${e.fn}-${i}`} className="border border-white/5 bg-black/30 p-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-pink-300">{e.source}</span>
                                    <span className="text-gray-600">→</span>
                                    <span className="text-cyan-300">{e.target}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                                    <span className="truncate">{e.fn}</span>
                                    <span className="ml-2 shrink-0 font-mono text-amber-300">{e.calls}× {e.bez > 0 ? `· ${e.bez.toFixed(2)} BEZ` : ''}</span>
                                </div>
                            </div>
                        )) : <p className="text-xs text-gray-500">Aún no hay conexiones registradas.</p>}
                    </div>
                </section>
            </div>
        </div>
    );
}
