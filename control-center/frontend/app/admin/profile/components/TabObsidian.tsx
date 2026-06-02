'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    BrainCircuit,
    CheckCircle2,
    ExternalLink,
    FileText,
    GitBranch,
    Loader2,
    Map as MapIcon,
    RefreshCw,
    Save,
    ShieldCheck,
} from 'lucide-react';

type VaultNote = {
    path: string;
    title: string;
    type: string;
    bytes: number;
    links: string[];
    preview: string;
};

type CanvasNode = {
    id: string;
    type: string;
    text?: string;
    file?: string;
    color?: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

type CanvasEdge = {
    id: string;
    fromNode: string;
    toNode: string;
};

type MapNode = CanvasNode & {
    left: number;
    top: number;
    w: number;
    h: number;
    cx: number;
    cy: number;
    accent: string;
};

type MapEdge = CanvasEdge & {
    path: string;
    accent: string;
    delay: number;
};

type ObsidianSummary = {
    status: 'ok';
    vaultRoot: string;
    counts: {
        notes: number;
        episodes: number;
        canvasNodes: number;
        canvasEdges: number;
    };
    notes: VaultNote[];
    episodes: VaultNote[];
    canvasPath: string;
    canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] };
    mapPath: string;
    mapMarkdown: string;
    selfModelPath: string;
    selfModel: {
        identity?: { name?: string; purpose?: string };
        capabilities?: Record<string, string[]>;
        behavioral_patterns?: Record<string, string[]>;
        performance_history?: Record<string, unknown>;
        decision_levels?: Record<string, string[]>;
        last_self_update?: string;
    };
    obsidianLinks: {
        canvas: string;
        map: string;
        vault: string;
    };
};

const NODE_ACCENTS: Record<string, string> = {
    'bezhas-core': '#f8fafc',
    director: '#60a5fa',
    critic: '#f59e0b',
    runtime: '#22d3ee',
    obsidian: '#a78bfa',
    memory: '#34d399',
    blockchain: '#f43f5e',
    aegis: '#10b981',
    sectors: '#f97316',
    telegram: '#38bdf8',
    loop: '#e5e7eb',
};

const CANVAS_COLOR_ACCENTS: Record<string, string> = {
    '0': '#94a3b8',
    '1': '#f8fafc',
    '2': '#60a5fa',
    '3': '#f43f5e',
    '4': '#34d399',
    '5': '#f59e0b',
    '6': '#a78bfa',
};

function getCanvasBounds(nodes: CanvasNode[]) {
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + node.width));
    const maxY = Math.max(...nodes.map((node) => node.y + node.height));
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    return { minX, minY, width, height };
}

function normalizeCanvas(nodes: CanvasNode[]): MapNode[] {
    if (!nodes.length) return [];
    const bounds = getCanvasBounds(nodes);
    return nodes.map((node) => ({
        ...node,
        left: ((node.x - bounds.minX) / bounds.width) * 100,
        top: ((node.y - bounds.minY) / bounds.height) * 100,
        w: (node.width / bounds.width) * 100,
        h: (node.height / bounds.height) * 100,
        cx: ((node.x + node.width / 2 - bounds.minX) / bounds.width) * 100,
        cy: ((node.y + node.height / 2 - bounds.minY) / bounds.height) * 100,
        accent: NODE_ACCENTS[node.id] || CANVAS_COLOR_ACCENTS[node.color || ''] || '#94a3b8',
    }));
}

function buildMapEdges(edges: CanvasEdge[], nodes: MapNode[]): MapEdge[] {
    const nodeById = new globalThis.Map(nodes.map((node) => [node.id, node]));
    return edges.flatMap((edge, index) => {
        const from = nodeById.get(edge.fromNode);
        const to = nodeById.get(edge.toNode);
        if (!from || !to) return [];
        const dx = to.cx - from.cx;
        const dy = to.cy - from.cy;
        const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const bend = Math.min(Math.max(distance * 0.18, 5), 14) * (index % 2 === 0 ? 1 : -1);
        const mx = (from.cx + to.cx) / 2;
        const my = (from.cy + to.cy) / 2;
        const nx = -dy / distance;
        const ny = dx / distance;
        return [{
            ...edge,
            path: `M ${from.cx} ${from.cy} Q ${mx + nx * bend} ${my + ny * bend} ${to.cx} ${to.cy}`,
            accent: to.accent,
            delay: index * 0.16,
        }];
    });
}

