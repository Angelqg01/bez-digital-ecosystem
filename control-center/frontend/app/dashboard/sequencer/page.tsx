'use client';

import {
    ArrowLeft, Clock, Layers, Zap, Users, RotateCcw, Activity,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ValidatorTierBadge from '@/components/ValidatorTierBadge';
import { useSequencerStatus, useValidators } from '@/lib/hooks';

function shortAddr(a: string) {
    return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '-';
}
function fmtNum(n: number | undefined, d = 0) {
    if (n === undefined || n === null) return '-';
    return n.toLocaleString('en-US', { maximumFractionDigits: d });
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

export default function SequencerPage() {
    const router = useRouter();
    const { data: seq, isLoading } = useSequencerStatus();
    const { data: valList } = useValidators('active', 'tier');

    const candidates = (valList?.validators ?? []).filter(v => v.is_sequencer_eligible);
    const blocksRemaining = seq ? Math.max(0, seq.epoch_length - seq.blocks_produced) : null;
    const epochProgress = seq ? Math.min(100, (seq.blocks_produced / seq.epoch_length) * 100) : 0;

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

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            <div>
                <button onClick={() => router.push('/dashboard/validators')}
                    className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Validadores
                </button>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <RotateCcw className="w-6 h-6 text-purple-400" /> Estado del Sequencer
                </h1>
                <p className="text-zinc-500 text-sm mt-1">Rotación de sequencer, epochs y cola de candidatos</p>
            </div>

            {!seq ? (
                <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-8 text-center text-zinc-500">
                    Contrato SequencerRotation no disponible.
                </div>
            ) : (
                <>
                    {/* Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Metric label="Epoch Actual" value={`#${seq.epoch_number}`} icon={Layers} color="purple" />
                        <Metric label="Bloques Producidos" value={fmtNum(seq.blocks_produced)} icon={Activity} color="cyan" />
                        <Metric label="Bloques Restantes" value={blocksRemaining !== null ? fmtNum(blocksRemaining) : '-'} icon={Clock} color="amber" />
                        <Metric label="Cola de Candidatos" value={seq.queue_length} icon={Users} color="emerald" />
                    </div>

                    {/* Epoch progress bar */}
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-400">Progreso del Epoch</span>
                            <span className="text-zinc-300 font-mono">{epochProgress.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-600 to-cyan-500 rounded-full transition-all duration-500"
                                style={{ width: `${epochProgress}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-zinc-600">
                            <span>Block {fmtNum(seq.epoch_start_block)}</span>
                            <span>Epoch length: {fmtNum(seq.epoch_length)} bloques</span>
                        </div>
                    </div>

                    {/* Current sequencer info */}
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 space-y-3">
                        <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" /> Sequencer Actual
                        </h2>
                        <p className="text-lg font-mono text-cyan-300">{seq.current_sequencer || 'Sin sequencer asignado'}</p>
                        {seq.sequencer_stats && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-zinc-500 text-xs">Epochs servidos</p>
                                    <p className="text-zinc-100 font-semibold">{fmtNum(seq.sequencer_stats.epochs_served)}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-zinc-500 text-xs">Total bloques</p>
                                    <p className="text-zinc-100 font-semibold">{fmtNum(seq.sequencer_stats.total_blocks)}</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-zinc-500 text-xs">Fees acumulados</p>
                                    <p className="text-zinc-100 font-semibold text-xs font-mono">{seq.sequencer_stats.total_fees_wei} wei</p>
                                </div>
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <p className="text-zinc-500 text-xs">Ultimo Epoch</p>
                                    <p className="text-zinc-100 font-semibold">#{fmtNum(seq.sequencer_stats.last_epoch)}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Candidate queue */}
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 space-y-3">
                        <h2 className="text-sm font-semibold text-zinc-300">Cola de Candidatos (Gold + Platinum)</h2>
                        {candidates.length === 0 ? (
                            <p className="text-zinc-600 text-sm">No hay candidatos elegibles en la cola.</p>
                        ) : (
                            <div className="overflow-hidden rounded-lg border border-zinc-800">
                                <table className="w-full text-sm">
                                    <thead className="bg-zinc-800/60 text-xs text-zinc-500 uppercase">
                                        <tr>
                                            <th className="text-left px-4 py-2">#</th>
                                            <th className="text-left px-4 py-2">Validador</th>
                                            <th className="text-left px-4 py-2">Tier</th>
                                            <th className="text-right px-4 py-2">Stake</th>
                                            <th className="text-right px-4 py-2">Uptime</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {candidates.map((c, i) => (
                                            <tr key={c.operator} className="border-t border-zinc-800/40 hover:bg-zinc-800/30 cursor-pointer"
                                                onClick={() => router.push(`/dashboard/validators/${c.operator}`)}>
                                                <td className="px-4 py-2 text-zinc-500">{i + 1}</td>
                                                <td className="px-4 py-2">
                                                    <p className="text-zinc-200 font-medium">{c.company_name || shortAddr(c.operator)}</p>
                                                    <p className="text-xs text-zinc-600 font-mono">{shortAddr(c.operator)}</p>
                                                </td>
                                                <td className="px-4 py-2"><ValidatorTierBadge tier={c.tier} /></td>
                                                <td className="px-4 py-2 text-right font-mono text-zinc-300">{fmtNum(c.staked_bez)} BEZ</td>
                                                <td className="px-4 py-2 text-right text-zinc-400">{c.uptime_pct?.toFixed(1) ?? '-'}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
