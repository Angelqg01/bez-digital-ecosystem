'use client';

import { useState, useEffect, useCallback } from 'react';
import { Factory, Car, Building, Zap, Target, RefreshCw, Pause, Play, Save } from 'lucide-react';
import { api } from '@/lib/api';

interface EcosystemStats {
    // null = sin fuente de datos, distinto de 0. No hay pool de liquidez RWA
    // desplegado, así que el backend manda null en vez de inventar una cifra.
    total_rwa_assets: number | null;
    locked_liquidity_usd: number | null;
    minting_fee_bez: number;
    is_paused: boolean;
}

interface AegisConfig {
    confidence_threshold: number;
    vision_model: string;
    auto_pause_on_failure: boolean;
}

const VISION_MODELS = [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Cloud)' },
    { value: 'gpt-4o', label: 'GPT-4o (Cloud)' },
    { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Cloud)' },
    { value: 'llava-1.5-7b', label: 'Llava-1.5-7B (Local Edge)' },
];

export default function TabEcosystem() {
    const [stats, setStats] = useState<EcosystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [pausing, setPausing] = useState(false);
    const [statsError, setStatsError] = useState<string | null>(null);

    // Aegis Oracle config (persisted via API)
    const [aegis, setAegis] = useState<AegisConfig>({
        confidence_threshold: 85,
        vision_model: 'gemini-2.0-flash',
        auto_pause_on_failure: true,
    });
    const [savedAegis, setSavedAegis] = useState(false);
    const [savingAegis, setSavingAegis] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get<{ stats: EcosystemStats }>('/sectors/rwa-factory-stats');
            setStats(res.stats ?? null);
        } catch {
            // Antes esto pintaba 12.408 activos y 4,2 M$ de liquidez cuando la
            // llamada fallaba. Eran cifras inventadas presentadas como reales
            // en el panel de administración; si no hay datos, se dice.
            setStats(null);
            setStatsError('No se pudieron cargar las métricas de RWA');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAegisConfig = useCallback(async () => {
        try {
            const res = await api.get<{ config: AegisConfig }>('/ai-control/aegis-config');
            if (res.config) setAegis(res.config);
        } catch {
            // Keep defaults
        }
    }, []);

    useEffect(() => {
        fetchStats();
        fetchAegisConfig();
    }, [fetchStats, fetchAegisConfig]);

    const toggleFactoryPause = async () => {
        if (!stats) return;
        setPausing(true);
        try {
            await api.post('/sectors/rwa-factory-pause', { pause: !stats.is_paused });
            setStats(prev => prev ? { ...prev, is_paused: !prev.is_paused } : prev);
            setStatsError(null);
        } catch {
            // El estado sólo cambia en pantalla si cambió en el servidor:
            // invertirlo también al fallar mostraba la factoría "pausada"
            // mientras seguía admitiendo acuñaciones.
            setStatsError('No se pudo cambiar el estado de la factoría');
        } finally {
            setPausing(false);
        }
    };

    const saveAegisConfig = async () => {
        setSavingAegis(true);
        try {
            await api.put('/ai-control/aegis-config', { config: aegis });
            setSavedAegis(true);
            setTimeout(() => setSavedAegis(false), 2500);
        } catch {
            // No marcar como guardado lo que no se guardó.
            setStatsError('No se pudo guardar la configuración de Aegis');
            setTimeout(() => setStatsError(null), 4000);
        } finally {
            setSavingAegis(false);
        }
    };

    // null → guion. `?? 0` mostraría "$0", que afirma que la liquidez es cero
    // cuando lo cierto es que no hay ninguna fuente que la mida.
    const formatLiquidity = (usd: number | null) => {
        if (usd === null || usd === undefined) return '—';
        if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
        if (usd >= 1_000) return `$${(usd / 1_000).toFixed(0)}K`;
        return `$${usd}`;
    };

    const formatCount = (value: number | null | undefined) =>
        value === null || value === undefined ? '—' : value.toLocaleString();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Ecosistema & Industrias (RWA)</h2>
                <p className="text-gray-400 text-sm max-w-2xl">Gestión de la fábrica transversal de activos del mundo real (Real World Assets) y calibración del Oráculo Aegis para validaciones de OpenClaw.</p>
            </div>

            {/* RWA Factory */}
            <div className="bg-white/5 border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3 text-cyan-400">
                        <Factory size={24} />
                        <h3 className="font-bold tracking-widest uppercase text-white">BeZhas RWA Factory (Master)</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {loading && <RefreshCw size={14} className="text-gray-500 animate-spin" />}
                        <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest border ${
                            stats?.is_paused
                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                            Status: {stats?.is_paused ? 'PAUSED' : 'Operational'}
                        </div>
                    </div>
                </div>

                {statsError && (
                    <p className="mb-4 text-[10px] text-amber-400/90 uppercase tracking-widest">{statsError}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-black/40 p-4 border border-white/5 text-center">
                        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Minting Fee</div>
                        <div className="text-xl font-mono text-white">
                            {loading ? '...' : `${stats?.minting_fee_bez ?? 100} BEZ`}
                        </div>
                    </div>
                    <div className="bg-black/40 p-4 border border-white/5 text-center">
                        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Activos RWA (ERC-1155)</div>
                        <div className="text-xl font-mono text-cyan-400 font-bold">
                            {loading ? '...' : formatCount(stats?.total_rwa_assets)}
                        </div>
                    </div>
                    <div className="bg-black/40 p-4 border border-white/5 text-center">
                        <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Liquidez Bloqueada</div>
                        <div className="text-xl font-mono text-white">
                            {loading ? '...' : formatLiquidity(stats?.locked_liquidity_usd ?? null)}
                        </div>
                    </div>
                    <div className="bg-black/40 p-4 border border-white/5 flex items-center justify-center">
                        <button
                            onClick={toggleFactoryPause}
                            disabled={pausing || loading}
                            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-40 ${
                                stats?.is_paused
                                    ? 'text-emerald-400 hover:text-white'
                                    : 'text-red-400 hover:text-white'
                            }`}
                        >
                            {pausing ? (
                                <RefreshCw size={14} className="animate-spin" />
                            ) : stats?.is_paused ? (
                                <Play size={14} />
                            ) : (
                                <Pause size={14} />
                            )}
                            {stats?.is_paused ? 'Reanudar Contrato' : 'Pausar Contrato'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Vertical Configurators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-black/40 border border-white/5 p-6 hover:border-white/20 transition-all cursor-pointer group">
                    <Car size={24} className="text-gray-500 mb-4 group-hover:text-[#0d33f2] transition-colors" />
                    <h4 className="text-sm font-bold uppercase tracking-widest text-white mb-2">Logística</h4>
                    <p className="text-xs text-gray-500 mb-4">NFTs de Manifiestos, BoLs automatizados.</p>
                    <div className="text-[10px] uppercase font-bold text-[#0d33f2]">Configurar Módulo →</div>
                </div>

                <div className="bg-black/40 border border-white/5 p-6 hover:border-white/20 transition-all cursor-pointer group">
                    <Building size={24} className="text-gray-500 mb-4 group-hover:text-emerald-400 transition-colors" />
                    <h4 className="text-sm font-bold uppercase tracking-widest text-white mb-2">Bienes Raíces</h4>
                    <p className="text-xs text-gray-500 mb-4">Fraccionamiento y distribución de dividendos de alquileres.</p>
                    <div className="text-[10px] uppercase font-bold text-emerald-400">Configurar Módulo →</div>
                </div>

                <div className="bg-black/40 border border-white/5 p-6 hover:border-white/20 transition-all cursor-pointer group">
                    <Zap size={24} className="text-gray-500 mb-4 group-hover:text-amber-400 transition-colors" />
                    <h4 className="text-sm font-bold uppercase tracking-widest text-white mb-2">Energía</h4>
                    <p className="text-xs text-gray-500 mb-4">Tokenización de Créditos de Carbono y GW verdes.</p>
                    <div className="text-[10px] uppercase font-bold text-amber-400">Configurar Módulo →</div>
                </div>
            </div>

            {/* Aegis Oracle Configuration */}
            <div className="bg-[#05060a] border border-white/10 p-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3 text-white">
                        <Target size={24} className="text-cyan-400" />
                        <h3 className="font-bold tracking-widest uppercase">Oráculo Aegis (Quality AI)</h3>
                    </div>
                </div>

                <p className="text-xs text-gray-400 mb-6 max-w-3xl">El Oráculo Aegis utiliza Modelos de Visión y Redes Neuronales locales para auditar imágenes de mercancías o bienes raíces en el mundo físico antes de registrarlos on-chain por OpenClaw.</p>

                <div className="space-y-4">
                    {/* Confidence Threshold */}
                    <div className="flex items-center justify-between bg-white/5 p-3 px-4">
                        <span className="text-xs font-bold text-gray-200 uppercase tracking-widest">
                            Confianza Mínima de Visión (Confidence Threshold)
                        </span>
                        <div className="flex items-center space-x-3">
                            <input
                                type="range"
                                min="50"
                                max="99"
                                value={aegis.confidence_threshold}
                                onChange={e => setAegis(prev => ({ ...prev, confidence_threshold: parseInt(e.target.value) }))}
                                className="w-32 accent-cyan-400"
                            />
                            <span className="text-xs font-mono text-cyan-400 font-bold w-10 text-right">
                                {aegis.confidence_threshold}%
                            </span>
                        </div>
                    </div>

                    {/* Vision Model */}
                    <div className="flex items-center justify-between bg-white/5 p-3 px-4">
                        <span className="text-xs font-bold text-gray-200 uppercase tracking-widest">Modelo Base de Visión</span>
                        <select
                            value={aegis.vision_model}
                            onChange={e => setAegis(prev => ({ ...prev, vision_model: e.target.value }))}
                            className="bg-black border border-white/10 text-white text-xs font-mono p-1.5 outline-none focus:border-cyan-400 transition"
                        >
                            {VISION_MODELS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Auto-pause */}
                    <div className="flex items-center justify-between bg-white/5 p-3 px-4">
                        <span className="text-xs font-bold text-gray-200 uppercase tracking-widest">Auto-pausar Fábrica en Fallo IA</span>
                        <button
                            onClick={() => setAegis(prev => ({ ...prev, auto_pause_on_failure: !prev.auto_pause_on_failure }))}
                            className={`relative w-12 h-6 rounded-full transition-colors ${aegis.auto_pause_on_failure ? 'bg-cyan-500' : 'bg-white/10'}`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${aegis.auto_pause_on_failure ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={saveAegisConfig}
                            disabled={savingAegis}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest transition ${
                                savedAegis
                                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                                    : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30'
                            } disabled:opacity-40`}
                        >
                            {savingAegis ? (
                                <RefreshCw size={14} className="animate-spin" />
                            ) : (
                                <Save size={14} />
                            )}
                            {savedAegis ? '✓ Guardado' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