export default function TabObsidian() {
    const [data, setData] = useState<ObsidianSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/obsidian', { cache: 'no-store' });
            const payload = await res.json();
            if (!res.ok || payload.status !== 'ok') throw new Error(payload.error || 'Obsidian vault no disponible');
            setData(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error cargando Obsidian');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const canvasNodes = useMemo(() => normalizeCanvas(data?.canvas.nodes || []), [data]);
    const canvasEdges = useMemo(() => buildMapEdges(data?.canvas.edges || [], canvasNodes), [data, canvasNodes]);
    const stats = useMemo(() => data ? [
        { label: 'Notas', value: data.counts.notes, Icon: FileText },
        { label: 'Episodios', value: data.counts.episodes, Icon: Activity },
        { label: 'Nodos Canvas', value: data.counts.canvasNodes, Icon: MapIcon },
        { label: 'Enlaces Canvas', value: data.counts.canvasEdges, Icon: GitBranch },
    ] : [], [data]);

    const recordEpisode = async () => {
        setSaving(true);
        setNotice(null);
        try {
            const res = await fetch('/api/obsidian', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'record_episode',
                    agent: 'director-agent',
                    goal: 'Verificar mapa Obsidian desde admin profile',
                    result: 'Vault, Canvas, auto-modelo y panel admin sincronizados',
                    evaluation: {
                        goal_achieved: true,
                        error_type: 'none',
                        strategy_effectiveness: 0.94,
                        update_self_model: false,
                    },
                }),
            });
            const payload = await res.json();
            if (!res.ok || payload.status !== 'ok') throw new Error(payload.error || 'No se pudo registrar episodio');
            setNotice(`Episodio registrado: ${payload.path}`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error guardando episodio');
        } finally {
            setSaving(false);
        }
    };

    const updateSelfModel = async () => {
        setSaving(true);
        setNotice(null);
        try {
            const res = await fetch('/api/obsidian', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_self_model',
                    reason: 'Admin profile confirmed Obsidian map and memory panel',
                    patch: {
                        performance_history: {
                            ...(data?.selfModel.performance_history || {}),
                            last_admin_profile_obsidian_check: new Date().toISOString(),
                        },
                    },
                }),
            });
            const payload = await res.json();
            if (!res.ok || payload.status !== 'ok') throw new Error(payload.error || 'No se pudo actualizar auto-modelo');
            setNotice('Auto-modelo actualizado desde el panel');
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error actualizando auto-modelo');
        } finally {
            setSaving(false);
        }
    };

    const rebuildCanvas = async () => {
        setSaving(true);
        setNotice(null);
        try {
            const res = await fetch('/api/obsidian', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rebuild_canvas' }),
            });
            const payload = await res.json();
            if (!res.ok || payload.status !== 'ok') throw new Error(payload.error || 'No se pudo reconstruir el Canvas');
            setNotice(`Canvas reconstruido: ${payload.counts.canvasNodes} nodos / ${payload.counts.canvasEdges} enlaces`);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error reconstruyendo Canvas');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-cyan-400" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Obsidian Knowledge Map</h2>
                    <p className="text-gray-400 text-sm max-w-3xl">
                        Memoria documental del sistema agéntico: Canvas de arquitectura, auto-modelo, episodios, decisiones y enlaces del vault.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={load} className="flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10">
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button onClick={rebuildCanvas} disabled={saving} className="flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-violet-200 hover:bg-violet-500/20 disabled:opacity-60">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />} Rebuild Canvas
                    </button>
                    {data && (
                        <>
                            <a href={data.obsidianLinks.canvas} className="flex items-center gap-2 border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20">
                                <ExternalLink size={14} /> Canvas
                            </a>
                            <a href={data.obsidianLinks.map} className="flex items-center gap-2 border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20">
                                <ExternalLink size={14} /> Markdown
                            </a>
                        </>
                    )}
                </div>
            </div>

            {error && (
                <div className="border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                    {error}
                </div>
            )}

            {notice && (
                <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                    <CheckCircle2 size={16} /> {notice}
                </div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                        {stats.map(({ label, value, Icon }) => (
                            <div key={label} className="border border-white/10 bg-white/5 p-4">
                                <div className="flex items-center justify-between text-gray-500">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
                                    <Icon size={16} />
                                </div>
                                <div className="mt-3 text-2xl font-black text-white">{value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.35fr_0.9fr]">
                        <section className="border border-white/10 bg-white/[0.03] p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3 text-cyan-300">
                                    <MapIcon size={22} />
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-white">Mapa Blockchain Canvas</h3>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest text-gray-500">{data.canvasPath}</span>
                            </div>
                            <div className="organic-map relative h-[620px] overflow-hidden border border-white/10 bg-[#070910]">
                                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:34px_34px]" />
                                <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
                                <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-violet-300/20 to-transparent" />
                                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                    <defs>
                                        <filter id="softGlow">
                                            <feGaussianBlur stdDeviation="0.45" result="blur" />
                                            <feMerge>
                                                <feMergeNode in="blur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    {canvasEdges.map((edge) => (
                                        <g key={edge.id}>
                                            <path
                                                d={edge.path}
                                                fill="none"
                                                stroke="rgba(148,163,184,0.16)"
                                                strokeWidth="0.42"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            <path
                                                className="flow-line"
                                                d={edge.path}
                                                fill="none"
                                                stroke={edge.accent}
                                                strokeLinecap="round"
                                                strokeWidth="0.58"
                                                style={{ animationDelay: `${edge.delay}s` }}
                                                vectorEffect="non-scaling-stroke"
                                                filter="url(#softGlow)"
                                            />
                                            <circle r="0.55" fill={edge.accent} opacity="0.9">
                                                <animateMotion dur="5s" repeatCount="indefinite" begin={`${edge.delay}s`} path={edge.path} />
                                            </circle>
                                        </g>
                                    ))}
                                </svg>
                                {canvasNodes.map((node) => (
                                    <div
                                        key={node.id}
                                        className="map-node absolute overflow-hidden border bg-black/75 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm"
                                        style={{
                                            left: `${node.left}%`,
                                            top: `${node.top}%`,
                                            width: `${Math.max(node.w, node.id === 'loop' ? 42 : 22)}%`,
                                            minHeight: `${Math.max(node.h, 10)}%`,
                                            borderColor: `${node.accent}55`,
                                            boxShadow: `0 12px 30px rgba(0,0,0,0.35), 0 0 24px ${node.accent}18`,
                                            animationDelay: `${canvasNodes.findIndex((item) => item.id === node.id) * 0.12}s`,
                                        }}
                                    >
                                        <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: node.accent }}>
                                            <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: node.accent, boxShadow: `0 0 12px ${node.accent}` }} />
                                            {node.id}
                                        </div>
                                        <div className="whitespace-pre-line text-[11px] leading-snug text-gray-300">{node.text || node.file}</div>
                                    </div>
                                ))}
                                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-gray-400">
                                    {['percepcion', 'accion', 'evaluacion', 'memoria'].map((label) => (
                                        <span key={label} className="border border-white/10 bg-black/40 px-2 py-1">{label}</span>
                                    ))}
                                </div>
                            </div>
                            <style jsx>{`
                                .organic-map {
                                    transform: translateZ(0);
                                }
                                .flow-line {
                                    stroke-dasharray: 8 22;
                                    animation: flowPulse 4.8s linear infinite;
                                    opacity: 0.78;
                                }
                                .map-node {
                                    animation: nodeBreath 5.6s ease-in-out infinite;
                                    border-radius: 8px;
                                }
                                @keyframes flowPulse {
                                    from { stroke-dashoffset: 32; opacity: 0.25; }
                                    40% { opacity: 0.9; }
                                    to { stroke-dashoffset: 0; opacity: 0.35; }
                                }
                                @keyframes nodeBreath {
                                    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
                                    50% { transform: translate3d(0, -3px, 0) scale(1.012); }
                                }
                                @media (prefers-reduced-motion: reduce) {
                                    .flow-line,
                                    .map-node {
                                        animation: none;
                                    }
                                }
                            `}</style>
                        </section>

                        <section className="space-y-6">
                            <div className="border border-white/10 bg-white/[0.03] p-5">
                                <div className="mb-4 flex items-center gap-3 text-[#0d33f2]">
                                    <BrainCircuit size={22} />
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-white">Auto-Modelo Director</h3>
                                </div>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest text-gray-500">Identidad</div>
                                        <div className="mt-1 font-bold text-white">{data.selfModel.identity?.name || 'BeZhas Director Agent'}</div>
                                        <p className="mt-1 text-xs leading-relaxed text-gray-400">{data.selfModel.identity?.purpose}</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {Object.entries(data.selfModel.capabilities || {}).map(([key, values]) => (
                                            <div key={key} className="border border-white/5 bg-black/30 p-3">
                                                <div className="text-[10px] uppercase tracking-widest text-gray-500">{key.replaceAll('_', ' ')}</div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {values.map((value) => <span key={value} className="bg-white/5 px-2 py-1 text-[11px] text-gray-300">{value}</span>)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500">
                                        Last update: <span className="text-gray-300">{data.selfModel.last_self_update || 'n/a'}</span>
                                    </div>
                                </div>
                                <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
                                    <button onClick={recordEpisode} disabled={saving} className="flex items-center justify-center gap-2 bg-cyan-500/15 px-3 py-3 text-xs font-bold uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-60">
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Registrar episodio
                                    </button>
                                    <button onClick={updateSelfModel} disabled={saving} className="flex items-center justify-center gap-2 bg-[#0d33f2]/20 px-3 py-3 text-xs font-bold uppercase tracking-widest text-blue-200 hover:bg-[#0d33f2]/30 disabled:opacity-60">
                                        <ShieldCheck size={14} /> Actualizar modelo
                                    </button>
                                </div>
                            </div>

                            <div className="border border-white/10 bg-white/[0.03] p-5">
                                <div className="mb-4 flex items-center gap-3 text-emerald-300">
                                    <Activity size={22} />
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-white">Feedback Loop</h3>
                                </div>
                                <div className="space-y-3">
                                    {data.episodes.slice(0, 5).map((episode) => (
                                        <div key={episode.path} className="border border-white/5 bg-black/30 p-3">
                                            <div className="text-xs font-bold text-gray-200">{episode.title}</div>
                                            <div className="mt-1 text-[10px] uppercase tracking-widest text-gray-500">{episode.path}</div>
                                            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{episode.preview}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="border border-white/10 bg-white/[0.03] p-5">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-gray-300">
                                <FileText size={22} />
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white">Notas del Vault</h3>
                            </div>
                            <span className="text-[10px] uppercase tracking-widest text-gray-500">{data.vaultRoot}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                            {data.notes.slice(0, 9).map((note) => (
                                <div key={note.path} className="border border-white/5 bg-black/30 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="truncate text-sm font-bold text-white">{note.title}</div>
                                        <span className="shrink-0 bg-white/5 px-2 py-1 text-[10px] uppercase text-gray-400">{note.type}</span>
                                    </div>
                                    <div className="mt-1 truncate text-[10px] uppercase tracking-widest text-gray-500">{note.path}</div>
                                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-gray-400">{note.preview}</p>
                                    {note.links.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {note.links.slice(0, 4).map((link) => <span key={link} className="bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-300">{link}</span>)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
