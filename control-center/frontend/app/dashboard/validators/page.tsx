'use client';

import { useState, useMemo } from 'react';
import {
    Shield, Users, Activity, Heart, AlertTriangle,
    ChevronRight, ArrowUpDown, Search, Award, Wallet,
    RefreshCw, Plus, Zap, CheckCircle,
} from 'lucide-react';
import ValidatorTierBadge from '@/components/ValidatorTierBadge';
import {
    useValidators,
    useValidatorProfile,
    useValidatorStats,
    useValidatorTimeline,
} from '@/lib/hooks';
import { useWalletConnection } from '@/lib/wallet-hooks';
import {
    useValidatorRegistryOnChain,
    useValidatorOnChain,
    useRegisterValidator,
    useAddStake,
    useHeartbeat,
    useSequencerOnChain,
} from '@/lib/validator-hooks';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import LockScreen from '@/components/LockScreen';

/* ── Helpers ── */
function shortAddr(a: string) {
    return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '-';
}
function fmtNum(n: number | undefined, decimals = 0) {
    if (n === undefined || n === null) return '-';
    return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}
function fmtDate(d: string | null) {
    if (!d) return 'Never';
    return new Date(d).toLocaleString();
}
function pct(n: number | undefined) {
    if (n === undefined || n === null) return '-';
    return `${n.toFixed(1)}%`;
}

