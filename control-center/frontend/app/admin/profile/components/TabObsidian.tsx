'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import BrainMap3D from './BrainMap3D';
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
    clientVisible?: boolean;
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

export default function TabObsidian() {
    const [data, setData] = useState<ObsidianSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [soloClientes, setSoloClientes] = useState(false);

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

    const visiblesClientes = useMemo(() => (data?.notes || []).filter((n) => n.clientVisible), [data]);
    const notasListadas = soloClientes ? visiblesClientes : (data?.notes || []).slice(0, 9);

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

                    <BrainMap3D nodes={data.canvas.nodes} edges={data.canvas.edges} path={data.canvasPath} />

                    <div className="grid grid-cols-1 gap-6">

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
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                                <button onClick={() => setSoloClientes(false)} aria-pressed={!soloClientes}
                                    className={`border px-3 py-1.5 ${!soloClientes ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>
                                    Recientes
                                </button>
                                <button onClick={() => setSoloClientes(true)} aria-pressed={soloClientes}
                                    className={`border px-3 py-1.5 ${soloClientes ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>
                                    Visibles para clientes · {visiblesClientes.length}
                                </button>
                            </div>
                        </div>
                        {soloClientes && (
                            <p className="mb-4 text-xs text-gray-500">
                                Sólo su sección «Para clientes» llega al chat, al MCP y a OPERANT. Para publicar una nota: <code className="text-cyan-300">visibility: public</code>, esa sección,
                                y regenerar <code className="text-cyan-300">api/services/knowledge/vault-public.json</code> (lo revisa el PR).
                            </p>
                        )}
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                            {notasListadas.map((note) => (
                                <div key={note.path} className="border border-white/5 bg-black/30 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="truncate text-sm font-bold text-white">{note.title}</div>
                                        <span className="flex shrink-0 items-center gap-1">
                                            {note.clientVisible && <span className="bg-emerald-500/15 px-2 py-1 text-[10px] uppercase text-emerald-300">Cliente</span>}
                                            <span className="bg-white/5 px-2 py-1 text-[10px] uppercase text-gray-400">{note.type}</span>
                                        </span>
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
