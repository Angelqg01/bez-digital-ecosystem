'use client';

import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Shield, Heart, Zap, TrendingUp, AlertTriangle,
    Clock, Award, Activity,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import ValidatorTierBadge from '@/components/ValidatorTierBadge';
import { useValidatorProfile, useValidatorTimeline } from '@/lib/hooks';

function shortAddr(a: string) {
    return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '-';
}
function fmtNum(n: number | undefined, d = 0) {
    if (n === undefined || n === null) return '-';
    return n.toLocaleString('en-US', { maximumFractionDigits: d });
}
function fmtDate(d: string | null) {
    if (!d) return 'Nunca';
    return new Date(d).toLocaleString();
}

function Metric({ label, value, icon: Icon, color = 'cyan' }: {
    label: string; value: string | number; icon: React.ElementType; color?: string;
}) {
    return (
        <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 text-${color}-400`} />
                <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-xl font-bold text-zinc-100">{String(value)}</p>
        </div>
    );
}

export default function ValidatorDetailPage() {
    const { address } = useParams<{ address: string }>();
    const router = useRouter();
    const { data: profile, isLoading } = useValidatorProfile(address ?? null);
    const { data: timeline } = useValidatorTimeline(address ?? null, 50);

    /* Build a simple rewards-over-time chart from timeline events */
    const rewardEvents = (timeline ?? [])
        .filter(e => e.event_name.includes('Reward') || e.event_name.includes('Claimed'))
        .reverse()
        .map((e, i) => ({
            idx: i + 1,
            block: e.block_number,
            event: e.event_name,
        }));

    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6 animate-pulse">
                <div className="h-8 bg-zinc-800 rounded w-1/3" />
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-800 rounded-xl" />)}
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
                <button onClick={() => router.back()} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 mb-4 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <p className="text-zinc-500">Validador no encontrado o no registrado en el contrato.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            {/* Back + Header */}
            <div>
                <button onClick={() => router.push('/dashboard/validators')} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Validadores
                </button>
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Shield className="w-6 h-6 text-cyan-400" />
                            {profile.company_name || 'Validador'}
                        </h1>
                        <p className="text-xs text-zinc-500 font-mono mt-1">{address}</p>
                    </div>
                    <ValidatorTierBadge tier={profile.tier} size="md" />
                    <span className={`px-3 py-1 text-xs rounded-full font-semibold ${profile.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                        {profile.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    {profile.is_sequencer_eligible && (
                        <span className="px-3 py-1 text-xs rounded-full bg-purple-900/40 text-purple-300 font-semibold">Secuenciador Elegible</span>
                    )}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Stake" value={`${fmtNum(profile.staked_bez)} BEZ`} icon={Zap} color="cyan" />
                <Metric label="Boost" value={`+${profile.boost_pct?.toFixed(1) ?? 0}%`} icon={TrendingUp} color="yellow" />
                <Metric label="Puntos de Contribucion" value={fmtNum(profile.contribution_points)} icon={Award} color="purple" />
                <Metric label="Uptime" value={`${profile.uptime_pct?.toFixed(1) ?? 0}%`} icon={Activity} color="emerald" />
                <Metric label="Recompensas Totales" value={`${fmtNum(profile.total_rewards_bez, 2)} BEZ`} icon={TrendingUp} color="amber" />
                <Metric label="Eventos Registrados" value={fmtNum(profile.total_events)} icon={Clock} color="sky" />
                <Metric label="Ultimo Heartbeat" value={fmtDate(profile.last_heartbeat)} icon={Heart} color="red" />
                <Metric label="Slashes" value={profile.total_events > 0 ? '-' : '0'} icon={AlertTriangle} color="red" />
            </div>

            {/* Chart (reward events over time) */}
            {rewardEvents.length > 0 && (
                <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-4">Eventos de Recompensa</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={rewardEvents}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis dataKey="idx" tick={{ fontSize: 11 }} stroke="#52525b" />
                            <YAxis dataKey="block" tick={{ fontSize: 11 }} stroke="#52525b" />
                            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                            <Area type="monotone" dataKey="block" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Timeline */}
            <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Historial de Actividad</h3>
                {(timeline ?? []).length === 0 ? (
                    <p className="text-zinc-600 text-sm">Sin actividad registrada para este validador.</p>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {(timeline ?? []).map((ev, i) => (
                            <div key={`${ev.tx_hash}-${i}`} className="flex items-start gap-3 text-sm border-b border-zinc-800/40 pb-3 last:border-0">
                                <span className="mt-1.5 w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-200 font-medium">{ev.event_name}</span>
                                        <span className="text-zinc-600 text-xs">Block #{ev.block_number}</span>
                                    </div>
                                    <p className="text-zinc-500 text-xs mt-0.5">{fmtDate(ev.created_at)}</p>
                                    {ev.tx_hash && (
                                        <p className="text-zinc-600 text-xs font-mono truncate mt-0.5">{ev.tx_hash}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