/* ── Small stat card ── */
function StatCard({ label, value, icon: Icon, color = 'cyan' }: {
    label: string; value: string | number; icon: React.ElementType; color?: string;
}) {
    return (
        <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${color}-900/30`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
            </div>
            <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-zinc-100">{String(value)}</p>
            </div>
        </div>
    );
}

/* ── Tier distribution bar ── */
function TierBar({ dist }: { dist: { platinum: number; gold: number; silver: number; bronze: number } }) {
    const total = dist.platinum + dist.gold + dist.silver + dist.bronze || 1;
    const segs = [
        { count: dist.platinum, color: 'bg-cyan-500', label: 'Platinum' },
        { count: dist.gold, color: 'bg-yellow-500', label: 'Gold' },
        { count: dist.silver, color: 'bg-gray-400', label: 'Silver' },
        { count: dist.bronze, color: 'bg-orange-500', label: 'Bronze' },
    ];
    return (
        <div className="space-y-2">
            <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800">
                {segs.map(s => s.count > 0 && (
                    <div key={s.label} className={`${s.color}`} style={{ width: `${(s.count / total) * 100}%` }} />
                ))}
            </div>
            <div className="flex gap-4 text-xs text-zinc-400">
                {segs.map(s => (
                    <span key={s.label} className="flex items-center gap-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${s.color}`} />
                        {s.label}: {s.count}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ── Detail drawer (right panel) ── */
function ValidatorDetail({ address, onClose }: { address: string; onClose: () => void }) {
    const { user } = useAuth() as any;
    const isGuest = !user;

    const { data: realProfile, isLoading: profileLoading } = useValidatorProfile(isGuest ? null : address);
    const { data: realTimeline } = useValidatorTimeline(isGuest ? null : address, 15);

    const mockProfiles: Record<string, any> = {
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC': { company_name: 'BZ Node Alpha', tier: 'platinum', staked_bez: 150000, boost_pct: 100, contribution_points: 9820, uptime_pct: 99.9, is_active: true, is_sequencer_eligible: true, total_rewards_bez: 1450.25, last_heartbeat: new Date().toISOString() },
        '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65': { company_name: 'BZ Node Beta', tier: 'gold', staked_bez: 85000, boost_pct: 50, contribution_points: 6450, uptime_pct: 99.4, is_active: true, is_sequencer_eligible: true, total_rewards_bez: 780.40, last_heartbeat: new Date(Date.now() - 60000).toISOString() },
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906': { company_name: 'Investor Node Gamma', tier: 'silver', staked_bez: 45000, boost_pct: 25, contribution_points: 3200, uptime_pct: 98.1, is_active: true, is_sequencer_eligible: false, total_rewards_bez: 320.10, last_heartbeat: new Date(Date.now() - 300000).toISOString() },
        '0x25d34AAf54267DB7D7c367839AAf71A00a2C6238': { company_name: 'Validator Testnet', tier: 'bronze', staked_bez: 15000, boost_pct: 0, contribution_points: 1200, uptime_pct: 95.7, is_active: false, is_sequencer_eligible: false, total_rewards_bez: 0, last_heartbeat: null }
    };

    const mockTimeline = [
        { event_name: 'Heartbeat Sent', block_number: 124502, created_at: new Date().toISOString(), tx_hash: '0xmock1' },
        { event_name: 'Staked BEZ', block_number: 124000, created_at: new Date(Date.now() - 3600000).toISOString(), tx_hash: '0xmock2' },
        { event_name: 'Registered', block_number: 120000, created_at: new Date(Date.now() - 86400000).toISOString(), tx_hash: '0xmock3' }
    ];

    const profile = isGuest ? mockProfiles[address] : realProfile;
    const timeline = isGuest ? mockTimeline : realTimeline;
    const isLoading = isGuest ? false : profileLoading;

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-8 bg-zinc-800 rounded w-2/3" />
                <div className="h-4 bg-zinc-800 rounded w-full" />
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
            </div>
        );
    }

    if (!profile) {
        return <p className="text-zinc-500 text-sm">No se pudo cargar el perfil del validador.</p>;
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-zinc-500 font-mono">{address}</p>
                    <h3 className="text-lg font-bold text-zinc-100 mt-1">{profile.company_name || 'Validador'}</h3>
                </div>
                <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-sm">Cerrar</button>
            </div>

            {/* Tier + Status */}
            <div className="flex items-center gap-3">
                <ValidatorTierBadge tier={profile.tier} size="md" />
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${profile.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                    {profile.is_active ? 'Activo' : 'Inactivo'}
                </span>
                {profile.is_sequencer_eligible && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-purple-900/40 text-purple-300 font-medium">Secuenciador</span>
                )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-500 text-xs">Stake</p>
                    <p className="text-zinc-100 font-semibold">{fmtNum(profile.staked_bez)} BEZ</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-500 text-xs">Boost</p>
                    <p className="text-zinc-100 font-semibold">+{pct(profile.boost_pct)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-500 text-xs">Puntos</p>
                    <p className="text-zinc-100 font-semibold">{fmtNum(profile.contribution_points)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-500 text-xs">Uptime</p>
                    <p className="text-zinc-100 font-semibold">{pct(profile.uptime_pct)}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-500 text-xs">Recompensas</p>
                    <p className="text-zinc-100 font-semibold">{fmtNum(profile.total_rewards_bez, 2)} BEZ</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                    <p className="text-zinc-500 text-xs">Ultimo Heartbeat</p>
                    <p className="text-zinc-100 font-semibold text-xs">{fmtDate(profile.last_heartbeat)}</p>
                </div>
            </div>

            {/* Timeline */}
            <div>
                <h4 className="text-sm font-semibold text-zinc-300 mb-2">Actividad reciente</h4>
                {timeline && timeline.length > 0 ? (
                    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {timeline.map((ev, i) => (
                            <li key={`${ev.tx_hash}-${i}`} className="flex items-start gap-2 text-xs">
                                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                                <div className="min-w-0">
                                    <span className="text-zinc-300 font-medium">{ev.event_name}</span>
                                    <span className="text-zinc-600 ml-2">Block #{ev.block_number}</span>
                                    <p className="text-zinc-500 truncate">{fmtDate(ev.created_at)}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-zinc-600 text-xs">Sin actividad registrada.</p>
                )}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════ MAIN PAGE ══════════════════════════════════════════ */
export default function ValidatorsPage() {
    const { user, openLoginModal } = useAuth() as any;
    const isGuest = !user;

    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('stake');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [regCompanyName, setRegCompanyName] = useState('');
    const [regStakeAmount, setRegStakeAmount] = useState('');

    // API hooks
    const { data: realList, isLoading: realListLoading } = useValidators(isGuest ? 'null' : statusFilter, sortBy);
    const { data: realStats } = useValidatorStats();

    // Web3 hooks (on-chain)
    const wallet = useWalletConnection();
    const { stats: realRegistryOnChain, refetch: refetchRegistry } = useValidatorRegistryOnChain();
    const { status: sequencerStatus } = useSequencerOnChain();
    const registerValidator = useRegisterValidator(wallet.signer);
    const heartbeat = useHeartbeat(wallet.signer);
    const addStake = useAddStake(wallet.signer);

    // Mock data for guests
    const mockValidators = useMemo(() => [
        { operator: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', company_name: 'BZ Node Alpha', tier: 'platinum', staked_bez: 150000, contribution_points: 9820, uptime_pct: 99.9, is_active: true },
        { operator: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', company_name: 'BZ Node Beta', tier: 'gold', staked_bez: 85000, contribution_points: 6450, uptime_pct: 99.4, is_active: true },
        { operator: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', company_name: 'Investor Node Gamma', tier: 'silver', staked_bez: 45000, contribution_points: 3200, uptime_pct: 98.1, is_active: true },
        { operator: '0x25d34AAf54267DB7D7c367839AAf71A00a2C6238', company_name: 'Validator Testnet', tier: 'bronze', staked_bez: 15000, contribution_points: 1200, uptime_pct: 95.7, is_active: false }
    ], []);

    const list = isGuest ? {
        validators: mockValidators,
        tier_distribution: { platinum: 1, gold: 1, silver: 1, bronze: 1 },
        total: 4,
        total_staked: 295000
    } : realList;

    const listLoading = isGuest ? false : realListLoading;

    const stats = isGuest ? {
        total_validators: 4,
        sequencer_candidates: 2,
        events_24h: { heartbeats: 342, slashes: 0 }
    } : realStats;

    const registryOnChain = isGuest ? {
        totalValidators: '4',
        sequencerCandidates: ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'],
        totalStaked: '295000'
    } : realRegistryOnChain;

    /* filter by search locally */
    const filtered = (list?.validators ?? []).filter((v: any) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return v.operator.toLowerCase().includes(q) || (v.company_name ?? '').toLowerCase().includes(q);
    });

    // On-chain register handler
    const handleRegister = async () => {
        if (isGuest) { openLoginModal(); return; }
        if (!wallet.connected) { wallet.connect(); return; }
        const tx = await registerValidator.register(regCompanyName, regStakeAmount);
        if (tx) {
            toast.success(`✅ Validador registrado on-chain: ${tx.slice(0, 12)}...`);
            refetchRegistry();
            setShowRegisterForm(false);
            setRegCompanyName('');
            setRegStakeAmount('');
        } else if (registerValidator.error) {
            toast.error(registerValidator.error);
        }
    };

    // Heartbeat handler
    const handleHeartbeat = async () => {
        if (isGuest) { openLoginModal(); return; }
        if (!wallet.connected) { wallet.connect(); return; }
        const tx = await heartbeat.sendHeartbeat();
        if (tx) toast.success('💓 Heartbeat enviado on-chain');
        else if (heartbeat.error) toast.error(heartbeat.error);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
            {/* Title */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="w-6 h-6 text-cyan-400" /> Gestion de Validadores
                    </h1>
                    <p className="text-zinc-500 text-sm mt-1">Sistema de validadores, tiers y recompensas de BeZhas L2</p>
                </div>
                <div className="flex items-center gap-2">
                    {wallet.connected && (
                        <button
                            onClick={handleHeartbeat}
                            disabled={heartbeat.sending}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-900/40 border border-emerald-800/60 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-900/60 transition disabled:opacity-50"
                        >
                            {heartbeat.sending ? <RefreshCw size={14} className="animate-spin" /> : <Heart size={14} />}
                            Heartbeat
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (isGuest) {
                                openLoginModal();
                            } else if (wallet.connected) {
                                setShowRegisterForm(!showRegisterForm);
                            } else {
                                wallet.connect();
                            }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-cyan-900/40 border border-cyan-800/60 text-cyan-400 rounded-lg text-xs font-bold hover:bg-cyan-900/60 transition"
                    >
                        {isGuest ? <Plus size={14} /> : (wallet.connected ? <Plus size={14} /> : <Wallet size={14} />)}
                        {isGuest ? 'Registrar Validador' : (wallet.connected ? 'Registrar Validador' : 'Conectar Wallet')}
                    </button>
                </div>
            </div>

            {/* Sequencer Status Banner */}
            {sequencerStatus?.isPaused && (
                <div className="flex items-center gap-3 bg-amber-900/30 border border-amber-800/40 rounded-xl p-3 text-amber-300 text-sm">
                    <AlertTriangle size={16} />
                    <span className="font-bold">Sequencer L2 pausado por IA</span>
                    <span className="text-amber-500">{sequencerStatus.pauseReason}</span>
                </div>
            )}

            {/* Register Form */}
            {showRegisterForm && (
                <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-zinc-300">Registrar Nuevo Validador (On-Chain)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            type="text" value={regCompanyName} onChange={e => setRegCompanyName(e.target.value)}
                            placeholder="Nombre de empresa" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
                        />
                        <input
                            type="text" value={regStakeAmount} onChange={e => setRegStakeAmount(e.target.value)}
                            placeholder="Stake (min 10,000 BEZ)" className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600"
                        />
                        <button
                            onClick={handleRegister} disabled={registerValidator.registering || !regCompanyName || !regStakeAmount}
                            className="flex items-center justify-center gap-2 bg-cyan-600 text-white rounded-lg px-4 py-2 text-sm font-bold hover:bg-cyan-500 transition disabled:opacity-50"
                        >
                            {registerValidator.registering ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                            Registrar On-Chain
                        </button>
                    </div>
                    {registerValidator.txHash && (
                        <p className="text-xs text-cyan-400">TX: {registerValidator.txHash.slice(0, 20)}...</p>
                    )}
                    {registerValidator.error && (
                        <p className="text-xs text-red-400">{registerValidator.error}</p>
                    )}
                </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Validadores" value={registryOnChain?.totalValidators ?? stats?.total_validators ?? '-'} icon={Users} color="cyan" />
                <StatCard label="Candidatos Secuenciador" value={registryOnChain?.sequencerCandidates?.length ?? stats?.sequencer_candidates ?? '-'} icon={Award} color="purple" />
                <StatCard label="Heartbeats 24h" value={stats?.events_24h?.heartbeats ?? '-'} icon={Heart} color="emerald" />
                <StatCard label="Total Staked" value={registryOnChain ? `${parseFloat(registryOnChain.totalStaked).toLocaleString()} BEZ` : (stats?.events_24h?.slashes ?? '-')} icon={Zap} color="amber" />
            </div>

            {/* Tier distribution */}
            {list?.tier_distribution && (
                <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-zinc-300 mb-3">Distribucion por Tier</h3>
                    <TierBar dist={list.tier_distribution} />
                </div>
            )}

            {/* Two-column layout: list + detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Validator list */}
                <div className={`${selected ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-3`}>
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Buscar por address o nombre..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-cyan-700"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-cyan-700"
                        >
                            <option value="all">Todos</option>
                            <option value="active">Activos</option>
                            <option value="inactive">Inactivos</option>
                        </select>
                        <button
                            onClick={() => setSortBy(s => s === 'stake' ? 'points' : 'stake')}
                            className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            {sortBy === 'stake' ? 'Stake' : 'Puntos'}
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl overflow-hidden">
                        {listLoading ? (
                            <div className="p-8 text-center text-zinc-600 animate-pulse">Cargando validadores...</div>
                        ) : filtered.length === 0 ? (
                            <div className="p-8 text-center text-zinc-600">
                                {list?.total === 0
                                    ? 'No hay validadores registrados en el contrato.'
                                    : 'Sin resultados para el filtro actual.'}
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="border-b border-zinc-800 text-xs text-zinc-500 uppercase">
                                    <tr>
                                        <th className="text-left px-4 py-3">Validador</th>
                                        <th className="text-left px-4 py-3">Tier</th>
                                        <th className="text-right px-4 py-3">Stake (BEZ)</th>
                                        <th className="text-right px-4 py-3 hidden md:table-cell">Puntos</th>
                                        <th className="text-right px-4 py-3 hidden md:table-cell">Uptime</th>
                                        <th className="text-center px-4 py-3">Estado</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((v: any) => (
                                        <tr
                                            key={v.operator}
                                            onClick={() => setSelected(v.operator)}
                                            className={`border-b border-zinc-800/40 cursor-pointer hover:bg-zinc-800/40 transition ${selected === v.operator ? 'bg-zinc-800/60' : ''}`}
                                        >
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-zinc-200">{v.company_name || shortAddr(v.operator)}</p>
                                                <p className="text-xs text-zinc-600 font-mono">{shortAddr(v.operator)}</p>
                                            </td>
                                            <td className="px-4 py-3"><ValidatorTierBadge tier={v.tier} /></td>
                                            <td className="px-4 py-3 text-right font-mono text-zinc-300">{fmtNum(v.staked_bez)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-zinc-400 hidden md:table-cell">{fmtNum(v.contribution_points)}</td>
                                            <td className="px-4 py-3 text-right text-zinc-400 hidden md:table-cell">{pct(v.uptime_pct)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <Activity className={`w-4 h-4 inline ${v.is_active ? 'text-emerald-400' : 'text-red-500'}`} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <ChevronRight className="w-4 h-4 text-zinc-600" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <p className="text-xs text-zinc-600 text-right">
                        {filtered.length} de {list?.total ?? 0} validadores
                        {list?.total_staked ? ` | Total staked: ${fmtNum(list.total_staked)} BEZ` : ''}
                    </p>
                </div>

                {/* Detail panel */}
                {selected && (
                    <div className="bg-zinc-900/70 border border-zinc-800/60 rounded-xl p-5 lg:col-span-1 self-start sticky top-6">
                        <ValidatorDetail address={selected} onClose={() => setSelected(null)} />
                    </div>
                )}
            </div>
        </div>
    );
}
