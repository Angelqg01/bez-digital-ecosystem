'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, RefreshCw, Zap, Coins, GitBranch } from 'lucide-react';

// Todo pasa por /api/brain: una ruta del servidor del panel que exige la sesión
// de SuperAdmin y es la única que conoce la URL privada del Brain, su clave y
// el ID token de Cloud Run. El navegador nunca llama al Brain directamente.

type UsageSummary = {
    totals: { calls: number; tokens: number; bez: number };
    topFunctions: { fn: string; calls: number; tokens: number; bez: number }[];
    topEdges: { source: string; target: string; fn: string; calls: number; bez: number }[];
    topNodes: { name: string; calls: number }[];
    updatedAt: string;
};

type BrainHealth = {
    status: string;
    notes: number | null;
    semantic: { reachable: boolean; cached: number };
    uptime: number | null;
};

type Estado = 'conectando' | 'online' | 'offline' | 'sin-configurar';

const POLL_MS = 4000;
const GRAPH_W = 960;
const GRAPH_H = 420;

async function leer<T>(view: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
    const res = await fetch(`/api/brain?view=${view}&limit=12`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: await res.json() };
}

export default function TabBrainLive() {
    const [summary, setSummary] = useState<UsageSummary | null>(null);
    const [health, setHealth] = useState<BrainHealth | null>(null);
    const [estado, setEstado] = useState<Estado>('conectando');
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let alive = true;
        const poll = async () => {
            try {
                const r = await leer<UsageSummary>('summary');
                if (!alive) return;
                if (r.ok) { setSummary(r.data); setEstado('online'); }
                else setEstado(r.status === 503 ? 'sin-configurar' : 'offline');
            } catch {
                if (alive) setEstado('offline');
            }
        };
        const pollHealth = async () => {
            try {
                const r = await leer<BrainHealth>('health');
                if (alive && r.ok) setHealth(r.data);
            } catch { /* el resumen ya marca el estado */ }
        };
        poll();
        pollHealth();
        const id = setInterval(poll, POLL_MS);
        const idHealth = setInterval(pollHealth, POLL_MS * 8);
        return () => { alive = false; clearInterval(id); clearInterval(idHealth); };
    }, [reloadKey]);

    const maxCalls = summary?.topFunctions[0]?.calls || 1;
    const online = estado === 'online';

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Brain Live · Red en vivo</h2>
                    <p className="text-gray-400 text-sm max-w-3xl">
                        Telemetría de API en tiempo real: qué actor usa qué función, tokens consumidos y BEZ movido.
                        Los nodos-actor (rosa) son agentes/tenants/usuarios API; los destinos (teal) son módulos de la plataforma.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`flex items-center gap-2 border px-3 py-2 text-[10px] font-bold uppercase tracking-widest ${
                        online ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                               : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        {estado === 'sin-configurar' ? 'Brain no configurado' : estado === 'conectando' ? 'conectando' : online ? 'Brain online' : 'Brain offline'}
                    </span>
                    {health && (
                        <span className="flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-violet-300">
                            <BrainCircuit size={12} /> {health.notes ?? 0} notas · semántica {health.semantic.reachable ? 'activa' : 'por términos'}
                        </span>
                    )}
                    <button onClick={() => setReloadKey((k) => k + 1)} className="flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10">
                        <RefreshCw size={14} /> Recargar
                    </button>
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

            {/* Mapa de tráfico */}
            <div className="border border-white/10 bg-[#05060a]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-widest text-gray-500">
                    <span>actores → módulos · grosor = llamadas</span>
                    <span>{summary?.updatedAt ? `actualizado ${new Date(summary.updatedAt).toLocaleTimeString()}` : ''}</span>
                </div>
                {estado === 'sin-configurar' ? (
                    <Aviso color="text-amber-400" titulo="El Brain no está configurado en este despliegue."
                        detalle={<>Falta <code className="text-cyan-300">BRAIN_URL</code> en el servidor del panel (lo pone <code className="text-cyan-300">deploy/gcp/14-brain.sh</code>).</>} />
                ) : estado === 'offline' ? (
                    <Aviso color="text-red-400" titulo="El Brain no responde."
                        detalle={<>En local: <code className="text-cyan-300">cd obsidian-mcp &amp;&amp; pnpm dev</code></>} />
                ) : summary?.topEdges.length ? (
                    <MapaTrafico edges={summary.topEdges} />
                ) : (
                    <Aviso color="text-cyan-400" titulo="Aún no hay tráfico registrado."
                        detalle={<>Cada petición autenticada a la API aparece aquí en segundos.</>} />
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

function Aviso({ color, titulo, detalle }: { color: string; titulo: string; detalle: React.ReactNode }) {
    return (
        <div className="flex h-[420px] flex-col items-center justify-center gap-3 px-4 text-center text-gray-500">
            <Activity size={32} className={color} />
            <p className="text-sm">{titulo}</p>
            <p className="text-xs">{detalle}</p>
        </div>
    );
}

// Grafo bipartito: actores a la izquierda, módulos a la derecha. Las aristas
// agregan todas las funciones de un mismo par y su grosor es proporcional a
// las llamadas; el trazo discontinuo animado marca el tráfico vivo.
function MapaTrafico({ edges }: { edges: UsageSummary['topEdges'] }) {
    const { actores, destinos, enlaces } = useMemo(() => {
        const pares = new Map<string, { source: string; target: string; calls: number; bez: number }>();
        for (const e of edges) {
            const k = `${e.source}\u0000${e.target}`;
            const p = pares.get(k) || { source: e.source, target: e.target, calls: 0, bez: 0 };
            p.calls += e.calls;
            p.bez += e.bez;
            pares.set(k, p);
        }
        const lista = [...pares.values()];
        const actores = [...new Set(lista.map((p) => p.source))];
        const destinos = [...new Set(lista.map((p) => p.target))];
        return { actores, destinos, enlaces: lista };
    }, [edges]);

    const y = (i: number, n: number) => (GRAPH_H / (n + 1)) * (i + 1);
    const xA = 210;
    const xD = GRAPH_W - 210;
    const maxC = Math.max(...enlaces.map((e) => e.calls), 1);

    return (
        <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} className="h-[420px] w-full min-w-[640px]" role="img" aria-label="Mapa de tráfico de la API">
                <style>{`@keyframes flujo{to{stroke-dashoffset:-24}} .flujo{animation:flujo 1.2s linear infinite}`}</style>
                {enlaces.map((e) => {
                    const y1 = y(actores.indexOf(e.source), actores.length);
                    const y2 = y(destinos.indexOf(e.target), destinos.length);
                    const w = 1 + (e.calls / maxC) * 7;
                    const d = `M${xA},${y1} C${GRAPH_W / 2},${y1} ${GRAPH_W / 2},${y2} ${xD},${y2}`;
                    return (
                        <g key={`${e.source}-${e.target}`}>
                            <path d={d} fill="none" stroke="#00D4AA" strokeOpacity={0.25} strokeWidth={w} />
                            <path d={d} fill="none" stroke={e.bez > 0 ? '#FFD700' : '#00D4AA'} strokeWidth={Math.max(1, w / 3)}
                                strokeDasharray="4 8" className="flujo">
                                <title>{`${e.source} → ${e.target}: ${e.calls} llamadas${e.bez > 0 ? `, ${e.bez.toFixed(2)} BEZ` : ''}`}</title>
                            </path>
                        </g>
                    );
                })}
                {actores.map((a, i) => (
                    <g key={`a-${a}`} transform={`translate(${xA},${y(i, actores.length)})`}>
                        <circle r={7} fill="#FF6B9D" />
                        <text x={-14} dy="0.35em" textAnchor="end" fill="#f9a8d4" fontSize={13}>{a.length > 24 ? `${a.slice(0, 23)}…` : a}</text>
                    </g>
                ))}
                {destinos.map((d, i) => (
                    <g key={`d-${d}`} transform={`translate(${xD},${y(i, destinos.length)})`}>
                        <circle r={8} fill="#00D4AA" />
                        <text x={14} dy="0.35em" fill="#67e8f9" fontSize={13}>{d}</text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
